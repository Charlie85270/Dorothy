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
 * Detect CLI paths from the system.
 * If savedPaths is provided, manually-set paths are checked first and used if the binary exists.
 */
async function detectCLIPaths(savedPaths?: Partial<CLIPaths>): Promise<{ claude: string; codex: string; gemini: string; opencode: string; pi: string; gws: string; gcloud: string; gh: string; node: string }> {
  const homeDir = os.homedir();
  const paths = { claude: '', codex: '', gemini: '', opencode: '', pi: '', gws: '', gcloud: '', gh: '', node: '' };

  // If a user manually set a path in settings, use it if the binary exists
  if (savedPaths) {
    const cliKeys = ['claude', 'codex', 'gemini', 'opencode', 'pi', 'gws', 'gcloud', 'gh', 'node'] as const;
    for (const key of cliKeys) {
      const savedPath = savedPaths[key];
      if (savedPath && fs.existsSync(savedPath)) {
        paths[key] = savedPath;
      }
    }
  }

  // Try to get the full interactive shell PATH (includes .zshrc/.bashrc paths)
  let shellPath = process.env.PATH || '';
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const { stdout } = await execAsync(`${shell} -ilc 'echo $PATH'`, { timeout: 5000 });
    if (stdout.trim()) {
      shellPath = stdout.trim();
    }
  } catch {
    // Fall back to process.env.PATH
  }

  // Common locations to check
  const commonPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(homeDir, '.local/bin'),
    path.join(homeDir, 'Library/pnpm'),   // pnpm global bin (macOS)
    path.join(homeDir, '.yarn/bin'),       // yarn global bin
  ];

  // Add directories from the shell PATH that aren't already included
  for (const dir of shellPath.split(':')) {
    if (dir && !commonPaths.includes(dir)) {
      commonPaths.push(dir);
    }
  }

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
  if (!paths.claude) for (const dir of commonPaths) {
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

  // Check for codex
  if (!paths.codex) for (const dir of commonPaths) {
    const codexPath = path.join(dir, 'codex');
    if (fs.existsSync(codexPath)) {
      paths.codex = codexPath;
      break;
    }
  }

  // Try which command for codex
  if (!paths.codex) {
    try {
      const { stdout } = await execAsync('which codex', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.codex = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for gemini
  if (!paths.gemini) for (const dir of commonPaths) {
    const geminiPath = path.join(dir, 'gemini');
    if (fs.existsSync(geminiPath)) {
      paths.gemini = geminiPath;
      break;
    }
  }

  // Try which command for gemini
  if (!paths.gemini) {
    try {
      const { stdout } = await execAsync('which gemini', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.gemini = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for opencode
  if (!paths.opencode) for (const dir of commonPaths) {
    const opencodePath = path.join(dir, 'opencode');
    if (fs.existsSync(opencodePath)) {
      paths.opencode = opencodePath;
      break;
    }
  }

  // Try which command for opencode
  if (!paths.opencode) {
    try {
      const { stdout } = await execAsync('which opencode', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.opencode = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for pi
  if (!paths.pi) for (const dir of commonPaths) {
    const piPath = path.join(dir, 'pi');
    if (fs.existsSync(piPath)) {
      paths.pi = piPath;
      break;
    }
  }

  // Try which command for pi
  if (!paths.pi) {
    try {
      const { stdout } = await execAsync('which pi', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.pi = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for gws
  if (!paths.gws) for (const dir of commonPaths) {
    const gwsPath = path.join(dir, 'gws');
    if (fs.existsSync(gwsPath)) {
      paths.gws = gwsPath;
      break;
    }
  }

  // Try which command for gws
  if (!paths.gws) {
    try {
      const { stdout } = await execAsync('which gws', {
        env: { ...process.env, PATH: `${commonPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.gws = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for gcloud (also check gcloud-specific install locations)
  const gcloudPaths = [
    ...commonPaths,
    '/opt/homebrew/share/google-cloud-sdk/bin',
    '/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin',
    path.join(homeDir, 'google-cloud-sdk/bin'),
  ];
  if (!paths.gcloud) for (const dir of gcloudPaths) {
    const gcloudPath = path.join(dir, 'gcloud');
    if (fs.existsSync(gcloudPath)) {
      paths.gcloud = gcloudPath;
      break;
    }
  }

  // Try which command for gcloud
  if (!paths.gcloud) {
    try {
      const { stdout } = await execAsync('which gcloud', {
        env: { ...process.env, PATH: `${gcloudPaths.join(':')}:${process.env.PATH}` },
      });
      if (stdout.trim()) {
        paths.gcloud = stdout.trim();
      }
    } catch {
      // Ignore
    }
  }

  // Check for gh
  if (!paths.gh) for (const dir of ['/opt/homebrew/bin', '/usr/local/bin']) {
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
  if (!paths.node) for (const dir of commonPaths) {
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
    path.join(homeDir, 'Library/pnpm'),
    path.join(homeDir, '.yarn/bin'),
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

  // Detect CLI paths (use saved settings as overrides if binary exists at saved path)
  ipcMain.handle('cliPaths:detect', async () => {
    const settings = getAppSettings();
    return detectCLIPaths(settings.cliPaths);
  });

  // Get CLI paths from app settings
  ipcMain.handle('cliPaths:get', async () => {
    const settings = getAppSettings();
    return settings.cliPaths || { claude: '', codex: '', gemini: '', opencode: '', pi: '', gws: '', gcloud: '', gh: '', node: '', additionalPaths: [] };
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
    path.join(homeDir, 'Library/pnpm'),
    path.join(homeDir, '.yarn/bin'),
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
    codex: '',
    gemini: '',
    opencode: '',
    pi: '',
    gws: '',
    gcloud: '',
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
