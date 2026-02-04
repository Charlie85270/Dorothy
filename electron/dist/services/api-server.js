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
exports.startApiServer = startApiServer;
exports.stopApiServer = stopApiServer;
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const pty = __importStar(require("node-pty"));
const electron_1 = require("electron");
const uuid_1 = require("uuid");
const constants_1 = require("../constants");
const agent_manager_1 = require("../core/agent-manager");
const pty_manager_1 = require("../core/pty-manager");
let apiServer = null;
function startApiServer(mainWindow, appSettings, getTelegramBot, getSlackApp, slackResponseChannel, slackResponseThreadTs, handleStatusChangeNotificationCallback, sendNotificationCallback, initAgentPtyCallback) {
    if (apiServer)
        return;
    apiServer = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        const url = new URL(req.url || '/', `http://localhost:${constants_1.API_PORT}`);
        const pathname = url.pathname;
        let body = {};
        if (req.method === 'POST') {
            try {
                const chunks = [];
                for await (const chunk of req) {
                    chunks.push(chunk);
                }
                const data = Buffer.concat(chunks).toString();
                if (data) {
                    body = JSON.parse(data);
                }
            }
            catch {
                // Ignore parse errors
            }
        }
        const sendJson = (data, status = 200) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        };
        try {
            // GET /api/agents
            if (pathname === '/api/agents' && req.method === 'GET') {
                const agentList = Array.from(agent_manager_1.agents.values()).map(a => ({
                    id: a.id,
                    name: a.name,
                    status: a.status,
                    projectPath: a.projectPath,
                    secondaryProjectPath: a.secondaryProjectPath,
                    skills: a.skills,
                    currentTask: a.currentTask,
                    lastActivity: a.lastActivity,
                    character: a.character,
                    branchName: a.branchName,
                    error: a.error,
                }));
                sendJson({ agents: agentList });
                return;
            }
            // GET /api/agents/:id
            const agentMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
            if (agentMatch && req.method === 'GET') {
                const agent = agent_manager_1.agents.get(agentMatch[1]);
                if (!agent) {
                    sendJson({ error: 'Agent not found' }, 404);
                    return;
                }
                sendJson({ agent });
                return;
            }
            // GET /api/agents/:id/output
            const outputMatch = pathname.match(/^\/api\/agents\/([^/]+)\/output$/);
            if (outputMatch && req.method === 'GET') {
                const agent = agent_manager_1.agents.get(outputMatch[1]);
                if (!agent) {
                    sendJson({ error: 'Agent not found' }, 404);
                    return;
                }
                const lines = parseInt(url.searchParams.get('lines') || '100', 10);
                const output = agent.output.slice(-lines).join('');
                sendJson({ output, status: agent.status });
                return;
            }
            // POST /api/agents
            if (pathname === '/api/agents' && req.method === 'POST') {
                const { projectPath, name, skills = [], character, skipPermissions, secondaryProjectPath } = body;
                if (!projectPath) {
                    sendJson({ error: 'projectPath is required' }, 400);
                    return;
                }
                const id = (0, uuid_1.v4)();
                const agent = {
                    id,
                    status: 'idle',
                    projectPath,
                    secondaryProjectPath,
                    skills,
                    output: [],
                    lastActivity: new Date().toISOString(),
                    character,
                    name: name || `Agent ${id.slice(0, 6)}`,
                    skipPermissions,
                };
                agent_manager_1.agents.set(id, agent);
                (0, agent_manager_1.saveAgents)();
                sendJson({ agent });
                return;
            }
            // POST /api/agents/:id/start
            const startMatch = pathname.match(/^\/api\/agents\/([^/]+)\/start$/);
            if (startMatch && req.method === 'POST') {
                const agent = agent_manager_1.agents.get(startMatch[1]);
                if (!agent) {
                    sendJson({ error: 'Agent not found' }, 404);
                    return;
                }
                const { prompt, model, skipPermissions } = body;
                if (!prompt) {
                    sendJson({ error: 'prompt is required' }, 400);
                    return;
                }
                const workingDir = agent.worktreePath || agent.projectPath;
                let command = `cd '${workingDir}' && claude`;
                const isSuperAgentApi = agent.name?.toLowerCase().includes('super agent') ||
                    agent.name?.toLowerCase().includes('orchestrator');
                if (isSuperAgentApi) {
                    const mcpConfigPath = path.join(electron_1.app.getPath('home'), '.claude', 'mcp.json');
                    if (fs.existsSync(mcpConfigPath)) {
                        command += ` --mcp-config '${mcpConfigPath}'`;
                    }
                }
                if (agent.secondaryProjectPath) {
                    command += ` --add-dir '${agent.secondaryProjectPath}'`;
                }
                if (skipPermissions !== undefined ? skipPermissions : agent.skipPermissions) {
                    command += ' --dangerously-skip-permissions';
                }
                if (model) {
                    command += ` --model ${model}`;
                }
                // Build final prompt with skills directive if agent has skills
                let finalPrompt = prompt;
                if (agent.skills && agent.skills.length > 0 && !isSuperAgentApi) {
                    const skillsList = agent.skills.join(', ');
                    finalPrompt = `[IMPORTANT: Use these skills for this session: ${skillsList}. Invoke them with /<skill-name> when relevant to the task.] ${prompt}`;
                }
                command += ` '${finalPrompt.replace(/'/g, "'\\''")}'`;
                // Use bash for more reliable PATH handling with nvm
                const shell = '/bin/bash';
                // Build PATH that includes nvm and other common locations for claude
                const homeDir = process.env.HOME || electron_1.app.getPath('home');
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
                const ptyProcess = pty.spawn(shell, ['-l', '-c', command], {
                    name: 'xterm-256color',
                    cols: 120,
                    rows: 40,
                    cwd: workingDir,
                    env: {
                        ...process.env,
                        PATH: fullPath,
                        TERM: 'xterm-256color',
                        CLAUDE_SKILLS: agent.skills?.join(',') || '',
                        CLAUDE_AGENT_ID: agent.id,
                        CLAUDE_PROJECT_PATH: agent.projectPath,
                    },
                });
                const ptyId = (0, uuid_1.v4)();
                pty_manager_1.ptyProcesses.set(ptyId, ptyProcess);
                agent.ptyId = ptyId;
                agent.status = 'running';
                agent.currentTask = prompt;
                agent.output = [];
                agent.lastActivity = new Date().toISOString();
                (0, agent_manager_1.saveAgents)();
                ptyProcess.onData((data) => {
                    agent.output.push(data);
                    if (agent.output.length > 10000) {
                        agent.output = agent.output.slice(-5000);
                    }
                    agent.lastActivity = new Date().toISOString();
                    const recentOutput = agent.output.slice(-20).join('');
                    const isWaiting = constants_1.CLAUDE_PATTERNS.waitingForInput.some(p => p.test(recentOutput));
                    if (isWaiting && agent.status === 'running') {
                        agent.status = 'waiting';
                    }
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('agent:output', { agentId: agent.id, data });
                    }
                });
                ptyProcess.onExit(({ exitCode }) => {
                    agent.status = exitCode === 0 ? 'completed' : 'error';
                    if (exitCode !== 0) {
                        agent.error = `Process exited with code ${exitCode}`;
                    }
                    agent.lastActivity = new Date().toISOString();
                    pty_manager_1.ptyProcesses.delete(ptyId);
                    (0, agent_manager_1.saveAgents)();
                });
                sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
                return;
            }
            // POST /api/agents/:id/stop
            const stopMatch = pathname.match(/^\/api\/agents\/([^/]+)\/stop$/);
            if (stopMatch && req.method === 'POST') {
                const agent = agent_manager_1.agents.get(stopMatch[1]);
                if (!agent) {
                    sendJson({ error: 'Agent not found' }, 404);
                    return;
                }
                if (agent.ptyId) {
                    const ptyProcess = pty_manager_1.ptyProcesses.get(agent.ptyId);
                    if (ptyProcess) {
                        ptyProcess.kill();
                        pty_manager_1.ptyProcesses.delete(agent.ptyId);
                    }
                }
                agent.status = 'idle';
                agent.currentTask = undefined;
                agent.lastActivity = new Date().toISOString();
                (0, agent_manager_1.saveAgents)();
                sendJson({ success: true });
                return;
            }
            // POST /api/agents/:id/message
            const messageMatch = pathname.match(/^\/api\/agents\/([^/]+)\/message$/);
            if (messageMatch && req.method === 'POST') {
                const agent = agent_manager_1.agents.get(messageMatch[1]);
                if (!agent) {
                    sendJson({ error: 'Agent not found' }, 404);
                    return;
                }
                const { message } = body;
                if (!message) {
                    sendJson({ error: 'message is required' }, 400);
                    return;
                }
                if (!agent.ptyId || !pty_manager_1.ptyProcesses.has(agent.ptyId)) {
                    const ptyId = await initAgentPtyCallback(agent);
                    agent.ptyId = ptyId;
                }
                const ptyProcess = pty_manager_1.ptyProcesses.get(agent.ptyId);
                if (ptyProcess) {
                    ptyProcess.write(message);
                    ptyProcess.write('\r');
                    agent.status = 'running';
                    agent.lastActivity = new Date().toISOString();
                    (0, agent_manager_1.saveAgents)();
                    sendJson({ success: true });
                    return;
                }
                sendJson({ error: 'Failed to send message - PTY not available' }, 500);
                return;
            }
            // DELETE /api/agents/:id
            const deleteMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
            if (deleteMatch && req.method === 'DELETE') {
                const agent = agent_manager_1.agents.get(deleteMatch[1]);
                if (!agent) {
                    sendJson({ error: 'Agent not found' }, 404);
                    return;
                }
                if (agent.ptyId) {
                    const ptyProcess = pty_manager_1.ptyProcesses.get(agent.ptyId);
                    if (ptyProcess) {
                        ptyProcess.kill();
                        pty_manager_1.ptyProcesses.delete(agent.ptyId);
                    }
                }
                agent_manager_1.agents.delete(deleteMatch[1]);
                (0, agent_manager_1.saveAgents)();
                sendJson({ success: true });
                return;
            }
            // POST /api/telegram/send
            if (pathname === '/api/telegram/send' && req.method === 'POST') {
                const { message } = body;
                if (!message) {
                    sendJson({ error: 'message is required' }, 400);
                    return;
                }
                const telegramBot = getTelegramBot();
                if (!telegramBot || !appSettings.telegramChatId) {
                    sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
                    return;
                }
                try {
                    await telegramBot.sendMessage(appSettings.telegramChatId, `👑 ${message}`, { parse_mode: 'Markdown' });
                    sendJson({ success: true });
                }
                catch (err) {
                    try {
                        await telegramBot.sendMessage(appSettings.telegramChatId, `👑 ${message}`);
                        sendJson({ success: true });
                    }
                    catch (err2) {
                        sendJson({ error: `Failed to send: ${err2}` }, 500);
                    }
                }
                return;
            }
            // POST /api/slack/send
            if (pathname === '/api/slack/send' && req.method === 'POST') {
                const { message } = body;
                if (!message) {
                    sendJson({ error: 'message is required' }, 400);
                    return;
                }
                const slackApp = getSlackApp();
                if (!slackApp || !appSettings.slackChannelId) {
                    sendJson({ error: 'Slack not configured or no channel ID' }, 400);
                    return;
                }
                try {
                    const postParams = {
                        channel: slackResponseChannel || appSettings.slackChannelId,
                        text: `:crown: ${message}`,
                        mrkdwn: true,
                    };
                    if (slackResponseThreadTs) {
                        postParams.thread_ts = slackResponseThreadTs;
                    }
                    await slackApp.client.chat.postMessage(postParams);
                    sendJson({ success: true });
                }
                catch (err) {
                    sendJson({ error: `Failed to send: ${err}` }, 500);
                }
                return;
            }
            // POST /api/hooks/status
            if (pathname === '/api/hooks/status' && req.method === 'POST') {
                const { agent_id, session_id, status, source, reason, waiting_reason } = body;
                if (!agent_id || !status) {
                    sendJson({ error: 'agent_id and status are required' }, 400);
                    return;
                }
                let agent;
                agent = agent_manager_1.agents.get(agent_id);
                if (!agent) {
                    for (const [, a] of agent_manager_1.agents) {
                        if (a.currentSessionId === session_id) {
                            agent = a;
                            break;
                        }
                    }
                }
                if (!agent) {
                    sendJson({ success: false, message: 'Agent not found' });
                    return;
                }
                const oldStatus = agent.status;
                if (status === 'running' && (agent.status === 'idle' || agent.status === 'waiting' || agent.status === 'completed')) {
                    agent.status = 'running';
                    agent.currentSessionId = session_id;
                }
                else if (status === 'waiting' && agent.status === 'running') {
                    agent.status = 'waiting';
                }
                else if (status === 'idle') {
                    agent.status = 'idle';
                    agent.currentSessionId = undefined;
                }
                else if (status === 'completed') {
                    agent.status = 'completed';
                }
                agent.lastActivity = new Date().toISOString();
                if (oldStatus !== agent.status) {
                    handleStatusChangeNotificationCallback(agent, agent.status);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('agent:status', {
                            agentId: agent.id,
                            status: agent.status,
                            waitingReason: waiting_reason
                        });
                    }
                }
                sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
                return;
            }
            // POST /api/hooks/notification
            if (pathname === '/api/hooks/notification' && req.method === 'POST') {
                const { agent_id, session_id, type, title, message } = body;
                if (!agent_id || !type) {
                    sendJson({ error: 'agent_id and type are required' }, 400);
                    return;
                }
                let agent = agent_manager_1.agents.get(agent_id);
                if (!agent) {
                    for (const [, a] of agent_manager_1.agents) {
                        if (a.currentSessionId === session_id) {
                            agent = a;
                            break;
                        }
                    }
                }
                const agentName = agent?.name || 'Claude';
                if (type === 'permission_prompt') {
                    if (appSettings.notifyOnWaiting) {
                        sendNotificationCallback(`${agentName} needs permission`, message || 'Claude needs your permission to proceed', agent?.id);
                    }
                }
                else if (type === 'idle_prompt') {
                    if (appSettings.notifyOnWaiting) {
                        sendNotificationCallback(`${agentName} is waiting`, message || 'Claude is waiting for your input', agent?.id);
                    }
                }
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('agent:notification', {
                        agentId: agent?.id,
                        type,
                        title,
                        message
                    });
                }
                sendJson({ success: true });
                return;
            }
            sendJson({ error: 'Not found' }, 404);
        }
        catch (error) {
            console.error('API error:', error);
            sendJson({ error: 'Internal server error' }, 500);
        }
    });
    apiServer.listen(constants_1.API_PORT, '127.0.0.1', () => {
        console.log(`Agent API server running on http://127.0.0.1:${constants_1.API_PORT}`);
    });
    apiServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${constants_1.API_PORT} is in use, API server not started`);
        }
        else {
            console.error('API server error:', err);
        }
    });
}
function stopApiServer() {
    if (apiServer) {
        apiServer.close();
        apiServer = null;
    }
}
//# sourceMappingURL=api-server.js.map