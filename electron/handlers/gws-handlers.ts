import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { buildFullPath } from '../utils/path-builder';
import type { AppSettings } from '../types';
import { findInDirs, whichBinary } from '../utils/shell';

const execAsync = promisify(exec);

// Scope patterns → friendly service names
const SCOPE_SERVICE_MAP: Record<string, string> = {
  gmail: 'gmail',
  drive: 'drive',
  spreadsheets: 'sheets',
  calendar: 'calendar',
  documents: 'docs',
  presentations: 'slides',
  tasks: 'tasks',
  chat: 'chat',
  contacts: 'people',
  people: 'people',
  forms: 'forms',
  keep: 'keep',
};

export type ServiceAccess = 'none' | 'read' | 'write';

export interface GwsAuthStatus {
  authenticated: boolean;
  user: string | null;
  tokenValid: boolean;
  scopes: string[];
  authMethod: string;
  services: Record<string, ServiceAccess>;
}

export interface GwsHandlerDependencies {
  getAppSettings: () => AppSettings;
  setAppSettings: (settings: AppSettings) => void;
  saveAppSettings: (settings: AppSettings) => void;
}

function deriveServicesFromScopes(scopes: string[]): Record<string, ServiceAccess> {
  const services: Record<string, ServiceAccess> = {
    gmail: 'none',
    drive: 'none',
    sheets: 'none',
    calendar: 'none',
    docs: 'none',
    slides: 'none',
    tasks: 'none',
    chat: 'none',
    people: 'none',
    forms: 'none',
    keep: 'none',
  };

  for (const scope of scopes) {
    const lower = scope.toLowerCase();
    const isReadonly = lower.includes('readonly');
    for (const [pattern, serviceName] of Object.entries(SCOPE_SERVICE_MAP)) {
      if (lower.includes(pattern)) {
        // Write access upgrades read; never downgrade write to read
        if (services[serviceName] === 'none') {
          services[serviceName] = isReadonly ? 'read' : 'write';
        } else if (services[serviceName] === 'read' && !isReadonly) {
          services[serviceName] = 'write';
        }
      }
    }
  }

  return services;
}

async function findGwsBinary(): Promise<string> {
  const homeDir = os.homedir();
  const commonPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(homeDir, '.local/bin'),
  ];

  // Add nvm paths
  const nvmDir = path.join(homeDir, '.nvm/versions/node');
  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir);
      for (const version of versions) {
        commonPaths.push(path.join(nvmDir, version, 'bin'));
      }
    } catch {
      // Ignore
    }
  }

  if (process.platform === 'win32' && process.env.APPDATA) {
    commonPaths.push(path.join(process.env.APPDATA, 'npm'));
  }

  return findInDirs('gws', commonPaths) || whichBinary('gws', commonPaths);
}

async function findGcloudBinary(): Promise<string> {
  const homeDir = os.homedir();
  const commonPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(homeDir, '.local/bin'),
    // Homebrew google-cloud-sdk puts gcloud here
    '/opt/homebrew/share/google-cloud-sdk/bin',
    '/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin',
    path.join(homeDir, 'google-cloud-sdk/bin'),
  ];

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    commonPaths.push(path.join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin'));
  }

  return findInDirs('gcloud', commonPaths) || whichBinary('gcloud', [...commonPaths, ...buildFullPath().split(path.delimiter)]);
}

export function registerGwsHandlers(deps: GwsHandlerDependencies): void {
  const { getAppSettings, setAppSettings, saveAppSettings } = deps;

  // Detect gws binary
  ipcMain.handle('gws:detect', async () => {
    return findGwsBinary();
  });

  // Detect gcloud binary
  ipcMain.handle('gws:detectGcloud', async () => {
    return findGcloudBinary();
  });

  // Get auth status from gws CLI
  ipcMain.handle('gws:authStatus', async () => {
    const result: GwsAuthStatus = {
      authenticated: false,
      user: null,
      tokenValid: false,
      scopes: [],
      authMethod: 'none',
      services: deriveServicesFromScopes([]),
    };

    try {
      const gwsPath = await findGwsBinary();
      if (!gwsPath) return result;

      // Include gcloud's directory in PATH so gws can find it
      const gcloudPath = await findGcloudBinary();
      const gcloudDir = gcloudPath ? path.dirname(gcloudPath) : '';
      const fullPath = [gcloudDir, buildFullPath()].filter(Boolean).join(path.delimiter);

      const { stdout } = await execAsync(`"${gwsPath}" auth status --json`, {
        env: { ...process.env, PATH: fullPath },
        timeout: 10000,
      });

      const data = JSON.parse(stdout.trim());
      // Real gws auth status output:
      // { user, token_valid, has_refresh_token, auth_method, scopes, scope_count, ... }
      result.authenticated = data.authenticated ?? data.has_refresh_token ?? data.token_valid ?? (data.status === 'success');
      result.user = data.user ?? data.account ?? data.email ?? null;
      result.tokenValid = data.token_valid ?? data.tokenValid ?? result.authenticated;
      result.scopes = data.scopes ?? [];
      result.authMethod = data.auth_method ?? data.authMethod ?? (result.authenticated ? 'oauth2' : 'none');
      result.services = deriveServicesFromScopes(result.scopes);
    } catch {
      // gws auth status failed — return defaults
    }

    return result;
  });

  // Register gws as MCP server with all providers
  // gws mcp -s <services> starts an MCP server over stdio
  // Each service adds 10-80 tools; keep under client tool limits (~50-100)
  const DEFAULT_MCP_SERVICES = 'drive,gmail,calendar,sheets,docs';

  ipcMain.handle('gws:setup', async (_event, services?: string) => {
    try {
      const gwsPath = await findGwsBinary();
      if (!gwsPath) {
        return { success: false, error: 'gws binary not found. Install it first.' };
      }

      const svc = services || DEFAULT_MCP_SERVICES;
      const { getAllProviders } = await import('../providers');
      const providers = getAllProviders();

      for (const provider of providers) {
        try {
          await provider.registerMcpServer('google-workspace', gwsPath, ['mcp', '-s', svc]);
        } catch (err) {
          console.error(`[${provider.id}] Failed to register gws MCP:`, err);
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Remove gws MCP from all providers
  ipcMain.handle('gws:remove', async () => {
    try {
      const { getAllProviders } = await import('../providers');
      const providers = getAllProviders();

      for (const provider of providers) {
        try {
          await provider.removeMcpServer('google-workspace');
        } catch (err) {
          console.error(`[${provider.id}] Failed to remove gws MCP:`, err);
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Check if gws MCP is registered with at least one provider
  ipcMain.handle('gws:getMcpStatus', async () => {
    try {
      const gwsPath = await findGwsBinary();
      const { getAllProviders } = await import('../providers');
      const providers = getAllProviders();

      let configured = false;
      for (const provider of providers) {
        try {
          if (provider.isMcpServerRegistered('google-workspace', gwsPath || '')) {
            configured = true;
            break;
          }
        } catch {
          // Skip provider on error
        }
      }

      return { configured };
    } catch (err) {
      return { configured: false, error: String(err) };
    }
  });

  // List installed gws skills across all providers
  ipcMain.handle('gws:listSkills', async () => {
    try {
      const { getAllProviders } = await import('../providers');
      const providers = getAllProviders();

      const skills = new Set<string>();
      for (const provider of providers) {
        try {
          for (const skill of provider.getInstalledSkills()) {
            if (skill.startsWith('gws-')) {
              skills.add(skill);
            }
          }
        } catch {
          // Skip provider on error
        }
      }

      return Array.from(skills).sort();
    } catch {
      return [];
    }
  });
}
