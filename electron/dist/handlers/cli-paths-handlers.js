"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFullPath = exports.getCLIPathsConfig = exports.registerCLIPathsHandlers = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Shared config file path that MCP can read
const CLI_PATHS_CONFIG_FILE = path.join(os.homedir(), '.claude-manager', 'cli-paths.json');
/**
 * Detect CLI paths from the system
 */
async function detectCLIPaths() {
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
        }
        catch {
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
        }
        catch {
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
        }
        catch {
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
        }
        catch {
            // Ignore
        }
    }
    return paths;
}
/**
 * Save CLI paths to the shared config file that MCP can read
 */
function saveCLIPathsConfig(paths) {
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
        }
        catch {
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
function loadCLIPathsConfig() {
    try {
        if (fs.existsSync(CLI_PATHS_CONFIG_FILE)) {
            const content = fs.readFileSync(CLI_PATHS_CONFIG_FILE, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch {
        // Ignore
    }
    return null;
}
/**
 * Register CLI paths IPC handlers
 */
function registerCLIPathsHandlers(deps) {
    const { getAppSettings, setAppSettings, saveAppSettings } = deps;
    // Detect CLI paths
    electron_1.ipcMain.handle('cliPaths:detect', async () => {
        return detectCLIPaths();
    });
    // Get CLI paths from app settings
    electron_1.ipcMain.handle('cliPaths:get', async () => {
        const settings = getAppSettings();
        return settings.cliPaths || { claude: '', gh: '', node: '', additionalPaths: [] };
    });
    // Save CLI paths
    electron_1.ipcMain.handle('cliPaths:save', async (_event, paths) => {
        try {
            const settings = getAppSettings();
            const updatedSettings = { ...settings, cliPaths: paths };
            setAppSettings(updatedSettings);
            saveAppSettings(updatedSettings);
            // Also save to shared config file for MCP
            saveCLIPathsConfig(paths);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    });
}
exports.registerCLIPathsHandlers = registerCLIPathsHandlers;
/**
 * Get CLI paths config for use by other parts of the app
 */
function getCLIPathsConfig() {
    const config = loadCLIPathsConfig();
    if (config) {
        return config;
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
        }
        catch {
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
exports.getCLIPathsConfig = getCLIPathsConfig;
/**
 * Get the full PATH string including configured and default paths
 */
function getFullPath() {
    const config = getCLIPathsConfig();
    return config.fullPath;
}
exports.getFullPath = getFullPath;
//# sourceMappingURL=cli-paths-handlers.js.map