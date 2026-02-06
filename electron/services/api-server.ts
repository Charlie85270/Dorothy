import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as pty from 'node-pty';
import { exec } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import TelegramBot from 'node-telegram-bot-api';
import { App as SlackApp } from '@slack/bolt';
import { AgentStatus, AppSettings, AgentCharacter } from '../types';
import { API_PORT, CLAUDE_PATTERNS } from '../constants';
import { isSuperAgent } from '../utils';
import { agents, saveAgents, initAgentPty } from '../core/agent-manager';
import { ptyProcesses } from '../core/pty-manager';

let apiServer: http.Server | null = null;

export function startApiServer(
  mainWindow: BrowserWindow | null,
  appSettings: AppSettings,
  getTelegramBot: () => TelegramBot | null,
  getSlackApp: () => SlackApp | null,
  slackResponseChannel: string | null,
  slackResponseThreadTs: string | null,
  handleStatusChangeNotificationCallback: (agent: AgentStatus, newStatus: string) => void,
  sendNotificationCallback: (title: string, body: string, agentId?: string) => void,
  initAgentPtyCallback: (agent: AgentStatus) => Promise<string>
) {
  if (apiServer) return;

  apiServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${API_PORT}`);
    const pathname = url.pathname;

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const data = Buffer.concat(chunks).toString();
        if (data) {
          body = JSON.parse(data);
        }
      } catch {
        // Ignore parse errors
      }
    }

    const sendJson = (data: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      // GET /api/agents
      if (pathname === '/api/agents' && req.method === 'GET') {
        const agentList = Array.from(agents.values()).map(a => ({
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
        const agent = agents.get(agentMatch[1]);
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
        const agent = agents.get(outputMatch[1]);
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
        const { projectPath, name, skills = [], character, skipPermissions, secondaryProjectPath } = body as {
          projectPath: string;
          name?: string;
          skills?: string[];
          character?: AgentCharacter;
          skipPermissions?: boolean;
          secondaryProjectPath?: string;
        };

        if (!projectPath) {
          sendJson({ error: 'projectPath is required' }, 400);
          return;
        }

        const id = uuidv4();
        const agent: AgentStatus = {
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
        agents.set(id, agent);
        saveAgents();
        sendJson({ agent });
        return;
      }

      // POST /api/agents/:id/start
      const startMatch = pathname.match(/^\/api\/agents\/([^/]+)\/start$/);
      if (startMatch && req.method === 'POST') {
        const agent = agents.get(startMatch[1]);
        if (!agent) {
          sendJson({ error: 'Agent not found' }, 404);
          return;
        }

        const { prompt, model, skipPermissions, printMode } = body as { prompt: string; model?: string; skipPermissions?: boolean; printMode?: boolean };
        if (!prompt) {
          sendJson({ error: 'prompt is required' }, 400);
          return;
        }

        const workingDir = agent.worktreePath || agent.projectPath;
        let command = `cd '${workingDir}' && claude`;

        // Detect if this is an automation agent (use print mode for one-shot execution)
        const isAutomationAgent = agent.name?.toLowerCase().includes('automation:');
        const usePrintMode = printMode || isAutomationAgent;

        // Add -p flag for print mode (one-shot execution, no interactive prompt)
        if (usePrintMode) {
          command += ' -p';
        }

        const isSuperAgentApi = agent.name?.toLowerCase().includes('super agent') ||
                               agent.name?.toLowerCase().includes('orchestrator');

        // Give MCP config to Super Agent and Automation agents so they can use MCP tools
        if (isSuperAgentApi || isAutomationAgent) {
          const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
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
        const homeDir = process.env.HOME || app.getPath('home');
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
          } catch {
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

        const ptyId = uuidv4();
        ptyProcesses.set(ptyId, ptyProcess);

        agent.ptyId = ptyId;
        agent.status = 'running';
        agent.currentTask = prompt;
        agent.output = [];
        agent.lastActivity = new Date().toISOString();
        saveAgents();

        ptyProcess.onData((data: string) => {
          agent.output.push(data);
          if (agent.output.length > 10000) {
            agent.output = agent.output.slice(-5000);
          }
          agent.lastActivity = new Date().toISOString();

          const recentOutput = agent.output.slice(-20).join('');
          const isWaiting = CLAUDE_PATTERNS.waitingForInput.some(p => p.test(recentOutput));
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
          ptyProcesses.delete(ptyId);
          saveAgents();
        });

        sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
        return;
      }

      // POST /api/agents/:id/stop
      const stopMatch = pathname.match(/^\/api\/agents\/([^/]+)\/stop$/);
      if (stopMatch && req.method === 'POST') {
        const agent = agents.get(stopMatch[1]);
        if (!agent) {
          sendJson({ error: 'Agent not found' }, 404);
          return;
        }

        if (agent.ptyId) {
          const ptyProcess = ptyProcesses.get(agent.ptyId);
          if (ptyProcess) {
            ptyProcess.kill();
            ptyProcesses.delete(agent.ptyId);
          }
        }
        agent.status = 'idle';
        agent.currentTask = undefined;
        agent.lastActivity = new Date().toISOString();
        saveAgents();
        sendJson({ success: true });
        return;
      }

      // POST /api/agents/:id/message
      const messageMatch = pathname.match(/^\/api\/agents\/([^/]+)\/message$/);
      if (messageMatch && req.method === 'POST') {
        const agent = agents.get(messageMatch[1]);
        if (!agent) {
          sendJson({ error: 'Agent not found' }, 404);
          return;
        }

        const { message } = body as { message: string };
        if (!message) {
          sendJson({ error: 'message is required' }, 400);
          return;
        }

        if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
          const ptyId = await initAgentPtyCallback(agent);
          agent.ptyId = ptyId;
        }

        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (ptyProcess) {
          ptyProcess.write(message);
          ptyProcess.write('\r');
          agent.status = 'running';
          agent.lastActivity = new Date().toISOString();
          saveAgents();
          sendJson({ success: true });
          return;
        }
        sendJson({ error: 'Failed to send message - PTY not available' }, 500);
        return;
      }

      // DELETE /api/agents/:id
      const deleteMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
      if (deleteMatch && req.method === 'DELETE') {
        const agent = agents.get(deleteMatch[1]);
        if (!agent) {
          sendJson({ error: 'Agent not found' }, 404);
          return;
        }

        if (agent.ptyId) {
          const ptyProcess = ptyProcesses.get(agent.ptyId);
          if (ptyProcess) {
            ptyProcess.kill();
            ptyProcesses.delete(agent.ptyId);
          }
        }
        agents.delete(deleteMatch[1]);
        saveAgents();
        sendJson({ success: true });
        return;
      }

      // POST /api/telegram/send
      if (pathname === '/api/telegram/send' && req.method === 'POST') {
        const { message } = body as { message: string };
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
        } catch (err) {
          try {
            await telegramBot.sendMessage(appSettings.telegramChatId, `👑 ${message}`);
            sendJson({ success: true });
          } catch (err2) {
            sendJson({ error: `Failed to send: ${err2}` }, 500);
          }
        }
        return;
      }

      // POST /api/telegram/send-photo
      if (pathname === '/api/telegram/send-photo' && req.method === 'POST') {
        const { photo_path, caption } = body as { photo_path: string; caption?: string };
        if (!photo_path) {
          sendJson({ error: 'photo_path is required' }, 400);
          return;
        }

        const telegramBot = getTelegramBot();
        if (!telegramBot || !appSettings.telegramChatId) {
          sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
          return;
        }

        try {
          // Check if file exists
          if (!fs.existsSync(photo_path)) {
            sendJson({ error: `File not found: ${photo_path}` }, 400);
            return;
          }

          await telegramBot.sendPhoto(
            appSettings.telegramChatId,
            photo_path,
            { caption: caption ? `👑 ${caption}` : undefined, parse_mode: 'Markdown' }
          );
          sendJson({ success: true });
        } catch (err) {
          sendJson({ error: `Failed to send photo: ${err}` }, 500);
        }
        return;
      }

      // POST /api/telegram/send-video
      if (pathname === '/api/telegram/send-video' && req.method === 'POST') {
        const { video_path, caption } = body as { video_path: string; caption?: string };
        if (!video_path) {
          sendJson({ error: 'video_path is required' }, 400);
          return;
        }

        const telegramBot = getTelegramBot();
        if (!telegramBot || !appSettings.telegramChatId) {
          sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
          return;
        }

        try {
          // Check if file exists
          if (!fs.existsSync(video_path)) {
            sendJson({ error: `File not found: ${video_path}` }, 400);
            return;
          }

          await telegramBot.sendVideo(
            appSettings.telegramChatId,
            video_path,
            { caption: caption ? `👑 ${caption}` : undefined, parse_mode: 'Markdown' }
          );
          sendJson({ success: true });
        } catch (err) {
          sendJson({ error: `Failed to send video: ${err}` }, 500);
        }
        return;
      }

      // POST /api/telegram/send-document
      if (pathname === '/api/telegram/send-document' && req.method === 'POST') {
        const { document_path, caption } = body as { document_path: string; caption?: string };
        if (!document_path) {
          sendJson({ error: 'document_path is required' }, 400);
          return;
        }

        const telegramBot = getTelegramBot();
        if (!telegramBot || !appSettings.telegramChatId) {
          sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
          return;
        }

        try {
          // Check if file exists
          if (!fs.existsSync(document_path)) {
            sendJson({ error: `File not found: ${document_path}` }, 400);
            return;
          }

          await telegramBot.sendDocument(
            appSettings.telegramChatId,
            document_path,
            { caption: caption ? `👑 ${caption}` : undefined, parse_mode: 'Markdown' }
          );
          sendJson({ success: true });
        } catch (err) {
          sendJson({ error: `Failed to send document: ${err}` }, 500);
        }
        return;
      }

      // POST /api/slack/send
      if (pathname === '/api/slack/send' && req.method === 'POST') {
        const { message } = body as { message: string };
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
          const postParams: { channel: string; text: string; mrkdwn: boolean; thread_ts?: string } = {
            channel: slackResponseChannel || appSettings.slackChannelId,
            text: `:crown: ${message}`,
            mrkdwn: true,
          };
          if (slackResponseThreadTs) {
            postParams.thread_ts = slackResponseThreadTs;
          }
          await slackApp.client.chat.postMessage(postParams);
          sendJson({ success: true });
        } catch (err) {
          sendJson({ error: `Failed to send: ${err}` }, 500);
        }
        return;
      }

      // POST /api/hooks/status
      if (pathname === '/api/hooks/status' && req.method === 'POST') {
        const { agent_id, session_id, status, source, reason, waiting_reason } = body as {
          agent_id: string;
          session_id: string;
          status: 'running' | 'waiting' | 'idle' | 'completed';
          source?: string;
          reason?: string;
          waiting_reason?: string;
        };

        if (!agent_id || !status) {
          sendJson({ error: 'agent_id and status are required' }, 400);
          return;
        }

        let agent: AgentStatus | undefined;
        agent = agents.get(agent_id);

        if (!agent) {
          for (const [, a] of agents) {
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
        } else if (status === 'waiting' && agent.status === 'running') {
          agent.status = 'waiting';
        } else if (status === 'idle') {
          agent.status = 'idle';
          agent.currentSessionId = undefined;
        } else if (status === 'completed') {
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
        const { agent_id, session_id, type, title, message } = body as {
          agent_id: string;
          session_id: string;
          type: string;
          title: string;
          message: string;
        };

        if (!agent_id || !type) {
          sendJson({ error: 'agent_id and type are required' }, 400);
          return;
        }

        let agent: AgentStatus | undefined = agents.get(agent_id);
        if (!agent) {
          for (const [, a] of agents) {
            if (a.currentSessionId === session_id) {
              agent = a;
              break;
            }
          }
        }

        const agentName = agent?.name || 'Claude';

        if (type === 'permission_prompt') {
          if (appSettings.notifyOnWaiting) {
            sendNotificationCallback(
              `${agentName} needs permission`,
              message || 'Claude needs your permission to proceed',
              agent?.id
            );
          }
        } else if (type === 'idle_prompt') {
          if (appSettings.notifyOnWaiting) {
            sendNotificationCallback(
              `${agentName} is waiting`,
              message || 'Claude is waiting for your input',
              agent?.id
            );
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

      // POST /api/kanban/generate - Generate task details from natural language prompt using Claude
      if (pathname === '/api/kanban/generate' && req.method === 'POST') {
        const { prompt, availableProjects } = body as {
          prompt: string;
          availableProjects: Array<{ path: string; name: string }>;
        };

        if (!prompt) {
          sendJson({ error: 'prompt is required' }, 400);
          return;
        }

        try {
          // Build the prompt for Claude to generate task details
          const projectList = availableProjects.map(p => `- "${p.name}" (${p.path})`).join('\n');

          const claudePrompt = `You are a task parser. Analyze the user's request and generate structured task details.

Available projects:
${projectList}

User's request:
${prompt}

Based on this request, generate a JSON object with these fields:
- title: A concise task title (max 80 chars)
- description: The full task description (keep the original request, improve clarity if needed)
- projectPath: The most relevant project path from the list above (use exact path)
- priority: "low", "medium", or "high" based on urgency indicators
- labels: Array of relevant labels (e.g., "bug", "feature", "refactor", "ui", "api", "docs", "test", "security", "performance")
- requiredSkills: Array of skills the agent might need (e.g., "commit", "test", "deploy")

IMPORTANT: Respond with ONLY the JSON object, no markdown, no explanation, just valid JSON.`;

          // Build PATH with nvm and common locations
          const homeDir = process.env.HOME || app.getPath('home');
          const existingPath = process.env.PATH || '';
          const additionalPaths = [
            path.join(homeDir, '.nvm/versions/node/v20.11.1/bin'),
            path.join(homeDir, '.nvm/versions/node/v22.0.0/bin'),
            '/usr/local/bin',
            '/opt/homebrew/bin',
            path.join(homeDir, '.local/bin'),
          ];
          const nvmDir = path.join(homeDir, '.nvm/versions/node');
          if (fs.existsSync(nvmDir)) {
            try {
              const versions = fs.readdirSync(nvmDir);
              for (const version of versions) {
                additionalPaths.push(path.join(nvmDir, version, 'bin'));
              }
            } catch {
              // Ignore errors
            }
          }
          const fullPath = [...new Set([...additionalPaths, ...existingPath.split(':')])].join(':');

          // Escape the prompt for shell
          const escapedPrompt = claudePrompt.replace(/'/g, "'\\''");

          // Call Claude CLI with -p flag for quick one-shot response using haiku for speed
          const command = `claude -p --model haiku '${escapedPrompt}'`;

          const claudeResult = await new Promise<string>((resolve, reject) => {
            exec(command, {
              env: { ...process.env, PATH: fullPath },
              timeout: 30000, // 30 second timeout
              maxBuffer: 1024 * 1024,
            }, (error, stdout, stderr) => {
              if (error) {
                console.error('[Kanban] Claude CLI error:', stderr || error.message);
                reject(error);
              } else {
                resolve(stdout.trim());
              }
            });
          });

          // Parse the JSON response
          let parsedTask;
          try {
            // Try to extract JSON from the response (in case there's extra text)
            const jsonMatch = claudeResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedTask = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('No JSON found in response');
            }
          } catch (parseErr) {
            console.error('[Kanban] Failed to parse Claude response:', claudeResult);
            // Fallback to simple extraction
            const lines = prompt.split('\n').filter(l => l.trim());
            parsedTask = {
              title: (lines[0] || prompt).substring(0, 80),
              description: prompt,
              projectPath: availableProjects[0]?.path || '',
              priority: 'medium',
              labels: [],
              requiredSkills: [],
            };
          }

          // Validate and sanitize the response
          const task = {
            title: String(parsedTask.title || prompt.substring(0, 80)).substring(0, 80),
            description: String(parsedTask.description || prompt),
            projectPath: String(parsedTask.projectPath || availableProjects[0]?.path || ''),
            projectId: String(parsedTask.projectPath || availableProjects[0]?.path || ''),
            priority: ['low', 'medium', 'high'].includes(parsedTask.priority) ? parsedTask.priority : 'medium',
            labels: Array.isArray(parsedTask.labels) ? parsedTask.labels.slice(0, 5) : [],
            requiredSkills: Array.isArray(parsedTask.requiredSkills) ? parsedTask.requiredSkills.slice(0, 3) : [],
          };

          sendJson({ success: true, task });
          return;
        } catch (err) {
          console.error('[Kanban] Failed to generate task:', err);
          // Return a simple fallback task on error
          const lines = prompt.split('\n').filter(l => l.trim());
          sendJson({
            success: true,
            task: {
              title: (lines[0] || prompt).substring(0, 80),
              description: prompt,
              projectPath: availableProjects[0]?.path || '',
              projectId: availableProjects[0]?.path || '',
              priority: 'medium',
              labels: [],
              requiredSkills: [],
            },
          });
          return;
        }
      }

      // POST /api/kanban/complete - Mark a kanban task as complete (called by hooks)
      // Can be called with task_id OR agent_id (will look up task by assigned agent)
      if (pathname === '/api/kanban/complete' && req.method === 'POST') {
        const { task_id, agent_id, session_id, summary } = body as {
          task_id?: string;
          agent_id?: string;
          session_id?: string;
          summary?: string;
        };

        try {
          // Import kanban handlers functions
          const { loadTasks, saveTasks, emitTaskEvent } = await import('../handlers/kanban-handlers');

          const tasks = loadTasks();
          let task;

          // Find task by task_id or by assigned agent
          if (task_id) {
            task = tasks.find(t => t.id === task_id);
          } else if (agent_id) {
            task = tasks.find(t => t.assignedAgentId === agent_id && t.column === 'ongoing');
          } else if (session_id) {
            // Try to find agent by session ID, then find task
            let agentIdFromSession: string | undefined;
            for (const [id, agent] of agents) {
              if (agent.currentSessionId === session_id) {
                agentIdFromSession = id;
                break;
              }
            }
            if (agentIdFromSession) {
              task = tasks.find(t => t.assignedAgentId === agentIdFromSession && t.column === 'ongoing');
            }
          }

          if (!task) {
            // No task found - this is OK, not all agents are kanban tasks
            sendJson({ success: true, message: 'No kanban task found for this agent' });
            return;
          }

          // Only complete if task is in ongoing state
          if (task.column !== 'ongoing') {
            sendJson({ success: true, message: 'Task already completed', currentColumn: task.column });
            return;
          }

          // Update task
          task.column = 'done';
          task.progress = 100;
          task.completedAt = new Date().toISOString();
          task.updatedAt = new Date().toISOString();
          if (summary) {
            task.completionSummary = summary;
          }

          // Delete agent if it was created specifically for this task
          if (task.agentCreatedForTask && task.assignedAgentId) {
            const agentToDelete = agents.get(task.assignedAgentId);
            if (agentToDelete) {
              console.log(`[Kanban] Deleting agent ${task.assignedAgentId} created for task`);
              agents.delete(task.assignedAgentId);
            }
          }

          saveTasks(tasks);

          // Emit event to frontend
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('kanban:task-updated', task);
          }

          console.log(`[Kanban] Task "${task.title}" marked as complete via hook`);
          sendJson({ success: true, task });
          return;
        } catch (err) {
          console.error('[Kanban] Failed to complete task:', err);
          sendJson({ error: 'Failed to complete task' }, 500);
          return;
        }
      }

      sendJson({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('API error:', error);
      sendJson({ error: 'Internal server error' }, 500);
    }
  });

  apiServer.listen(API_PORT, '127.0.0.1', () => {
    console.log(`Agent API server running on http://127.0.0.1:${API_PORT}`);
  });

  apiServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${API_PORT} is in use, API server not started`);
    } else {
      console.error('API server error:', err);
    }
  });
}

export function stopApiServer() {
  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }
}
