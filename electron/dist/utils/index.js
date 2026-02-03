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
exports.setMainWindow = setMainWindow;
exports.getAppBasePath = getAppBasePath;
exports.ensureDataDir = ensureDataDir;
exports.sendNotification = sendNotification;
exports.isSuperAgent = isSuperAgent;
exports.getSuperAgent = getSuperAgent;
exports.formatAgentStatus = formatAgentStatus;
exports.formatSlackAgentStatus = formatSlackAgentStatus;
exports.getSuperAgentInstructionsPath = getSuperAgentInstructionsPath;
exports.getSuperAgentInstructions = getSuperAgentInstructions;
exports.detectAgentStatus = detectAgentStatus;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const constants_1 = require("../constants");
let mainWindow = null;
function setMainWindow(window) {
    mainWindow = window;
}
function getAppBasePath() {
    let appPath = electron_1.app.getAppPath();
    if (appPath.includes('app.asar')) {
        appPath = appPath.replace('app.asar', 'app.asar.unpacked');
    }
    return path.join(appPath, 'out');
}
function ensureDataDir() {
    if (!fs.existsSync(constants_1.DATA_DIR)) {
        fs.mkdirSync(constants_1.DATA_DIR, { recursive: true });
    }
}
function sendNotification(title, body, agentId, appSettings) {
    if (!appSettings?.notificationsEnabled)
        return;
    const notification = new electron_1.Notification({
        title,
        body,
        silent: false,
    });
    notification.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
            if (agentId) {
                mainWindow.webContents.send('agent:focus', { agentId });
            }
        }
    });
    notification.show();
}
function isSuperAgent(agent) {
    const name = agent.name?.toLowerCase() || '';
    return name.includes('super agent') || name.includes('orchestrator');
}
function getSuperAgent(agents) {
    return Array.from(agents.values()).find(a => isSuperAgent(a));
}
function formatAgentStatus(agent) {
    const isSuper = isSuperAgent(agent);
    const emoji = isSuper ? '👑' : (constants_1.TG_CHARACTER_FACES[agent.character || ''] || '🤖');
    const statusEmoji = {
        idle: '⚪', running: '🟢', completed: '✅', error: '🔴', waiting: '🟡'
    }[agent.status] || '⚪';
    let text = `${emoji} *${agent.name || 'Unnamed'}* ${statusEmoji}\n`;
    text += `   Status: ${agent.status}\n`;
    if (agent.currentTask) {
        text += `   Task: ${agent.currentTask.slice(0, 50)}${agent.currentTask.length > 50 ? '...' : ''}\n`;
    }
    if (!isSuper) {
        text += `   Project: \`${agent.projectPath.split('/').pop()}\``;
    }
    return text;
}
function formatSlackAgentStatus(a) {
    const isSuper = isSuperAgent(a);
    const emoji = isSuper ? ':crown:' : (constants_1.SLACK_CHARACTER_FACES[a.character || ''] || ':robot_face:');
    const statusEmoji = a.status === 'running' ? ':large_green_circle:' :
        a.status === 'waiting' ? ':large_yellow_circle:' :
            a.status === 'error' ? ':red_circle:' : ':white_circle:';
    let text = `${emoji} *${a.name}* ${statusEmoji}\n`;
    if (!isSuper) {
        const project = a.projectPath.split('/').pop() || 'Unknown';
        text += `    :file_folder: \`${project}\`\n`;
    }
    if (a.skills.length > 0) {
        text += `    :wrench: ${a.skills.slice(0, 3).join(', ')}${a.skills.length > 3 ? '...' : ''}\n`;
    }
    if (a.currentTask && a.status === 'running') {
        text += `    :speech_balloon: _${a.currentTask.slice(0, 40)}${a.currentTask.length > 40 ? '...' : ''}_\n`;
    }
    return text;
}
/**
 * Get the path to the super agent instructions file
 */
function getSuperAgentInstructionsPath() {
    const appPath = electron_1.app.getAppPath();
    // In development, appPath is the project root
    // In production (asar), appPath is inside the asar archive
    return path.join(appPath, 'electron', 'resources', 'super-agent-instructions.md');
}
/**
 * Read super agent instructions from file
 */
function getSuperAgentInstructions() {
    const instructionsPath = getSuperAgentInstructionsPath();
    try {
        if (fs.existsSync(instructionsPath)) {
            return fs.readFileSync(instructionsPath, 'utf-8');
        }
    }
    catch (err) {
        console.error('Failed to read super agent instructions:', err);
    }
    // Fallback instructions
    return 'You are the Super Agent - an orchestrator that manages other Claude agents using MCP tools. Use list_agents, start_agent, get_agent_output, send_telegram, and send_slack tools.';
}
function detectAgentStatus(agent) {
    const lastChunk = agent.output.slice(-1).join('');
    const recentChunks = agent.output.slice(-10).join('');
    const extendedContext = agent.output.slice(-30).join('');
    const stripAnsi = (str) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    const cleanLastChunk = stripAnsi(lastChunk);
    const cleanRecentChunks = stripAnsi(recentChunks);
    const cleanExtendedContext = stripAnsi(extendedContext);
    const spinnerPattern = /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|◐|◓|◑|◒|⣾|⣽|⣻|⢿|⡿|⣟|⣯|⣷/;
    if (spinnerPattern.test(cleanLastChunk)) {
        return 'running';
    }
    for (const pattern of constants_1.CLAUDE_PATTERNS.working) {
        if (pattern.test(cleanLastChunk)) {
            return 'running';
        }
    }
    for (const pattern of constants_1.CLAUDE_PATTERNS.error) {
        if (pattern.test(cleanRecentChunks)) {
            return 'error';
        }
    }
    const userInputPatterns = [
        /\[Y\/n\]/i,
        /\[y\/N\]/i,
        /\(y\/n\)/i,
        /\[yes\/no\]/i,
        /accept edits/i,
        /shift\+?Tab to cycle/i,
        />\s*Commit this/i,
        /❯\s*Commit/i,
        /Press Enter to/i,
        /\(enter to confirm\)/i,
        /\(esc to cancel\)/i,
        /\d+\.\s*(Yes|No|Cancel|Skip|Allow|Deny|Accept|Reject)\b/i,
        /❯\s*\d+\./,
        />\s*\d+\.\s/,
        /\(Use arrow keys\)/i,
        /Do you want to (create|edit|delete|write|read|run|execute|allow|proceed|continue|overwrite|replace|install|update|remove)/i,
        /Allow this/i,
        /Allow .+ to/i,
        /Approve this/i,
        /Confirm this/i,
        /What would you like/i,
        /What should I/i,
        /How would you like/i,
        /Which .+ would you/i,
        /Which .+ should/i,
        /Would you like to/i,
        /Would you like me to/i,
        /Should I\s/i,
        /Shall I\s/i,
        /Choose /i,
        /Select /i,
        /Pick /i,
    ];
    let hasUserInputPrompt = false;
    for (const pattern of userInputPatterns) {
        if (pattern.test(cleanRecentChunks) || pattern.test(cleanExtendedContext)) {
            hasUserInputPrompt = true;
            break;
        }
    }
    if (hasUserInputPrompt) {
        return 'waiting';
    }
    const idlePromptPatterns = [
        /❯\s*$/m,
        /^\s*❯\s*$/m,
        /\$\s*$/m,
    ];
    for (const pattern of constants_1.CLAUDE_PATTERNS.completed) {
        if (pattern.test(cleanRecentChunks)) {
            return 'completed';
        }
    }
    for (const pattern of idlePromptPatterns) {
        if (pattern.test(cleanRecentChunks)) {
            const now = Date.now();
            const lastActivityTime = new Date(agent.lastActivity).getTime();
            const timeSinceActivity = now - lastActivityTime;
            if (timeSinceActivity > 2000) {
                return 'completed';
            }
        }
    }
    const now = Date.now();
    const lastActivityTime = new Date(agent.lastActivity).getTime();
    const timeSinceActivity = now - lastActivityTime;
    if (timeSinceActivity < 2000 && agent.output.length > 0) {
        if (agent.status === 'idle' || agent.status === 'completed') {
            return 'running';
        }
        return agent.status === 'error' ? 'error' : 'running';
    }
    return agent.status;
}
//# sourceMappingURL=index.js.map