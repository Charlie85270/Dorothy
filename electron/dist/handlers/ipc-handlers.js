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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const uuid_1 = require("uuid");
const pty = __importStar(require("node-pty"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const bolt_1 = require("@slack/bolt");
/**
 * Register all IPC handlers
 */
function registerIpcHandlers(deps) {
    registerPtyHandlers(deps);
    registerAgentHandlers(deps);
    registerSkillHandlers(deps);
    registerPluginHandlers(deps);
    registerClaudeDataHandlers(deps);
    registerSettingsHandlers(deps);
    registerAppSettingsHandlers(deps);
    // Orchestrator handlers are registered separately in services/mcp-orchestrator.ts
    registerFileSystemHandlers(deps);
    registerShellHandlers(deps);
}
// ============== PTY Terminal IPC Handlers ==============
function registerPtyHandlers(deps) {
    const { ptyProcesses, getMainWindow } = deps;
    // Create a new PTY terminal
    electron_1.ipcMain.handle('pty:create', async (_event, { cwd, cols, rows }) => {
        const id = (0, uuid_1.v4)();
        const shell = process.env.SHELL || '/bin/zsh';
        const ptyProcess = pty.spawn(shell, ['-l'], {
            name: 'xterm-256color',
            cols: cols || 80,
            rows: rows || 24,
            cwd: cwd || os.homedir(),
            env: process.env,
        });
        ptyProcesses.set(id, ptyProcess);
        // Send data from PTY to renderer
        ptyProcess.onData((data) => {
            getMainWindow()?.webContents.send('pty:data', { id, data });
        });
        // Handle PTY exit
        ptyProcess.onExit(({ exitCode }) => {
            getMainWindow()?.webContents.send('pty:exit', { id, exitCode });
            ptyProcesses.delete(id);
        });
        return { id };
    });
    // Write to PTY
    electron_1.ipcMain.handle('pty:write', async (_event, { id, data }) => {
        const ptyProcess = ptyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.write(data);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Resize PTY
    electron_1.ipcMain.handle('pty:resize', async (_event, { id, cols, rows }) => {
        const ptyProcess = ptyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Kill PTY
    electron_1.ipcMain.handle('pty:kill', async (_event, { id }) => {
        const ptyProcess = ptyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.kill();
            ptyProcesses.delete(id);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
}
// ============== Agent Management IPC Handlers ==============
function registerAgentHandlers(deps) {
    const { agents, ptyProcesses, getMainWindow, getAppSettings, saveAgents, initAgentPty, detectAgentStatus, handleStatusChangeNotification, isSuperAgent, getSuperAgentTelegramTask, getSuperAgentOutputBuffer, setSuperAgentOutputBuffer } = deps;
    // Create a new agent (now creates a PTY-backed terminal)
    electron_1.ipcMain.handle('agent:create', async (_event, config) => {
        const id = (0, uuid_1.v4)();
        const shell = process.env.SHELL || '/bin/zsh';
        // Validate project path exists
        let cwd = config.projectPath;
        if (!fs.existsSync(cwd)) {
            console.warn(`Project path does not exist: ${cwd}, using home directory`);
            cwd = os.homedir();
        }
        let worktreePath;
        let branchName;
        // Create git worktree if enabled
        if (config.worktree?.enabled && config.worktree?.branchName) {
            branchName = config.worktree.branchName;
            const worktreesDir = path.join(cwd, '.worktrees');
            worktreePath = path.join(worktreesDir, branchName);
            console.log(`Creating git worktree for agent ${id} at ${worktreePath} on branch ${branchName}`);
            try {
                // Create .worktrees directory if it doesn't exist
                if (!fs.existsSync(worktreesDir)) {
                    fs.mkdirSync(worktreesDir, { recursive: true });
                }
                // Check if worktree already exists
                if (fs.existsSync(worktreePath)) {
                    console.log(`Worktree already exists at ${worktreePath}, reusing it`);
                }
                else {
                    // Create the worktree with a new branch
                    const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
                    // Check if branch already exists
                    try {
                        execSync(`git rev-parse --verify ${branchName}`, { cwd, stdio: 'pipe' });
                        // Branch exists, create worktree using existing branch
                        execSync(`git worktree add "${worktreePath}" ${branchName}`, { cwd, stdio: 'pipe' });
                        console.log(`Created worktree using existing branch ${branchName}`);
                    }
                    catch {
                        // Branch doesn't exist, create worktree with new branch
                        execSync(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd, stdio: 'pipe' });
                        console.log(`Created worktree with new branch ${branchName}`);
                    }
                }
                // Use the worktree path as the working directory
                cwd = worktreePath;
            }
            catch (err) {
                console.error(`Failed to create git worktree:`, err);
                // Continue without worktree if creation fails
                worktreePath = undefined;
                branchName = undefined;
            }
        }
        console.log(`Creating PTY for agent ${id} with shell ${shell} in ${cwd}`);
        // Create PTY for this agent
        let ptyProcess;
        try {
            ptyProcess = pty.spawn(shell, ['-l'], {
                name: 'xterm-256color',
                cols: 120,
                rows: 30,
                cwd,
                env: {
                    ...process.env,
                    CLAUDE_SKILLS: config.skills.join(','),
                    CLAUDE_AGENT_ID: id,
                    CLAUDE_PROJECT_PATH: config.projectPath,
                },
            });
            console.log(`PTY created successfully for agent ${id}, PID: ${ptyProcess.pid}`);
        }
        catch (err) {
            console.error(`Failed to create PTY for agent ${id}:`, err);
            throw err;
        }
        const ptyId = (0, uuid_1.v4)();
        ptyProcesses.set(ptyId, ptyProcess);
        // Validate secondary project path if provided
        let secondaryProjectPath;
        if (config.secondaryProjectPath) {
            if (fs.existsSync(config.secondaryProjectPath)) {
                secondaryProjectPath = config.secondaryProjectPath;
                console.log(`Secondary project path validated: ${secondaryProjectPath}`);
            }
            else {
                console.warn(`Secondary project path does not exist: ${config.secondaryProjectPath}`);
            }
        }
        const status = {
            id,
            status: 'idle',
            projectPath: config.projectPath,
            secondaryProjectPath,
            worktreePath,
            branchName,
            skills: config.skills,
            output: [],
            lastActivity: new Date().toISOString(),
            ptyId,
            character: config.character || 'robot',
            name: config.name || `Agent ${id.slice(0, 4)}`,
            skipPermissions: config.skipPermissions || false,
        };
        agents.set(id, status);
        // Save agents to disk
        saveAgents();
        // Forward PTY output to renderer
        ptyProcess.onData((data) => {
            const agent = agents.get(id);
            if (agent) {
                agent.output.push(data);
                agent.lastActivity = new Date().toISOString();
                // Capture Super Agent output for Telegram
                if (getSuperAgentTelegramTask() && isSuperAgent(agent)) {
                    const buffer = getSuperAgentOutputBuffer();
                    buffer.push(data);
                    // Keep buffer reasonable
                    if (buffer.length > 200) {
                        setSuperAgentOutputBuffer(buffer.slice(-100));
                    }
                }
                // Check if agent was manually stopped recently (within 3 seconds)
                // If so, don't override the status with detection
                const manuallyStoppedAt = agent._manuallyStoppedAt;
                const wasRecentlyStopped = manuallyStoppedAt && (Date.now() - manuallyStoppedAt) < 3000;
                if (!wasRecentlyStopped) {
                    // Detect status changes when we receive output
                    const newStatus = detectAgentStatus(agent);
                    if (newStatus !== agent.status) {
                        agent.status = newStatus;
                        // Send notification
                        handleStatusChangeNotification(agent, newStatus);
                        // Send status change event
                        getMainWindow()?.webContents.send('agent:status', {
                            type: 'status',
                            agentId: id,
                            status: newStatus,
                            timestamp: new Date().toISOString(),
                        });
                    }
                }
            }
            getMainWindow()?.webContents.send('agent:output', {
                type: 'output',
                agentId: id,
                ptyId,
                data,
                timestamp: new Date().toISOString(),
            });
        });
        ptyProcess.onExit(({ exitCode }) => {
            console.log(`Agent ${id} PTY exited with code ${exitCode}`);
            const agent = agents.get(id);
            if (agent) {
                const newStatus = exitCode === 0 ? 'completed' : 'error';
                agent.status = newStatus;
                agent.lastActivity = new Date().toISOString();
                // Send notification
                handleStatusChangeNotification(agent, newStatus);
            }
            // Remove PTY from map since it's exited
            ptyProcesses.delete(ptyId);
            getMainWindow()?.webContents.send('agent:complete', {
                type: 'complete',
                agentId: id,
                ptyId,
                exitCode,
                timestamp: new Date().toISOString(),
            });
        });
        return { ...status, ptyId };
    });
    // Start an agent with a prompt (sends command to PTY)
    electron_1.ipcMain.handle('agent:start', async (_event, { id, prompt, options }) => {
        const agent = agents.get(id);
        if (!agent)
            throw new Error('Agent not found');
        // Initialize PTY if agent was restored from disk and doesn't have one
        if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
            console.log(`Agent ${id} needs PTY initialization`);
            const ptyId = await initAgentPty(agent);
            agent.ptyId = ptyId;
        }
        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (!ptyProcess)
            throw new Error('PTY not found');
        // Build Claude Code command
        let command = 'claude';
        // Check if this is the Super Agent (orchestrator)
        const isSuperAgentCheck = agent.name?.toLowerCase().includes('super agent') ||
            agent.name?.toLowerCase().includes('orchestrator');
        // Add explicit MCP config for Super Agent to ensure orchestrator tools are loaded
        if (isSuperAgentCheck) {
            const { app } = await Promise.resolve().then(() => __importStar(require('electron')));
            const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
            if (fs.existsSync(mcpConfigPath)) {
                command += ` --mcp-config '${mcpConfigPath}'`;
            }
            // Add super agent instructions
            const { getSuperAgentInstructionsPath } = await Promise.resolve().then(() => __importStar(require('../utils')));
            const instructionsPath = getSuperAgentInstructionsPath();
            if (fs.existsSync(instructionsPath)) {
                command += ` --append-system-prompt "$(cat '${instructionsPath}')"`;
            }
        }
        if (options?.model) {
            command += ` --model ${options.model}`;
        }
        if (options?.resume) {
            command += ' --resume';
        }
        // Add verbose flag if enabled in app settings
        const currentAppSettings = getAppSettings();
        if (currentAppSettings.verboseModeEnabled) {
            command += ' --verbose';
        }
        // Add skip permissions flag if enabled
        if (agent.skipPermissions) {
            command += ' --dangerously-skip-permissions';
        }
        // Add secondary project path with --add-dir flag if set
        if (agent.secondaryProjectPath) {
            const escapedSecondaryPath = agent.secondaryProjectPath.replace(/'/g, "'\\''");
            command += ` --add-dir '${escapedSecondaryPath}'`;
        }
        // Build the final prompt with skills directive if agent has skills
        let finalPrompt = prompt;
        if (agent.skills && agent.skills.length > 0 && !isSuperAgentCheck) {
            const skillsList = agent.skills.join(', ');
            finalPrompt = `[IMPORTANT: Use these skills for this session: ${skillsList}. Invoke them with /<skill-name> when relevant to the task.] ${prompt}`;
        }
        // Add the prompt (escape single quotes)
        const escapedPrompt = finalPrompt.replace(/'/g, "'\\''");
        command += ` '${escapedPrompt}'`;
        // Update status
        agent.status = 'running';
        agent.currentTask = prompt.slice(0, 100);
        agent.lastActivity = new Date().toISOString();
        // First cd to the appropriate directory (worktree if exists, otherwise project), then run claude
        const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");
        ptyProcess.write(`cd '${workingPath}' && ${command}`);
        ptyProcess.write('\r');
        // Save updated status
        saveAgents();
        return { success: true };
    });
    // Get agent status
    electron_1.ipcMain.handle('agent:get', async (_event, id) => {
        const agent = agents.get(id);
        if (!agent)
            return null;
        // Initialize PTY if agent was restored from disk and doesn't have one
        if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
            console.log(`Initializing PTY for agent ${id} on get`);
            const ptyId = await initAgentPty(agent);
            agent.ptyId = ptyId;
        }
        return agent;
    });
    // Get all agents
    electron_1.ipcMain.handle('agent:list', async () => {
        return Array.from(agents.values());
    });
    // Update an agent (can update skills, secondaryProjectPath, skipPermissions, name, character)
    electron_1.ipcMain.handle('agent:update', async (_event, params) => {
        const agent = agents.get(params.id);
        if (!agent) {
            return { success: false, error: 'Agent not found' };
        }
        // Update fields if provided
        if (params.skills !== undefined) {
            agent.skills = params.skills;
        }
        if (params.secondaryProjectPath !== undefined) {
            if (params.secondaryProjectPath === null) {
                agent.secondaryProjectPath = undefined;
            }
            else if (fs.existsSync(params.secondaryProjectPath)) {
                agent.secondaryProjectPath = params.secondaryProjectPath;
            }
            else {
                return { success: false, error: 'Secondary project path does not exist' };
            }
        }
        if (params.skipPermissions !== undefined) {
            agent.skipPermissions = params.skipPermissions;
        }
        if (params.name !== undefined) {
            agent.name = params.name;
        }
        if (params.character !== undefined) {
            agent.character = params.character;
        }
        agent.lastActivity = new Date().toISOString();
        saveAgents();
        return { success: true, agent };
    });
    // Stop an agent
    electron_1.ipcMain.handle('agent:stop', async (_event, id) => {
        const agent = agents.get(id);
        if (agent?.ptyId) {
            const ptyProcess = ptyProcesses.get(agent.ptyId);
            if (ptyProcess) {
                // Send Ctrl+C to interrupt
                ptyProcess.write('\x03');
            }
            agent.status = 'idle';
            agent.currentTask = undefined;
            agent.lastActivity = new Date().toISOString();
            // Mark as manually stopped to prevent status detection from overriding
            agent._manuallyStoppedAt = Date.now();
            saveAgents();
            // Send status change notification to frontend immediately
            getMainWindow()?.webContents.send('agent:status', {
                type: 'status',
                agentId: id,
                status: 'idle',
                timestamp: new Date().toISOString(),
            });
        }
        return { success: true };
    });
    // Remove an agent
    electron_1.ipcMain.handle('agent:remove', async (_event, id) => {
        const agent = agents.get(id);
        if (agent?.ptyId) {
            const ptyProcess = ptyProcesses.get(agent.ptyId);
            if (ptyProcess) {
                ptyProcess.kill();
                ptyProcesses.delete(agent.ptyId);
            }
        }
        // Clean up worktree if it exists
        if (agent?.worktreePath && agent?.branchName) {
            try {
                const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
                console.log(`Removing worktree at ${agent.worktreePath}`);
                execSync(`git worktree remove "${agent.worktreePath}" --force`, { cwd: agent.projectPath, stdio: 'pipe' });
                console.log(`Worktree removed successfully`);
            }
            catch (err) {
                console.warn(`Failed to remove worktree:`, err);
                // Continue even if worktree removal fails
            }
        }
        agents.delete(id);
        // Save agents to disk
        saveAgents();
        return { success: true };
    });
    // Update agent's secondary project path
    electron_1.ipcMain.handle('agent:setSecondaryProject', async (_event, { id, secondaryProjectPath }) => {
        const agent = agents.get(id);
        if (!agent) {
            return { success: false, error: 'Agent not found' };
        }
        // Validate the path if provided
        if (secondaryProjectPath) {
            if (!fs.existsSync(secondaryProjectPath)) {
                return { success: false, error: 'Path does not exist' };
            }
            agent.secondaryProjectPath = secondaryProjectPath;
            console.log(`Set secondary project path for agent ${id}: ${secondaryProjectPath}`);
        }
        else {
            // Clear the secondary project path
            agent.secondaryProjectPath = undefined;
            console.log(`Cleared secondary project path for agent ${id}`);
        }
        // Save updated agents to disk
        saveAgents();
        return { success: true, agent };
    });
    // Send input to an agent
    electron_1.ipcMain.handle('agent:input', async (_event, { id, input }) => {
        const agent = agents.get(id);
        if (agent?.ptyId) {
            const ptyProcess = ptyProcesses.get(agent.ptyId);
            if (ptyProcess) {
                try {
                    ptyProcess.write(input);
                    return { success: true };
                }
                catch (err) {
                    console.error('Failed to write to PTY:', err);
                    return { success: false, error: 'Failed to write to PTY' };
                }
            }
        }
        return { success: false, error: 'PTY not found' };
    });
    // Resize agent PTY
    electron_1.ipcMain.handle('agent:resize', async (_event, { id, cols, rows }) => {
        const agent = agents.get(id);
        if (agent?.ptyId) {
            const ptyProcess = ptyProcesses.get(agent.ptyId);
            if (ptyProcess) {
                try {
                    ptyProcess.resize(cols, rows);
                    return { success: true };
                }
                catch (err) {
                    console.error('Failed to resize PTY:', err);
                    return { success: false, error: 'Failed to resize PTY' };
                }
            }
        }
        return { success: false, error: 'PTY not found' };
    });
}
// ============== Skills IPC Handlers ==============
function registerSkillHandlers(deps) {
    const { skillPtyProcesses, getMainWindow } = deps;
    // Start skill installation (creates interactive PTY)
    electron_1.ipcMain.handle('skill:install-start', async (_event, { repo, cols, rows }) => {
        const id = (0, uuid_1.v4)();
        const shell = process.env.SHELL || '/bin/zsh';
        const ptyProcess = pty.spawn(shell, ['-l'], {
            name: 'xterm-256color',
            cols: cols || 80,
            rows: rows || 24,
            cwd: os.homedir(),
            env: process.env,
        });
        skillPtyProcesses.set(id, ptyProcess);
        // Forward PTY output to renderer
        ptyProcess.onData((data) => {
            getMainWindow()?.webContents.send('skill:pty-data', { id, data });
        });
        // Handle PTY exit
        ptyProcess.onExit(({ exitCode }) => {
            getMainWindow()?.webContents.send('skill:pty-exit', { id, exitCode });
            skillPtyProcesses.delete(id);
        });
        // Send the install command after a short delay to let shell initialize
        // Parse repo to get the GitHub URL and skill name
        // Format: "owner/repo/skill-name" or "owner/repo" for full repo install
        const parts = repo.split('/');
        let command;
        if (parts.length >= 3) {
            // Has skill name: owner/repo/skill-name
            const repoPath = `${parts[0]}/${parts[1]}`;
            const skillName = parts.slice(2).join('/');
            command = `npx skills add https://github.com/${repoPath} --skill ${skillName}`;
        }
        else {
            // Just repo: owner/repo (install all skills from repo)
            command = `npx skills add https://github.com/${repo}`;
        }
        setTimeout(() => {
            ptyProcess.write(command);
            ptyProcess.write('\r');
        }, 500);
        return { id, repo };
    });
    // Write to skill installation PTY
    electron_1.ipcMain.handle('skill:install-write', async (_event, { id, data }) => {
        const ptyProcess = skillPtyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.write(data);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Resize skill installation PTY
    electron_1.ipcMain.handle('skill:install-resize', async (_event, { id, cols, rows }) => {
        const ptyProcess = skillPtyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Kill skill installation PTY
    electron_1.ipcMain.handle('skill:install-kill', async (_event, { id }) => {
        const ptyProcess = skillPtyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.kill();
            skillPtyProcesses.delete(id);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Legacy install (kept for backwards compatibility)
    electron_1.ipcMain.handle('skill:install', async (_event, repo) => {
        // Just start the installation and return immediately
        // The actual interaction happens via skill:install-start
        return { success: true, message: 'Use skill:install-start for interactive installation' };
    });
    // Get installed skills from Claude config
    electron_1.ipcMain.handle('skill:list-installed', async () => {
        try {
            const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                // Skills are stored in enabledPlugins as "skill-name@source": true/false
                if (settings.enabledPlugins) {
                    return Object.keys(settings.enabledPlugins)
                        .filter(key => settings.enabledPlugins[key]) // Only enabled ones
                        .map(key => key.split('@')[0]); // Extract skill name before @
                }
                return [];
            }
            return [];
        }
        catch {
            return [];
        }
    });
}
// ============== Plugin IPC Handlers ==============
function registerPluginHandlers(deps) {
    const { pluginPtyProcesses, getMainWindow } = deps;
    // Start plugin installation (creates interactive PTY)
    electron_1.ipcMain.handle('plugin:install-start', async (_event, { command, cols, rows }) => {
        const id = (0, uuid_1.v4)();
        const shell = process.env.SHELL || '/bin/zsh';
        const ptyProcess = pty.spawn(shell, ['-l'], {
            name: 'xterm-256color',
            cols: cols || 80,
            rows: rows || 24,
            cwd: os.homedir(),
            env: process.env,
        });
        pluginPtyProcesses.set(id, ptyProcess);
        // Forward PTY output to renderer
        ptyProcess.onData((data) => {
            getMainWindow()?.webContents.send('plugin:pty-data', { id, data });
        });
        // Handle PTY exit
        ptyProcess.onExit(({ exitCode }) => {
            getMainWindow()?.webContents.send('plugin:pty-exit', { id, exitCode });
            pluginPtyProcesses.delete(id);
        });
        // Send the install command after a short delay to let shell initialize
        // If the command starts with /, it's a Claude CLI slash command - prefix with 'claude'
        const finalCommand = command.startsWith('/') ? `claude "${command}"` : command;
        setTimeout(() => {
            ptyProcess.write(finalCommand);
            ptyProcess.write('\r');
        }, 500);
        return { id };
    });
    // Write to plugin installation PTY
    electron_1.ipcMain.handle('plugin:install-write', async (_event, { id, data }) => {
        const ptyProcess = pluginPtyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.write(data);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Resize plugin installation PTY
    electron_1.ipcMain.handle('plugin:install-resize', async (_event, { id, cols, rows }) => {
        const ptyProcess = pluginPtyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Kill plugin installation PTY
    electron_1.ipcMain.handle('plugin:install-kill', async (_event, { id }) => {
        const ptyProcess = pluginPtyProcesses.get(id);
        if (ptyProcess) {
            ptyProcess.kill();
            pluginPtyProcesses.delete(id);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
}
// ============== Claude Data IPC Handlers ==============
function registerClaudeDataHandlers(deps) {
    const { getClaudeSettings, getClaudeStats, getClaudeProjects, getClaudePlugins, getClaudeSkills, getClaudeHistory } = deps;
    // Get all Claude data
    electron_1.ipcMain.handle('claude:getData', async () => {
        try {
            const [settings, stats, projects, plugins, skills, history] = await Promise.all([
                getClaudeSettings(),
                getClaudeStats(),
                getClaudeProjects(),
                getClaudePlugins(),
                getClaudeSkills(),
                getClaudeHistory(50),
            ]);
            return {
                settings,
                stats,
                projects,
                plugins,
                skills,
                history,
                activeSessions: [],
            };
        }
        catch (err) {
            console.error('Failed to get Claude data:', err);
            return null;
        }
    });
}
// ============== Settings IPC Handlers ==============
function registerSettingsHandlers(_deps) {
    const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
    // Get Claude settings
    electron_1.ipcMain.handle('settings:get', async () => {
        try {
            if (!fs.existsSync(SETTINGS_PATH)) {
                return {
                    enabledPlugins: {},
                    env: {},
                    hooks: {},
                    includeCoAuthoredBy: false,
                    permissions: { allow: [], deny: [] },
                };
            }
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
        }
        catch (err) {
            console.error('Failed to read settings:', err);
            return null;
        }
    });
    // Save Claude settings
    electron_1.ipcMain.handle('settings:save', async (_event, settings) => {
        try {
            // Read existing settings first
            let existingSettings = {};
            if (fs.existsSync(SETTINGS_PATH)) {
                existingSettings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
            }
            // Merge with new settings
            const newSettings = { ...existingSettings, ...settings };
            // Write back
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
            return { success: true };
        }
        catch (err) {
            console.error('Failed to save settings:', err);
            return { success: false, error: String(err) };
        }
    });
    // Get Claude info (version, paths, etc.)
    electron_1.ipcMain.handle('settings:getInfo', async () => {
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            // Try to get Claude version
            let claudeVersion = 'Unknown';
            try {
                claudeVersion = execSync('claude --version 2>/dev/null', { encoding: 'utf-8' }).trim();
            }
            catch {
                // Claude not installed or not in PATH
            }
            return {
                claudeVersion,
                configPath: path.join(os.homedir(), '.claude'),
                settingsPath: SETTINGS_PATH,
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                electronVersion: process.versions.electron,
            };
        }
        catch (err) {
            console.error('Failed to get info:', err);
            return null;
        }
    });
}
// ============== App Settings IPC Handlers (Notifications) ==============
function registerAppSettingsHandlers(deps) {
    const { getAppSettings, setAppSettings, saveAppSettings, initTelegramBot, initSlackBot, getTelegramBot, getSlackApp } = deps;
    // Get app settings (notifications, etc.)
    electron_1.ipcMain.handle('app:getSettings', async () => {
        return getAppSettings();
    });
    // Save app settings
    electron_1.ipcMain.handle('app:saveSettings', async (_event, newSettings) => {
        try {
            const telegramChanged = newSettings.telegramEnabled !== undefined ||
                newSettings.telegramBotToken !== undefined;
            const slackChanged = newSettings.slackEnabled !== undefined ||
                newSettings.slackBotToken !== undefined ||
                newSettings.slackAppToken !== undefined;
            const currentSettings = getAppSettings();
            const updatedSettings = { ...currentSettings, ...newSettings };
            setAppSettings(updatedSettings);
            saveAppSettings(updatedSettings);
            // Reinitialize Telegram bot if settings changed
            if (telegramChanged) {
                initTelegramBot();
            }
            // Reinitialize Slack bot if settings changed
            if (slackChanged) {
                initSlackBot();
            }
            return { success: true };
        }
        catch (err) {
            console.error('Failed to save app settings:', err);
            return { success: false, error: String(err) };
        }
    });
    // Test Telegram connection
    electron_1.ipcMain.handle('telegram:test', async () => {
        const appSettings = getAppSettings();
        if (!appSettings.telegramBotToken) {
            return { success: false, error: 'No bot token configured' };
        }
        try {
            const testBot = new node_telegram_bot_api_1.default(appSettings.telegramBotToken);
            const me = await testBot.getMe();
            return { success: true, botName: me.username };
        }
        catch (err) {
            console.error('Telegram test failed:', err);
            return { success: false, error: String(err) };
        }
    });
    // Send test message to Telegram
    electron_1.ipcMain.handle('telegram:sendTest', async () => {
        const appSettings = getAppSettings();
        const telegramBot = getTelegramBot();
        if (!telegramBot || !appSettings.telegramChatId) {
            return { success: false, error: 'Bot not connected or no chat ID. Send /start to the bot first.' };
        }
        try {
            await telegramBot.sendMessage(appSettings.telegramChatId, '✅ Test message from Claude Manager!');
            return { success: true };
        }
        catch (err) {
            console.error('Telegram send test failed:', err);
            return { success: false, error: String(err) };
        }
    });
    // Test Slack connection
    electron_1.ipcMain.handle('slack:test', async () => {
        const appSettings = getAppSettings();
        if (!appSettings.slackBotToken || !appSettings.slackAppToken) {
            return { success: false, error: 'Bot token and App token are required' };
        }
        try {
            // Create a temporary Slack app to test the tokens
            const testApp = new bolt_1.App({
                token: appSettings.slackBotToken,
                appToken: appSettings.slackAppToken,
                socketMode: true,
                logLevel: bolt_1.LogLevel.ERROR,
            });
            // Test auth
            const authResult = await testApp.client.auth.test();
            await testApp.stop();
            return { success: true, botName: authResult.user };
        }
        catch (err) {
            console.error('Slack test failed:', err);
            return { success: false, error: String(err) };
        }
    });
    // Send test message to Slack
    electron_1.ipcMain.handle('slack:sendTest', async () => {
        const appSettings = getAppSettings();
        const slackApp = getSlackApp();
        if (!slackApp || !appSettings.slackChannelId) {
            return { success: false, error: 'Bot not connected or no channel ID. Mention the bot or DM it first.' };
        }
        try {
            await slackApp.client.chat.postMessage({
                channel: appSettings.slackChannelId,
                text: ':white_check_mark: Test message from Claude Manager!',
                mrkdwn: true,
            });
            return { success: true };
        }
        catch (err) {
            console.error('Slack send test failed:', err);
            return { success: false, error: String(err) };
        }
    });
}
// ============== File System IPC Handlers ==============
function registerFileSystemHandlers(deps) {
    const { getMainWindow } = deps;
    electron_1.ipcMain.handle('fs:list-projects', async () => {
        try {
            const claudeDir = path.join(os.homedir(), '.claude', 'projects');
            if (!fs.existsSync(claudeDir))
                return [];
            // Smart path decoding function (same as in getClaudeProjects)
            const decodeClaudePath = (encoded) => {
                const parts = encoded.split('-').filter(Boolean);
                const tryDecode = (index, currentPath) => {
                    if (index >= parts.length) {
                        return fs.existsSync(currentPath) ? currentPath : null;
                    }
                    const withSlash = currentPath + '/' + parts[index];
                    if (fs.existsSync(withSlash)) {
                        const result = tryDecode(index + 1, withSlash);
                        if (result)
                            return result;
                    }
                    for (let end = index + 1; end <= parts.length; end++) {
                        const combined = parts.slice(index, end).join('-');
                        const withCombined = currentPath + '/' + combined;
                        if (fs.existsSync(withCombined)) {
                            if (end === parts.length) {
                                return withCombined;
                            }
                            const result = tryDecode(end, withCombined);
                            if (result)
                                return result;
                        }
                    }
                    return null;
                };
                const result = tryDecode(0, '');
                if (result)
                    return result;
                // Fallback to simple decode if nothing found
                let decoded = '/' + parts.join('/');
                return decoded;
            };
            const dirs = fs.readdirSync(claudeDir);
            const projects = [];
            for (const dir of dirs) {
                const fullPath = path.join(claudeDir, dir);
                const stat = fs.statSync(fullPath);
                if (!stat.isDirectory())
                    continue;
                const decodedPath = decodeClaudePath(dir);
                projects.push({
                    id: dir,
                    path: decodedPath,
                    name: path.basename(decodedPath),
                });
            }
            return projects;
        }
        catch (err) {
            console.error('Failed to list projects:', err);
            return [];
        }
    });
    // Open folder dialog
    electron_1.ipcMain.handle('dialog:open-folder', async () => {
        const result = await electron_1.dialog.showOpenDialog(getMainWindow(), {
            properties: ['openDirectory'],
        });
        return result.filePaths[0] || null;
    });
}
// ============== Shell IPC Handlers ==============
function registerShellHandlers(deps) {
    const { quickPtyProcesses, getMainWindow } = deps;
    // Open in external terminal
    electron_1.ipcMain.handle('shell:open-terminal', async (_event, { cwd, command }) => {
        const shell = process.env.SHELL || '/bin/zsh';
        const script = command
            ? `tell application "Terminal" to do script "cd '${cwd}' && ${command}"`
            : `tell application "Terminal" to do script "cd '${cwd}'"`;
        const ptyProcess = pty.spawn(shell, ['-c', `osascript -e '${script.replace(/'/g, "'\\''")}'`], {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: os.homedir(),
            env: process.env,
        });
        return new Promise((resolve) => {
            ptyProcess.onExit(() => {
                resolve({ success: true });
            });
        });
    });
    // Execute arbitrary command (uses PTY)
    electron_1.ipcMain.handle('shell:exec', async (_event, { command, cwd }) => {
        return new Promise((resolve) => {
            const shell = process.env.SHELL || '/bin/zsh';
            const ptyProcess = pty.spawn(shell, ['-l', '-c', command], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: cwd || os.homedir(),
                env: process.env,
            });
            let output = '';
            ptyProcess.onData((data) => {
                output += data;
            });
            ptyProcess.onExit(({ exitCode }) => {
                if (exitCode === 0) {
                    resolve({ success: true, output });
                }
                else {
                    resolve({ success: false, error: output, code: exitCode });
                }
            });
        });
    });
    // Start a new quick terminal PTY
    electron_1.ipcMain.handle('shell:startPty', async (_event, { cwd, cols, rows }) => {
        const id = (0, uuid_1.v4)();
        const shell = process.env.SHELL || '/bin/zsh';
        const ptyProcess = pty.spawn(shell, ['-l'], {
            name: 'xterm-256color',
            cols: cols || 80,
            rows: rows || 24,
            cwd: cwd || os.homedir(),
            env: process.env,
        });
        quickPtyProcesses.set(id, ptyProcess);
        // Forward PTY output to renderer
        ptyProcess.onData((data) => {
            getMainWindow()?.webContents.send('shell:ptyOutput', { ptyId: id, data });
        });
        // Handle PTY exit
        ptyProcess.onExit(({ exitCode }) => {
            getMainWindow()?.webContents.send('shell:ptyExit', { ptyId: id, exitCode });
            quickPtyProcesses.delete(id);
        });
        return id;
    });
    // Write to quick terminal PTY
    electron_1.ipcMain.handle('shell:writePty', async (_event, { ptyId, data }) => {
        const ptyProcess = quickPtyProcesses.get(ptyId);
        if (ptyProcess) {
            ptyProcess.write(data);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Resize quick terminal PTY
    electron_1.ipcMain.handle('shell:resizePty', async (_event, { ptyId, cols, rows }) => {
        const ptyProcess = quickPtyProcesses.get(ptyId);
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
    // Kill quick terminal PTY
    electron_1.ipcMain.handle('shell:killPty', async (_event, { ptyId }) => {
        const ptyProcess = quickPtyProcesses.get(ptyId);
        if (ptyProcess) {
            ptyProcess.kill();
            quickPtyProcesses.delete(ptyId);
            return { success: true };
        }
        return { success: false, error: 'PTY not found' };
    });
}
//# sourceMappingURL=ipc-handlers.js.map