import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { AppSettings, CLIPaths } from '../types';

const execAsync = promisify(exec);

// Shared config file path that MCP can read
const CLI_PATHS_CONFIG_FILE = path.join(os.homedir(), '.dorothy', 'cli-paths.json');

export interface CLIPathsHandlerDependencies {
  getAppSettings: () => AppSettings;
  setAppSettings: (settings: AppSettings) => void;
  saveAppSettings: (settings: AppSettings) => void;
}

/**
 * Detect CLI paths from the system
 */
async function detectCLIPaths(): Promise<{ claude: string; gh: string; node: string }> {
  const homeDir = os.homedir();
  const paths = { claude: '', gh: '', node: '' };

  // Common locations to check
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
      // Ignore errors
    }
  }

  // Check for claude
  for (const dir of commonPaths) {
    const claudePath = path.join(dir, 'claude');
    if (fs.existsSync(claudePath)) {
      paths.claude = claudePath;
      break;
    }
  }

  // Try which command for claude
  if (!paths.claude) {
    try {
      const { stdout } = await execAsync('which claude', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.claude = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for gh
  for (const dir of ['/opt/homebrew/bin', '/usr/local/bin']) {
    const ghPath = path.join(dir, 'gh');
    if (fs.existsSync(ghPath)) {
      paths.gh = ghPath;
      break;
    }
  }

  // Try which command for gh
  if (!paths.gh) {
    try {
      const { stdout } = await execAsync('which gh', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.gh = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for node
  for (const dir of commonPaths) {
    const nodePath = path.join(dir, 'node');
    if (fs.existsSync(nodePath)) {
      paths.node = nodePath;
      break;
    }
  }

  // Try which command for node
  if (!paths.node) {
    try {
      const { stdout } = await execAsync('which node', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.node = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  return paths;
}

/**
 * Save CLI paths to the shared config file that MCP can read
 */
function saveCLIPathsConfig(paths: CLIPaths): void {
  const configDir = path.dirname(CLI_PATHS_CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Build full PATH string from configured paths
  const homeDir = os.homedir();
  const defaultPaths = [
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
        defaultPaths.push(path.join(nvmDir, version, 'bin'));
      }
    } catch {
      // Ignore
    }
  }

  // Combine all paths
  const allPaths = [...new Set([
    ...paths.additionalPaths,
    ...defaultPaths,
    ...(process.env.PATH || '').split(':'),
  ])];

  const config = {
    ...paths,
    fullPath: allPaths.join(':'),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CLI_PATHS_CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Load CLI paths config from file
 */
function loadCLIPathsConfig(): CLIPaths | null {
  try {
    if (fs.existsSync(CLI_PATHS_CONFIG_FILE)) {
      const content = fs.readFileSync(CLI_PATHS_CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Register CLI paths IPC handlers
 */
export function registerCLIPathsHandlers(deps: CLIPathsHandlerDependencies): void {
  const { getAppSettings, setAppSettings, saveAppSettings } = deps;

  // Detect CLI paths
  ipcMain.handle('cliPaths:detect', async () => {
    return detectCLIPaths();
  });

  // Get CLI paths from app settings
  ipcMain.handle('cliPaths:get', async () => {
    const settings = getAppSettings();
    return settings.cliPaths || { claude: '', gh: '', node: '', additionalPaths: [] };
  });

  // Save CLI paths
  ipcMain.handle('cliPaths:save', async (_event, paths: CLIPaths) => {
    try {
      const settings = getAppSettings();
      const updatedSettings = { ...settings, cliPaths: paths };
      setAppSettings(updatedSettings);
      saveAppSettings(updatedSettings);

      // Also save to shared config file for MCP
      saveCLIPathsConfig(paths);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

/**
 * Get CLI paths config for use by other parts of the app
 */
export function getCLIPathsConfig(): CLIPaths & { fullPath: string } {
  const config = loadCLIPathsConfig();
  if (config) {
    return config as CLIPaths & { fullPath: string };
  }

  // Return defaults
  const homeDir = os.homedir();
  const defaultPaths = [
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
        defaultPaths.push(path.join(nvmDir, version, 'bin'));
      }
    } catch {
      // Ignore
    }
  }

  return {
    claude: '',
    gh: '',
    node: '',
    additionalPaths: [],
    fullPath: [...new Set([...defaultPaths, ...(process.env.PATH || '').split(':')])].join(':'),
  };
}

/**
 * Get the full PATH string including configured and default paths
 */
export function getFullPath(): string {
  const config = getCLIPathsConfig();
  return config.fullPath;
}
