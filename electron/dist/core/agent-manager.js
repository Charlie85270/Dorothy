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
exports.superAgentOutputBuffer = exports.superAgentTelegramTask = exports.agentsLoaded = exports.agents = void 0;
exports.setSuperAgentTelegramTask = setSuperAgentTelegramTask;
exports.getSuperAgentOutputBuffer = getSuperAgentOutputBuffer;
exports.clearSuperAgentOutputBuffer = clearSuperAgentOutputBuffer;
exports.handleStatusChangeNotification = handleStatusChangeNotification;
exports.saveAgents = saveAgents;
exports.loadAgents = loadAgents;
exports.initAgentPty = initAgentPty;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const pty = __importStar(require("node-pty"));
const uuid_1 = require("uuid");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const pty_manager_1 = require("./pty-manager");
exports.agents = new Map();
exports.agentsLoaded = false;
exports.superAgentTelegramTask = false;
exports.superAgentOutputBuffer = [];
function setSuperAgentTelegramTask(value) {
    exports.superAgentTelegramTask = value;
}
function getSuperAgentOutputBuffer() {
    return exports.superAgentOutputBuffer;
}
function clearSuperAgentOutputBuffer() {
    exports.superAgentOutputBuffer = [];
}
const previousAgentStatus = new Map();
const pendingStatusChanges = new Map();
function handleStatusChangeNotification(agent, newStatus, appSettings, sendNotification, sendTelegramMessage, sendSuperAgentResponseToTelegram) {
    const prevStatus = previousAgentStatus.get(agent.id);
    if (!prevStatus) {
        previousAgentStatus.set(agent.id, newStatus);
        return;
    }
    if (prevStatus === newStatus) {
        return;
    }
    if (newStatus === 'running') {
        const pending = pendingStatusChanges.get(agent.id);
        if (pending) {
            clearTimeout(pending.timeoutId);
            pendingStatusChanges.delete(agent.id);
        }
        previousAgentStatus.set(agent.id, newStatus);
        return;
    }
    const pending = pendingStatusChanges.get(agent.id);
    if (pending && pending.newStatus === newStatus) {
        return;
    }
    if (pending) {
        clearTimeout(pending.timeoutId);
    }
    const timeoutId = setTimeout(() => {
        pendingStatusChanges.delete(agent.id);
        const currentAgent = exports.agents.get(agent.id);
        if (!currentAgent || currentAgent.status !== newStatus) {
            return;
        }
        previousAgentStatus.set(agent.id, newStatus);
        const agentName = currentAgent.name || `Agent ${currentAgent.id.slice(0, 6)}`;
        const isSuper = (0, utils_1.isSuperAgent)(currentAgent);
        if (newStatus === 'waiting') {
            if (!isSuper && appSettings.notifyOnWaiting) {
                sendNotification(`${agentName} needs your attention`, 'The agent is waiting for your input.', currentAgent.id, appSettings);
            }
            if (isSuper && exports.superAgentTelegramTask && sendSuperAgentResponseToTelegram) {
                sendSuperAgentResponseToTelegram(currentAgent);
                exports.superAgentTelegramTask = false;
            }
        }
        else if (newStatus === 'completed' && appSettings.notifyOnComplete) {
            if (!isSuper) {
                sendNotification(`${agentName} completed`, currentAgent.currentTask ? `Finished: ${currentAgent.currentTask.slice(0, 50)}...` : 'Task completed successfully.', currentAgent.id, appSettings);
            }
            if (isSuper && exports.superAgentTelegramTask && sendSuperAgentResponseToTelegram) {
                sendSuperAgentResponseToTelegram(currentAgent);
                exports.superAgentTelegramTask = false;
            }
        }
        else if (newStatus === 'error' && appSettings.notifyOnError) {
            if (!isSuper) {
                sendNotification(`${agentName} encountered an error`, currentAgent.error || 'An error occurred while running.', currentAgent.id, appSettings);
            }
            if (isSuper && exports.superAgentTelegramTask && sendTelegramMessage) {
                sendTelegramMessage(`🔴 Super Agent error: ${currentAgent.error || 'An error occurred.'}`);
                exports.superAgentTelegramTask = false;
            }
        }
    }, 5000);
    pendingStatusChanges.set(agent.id, {
        newStatus,
        scheduledAt: Date.now(),
        timeoutId,
    });
}
function saveAgents() {
    try {
        if (!exports.agentsLoaded) {
            console.log('Skipping save - agents not loaded yet');
            return;
        }
        (0, utils_1.ensureDataDir)();
        const agentsArray = Array.from(exports.agents.values()).map(agent => ({
            ...agent,
            ptyId: undefined,
            pathMissing: undefined,
            output: agent.output.slice(-100),
            status: agent.status === 'running' ? 'idle' : agent.status,
        }));
        if (fs.existsSync(constants_1.AGENTS_FILE)) {
            const existingContent = fs.readFileSync(constants_1.AGENTS_FILE, 'utf-8');
            if (existingContent.trim().length > 2) {
                const backupFile = path.join(constants_1.DATA_DIR, 'agents.backup.json');
                fs.writeFileSync(backupFile, existingContent);
            }
        }
        fs.writeFileSync(constants_1.AGENTS_FILE, JSON.stringify(agentsArray, null, 2));
        console.log(`Saved ${agentsArray.length} agents to disk`);
    }
    catch (err) {
        console.error('Failed to save agents:', err);
    }
}
function loadAgents() {
    try {
        if (!fs.existsSync(constants_1.AGENTS_FILE)) {
            console.log('No agents file found, starting fresh');
            exports.agentsLoaded = true;
            return;
        }
        const data = fs.readFileSync(constants_1.AGENTS_FILE, 'utf-8');
        if (!data.trim() || data.trim() === '[]') {
            console.log('Agents file is empty, checking for backup...');
            const backupFile = path.join(constants_1.DATA_DIR, 'agents.backup.json');
            if (fs.existsSync(backupFile)) {
                const backupData = fs.readFileSync(backupFile, 'utf-8');
                if (backupData.trim() && backupData.trim() !== '[]') {
                    console.log('Restoring agents from backup...');
                    fs.writeFileSync(constants_1.AGENTS_FILE, backupData);
                    loadAgents();
                    return;
                }
            }
            exports.agentsLoaded = true;
            return;
        }
        const agentsArray = JSON.parse(data);
        for (const agent of agentsArray) {
            const workingPath = agent.worktreePath || agent.projectPath;
            if (!fs.existsSync(workingPath)) {
                console.warn(`Agent ${agent.id} has missing path: ${workingPath} - marking as pathMissing`);
                agent.pathMissing = true;
            }
            else {
                agent.pathMissing = false;
            }
            agent.status = 'idle';
            agent.ptyId = undefined;
            exports.agents.set(agent.id, agent);
        }
        console.log(`Loaded ${exports.agents.size} agents from disk`);
        exports.agentsLoaded = true;
    }
    catch (err) {
        console.error('Failed to load agents:', err);
        exports.agentsLoaded = true;
    }
}
async function initAgentPty(agent, mainWindow, handleStatusChangeNotificationCallback, saveAgentsCallback) {
    // Use bash for more reliable PATH handling with nvm
    const shell = '/bin/bash';
    const cwd = agent.worktreePath || agent.projectPath;
    console.log(`Initializing PTY for restored agent ${agent.id} in ${cwd}`);
    // Build PATH that includes nvm and other common locations for claude
    const homeDir = process.env.HOME || os.homedir();
    const existingPath = process.env.PATH || '';
    // Add nvm paths and other common locations
    const additionalPaths = [
        path.join(homeDir, '.nvm/versions/node/v20.11.1/bin'),
        path.join(homeDir, '.nvm/versions/node/v22.0.0/bin'),
        '/usr/local/bin',
        '/opt/homebrew/bin',
        path.join(homeDir, '.local/bin'),
    ];
    // Find any nvm node version directories
    const nvmDir = path.join(homeDir, '.nvm/versions/node');
    if (fs.existsSync(nvmDir)) {
        try {
            const versions = fs.readdirSync(nvmDir);
            for (const version of versions) {
                additionalPaths.push(path.join(nvmDir, version, 'bin'));
            }
        }
        catch {
            // Ignore errors
        }
    }
    const fullPath = [...new Set([...additionalPaths, ...existingPath.split(':')])].join(':');
    const ptyProcess = pty.spawn(shell, ['-l'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: {
            ...process.env,
            PATH: fullPath,
            CLAUDE_SKILLS: agent.skills.join(','),
            CLAUDE_AGENT_ID: agent.id,
            CLAUDE_PROJECT_PATH: agent.projectPath,
        },
    });
    const ptyId = (0, uuid_1.v4)();
    pty_manager_1.ptyProcesses.set(ptyId, ptyProcess);
    ptyProcess.onData((data) => {
        const agentData = exports.agents.get(agent.id);
        if (agentData) {
            agentData.output.push(data);
            agentData.lastActivity = new Date().toISOString();
            if (exports.superAgentTelegramTask && (0, utils_1.isSuperAgent)(agentData)) {
                exports.superAgentOutputBuffer.push(data);
                if (exports.superAgentOutputBuffer.length > 200) {
                    exports.superAgentOutputBuffer = exports.superAgentOutputBuffer.slice(-100);
                }
            }
            const manuallyStoppedAt = agentData._manuallyStoppedAt;
            const wasRecentlyStopped = manuallyStoppedAt && (Date.now() - manuallyStoppedAt) < 3000;
            if (!wasRecentlyStopped) {
                const newStatus = (0, utils_1.detectAgentStatus)(agentData);
                if (newStatus !== agentData.status) {
                    agentData.status = newStatus;
                    handleStatusChangeNotificationCallback(agentData, newStatus);
                    mainWindow?.webContents.send('agent:status', {
                        type: 'status',
                        agentId: agent.id,
                        status: newStatus,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
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
        const agentData = exports.agents.get(agent.id);
        if (agentData) {
            const newStatus = exitCode === 0 ? 'completed' : 'error';
            agentData.status = newStatus;
            agentData.lastActivity = new Date().toISOString();
            handleStatusChangeNotificationCallback(agentData, newStatus);
            saveAgentsCallback();
        }
        pty_manager_1.ptyProcesses.delete(ptyId);
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
//# sourceMappingURL=agent-manager.js.map