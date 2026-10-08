import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { AppSettings, CLIPaths } from '../types';
import { findInDirs, whichBinary } from '../utils/shell';

const execAsync = promisify(exec);

// Shared config file path that MCP can read
const CLI_PATHS_CONFIG_FILE = path.join(os.homedir(), '.dorothy', 'cli-paths.json');

export interface CLIPathsHandlerDependencies {
  getAppSettings: () => AppSettings;
  setAppSettings: (settings: AppSettings) => void;
  saveAppSettings: (settings: AppSettings) => void;
}

const isWindows = process.platform === 'win32';

/** Platform-specific default binary directories. */
function getDefaultBinDirs(homeDir: string): string[] {
  if (isWindows) {
    const dirs = [
      path.join(homeDir, '.local', 'bin'),   // Claude Code native installer
      path.join(homeDir, '.grok', 'bin'),    // Grok CLI default install dir
    ];
    if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));
    if (process.env.LOCALAPPDATA) {
      dirs.push(path.join(process.env.LOCALAPPDATA, 'pnpm'), path.join(process.env.LOCALAPPDATA, 'Volta', 'bin'));
    }
    if (process.env.NVM_SYMLINK) dirs.push(process.env.NVM_SYMLINK);
    if (process.env.ProgramFiles) {
      dirs.push(path.join(process.env.ProgramFiles, 'nodejs'), path.join(process.env.ProgramFiles, 'GitHub CLI'));
    }
    return dirs;
  }
  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(homeDir, '.local/bin'),
    path.join(homeDir, '.grok/bin'),       // Grok CLI default install dir
    path.join(homeDir, 'Library/pnpm'),   // pnpm global bin (macOS)
    path.join(homeDir, '.yarn/bin'),       // yarn global bin
  ];
}

/** nvm node version bin directories (macOS/Linux nvm layout). */
function getNvmBinDirs(homeDir: string): string[] {
  const nvmDir = path.join(homeDir, '.nvm/versions/node');
  if (!fs.existsSync(nvmDir)) return [];
  try {
    return fs.readdirSync(nvmDir).map((version) => path.join(nvmDir, version, 'bin'));
  } catch {
    return [];
  }
}

/**
 * Detect CLI paths from the system.
 * If savedPaths is provided, manually-set paths are checked first and used if the binary exists.
 */
async function detectCLIPaths(savedPaths?: Partial<CLIPaths>): Promise<{ claude: string; codex: string; gemini: string; grok: string; opencode: string; pi: string; gws: string; gcloud: string; gh: string; node: string }> {
  const homeDir = os.homedir();
  const paths = { claude: '', codex: '', gemini: '', grok: '', opencode: '', pi: '', gws: '', gcloud: '', gh: '', node: '' };

  // If a user manually set a path in settings, use it if the binary exists
  if (savedPaths) {
    const cliKeys = ['claude', 'codex', 'gemini', 'grok', 'opencode', 'pi', 'gws', 'gcloud', 'gh', 'node'] as const;
    for (const key of cliKeys) {
      const savedPath = savedPaths[key];
      if (savedPath && fs.existsSync(savedPath)) {
        paths[key] = savedPath;
      }
    }
  }

  // Try to get the full interactive shell PATH (includes .zshrc/.bashrc paths).
  // Skipped on Windows: Git Bash would return a POSIX-style PATH; process.env.PATH is authoritative there.
  let shellPath = process.env.PATH || '';
  if (!isWindows) {
    try {
      const shell = process.env.SHELL || '/bin/zsh';
      const { stdout } = await execAsync(`${shell} -ilc 'echo $PATH'`, { timeout: 5000 });
      if (stdout.trim()) {
        shellPath = stdout.trim();
      }
    } catch {
      // Fall back to process.env.PATH
    }
  }

  // Common locations to check
  const commonPaths = getDefaultBinDirs(homeDir);

  // Add directories from the shell PATH that aren't already included
  for (const dir of shellPath.split(path.delimiter)) {
    if (dir && !commonPaths.includes(dir)) {
      commonPaths.push(dir);
    }
  }

  // Add nvm paths
  commonPaths.push(...getNvmBinDirs(homeDir));

  for (const key of ['claude', 'codex', 'gemini', 'grok', 'opencode', 'pi', 'gws'] as const) {
    if (!paths[key]) paths[key] = findInDirs(key, commonPaths);
    if (!paths[key]) paths[key] = await whichBinary(key, commonPaths);
  }

  // Check for gcloud (also check gcloud-specific install locations)
  const gcloudPaths = [
    ...commonPaths,
    '/opt/homebrew/share/google-cloud-sdk/bin',
    '/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin',
    path.join(homeDir, 'google-cloud-sdk/bin'),
  ];
  if (isWindows && process.env.LOCALAPPDATA) {
    gcloudPaths.push(path.join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin'));
  }
  if (!paths.gcloud) paths.gcloud = findInDirs('gcloud', gcloudPaths);
  if (!paths.gcloud) paths.gcloud = await whichBinary('gcloud', gcloudPaths);

  // Check for gh
  const ghDirs = isWindows
    ? (process.env.ProgramFiles ? [path.join(process.env.ProgramFiles, 'GitHub CLI')] : [])
    : ['/opt/homebrew/bin', '/usr/local/bin'];
  if (!paths.gh) paths.gh = findInDirs('gh', ghDirs);
  if (!paths.gh) paths.gh = await whichBinary('gh', commonPaths);

  // Check for node
  if (!paths.node) paths.node = findInDirs('node', commonPaths);
  if (!paths.node) paths.node = await whichBinary('node', commonPaths);

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
    ...getDefaultBinDirs(homeDir).filter((dir) => !dir.endsWith(path.join('.grok', 'bin'))),
    ...getNvmBinDirs(homeDir),
  ];

  // Combine all paths
  const allPaths = [...new Set([
    ...paths.additionalPaths,
    ...defaultPaths,
    ...(process.env.PATH || '').split(path.delimiter),
  ])];

  const config = {
    ...paths,
    fullPath: allPaths.join(path.delimiter),
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
    return settings.cliPaths || { claude: '', codex: '', gemini: '', grok: '', opencode: '', pi: '', gws: '', gcloud: '', gh: '', node: '', additionalPaths: [] };
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
    ...getDefaultBinDirs(homeDir).filter((dir) => !dir.endsWith(path.join('.grok', 'bin'))),
    ...getNvmBinDirs(homeDir),
  ];

  return {
    claude: '',
    codex: '',
    gemini: '',
    grok: '',
    opencode: '',
    pi: '',
    gws: '',
    gcloud: '',
    gh: '',
    node: '',
    additionalPaths: [],
    fullPath: [...new Set([...defaultPaths, ...(process.env.PATH || '').split(path.delimiter)])].join(path.delimiter),
  };
}

/**
 * Get the full PATH string including configured and default paths
 */
export function getFullPath(): string {
  const config = getCLIPathsConfig();
  return config.fullPath;
}
