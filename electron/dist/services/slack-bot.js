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
exports.getSlackApp = getSlackApp;
exports.setSlackApp = setSlackApp;
exports.getSlackResponseChannel = getSlackResponseChannel;
exports.setSlackResponseChannel = setSlackResponseChannel;
exports.getSlackResponseThreadTs = getSlackResponseThreadTs;
exports.setSlackResponseThreadTs = setSlackResponseThreadTs;
exports.getSuperAgentSlackTask = getSuperAgentSlackTask;
exports.setSuperAgentSlackTask = setSuperAgentSlackTask;
exports.getSuperAgentSlackBuffer = getSuperAgentSlackBuffer;
exports.setSuperAgentSlackBuffer = setSuperAgentSlackBuffer;
exports.clearSuperAgentSlackBuffer = clearSuperAgentSlackBuffer;
exports.sendSlackMessage = sendSlackMessage;
exports.initSlackBot = initSlackBot;
exports.handleSlackCommand = handleSlackCommand;
exports.sendToSuperAgentFromSlack = sendToSuperAgentFromSlack;
exports.stopSlackBot = stopSlackBot;
exports.setGetClaudeStatsRef = setGetClaudeStatsRef;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const bolt_1 = require("@slack/bolt");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
const agent_manager_1 = require("../core/agent-manager");
const pty_manager_1 = require("../core/pty-manager");
const window_manager_1 = require("../core/window-manager");
const electron_1 = require("electron");
// Slack bot state
let slackApp = null;
let slackResponseChannel = null;
let slackResponseThreadTs = null; // Track thread timestamp for replies
let superAgentSlackTask = false;
let superAgentSlackBuffer = [];
// Export references for external access
function getSlackApp() {
    return slackApp;
}
function setSlackApp(app) {
    slackApp = app;
}
function getSlackResponseChannel() {
    return slackResponseChannel;
}
function setSlackResponseChannel(channel) {
    slackResponseChannel = channel;
}
function getSlackResponseThreadTs() {
    return slackResponseThreadTs;
}
function setSlackResponseThreadTs(ts) {
    slackResponseThreadTs = ts;
}
function getSuperAgentSlackTask() {
    return superAgentSlackTask;
}
function setSuperAgentSlackTask(value) {
    superAgentSlackTask = value;
}
function getSuperAgentSlackBuffer() {
    return superAgentSlackBuffer;
}
function setSuperAgentSlackBuffer(buffer) {
    superAgentSlackBuffer = buffer;
}
function clearSuperAgentSlackBuffer() {
    superAgentSlackBuffer = [];
}
// Helper to initialize agent PTY with proper callbacks
async function initAgentPtyWithCallbacks(agent) {
    return (0, agent_manager_1.initAgentPty)(agent, (0, window_manager_1.getMainWindow)(), (agent, newStatus) => {
        // Simple status change handler - just update the agent
        agent.status = newStatus;
    }, agent_manager_1.saveAgents);
}
// Send message to Slack
async function sendSlackMessage(text, appSettings, channel) {
    if (!slackApp || (!channel && !appSettings.slackChannelId))
        return;
    const targetChannel = channel || appSettings.slackChannelId;
    try {
        // Slack has a 4000 char limit for text, truncate if needed
        const maxLen = 3900;
        const truncated = text.length > maxLen ? text.slice(0, maxLen) + '\n\n_(truncated)_' : text;
        await slackApp.client.chat.postMessage({
            channel: targetChannel,
            text: `:crown: ${truncated}`,
            mrkdwn: true,
        });
    }
    catch (err) {
        console.error('Failed to send Slack message:', err);
    }
}
// Initialize Slack bot
function initSlackBot(appSettings, onSettingsChanged, mainWindow) {
    // Stop existing bot if any
    if (slackApp) {
        slackApp.stop().catch(err => console.error('Error stopping Slack app:', err));
        slackApp = null;
    }
    if (!appSettings.slackEnabled || !appSettings.slackBotToken || !appSettings.slackAppToken) {
        console.log('Slack bot disabled or missing tokens');
        return;
    }
    try {
        slackApp = new bolt_1.App({
            token: appSettings.slackBotToken,
            appToken: appSettings.slackAppToken,
            socketMode: true,
            logLevel: bolt_1.LogLevel.DEBUG,
        });
        // Handle app mentions
        slackApp.event('app_mention', async ({ event, say }) => {
            console.log('Slack app_mention event received:', JSON.stringify(event, null, 2));
            // Remove the bot mention from the text
            const text = event.text.replace(/<@[A-Z0-9]+>/gi, '').trim();
            slackResponseChannel = event.channel;
            // Use thread_ts if replying in a thread, otherwise use the message ts to start a thread
            slackResponseThreadTs =
                event.thread_ts ||
                    event.ts ||
                    null;
            // Save channel ID
            if (appSettings.slackChannelId !== event.channel) {
                appSettings.slackChannelId = event.channel;
                onSettingsChanged(appSettings);
                mainWindow?.webContents.send('settings:updated', appSettings);
            }
            await handleSlackCommand(text, event.channel, say, appSettings, mainWindow);
        });
        // Handle direct messages - use 'message' event with subtype filter
        slackApp.message(async ({ message, say }) => {
            // Cast to any for flexibility with Slack's complex message types
            const msg = message;
            console.log('Slack message event received:', JSON.stringify(msg, null, 2));
            // Skip bot messages and message changes/deletions
            if (msg.bot_id)
                return;
            if (msg.subtype)
                return; // Skip edited, deleted, etc.
            if (!msg.text)
                return;
            const channel = msg.channel;
            slackResponseChannel = channel;
            // Use thread_ts if replying in a thread, otherwise use the message ts to start a thread
            slackResponseThreadTs = msg.thread_ts || msg.ts || null;
            // Save channel for responses
            if (appSettings.slackChannelId !== channel) {
                appSettings.slackChannelId = channel;
                onSettingsChanged(appSettings);
                mainWindow?.webContents.send('settings:updated', appSettings);
            }
            await sendToSuperAgentFromSlack(channel, msg.text, say, appSettings, mainWindow);
        });
        // Log all events for debugging
        slackApp.use(async ({ next, payload }) => {
            console.log('Slack event payload type:', payload?.type || 'unknown');
            await next();
        });
        // Start the app
        slackApp
            .start()
            .then(() => {
            console.log('Slack bot started (Socket Mode)');
        })
            .catch(err => {
            console.error('Failed to start Slack bot:', err);
            slackApp = null;
        });
    }
    catch (err) {
        console.error('Failed to initialize Slack bot:', err);
        slackApp = null;
    }
}
// Handle Slack commands
async function handleSlackCommand(text, channel, say, appSettings, mainWindow) {
    const lowerText = text.toLowerCase().trim();
    if (lowerText === 'help' || lowerText === '') {
        await say(`:crown: *Claude Manager Bot*\n\n` +
            `*Commands:*\n` +
            `• \`status\` - Show all agents status\n` +
            `• \`agents\` - List agents with details\n` +
            `• \`projects\` - List all projects\n` +
            `• \`start <agent> <task>\` - Start an agent\n` +
            `• \`stop <agent>\` - Stop an agent\n` +
            `• \`usage\` - Show usage & cost stats\n` +
            `• \`help\` - Show this help message\n\n` +
            `Or just send a message to talk to the Super Agent!`);
        return;
    }
    if (lowerText === 'status') {
        const agentList = Array.from(agent_manager_1.agents.values());
        if (agentList.length === 0) {
            await say(':package: No agents created yet.');
            return;
        }
        const running = agentList.filter(a => a.status === 'running');
        const waiting = agentList.filter(a => a.status === 'waiting');
        const idle = agentList.filter(a => a.status === 'idle' || a.status === 'completed');
        const error = agentList.filter(a => a.status === 'error');
        let response = `:bar_chart: *Agents Status*\n\n`;
        if (running.length > 0) {
            response += `:large_green_circle: *Running (${running.length}):*\n`;
            running.forEach(a => {
                response += (0, utils_1.formatSlackAgentStatus)(a);
            });
            response += '\n';
        }
        if (waiting.length > 0) {
            response += `:large_yellow_circle: *Waiting (${waiting.length}):*\n`;
            waiting.forEach(a => {
                response += (0, utils_1.formatSlackAgentStatus)(a);
            });
            response += '\n';
        }
        if (error.length > 0) {
            response += `:red_circle: *Error (${error.length}):*\n`;
            error.forEach(a => {
                response += (0, utils_1.formatSlackAgentStatus)(a);
            });
            response += '\n';
        }
        if (idle.length > 0) {
            response += `:white_circle: *Idle (${idle.length}):*\n`;
            idle.forEach(a => {
                response += (0, utils_1.formatSlackAgentStatus)(a);
            });
        }
        await say(response);
        return;
    }
    if (lowerText === 'agents') {
        const agentList = Array.from(agent_manager_1.agents.values());
        if (agentList.length === 0) {
            await say(':package: No agents created yet.');
            return;
        }
        let response = `:robot_face: *All Agents*\n\n`;
        agentList.forEach(a => {
            response += (0, utils_1.formatSlackAgentStatus)(a) + '\n';
        });
        await say(response);
        return;
    }
    if (lowerText === 'projects') {
        const agentList = Array.from(agent_manager_1.agents.values()).filter(a => !(0, utils_1.isSuperAgent)(a));
        if (agentList.length === 0) {
            await say(':package: No projects with agents yet.');
            return;
        }
        const projectsMap = new Map();
        agentList.forEach(agent => {
            const path = agent.projectPath;
            if (!projectsMap.has(path)) {
                projectsMap.set(path, []);
            }
            projectsMap.get(path).push(agent);
        });
        let response = `:file_folder: *Projects*\n\n`;
        projectsMap.forEach((projectAgents, projectPath) => {
            const projectName = projectPath.split('/').pop() || 'Unknown';
            response += `:open_file_folder: *${projectName}*\n`;
            response += `    \`${projectPath}\`\n`;
            response += `    :busts_in_silhouette: Agents: ${projectAgents
                .map(a => {
                const emoji = constants_1.SLACK_CHARACTER_FACES[a.character || ''] || ':robot_face:';
                const status = a.status === 'running'
                    ? ':large_green_circle:'
                    : a.status === 'waiting'
                        ? ':large_yellow_circle:'
                        : a.status === 'error'
                            ? ':red_circle:'
                            : ':white_circle:';
                return `${emoji}${a.name}${status}`;
            })
                .join(', ')}\n\n`;
        });
        await say(response);
        return;
    }
    if (lowerText === 'usage') {
        try {
            const stats = await getClaudeStats();
            if (!stats) {
                await say(':bar_chart: No usage data available yet.');
                return;
            }
            // Use same pricing as Telegram
            const MODEL_PRICING = {
                'claude-opus-4-5-20251101': {
                    inputPerMTok: 5,
                    outputPerMTok: 25,
                    cacheHitsPerMTok: 0.5,
                    cache5mWritePerMTok: 6.25,
                },
                'claude-opus-4-5': {
                    inputPerMTok: 5,
                    outputPerMTok: 25,
                    cacheHitsPerMTok: 0.5,
                    cache5mWritePerMTok: 6.25,
                },
                'claude-sonnet-4': {
                    inputPerMTok: 3,
                    outputPerMTok: 15,
                    cacheHitsPerMTok: 0.3,
                    cache5mWritePerMTok: 3.75,
                },
            };
            const getModelPricing = (modelId) => {
                if (MODEL_PRICING[modelId])
                    return MODEL_PRICING[modelId];
                const lower = modelId.toLowerCase();
                if (lower.includes('opus-4-5') || lower.includes('opus-4.5'))
                    return MODEL_PRICING['claude-opus-4-5'];
                if (lower.includes('sonnet'))
                    return MODEL_PRICING['claude-sonnet-4'];
                return MODEL_PRICING['claude-sonnet-4'];
            };
            let totalCost = 0;
            let totalInput = 0;
            let totalOutput = 0;
            if (stats.modelUsage) {
                Object.entries(stats.modelUsage).forEach(([modelId, usageUnknown]) => {
                    const usage = usageUnknown;
                    const input = usage.inputTokens || 0;
                    const output = usage.outputTokens || 0;
                    const cacheRead = usage.cacheReadInputTokens || 0;
                    const cacheWrite = usage.cacheCreationInputTokens || 0;
                    totalInput += input;
                    totalOutput += output;
                    const pricing = getModelPricing(modelId);
                    const inputCost = (input * pricing.inputPerMTok) / 1000000;
                    const outputCost = (output * pricing.outputPerMTok) / 1000000;
                    const cacheReadCost = (cacheRead * pricing.cacheHitsPerMTok) / 1000000;
                    const cacheWriteCost = (cacheWrite * pricing.cache5mWritePerMTok) / 1000000;
                    totalCost += inputCost + outputCost + cacheReadCost + cacheWriteCost;
                });
            }
            let statsText = ':bar_chart: *Usage Stats*\n\n';
            statsText += `Input Tokens: ${totalInput.toLocaleString()}\n`;
            statsText += `Output Tokens: ${totalOutput.toLocaleString()}\n`;
            statsText += `Total Cost: $${totalCost.toFixed(2)}\n`;
            await say(statsText);
        }
        catch (err) {
            console.error('Failed to get usage stats:', err);
            await say(':x: Failed to get usage stats');
        }
        return;
    }
    if (lowerText.startsWith('start ')) {
        const parts = text.slice(5).trim().split(' ');
        const agentName = parts[0].toLowerCase();
        const task = parts.slice(1).join(' ');
        if (!task) {
            await say(':x: Usage: `start <agent> <task>`');
            return;
        }
        const agent = Array.from(agent_manager_1.agents.values()).find(a => a.name?.toLowerCase().includes(agentName) || a.id === agentName);
        if (!agent) {
            await say(`:x: Agent "${agentName}" not found.`);
            return;
        }
        if (agent.status === 'running') {
            await say(`:warning: ${agent.name} is already running.`);
            return;
        }
        try {
            const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");
            if (!agent.ptyId || !pty_manager_1.ptyProcesses.has(agent.ptyId)) {
                const ptyId = await initAgentPtyWithCallbacks(agent);
                agent.ptyId = ptyId;
            }
            const ptyProcess = pty_manager_1.ptyProcesses.get(agent.ptyId);
            if (!ptyProcess) {
                await say(':x: Failed to initialize agent terminal.');
                return;
            }
            let command = 'claude';
            if (agent.skipPermissions)
                command += ' --dangerously-skip-permissions';
            if (agent.secondaryProjectPath) {
                command += ` --add-dir '${agent.secondaryProjectPath.replace(/'/g, "'\\''")}'`;
            }
            command += ` '${task.replace(/'/g, "'\\''")}'`;
            agent.status = 'running';
            agent.currentTask = task.slice(0, 100);
            agent.lastActivity = new Date().toISOString();
            ptyProcess.write(`cd '${workingPath}' && ${command}`);
            ptyProcess.write('\r');
            (0, agent_manager_1.saveAgents)();
            const emoji = (0, utils_1.isSuperAgent)(agent) ? ':crown:' : constants_1.SLACK_CHARACTER_FACES[agent.character || ''] || ':robot_face:';
            await say(`:rocket: Started *${agent.name}*\n\n${emoji} Task: ${task}`);
        }
        catch (err) {
            console.error('Failed to start agent from Slack:', err);
            await say(`:x: Failed to start agent: ${err}`);
        }
        return;
    }
    if (lowerText.startsWith('stop ')) {
        const agentName = text.slice(5).trim().toLowerCase();
        const agent = Array.from(agent_manager_1.agents.values()).find(a => a.name?.toLowerCase().includes(agentName) || a.id === agentName);
        if (!agent) {
            await say(`:x: Agent "${agentName}" not found.`);
            return;
        }
        if (agent.status !== 'running' && agent.status !== 'waiting') {
            await say(`:warning: ${agent.name} is not running.`);
            return;
        }
        if (agent.ptyId) {
            const ptyProcess = pty_manager_1.ptyProcesses.get(agent.ptyId);
            if (ptyProcess) {
                ptyProcess.write('\x03'); // Ctrl+C
            }
        }
        agent.status = 'idle';
        agent.currentTask = undefined;
        (0, agent_manager_1.saveAgents)();
        await say(`:octagonal_sign: Stopped *${agent.name}*`);
        return;
    }
    // Default: forward to Super Agent
    await sendToSuperAgentFromSlack(channel, text, say, appSettings, mainWindow);
}
// Send message to Super Agent from Slack
async function sendToSuperAgentFromSlack(channel, message, say, appSettings, mainWindow) {
    const superAgent = (0, utils_1.getSuperAgent)(agent_manager_1.agents);
    if (!superAgent) {
        await say(':crown: No Super Agent found.\n\nCreate one in Claude Manager first, or use `start <agent> <task>` to start a specific agent.');
        return;
    }
    // Sanitize message - replace newlines with spaces for terminal compatibility
    const sanitizedMessage = message.replace(/\r?\n/g, ' ').trim();
    try {
        // Initialize PTY if needed
        if (!superAgent.ptyId || !pty_manager_1.ptyProcesses.has(superAgent.ptyId)) {
            const ptyId = await initAgentPtyWithCallbacks(superAgent);
            superAgent.ptyId = ptyId;
        }
        const ptyProcess = pty_manager_1.ptyProcesses.get(superAgent.ptyId);
        if (!ptyProcess) {
            await say(':x: Failed to connect to Super Agent terminal.');
            return;
        }
        // If agent is running or waiting, send message to existing session
        if (superAgent.status === 'running' || superAgent.status === 'waiting') {
            superAgentSlackTask = true;
            superAgentSlackBuffer = [];
            superAgent.currentTask = sanitizedMessage.slice(0, 100);
            superAgent.lastActivity = new Date().toISOString();
            (0, agent_manager_1.saveAgents)();
            const slackMessage = `[FROM SLACK - Use send_slack MCP tool to respond!] ${sanitizedMessage}`;
            ptyProcess.write(slackMessage);
            ptyProcess.write('\r');
            await say(':crown: Super Agent is processing...');
        }
        else if (superAgent.status === 'idle' ||
            superAgent.status === 'completed' ||
            superAgent.status === 'error') {
            // No active session, start a new one
            const workingPath = (superAgent.worktreePath || superAgent.projectPath).replace(/'/g, "'\\''");
            // Build command with instructions file
            let command = 'claude';
            const mcpConfigPath = path.join(electron_1.app.getPath('home'), '.claude', 'mcp.json');
            if (fs.existsSync(mcpConfigPath)) {
                command += ` --mcp-config '${mcpConfigPath}'`;
            }
            // Add system prompt from instructions file
            const instructionsPath = (0, utils_1.getSuperAgentInstructionsPath)();
            if (fs.existsSync(instructionsPath)) {
                command += ` --append-system-prompt "$(cat '${instructionsPath}')"`;
            }
            if (superAgent.skipPermissions)
                command += ' --dangerously-skip-permissions';
            // Simple prompt with Slack context - the detailed instructions come from the file
            const userPrompt = `[FROM SLACK - Use send_slack MCP tool to respond!] ${sanitizedMessage}`;
            command += ` '${userPrompt.replace(/'/g, "'\\''")}'`;
            superAgent.status = 'running';
            superAgent.currentTask = sanitizedMessage.slice(0, 100);
            superAgent.lastActivity = new Date().toISOString();
            superAgentSlackTask = true;
            superAgentSlackBuffer = [];
            ptyProcess.write(`cd '${workingPath}' && ${command}`);
            ptyProcess.write('\r');
            (0, agent_manager_1.saveAgents)();
            await say(':crown: Super Agent is processing your request...');
        }
        else {
            await say(`:crown: Super Agent is in ${superAgent.status} state. Try again in a moment.`);
        }
    }
    catch (err) {
        console.error('Failed to send to Super Agent:', err);
        await say(`:x: Error: ${err}`);
    }
}
// Stop Slack bot
function stopSlackBot() {
    if (slackApp) {
        slackApp.stop().catch(err => console.error('Error stopping Slack app:', err));
        slackApp = null;
        console.log('Slack bot stopped');
    }
}
// Helper function to get Claude stats - provided by caller
let getClaudeStatsRef = null;
function setGetClaudeStatsRef(fn) {
    getClaudeStatsRef = fn;
}
async function getClaudeStats() {
    if (!getClaudeStatsRef) {
        return undefined;
    }
    return getClaudeStatsRef();
}
//# sourceMappingURL=slack-bot.js.map