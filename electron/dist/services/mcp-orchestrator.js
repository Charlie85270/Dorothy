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
exports.registerMcpOrchestratorHandlers = exports.setupOrchestratorRemoveHandler = exports.setupOrchestratorSetupHandler = exports.setupOrchestratorStatusHandler = exports.setupMcpOrchestrator = exports.getMcpOrchestratorPath = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
/**
 * MCP Orchestrator Service
 *
 * Manages the setup, configuration, and lifecycle of the MCP orchestrator
 * which integrates with Claude's global configuration.
 */
// ============== Helper Functions ==============
/**
 * Get the path to the bundled MCP orchestrator
 * In production, MCP orchestrator is in extraResources
 * In development, it's in the project directory
 */
function getMcpOrchestratorPath() {
    // In production, MCP orchestrator is in extraResources
    if (electron_1.app.isPackaged) {
        return path.join(process.resourcesPath, 'mcp-orchestrator', 'dist', 'index.js');
    }
    // In development, it's in the project directory
    return path.join(__dirname, '..', 'mcp-orchestrator', 'dist', 'index.js');
}
exports.getMcpOrchestratorPath = getMcpOrchestratorPath;
/**
 * Auto-setup MCP orchestrator on app start using claude mcp add command
 * This function runs during app initialization to ensure the orchestrator is properly configured
 */
async function setupMcpOrchestrator() {
    try {
        const orchestratorPath = getMcpOrchestratorPath();
        // Check if orchestrator exists
        if (!fs.existsSync(orchestratorPath)) {
            console.log('MCP orchestrator not found at', orchestratorPath);
            return;
        }
        const claudeDir = path.join(os.homedir(), '.claude');
        const mcpConfigPath = path.join(claudeDir, 'mcp.json');
        // Check if current config path matches the expected path
        let needsUpdate = true;
        if (fs.existsSync(mcpConfigPath)) {
            try {
                const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
                const existingConfig = mcpConfig.mcpServers?.['claude-mgr-orchestrator'];
                if (existingConfig?.args?.[0] === orchestratorPath) {
                    console.log('MCP orchestrator already configured with correct path');
                    needsUpdate = false;
                }
                else if (existingConfig) {
                    console.log('MCP orchestrator path changed, updating...');
                    console.log('  Old path:', existingConfig.args?.[0]);
                    console.log('  New path:', orchestratorPath);
                }
            }
            catch {
                // Config parsing failed, will update
            }
        }
        if (!needsUpdate) {
            return;
        }
        // Remove existing config first (in case path changed)
        try {
            (0, child_process_1.execSync)('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
            console.log('Removed old MCP orchestrator config');
        }
        catch {
            // Ignore errors if it doesn't exist
        }
        // Add the MCP server using claude mcp add with -s user for global scope
        // Format: claude mcp add -s user <name> <command> [args...]
        const addCommand = `claude mcp add -s user claude-mgr-orchestrator node "${orchestratorPath}"`;
        console.log('Running:', addCommand);
        try {
            (0, child_process_1.execSync)(addCommand, { encoding: 'utf-8', stdio: 'pipe' });
            console.log('MCP orchestrator configured globally via claude mcp add -s user');
        }
        catch (addErr) {
            console.error('Failed to add MCP server via claude mcp add -s user:', addErr);
            // Fallback: also write to mcp.json for compatibility
            if (!fs.existsSync(claudeDir)) {
                fs.mkdirSync(claudeDir, { recursive: true });
            }
            let mcpConfig = { mcpServers: {} };
            if (fs.existsSync(mcpConfigPath)) {
                try {
                    mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
                    if (!mcpConfig.mcpServers) {
                        mcpConfig.mcpServers = {};
                    }
                }
                catch {
                    mcpConfig = { mcpServers: {} };
                }
            }
            mcpConfig.mcpServers['claude-mgr-orchestrator'] = {
                command: 'node',
                args: [orchestratorPath]
            };
            fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
            console.log('MCP orchestrator configured via mcp.json fallback');
        }
    }
    catch (err) {
        console.error('Failed to auto-setup MCP orchestrator:', err);
    }
}
exports.setupMcpOrchestrator = setupMcpOrchestrator;
// ============== IPC Handlers ==============
/**
 * Get the current status of the MCP orchestrator
 * Checks both claude mcp list output and mcp.json configuration
 */
function setupOrchestratorStatusHandler() {
    electron_1.ipcMain.handle('orchestrator:getStatus', async () => {
        try {
            const orchestratorPath = getMcpOrchestratorPath();
            const orchestratorExists = fs.existsSync(orchestratorPath);
            // Check using claude mcp list
            let isConfigured = false;
            try {
                const listOutput = (0, child_process_1.execSync)('claude mcp list 2>&1', { encoding: 'utf-8' });
                isConfigured = listOutput.includes('claude-mgr-orchestrator');
            }
            catch {
                // claude mcp list might fail if no servers configured
                isConfigured = false;
            }
            // Also check mcp.json as fallback
            const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
            let mcpJsonConfigured = false;
            if (fs.existsSync(mcpConfigPath)) {
                try {
                    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
                    mcpJsonConfigured = mcpConfig?.mcpServers?.['claude-mgr-orchestrator'] !== undefined;
                }
                catch {
                    // Ignore parse errors
                }
            }
            return {
                configured: isConfigured || mcpJsonConfigured,
                orchestratorPath,
                orchestratorExists,
                mcpListConfigured: isConfigured,
                mcpJsonConfigured
            };
        }
        catch (err) {
            console.error('Failed to get orchestrator status:', err);
            return { configured: false, error: String(err) };
        }
    });
}
exports.setupOrchestratorStatusHandler = setupOrchestratorStatusHandler;
/**
 * Setup the MCP orchestrator using claude mcp add command
 * This handler allows manual configuration from the renderer process
 */
function setupOrchestratorSetupHandler() {
    electron_1.ipcMain.handle('orchestrator:setup', async () => {
        try {
            const orchestratorPath = getMcpOrchestratorPath();
            // Check if orchestrator exists
            if (!fs.existsSync(orchestratorPath)) {
                return {
                    success: false,
                    error: `MCP orchestrator not found at ${orchestratorPath}. Try reinstalling the app.`
                };
            }
            // First try to remove any existing config to avoid duplicates (from both user and project scope)
            try {
                (0, child_process_1.execSync)('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
            }
            catch {
                // Ignore errors if it doesn't exist
            }
            try {
                (0, child_process_1.execSync)('claude mcp remove claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
            }
            catch {
                // Ignore errors if it doesn't exist in project scope
            }
            // Add the MCP server using claude mcp add with -s user for global scope
            const addCommand = `claude mcp add -s user claude-mgr-orchestrator node "${orchestratorPath}"`;
            console.log('Running:', addCommand);
            try {
                (0, child_process_1.execSync)(addCommand, { encoding: 'utf-8', stdio: 'pipe' });
                console.log('MCP orchestrator configured globally via claude mcp add -s user');
                return { success: true, method: 'claude-mcp-add-global' };
            }
            catch (addErr) {
                console.error('Failed to add MCP server via claude mcp add -s user:', addErr);
                // Fallback: write to mcp.json
                const claudeDir = path.join(os.homedir(), '.claude');
                const mcpConfigPath = path.join(claudeDir, 'mcp.json');
                if (!fs.existsSync(claudeDir)) {
                    fs.mkdirSync(claudeDir, { recursive: true });
                }
                let mcpConfig = { mcpServers: {} };
                if (fs.existsSync(mcpConfigPath)) {
                    try {
                        mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
                        if (!mcpConfig.mcpServers) {
                            mcpConfig.mcpServers = {};
                        }
                    }
                    catch {
                        mcpConfig = { mcpServers: {} };
                    }
                }
                mcpConfig.mcpServers['claude-mgr-orchestrator'] = {
                    command: 'node',
                    args: [orchestratorPath]
                };
                fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
                console.log('MCP orchestrator configured via mcp.json fallback');
                return { success: true, path: mcpConfigPath, method: 'mcp-json-fallback' };
            }
        }
        catch (err) {
            console.error('Failed to setup orchestrator:', err);
            return { success: false, error: String(err) };
        }
    });
}
exports.setupOrchestratorSetupHandler = setupOrchestratorSetupHandler;
/**
 * Remove orchestrator from Claude's global configuration
 * This handler allows uninstalling the MCP orchestrator
 */
function setupOrchestratorRemoveHandler() {
    electron_1.ipcMain.handle('orchestrator:remove', async () => {
        try {
            // Remove from global user scope
            try {
                (0, child_process_1.execSync)('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
            }
            catch {
                // Ignore errors if it doesn't exist
            }
            // Also clean up mcp.json fallback if it exists
            const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
            if (fs.existsSync(mcpConfigPath)) {
                try {
                    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
                    if (mcpConfig?.mcpServers?.['claude-mgr-orchestrator']) {
                        delete mcpConfig.mcpServers['claude-mgr-orchestrator'];
                        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
                    }
                }
                catch {
                    // Ignore parse errors
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('Failed to remove orchestrator:', err);
            return { success: false, error: String(err) };
        }
    });
}
exports.setupOrchestratorRemoveHandler = setupOrchestratorRemoveHandler;
/**
 * Register all MCP orchestrator IPC handlers
 * Call this during app initialization to set up all handlers
 */
function registerMcpOrchestratorHandlers() {
    setupOrchestratorStatusHandler();
    setupOrchestratorSetupHandler();
    setupOrchestratorRemoveHandler();
}
exports.registerMcpOrchestratorHandlers = registerMcpOrchestratorHandlers;
//# sourceMappingURL=mcp-orchestrator.js.map