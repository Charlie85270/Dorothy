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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const uuid_1 = require("uuid");
const pty = __importStar(require("node-pty"));
// PTY instances for terminals
const ptyProcesses = new Map();
const agents = new Map();
// ============== Agent Persistence ==============
const DATA_DIR = path.join(os.homedir(), '.claude-manager');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
// Ensure data directory exists
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
// Save agents to disk
function saveAgents() {
    try {
        ensureDataDir();
        const agentsArray = Array.from(agents.values()).map(agent => ({
            ...agent,
            // Don't persist runtime-only fields
            ptyId: undefined,
            pathMissing: undefined, // Recalculated on load
            // Limit output to last 100 entries to avoid huge files
            output: agent.output.slice(-100),
            // Reset running status to idle on save (will be restarted manually)
            status: agent.status === 'running' ? 'idle' : agent.status,
        }));
        fs.writeFileSync(AGENTS_FILE, JSON.stringify(agentsArray, null, 2));
        console.log(`Saved ${agentsArray.length} agents to disk`);
    }
    catch (err) {
        console.error('Failed to save agents:', err);
    }
}
// Load agents from disk
function loadAgents() {
    try {
        if (!fs.existsSync(AGENTS_FILE)) {
            console.log('No agents file found, starting fresh');
            return;
        }
        const data = fs.readFileSync(AGENTS_FILE, 'utf-8');
        const agentsArray = JSON.parse(data);
        for (const agent of agentsArray) {
            // Check if project path still exists - but NEVER skip agents!
            // Just mark them as having a missing path so UI can show warning
            const workingPath = agent.worktreePath || agent.projectPath;
            if (!fs.existsSync(workingPath)) {
                console.warn(`Agent ${agent.id} has missing path: ${workingPath} - marking as pathMissing`);
                agent.pathMissing = true;
            }
            else {
                agent.pathMissing = false;
            }
            // Reset status to idle since PTY is not running
            agent.status = 'idle';
            agent.ptyId = undefined;
            agents.set(agent.id, agent);
        }
        console.log(`Loaded ${agents.size} agents from disk`);
    }
    catch (err) {
        console.error('Failed to load agents:', err);
    }
}
// Initialize a PTY for a restored agent
async function initAgentPty(agent) {
    const shell = process.env.SHELL || '/bin/zsh';
    const cwd = agent.worktreePath || agent.projectPath;
    console.log(`Initializing PTY for restored agent ${agent.id} in ${cwd}`);
    const ptyProcess = pty.spawn(shell, ['-l'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: {
            ...process.env,
            CLAUDE_SKILLS: agent.skills.join(','),
        },
    });
    const ptyId = (0, uuid_1.v4)();
    ptyProcesses.set(ptyId, ptyProcess);
    // Forward PTY output to renderer
    ptyProcess.onData((data) => {
        const agentData = agents.get(agent.id);
        if (agentData) {
            agentData.output.push(data);
            agentData.lastActivity = new Date().toISOString();
        }
        mainWindow?.webContents.send('agent:output', {
            type: 'output',
            agentId: agent.id,
            ptyId,
            data,
            timestamp: new Date().toISOString(),
        });
    });
    ptyProcess.onExit(({ exitCode }) => {
        console.log(`Agent ${agent.id} PTY exited with code ${exitCode}`);
        const agentData = agents.get(agent.id);
        if (agentData) {
            agentData.status = exitCode === 0 ? 'completed' : 'error';
            agentData.lastActivity = new Date().toISOString();
            saveAgents();
        }
        ptyProcesses.delete(ptyId);
        mainWindow?.webContents.send('agent:complete', {
            type: 'complete',
            agentId: agent.id,
            ptyId,
            exitCode,
            timestamp: new Date().toISOString(),
        });
    });
    return ptyId;
}
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1200,
        minHeight: 800,
        title: 'claude.mgr',
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Load the Next.js app
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, load the exported Next.js static files
        mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    // Load persisted agents before creating window
    loadAgents();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    // Save agents before quitting
    saveAgents();
    // Kill all PTY processes
    ptyProcesses.forEach((ptyProcess) => {
        ptyProcess.kill();
    });
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Save agents when app is about to quit
electron_1.app.on('before-quit', () => {
    saveAgents();
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// ============== PTY Terminal IPC Handlers ==============
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
        mainWindow?.webContents.send('pty:data', { id, data });
    });
    // Handle PTY exit
    ptyProcess.onExit(({ exitCode }) => {
        mainWindow?.webContents.send('pty:exit', { id, exitCode });
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
// ============== Agent Management IPC Handlers ==============
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
    const status = {
        id,
        status: 'idle',
        projectPath: config.projectPath,
        worktreePath,
        branchName,
        skills: config.skills,
        output: [],
        lastActivity: new Date().toISOString(),
        ptyId,
        character: config.character || 'robot',
        name: config.name || `Agent ${id.slice(0, 4)}`,
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
        }
        mainWindow?.webContents.send('agent:output', {
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
            agent.status = exitCode === 0 ? 'completed' : 'error';
            agent.lastActivity = new Date().toISOString();
        }
        // Remove PTY from map since it's exited
        ptyProcesses.delete(ptyId);
        mainWindow?.webContents.send('agent:complete', {
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
    if (options?.model) {
        command += ` --model ${options.model}`;
    }
    if (options?.resume) {
        command += ' --resume';
    }
    // Add the prompt (escape single quotes)
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    command += ` '${escapedPrompt}'`;
    // Update status
    agent.status = 'running';
    agent.currentTask = prompt.slice(0, 100);
    agent.lastActivity = new Date().toISOString();
    // First cd to the appropriate directory (worktree if exists, otherwise project), then run claude
    const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");
    ptyProcess.write(`cd '${workingPath}' && ${command}\r`);
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
        agent.lastActivity = new Date().toISOString();
        saveAgents();
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
// ============== Skills IPC Handlers ==============
// Store for skill installation PTYs
const skillPtyProcesses = new Map();
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
        mainWindow?.webContents.send('skill:pty-data', { id, data });
    });
    // Handle PTY exit
    ptyProcess.onExit(({ exitCode }) => {
        mainWindow?.webContents.send('skill:pty-exit', { id, exitCode });
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
        ptyProcess.write(`${command}\r`);
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
// ============== File System IPC Handlers ==============
electron_1.ipcMain.handle('fs:list-projects', async () => {
    try {
        const claudeDir = path.join(os.homedir(), '.claude', 'projects');
        if (!fs.existsSync(claudeDir))
            return [];
        const projectDirs = fs.readdirSync(claudeDir);
        const projects = [];
        for (const dir of projectDirs) {
            // Claude encodes paths by replacing / with -
            // So /Users/charlie/project becomes -Users-charlie-project
            let decodedPath = dir.replace(/-/g, '/');
            // Remove any double slashes that might occur
            decodedPath = decodedPath.replace(/\/+/g, '/');
            // Ensure path starts with single /
            if (!decodedPath.startsWith('/')) {
                decodedPath = '/' + decodedPath;
            }
            // Verify the path exists before adding
            if (fs.existsSync(decodedPath)) {
                const stats = fs.statSync(path.join(claudeDir, dir));
                projects.push({
                    path: decodedPath,
                    name: path.basename(decodedPath),
                    lastModified: stats.mtime.toISOString(),
                });
            }
        }
        return projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    }
    catch (err) {
        console.error('Error listing projects:', err);
        return [];
    }
});
// Open folder dialog
electron_1.ipcMain.handle('dialog:open-folder', async () => {
    const { dialog } = await Promise.resolve().then(() => __importStar(require('electron')));
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    return result.filePaths[0] || null;
});
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
//# sourceMappingURL=main.js.map