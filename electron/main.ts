import { app, BrowserWindow, ipcMain, protocol, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import * as pty from 'node-pty';
import TelegramBot from 'node-telegram-bot-api';
import { spawn, ChildProcess } from 'child_process';

// ============== Claude-Mem Worker ==============
// Memory is now handled entirely by claude-mem plugin
let claudeMemWorker: ChildProcess | null = null;
const CLAUDE_MEM_PORT = 37777;

// ============== Claude-Mem Worker Functions ==============

/**
 * Start the claude-mem worker service
 */
async function startClaudeMemWorker(): Promise<boolean> {
  // Check if already running
  try {
    const response = await fetch(`http://localhost:${CLAUDE_MEM_PORT}/api/stats`);
    if (response.ok) {
      console.log('Claude-mem worker already running on port', CLAUDE_MEM_PORT);
      return true;
    }
  } catch {
    // Not running, will start it
  }

  // Find the worker script
  const workerPaths = [
    // Development: in node_modules
    path.join(__dirname, '..', 'node_modules', 'claude-mem', 'plugin', 'scripts', 'worker-service.cjs'),
    // Production: bundled
    path.join(app.getAppPath(), 'node_modules', 'claude-mem', 'plugin', 'scripts', 'worker-service.cjs'),
    // Unpacked asar
    path.join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), 'node_modules', 'claude-mem', 'plugin', 'scripts', 'worker-service.cjs'),
  ];

  let workerScript: string | null = null;
  for (const p of workerPaths) {
    if (fs.existsSync(p)) {
      workerScript = p;
      break;
    }
  }

  if (!workerScript) {
    console.error('Claude-mem worker script not found. Install claude-mem package.');
    return false;
  }

  console.log('Starting claude-mem worker from:', workerScript);

  // Try to use bun first, fall back to node
  const runtime = await findRuntime();

  return new Promise((resolve) => {
    try {
      claudeMemWorker = spawn(runtime, [workerScript, 'start'], {
        cwd: path.dirname(workerScript),
        env: {
          ...process.env,
          CLAUDE_MEM_PORT: CLAUDE_MEM_PORT.toString(),
          CLAUDE_MEM_DATA_DIR: path.join(os.homedir(), '.claude-mem'),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      claudeMemWorker.stdout?.on('data', (data) => {
        console.log('[claude-mem]', data.toString().trim());
      });

      claudeMemWorker.stderr?.on('data', (data) => {
        console.error('[claude-mem error]', data.toString().trim());
      });

      claudeMemWorker.on('error', (err) => {
        console.error('Failed to start claude-mem worker:', err);
        resolve(false);
      });

      claudeMemWorker.on('exit', (code) => {
        console.log('Claude-mem worker exited with code:', code);
        claudeMemWorker = null;
      });

      // Wait a bit and check if it started
      setTimeout(async () => {
        try {
          const response = await fetch(`http://localhost:${CLAUDE_MEM_PORT}/api/stats`);
          if (response.ok) {
            console.log('Claude-mem worker started successfully');
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          // Give it more time
          setTimeout(async () => {
            try {
              const response = await fetch(`http://localhost:${CLAUDE_MEM_PORT}/api/stats`);
              resolve(response.ok);
            } catch {
              resolve(false);
            }
          }, 3000);
        }
      }, 2000);
    } catch (err) {
      console.error('Error starting claude-mem worker:', err);
      resolve(false);
    }
  });
}

/**
 * Find bun or node runtime
 */
async function findRuntime(): Promise<string> {
  const { execSync } = require('child_process');

  // Try bun first (preferred by claude-mem)
  try {
    execSync('which bun', { stdio: 'ignore' });
    return 'bun';
  } catch {
    // Fall back to node
    return 'node';
  }
}

/**
 * Stop the claude-mem worker
 */
function stopClaudeMemWorker(): void {
  if (claudeMemWorker) {
    console.log('Stopping claude-mem worker...');
    claudeMemWorker.kill();
    claudeMemWorker = null;
  }
}

/**
 * Check if claude-mem is available
 */
async function isClaudeMemAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${CLAUDE_MEM_PORT}/api/stats`);
    return response.ok;
  } catch {
    return false;
  }
}

// Get the base path for static assets
function getAppBasePath(): string {
  let appPath = app.getAppPath();
  // If running from asar, the unpacked files are in app.asar.unpacked
  if (appPath.includes('app.asar')) {
    appPath = appPath.replace('app.asar', 'app.asar.unpacked');
  }
  return path.join(appPath, 'out');
}

// MIME type lookup
const mimeTypes: { [key: string]: string } = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// PTY instances for terminals
const ptyProcesses: Map<string, pty.IPty> = new Map();

// Agent state
interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

type AgentCharacter = 'robot' | 'ninja' | 'wizard' | 'astronaut' | 'knight' | 'pirate' | 'alien' | 'viking';

interface AgentStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'waiting';
  projectPath: string;
  secondaryProjectPath?: string; // Secondary project added via --add-dir
  worktreePath?: string;
  branchName?: string;
  skills: string[];
  currentTask?: string;
  output: string[];
  lastActivity: string;
  error?: string;
  ptyId?: string;
  character?: AgentCharacter;
  name?: string;
  pathMissing?: boolean; // True if project path no longer exists
  skipPermissions?: boolean; // If true, use --dangerously-skip-permissions flag
  currentSessionId?: string; // Current Claude Code session ID (for hook matching)
}

const agents: Map<string, AgentStatus> = new Map();

// HTTP API Server for MCP orchestrator integration
const API_PORT = 31415;
let apiServer: http.Server | null = null;

function startApiServer() {
  if (apiServer) return;

  apiServer = http.createServer(async (req, res) => {
    // CORS headers for local access
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

    // Parse JSON body for POST requests
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
      // GET /api/agents - List all agents
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

      // GET /api/agents/:id - Get single agent
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

      // GET /api/agents/:id/output - Get agent output
      const outputMatch = pathname.match(/^\/api\/agents\/([^/]+)\/output$/);
      if (outputMatch && req.method === 'GET') {
        const agent = agents.get(outputMatch[1]);
        if (!agent) {
          sendJson({ error: 'Agent not found' }, 404);
          return;
        }
        // Return last N lines of output
        const lines = parseInt(url.searchParams.get('lines') || '100', 10);
        const output = agent.output.slice(-lines).join('');
        sendJson({ output, status: agent.status });
        return;
      }

      // POST /api/agents - Create new agent
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

      // POST /api/agents/:id/start - Start agent with task
      const startMatch = pathname.match(/^\/api\/agents\/([^/]+)\/start$/);
      if (startMatch && req.method === 'POST') {
        const agent = agents.get(startMatch[1]);
        if (!agent) {
          sendJson({ error: 'Agent not found' }, 404);
          return;
        }

        const { prompt, model, skipPermissions } = body as { prompt: string; model?: string; skipPermissions?: boolean };
        if (!prompt) {
          sendJson({ error: 'prompt is required' }, 400);
          return;
        }

        // Memory is now handled by claude-mem plugin via hooks
        // No need to start sessions or inject context manually

        const effectivePrompt = prompt;

        // Start the agent (similar to agent:start IPC handler)
        const workingDir = agent.worktreePath || agent.projectPath;
        let command = `cd '${workingDir}' && claude`;

        // Check if this is the Super Agent (orchestrator)
        const isSuperAgentApi = agent.name?.toLowerCase().includes('super agent') ||
                               agent.name?.toLowerCase().includes('orchestrator');

        // Add explicit MCP config for Super Agent
        if (isSuperAgentApi) {
          const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
          if (fs.existsSync(mcpConfigPath)) {
            command += ` --mcp-config '${mcpConfigPath}'`;
          }
        }

        if (agent.secondaryProjectPath) {
          command += ` --add-dir '${agent.secondaryProjectPath}'`;
        }
        // Use skipPermissions from request body if provided, otherwise fall back to agent's setting
        if (skipPermissions !== undefined ? skipPermissions : agent.skipPermissions) {
          command += ' --dangerously-skip-permissions';
        }
        if (model) {
          command += ` --model ${model}`;
        }
        command += ` '${effectivePrompt.replace(/'/g, "'\\''")}'`;

        const shell = process.env.SHELL || '/bin/zsh';
        const ptyProcess = pty.spawn(shell, ['-l', '-c', command], {
          name: 'xterm-256color',
          cols: 120,
          rows: 40,
          cwd: workingDir,
          env: { ...process.env, TERM: 'xterm-256color' },
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

          // Memory is handled by claude-mem plugin via hooks

          // Check for waiting state
          const recentOutput = agent.output.slice(-20).join('');
          const isWaiting = CLAUDE_PATTERNS.waitingForInput.some(p => p.test(recentOutput));
          if (isWaiting && agent.status === 'running') {
            agent.status = 'waiting';
          }
          // Emit to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('agent:output', { agentId: agent.id, data });
          }
        });

        ptyProcess.onExit(({ exitCode }) => {
          agent.status = exitCode === 0 ? 'completed' : 'error';
          if (exitCode !== 0) {
            agent.error = `Process exited with code ${exitCode}`;
          }
          // Memory sessions are handled by claude-mem via hooks
          agent.lastActivity = new Date().toISOString();
          ptyProcesses.delete(ptyId);
          saveAgents();
        });

        sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
        return;
      }

      // POST /api/agents/:id/stop - Stop agent
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

      // POST /api/agents/:id/message - Send input to agent
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

        // Initialize PTY if needed
        if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
          const ptyId = await initAgentPty(agent);
          agent.ptyId = ptyId;
        }

        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (ptyProcess) {
          // Write message then send Enter separately
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

      // DELETE /api/agents/:id - Remove agent
      const deleteMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
      if (deleteMatch && req.method === 'DELETE') {
        const agent = agents.get(deleteMatch[1]);
        if (!agent) {
          sendJson({ error: 'Agent not found' }, 404);
          return;
        }

        // Stop if running
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

      // POST /api/telegram/send - Send message to Telegram
      if (pathname === '/api/telegram/send' && req.method === 'POST') {
        const { message } = body as { message: string };
        if (!message) {
          sendJson({ error: 'message is required' }, 400);
          return;
        }

        if (!telegramBot || !appSettings.telegramChatId) {
          sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
          return;
        }

        try {
          await telegramBot.sendMessage(appSettings.telegramChatId, `👑 ${message}`, { parse_mode: 'Markdown' });
          sendJson({ success: true });
        } catch (err) {
          // Try without markdown
          try {
            await telegramBot.sendMessage(appSettings.telegramChatId, `👑 ${message}`);
            sendJson({ success: true });
          } catch (err2) {
            sendJson({ error: `Failed to send: ${err2}` }, 500);
          }
        }
        return;
      }

      // ============== Memory API Endpoints ==============
      // These endpoints proxy to claude-mem when available, fallback to local memory

      // Helper to proxy to claude-mem
      const proxyToClaudeMem = async (apiPath: string): Promise<any | null> => {
        try {
          const response = await fetch(`http://localhost:${CLAUDE_MEM_PORT}${apiPath}`);
          if (response.ok) {
            return await response.json();
          }
        } catch {
          // claude-mem not available
        }
        return null;
      };

      // GET /api/memory/search - Search memories (claude-mem only)
      if (pathname === '/api/memory/search' && req.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        const agentId = url.searchParams.get('agent_id') || undefined;
        const projectPath = url.searchParams.get('project') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);

        const claudeMemData = await proxyToClaudeMem(`/api/observations?limit=${limit}`);
        if (claudeMemData && Array.isArray(claudeMemData)) {
          const results = claudeMemData
            .filter((obs: any) => {
              if (query && !obs.title?.toLowerCase().includes(query.toLowerCase()) && !obs.content?.toLowerCase().includes(query.toLowerCase())) {
                return false;
              }
              return true;
            })
            .slice(0, limit)
            .map((obs: any) => ({
              id: obs.id?.toString() || obs.observationId?.toString(),
              type: obs.type || 'observation',
              content: obs.title || obs.content || '',
              agent_id: agentId || 'claude-mem',
              project_path: obs.projectPath || projectPath || '',
              created_at: obs.createdAt || Date.now(),
              session_id: obs.sessionId,
              metadata: { source: 'claude-mem', raw: obs },
            }));
          sendJson({ results, source: 'claude-mem' });
        } else {
          sendJson({ results: [], source: 'claude-mem', error: 'claude-mem not available' });
        }
        return;
      }

      // GET /api/memory/timeline/:observation_id - Get timeline (claude-mem only)
      const timelineMatch = pathname.match(/^\/api\/memory\/timeline\/([^/]+)$/);
      if (timelineMatch && req.method === 'GET') {
        const observationId = timelineMatch[1];
        // Claude-mem doesn't have a timeline endpoint, return empty
        sendJson({ timeline: [], source: 'claude-mem' });
        return;
      }

      // GET /api/memory/observations - Get observations by IDs (claude-mem only)
      if (pathname === '/api/memory/observations' && req.method === 'GET') {
        const idsParam = url.searchParams.get('ids') || '';
        const ids = idsParam.split(',').filter(id => id.trim());
        // Fetch individual observations from claude-mem
        const observations: any[] = [];
        for (const id of ids) {
          const obs = await proxyToClaudeMem(`/api/observation/${id}`);
          if (obs) observations.push(obs);
        }
        sendJson({ observations, source: 'claude-mem' });
        return;
      }

      // POST /api/memory/remember - Store memory (not supported without local memory)
      if (pathname === '/api/memory/remember' && req.method === 'POST') {
        sendJson({ error: 'Memory storage is handled by claude-mem plugin', source: 'claude-mem' }, 400);
        return;
      }

      // GET /api/memory/context - Get memory context (claude-mem handles this via hooks)
      if (pathname === '/api/memory/context' && req.method === 'GET') {
        const context = await proxyToClaudeMem('/api/context/preview');
        sendJson({ context: context || 'No context available', source: 'claude-mem' });
        return;
      }

      // GET /api/memory/sessions/:agent_id - Get agent sessions (claude-mem only)
      const sessionsMatch = pathname.match(/^\/api\/memory\/sessions\/([^/]+)$/);
      if (sessionsMatch && req.method === 'GET') {
        const sessions = await proxyToClaudeMem('/api/sessions');
        sendJson({ sessions: sessions || [], source: 'claude-mem' });
        return;
      }

      // GET /api/memory/stats - Get memory stats (claude-mem only)
      if (pathname === '/api/memory/stats' && req.method === 'GET') {
        const claudeMemStats = await proxyToClaudeMem('/api/stats');
        if (claudeMemStats) {
          sendJson({ ...claudeMemStats, source: 'claude-mem' });
        } else {
          sendJson({ totalObservations: 0, source: 'claude-mem', error: 'claude-mem not available' });
        }
        return;
      }

      // ============== Hook API Endpoints ==============

      // POST /api/hooks/status - Update agent status from hooks
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

        // Find agent by session_id or agent_id
        let agent: AgentStatus | undefined;

        // First try to find by CLAUDE_AGENT_ID (environment variable set by us)
        agent = agents.get(agent_id);

        // If not found, try to find by session_id match
        if (!agent) {
          for (const [, a] of agents) {
            if (a.currentSessionId === session_id) {
              agent = a;
              break;
            }
          }
        }

        if (!agent) {
          // Agent not found - might be a standalone Claude Code session
          sendJson({ success: false, message: 'Agent not found' });
          return;
        }

        const oldStatus = agent.status;

        // Update status
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

        // Send notification if status changed
        if (oldStatus !== agent.status) {
          handleStatusChangeNotification(agent, agent.status);

          // Emit to renderer
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

      // POST /api/hooks/notification - Forward notifications from hooks
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

        // Find agent
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

        // Handle different notification types
        if (type === 'permission_prompt') {
          if (appSettings.notifyOnWaiting) {
            sendNotification(
              `${agentName} needs permission`,
              message || 'Claude needs your permission to proceed',
              agent?.id
            );
          }
        } else if (type === 'idle_prompt') {
          // Agent is idle, might want to notify
          if (appSettings.notifyOnWaiting) {
            sendNotification(
              `${agentName} is waiting`,
              message || 'Claude is waiting for your input',
              agent?.id
            );
          }
        }

        // Emit to renderer
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

      // 404 for unknown routes
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

function stopApiServer() {
  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }
}

// Patterns to detect Claude Code state from terminal output
const CLAUDE_PATTERNS = {
  // Claude is waiting for user input (shows prompt)
  // Comprehensive list of all Claude Code prompt patterns
  waitingForInput: [
    // === Claude Code prompt indicators (highest priority) ===
    /❯\s*$/m,                            // Chevron at end of line (Claude prompt)
    /❯$/m,                               // Chevron at very end
    /^❯\s*$/m,                           // Chevron on its own line
    /\n❯\s*$/,                           // Chevron after newline at end
    /●.*\n\s*❯/,                         // Response bullet followed by prompt
    /^\s*❯\s/m,                          // Chevron at start of line with space

    // === Claude Code UI indicators ===
    /Esc to cancel/i,                    // Claude Code prompt footer
    /Tab to add additional/i,            // Claude Code prompt footer
    /shift\+Tab/i,                       // Claude Code keyboard hint
    /shift-Tab/i,                        // Alternative format
    /Enter to confirm/i,                 // Confirmation hint
    /Press Enter/i,                      // Press enter prompt

    // === Selection/Menu prompts (inquirer.js style) ===
    /❯\s*\d/,                            // Chevron with number (selected option)
    />\s*\d+\.\s/,                       // "> 1." style selection
    /\(Use arrow keys\)/i,               // Arrow key hint
    /Use arrow keys/i,                   // Arrow key hint variant

    // === Yes/No/Confirmation prompts ===
    /\[Y\/n\]/i,                         // [Y/n] prompt
    /\[y\/N\]/i,                         // [y/N] prompt
    /\(y\/n\)/i,                         // (y/n) prompt
    /\[yes\/no\]/i,                      // [yes/no] prompt
    /\d+\.\s*Yes\b/i,                    // "1. Yes" numbered option
    /\d+\.\s*No\b/i,                     // "2. No" numbered option
    /\d+\.\s*Cancel\b/i,                 // "3. Cancel" numbered option
    /\d+\.\s*Skip\b/i,                   // "4. Skip" numbered option

    // === File operation prompts ===
    /Do you want to create/i,            // Create file prompt
    /Do you want to edit/i,              // Edit file prompt
    /Do you want to delete/i,            // Delete file prompt
    /Do you want to write/i,             // Write file prompt
    /Do you want to read/i,              // Read file prompt
    /Do you want to run/i,               // Run command prompt
    /Do you want to execute/i,           // Execute prompt
    /Do you want to allow/i,             // Permission prompt
    /Do you want to proceed/i,           // Proceed prompt
    /Do you want to continue/i,          // Continue prompt
    /Do you want to overwrite/i,         // Overwrite prompt
    /Do you want to replace/i,           // Replace prompt
    /Do you want to install/i,           // Install prompt
    /Do you want to update/i,            // Update prompt
    /Do you want to remove/i,            // Remove prompt
    /Do you want to/i,                   // Generic "Do you want to" catch-all

    // === Permission/Approval prompts ===
    /Allow this/i,                       // "Allow this edit?"
    /Allow .+ to/i,                      // "Allow X to run?"
    /Approve this/i,                     // Approval prompt
    /Confirm this/i,                     // Confirmation prompt
    /Accept this/i,                      // Accept prompt

    // === Question prompts / Claude asking what to do ===
    /Let me know what/i,                 // "Let me know what you want..."
    /let me know if/i,                   // "Let me know if you need..."
    /What would you like/i,              // "What would you like..."
    /What should I/i,                    // "What should I..."
    /How would you like/i,               // "How would you like..."
    /How can I help/i,                   // "How can I help..."
    /What do you think/i,                // "What do you think..."
    /Which .+ would you/i,               // "Which option would you..."
    /Which .+ should/i,                  // "Which file should..."
    /Would you like to/i,                // "Would you like to..."
    /Would you like me to/i,             // "Would you like me to..."
    /Should I\s/i,                       // "Should I..."
    /Can I\s/i,                          // "Can I..."
    /May I\s/i,                          // "May I..."
    /Shall I\s/i,                        // "Shall I..."
    /What else/i,                        // "What else would you like..."
    /Anything else/i,                    // "Anything else?"
    /Is there anything/i,                // "Is there anything else..."

    // === Input prompts ===
    /Enter your/i,                       // "Enter your message..."
    /Enter a /i,                         // "Enter a value..."
    /Type your/i,                        // "Type your response..."
    /Input:/i,                           // "Input:" prompt
    /Provide /i,                         // "Provide a value..."
    /Specify /i,                         // "Specify the..."
    /Choose /i,                          // "Choose an option..."
    /Select /i,                          // "Select a file..."
    /Pick /i,                            // "Pick one..."

    // === Wait/Ready indicators ===
    /waiting for/i,                      // "Waiting for input"
    /ready for/i,                        // "Ready for your input"
    /awaiting/i,                         // "Awaiting response"

    // === Bash/Terminal prompts ===
    /\$\s*$/m,                           // Shell prompt "$"
    />\s*$/m,                            // Simple prompt ">"
  ],
  // Claude is actively working (spinner or progress)
  // These patterns indicate Claude is processing, not waiting for input
  working: [
    // === Spinner characters (highest confidence) ===
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,  // Braille spinner characters
    /◐|◓|◑|◒/,                  // Circle spinner
    /⣾|⣽|⣻|⢿|⡿|⣟|⣯|⣷/,        // Dot spinner

    // === Progress indicators with "..." ===
    /Thinking\.\.\./i,
    /Working\.\.\./i,
    /Analyzing\.\.\./i,
    /Processing\.\.\./i,
    /Generating\.\.\./i,
    /Loading\.\.\./i,
    /Fetching\.\.\./i,
    /Compiling\.\.\./i,
    /Building\.\.\./i,

    // === Active operation messages (must have context) ===
    /Reading .+\.\.\./i,         // "Reading file..."
    /Writing .+\.\.\./i,         // "Writing to file..."
    /Searching .+\.\.\./i,       // "Searching in..."
    /Running .+\.\.\./i,         // "Running command..."
    /Executing .+\.\.\./i,       // "Executing..."
    /Installing .+\.\.\./i,      // "Installing package..."
    /Updating .+\.\.\./i,        // "Updating..."
    /Creating .+\.\.\./i,        // "Creating file..."
    /Downloading .+\.\.\./i,     // "Downloading..."
    /Uploading .+\.\.\./i,       // "Uploading..."
  ],
  // Claude finished a task (look for these in recent output)
  completed: [
    /Task completed/i,
    /Done!/i,
    /Finished!/i,
    /Complete!/i,
    /Successfully/i,
    /✓/,                        // Checkmark
    /✔/,                        // Another checkmark
    /\[done\]/i,
    /Worked for \d+/i,          // "Worked for 38s" - Claude Code completion indicator
    /\* Worked for/i,           // "* Worked for" variant
  ],
  // Claude encountered an error
  error: [
    /Error:/i,
    /Failed:/i,
    /Exception:/i,
    /FATAL/i,
    /✗/,                        // X mark
    /✘/,                        // Another X mark
    /\[error\]/i,
    /Permission denied/i,
    /not found/i,
  ],
};

// App settings stored in our own config
interface AppSettings {
  notificationsEnabled: boolean;
  notifyOnWaiting: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  // Telegram integration
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string; // Will be auto-detected on first message
}

// Note: APP_SETTINGS_FILE is defined after DATA_DIR below

// Send native notification
function sendNotification(title: string, body: string, agentId?: string) {
  if (!appSettings.notificationsEnabled) return;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on('click', () => {
    // Bring window to focus and select agent if specified
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (agentId) {
        mainWindow.webContents.send('agent:focus', { agentId });
      }
    }
  });

  notification.show();
}

// Track previous status to detect changes
const previousAgentStatus: Map<string, string> = new Map();

// Track pending status changes with 5-second debounce
const pendingStatusChanges: Map<string, {
  newStatus: string;
  scheduledAt: number;
  timeoutId: NodeJS.Timeout;
}> = new Map();

// Handle status change notifications with 5-second debounce
// This prevents spam from rapid status changes during agent operation
function handleStatusChangeNotification(agent: AgentStatus, newStatus: string) {
  const prevStatus = previousAgentStatus.get(agent.id);

  // Don't notify on first status set
  if (!prevStatus) {
    previousAgentStatus.set(agent.id, newStatus);
    return;
  }

  // Don't notify if status didn't change
  if (prevStatus === newStatus) {
    // Clear any pending notification for this status since we're staying in it
    return;
  }

  // For "running" status, update immediately without notification (no debounce needed)
  if (newStatus === 'running') {
    // Clear any pending status change since agent is actively working now
    const pending = pendingStatusChanges.get(agent.id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingStatusChanges.delete(agent.id);
    }
    previousAgentStatus.set(agent.id, newStatus);
    return;
  }

  // For other statuses (waiting, completed, error), use 5-second debounce
  // This ensures the agent has truly settled into this state
  const pending = pendingStatusChanges.get(agent.id);

  // If we already have a pending change to this same status, let it continue
  if (pending && pending.newStatus === newStatus) {
    return;
  }

  // Clear any existing pending change (we're changing to a different status)
  if (pending) {
    clearTimeout(pending.timeoutId);
  }

  // Schedule the notification for 5 seconds from now
  const timeoutId = setTimeout(() => {
    pendingStatusChanges.delete(agent.id);

    // Re-check the current agent status - if it changed, don't notify
    const currentAgent = agents.get(agent.id);
    if (!currentAgent || currentAgent.status !== newStatus) {
      return;
    }

    // Update previous status and send notification
    previousAgentStatus.set(agent.id, newStatus);

    const agentName = currentAgent.name || `Agent ${currentAgent.id.slice(0, 6)}`;

    const isSuper = isSuperAgent(currentAgent);

    // Skip "waiting" notifications for Super Agent - but send Telegram response if task came from Telegram
    if (newStatus === 'waiting') {
      if (!isSuper && appSettings.notifyOnWaiting) {
        sendNotification(
          `${agentName} needs your attention`,
          'The agent is waiting for your input.',
          currentAgent.id
        );
      }
      // Super Agent finished responding - send to Telegram
      if (isSuper && superAgentTelegramTask) {
        sendSuperAgentResponseToTelegram(currentAgent);
        superAgentTelegramTask = false;
      }
    } else if (newStatus === 'completed' && appSettings.notifyOnComplete) {
      // Desktop notification for all agents
      if (!isSuper) {
        sendNotification(
          `${agentName} completed`,
          currentAgent.currentTask ? `Finished: ${currentAgent.currentTask.slice(0, 50)}...` : 'Task completed successfully.',
          currentAgent.id
        );
      }
      // Telegram response - only for Super Agent when task came from Telegram
      if (isSuper && superAgentTelegramTask) {
        sendSuperAgentResponseToTelegram(currentAgent);
        superAgentTelegramTask = false;
      }
    } else if (newStatus === 'error' && appSettings.notifyOnError) {
      if (!isSuper) {
        sendNotification(
          `${agentName} encountered an error`,
          currentAgent.error || 'An error occurred while running.',
          currentAgent.id
        );
      }
      // Telegram notification for Super Agent errors
      if (isSuper && superAgentTelegramTask) {
        sendTelegramMessage(`🔴 Super Agent error: ${currentAgent.error || 'An error occurred.'}`);
        superAgentTelegramTask = false;
      }
    }
  }, 5000); // 5 second debounce

  pendingStatusChanges.set(agent.id, {
    newStatus,
    scheduledAt: Date.now(),
    timeoutId,
  });
}

// Detect agent status from recent output
function detectAgentStatus(agent: AgentStatus): 'running' | 'waiting' | 'completed' | 'error' | 'idle' {
  // Get the very last output chunk (most recent)
  const lastChunk = agent.output.slice(-1).join('');
  // Get last few chunks for context (more chunks to catch full prompts)
  const recentChunks = agent.output.slice(-10).join('');
  // Get more context for detecting working state
  const extendedContext = agent.output.slice(-30).join('');

  // Strip ANSI escape codes for more reliable matching
  const stripAnsi = (str: string) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  const cleanLastChunk = stripAnsi(lastChunk);
  const cleanRecentChunks = stripAnsi(recentChunks);
  const cleanExtendedContext = stripAnsi(extendedContext);

  // Check for active spinners FIRST in the LAST chunk (spinners = actively working)
  const spinnerPattern = /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|◐|◓|◑|◒|⣾|⣽|⣻|⢿|⡿|⣟|⣯|⣷/;
  if (spinnerPattern.test(cleanLastChunk)) {
    return 'running';
  }

  // Check for working progress messages in last chunk
  for (const pattern of CLAUDE_PATTERNS.working) {
    if (pattern.test(cleanLastChunk)) {
      return 'running';
    }
  }

  // Check for error patterns first (before waiting/completed)
  for (const pattern of CLAUDE_PATTERNS.error) {
    if (pattern.test(cleanRecentChunks)) {
      return 'error';
    }
  }

  // === IMPROVED WAITING DETECTION ===
  // Only mark as "waiting" if Claude is ACTUALLY asking for user input/selection
  // This means there must be a question or selection prompt, not just a command prompt

  // Patterns that indicate Claude is asking the user to choose/confirm something
  const userInputPatterns = [
    // Yes/No prompts (highest priority - these need user action)
    /\[Y\/n\]/i,
    /\[y\/N\]/i,
    /\(y\/n\)/i,
    /\[yes\/no\]/i,

    // Claude Code specific prompts for accepting edits/commits
    /accept edits/i,                       // "accept edits on (shift+Tab to cycle)"
    /shift\+?Tab to cycle/i,               // The cycling hint
    />\s*Commit this/i,                    // "> Commit this" prompt
    /❯\s*Commit/i,                         // "❯ Commit" prompt
    /Press Enter to/i,                     // Press enter prompts
    /\(enter to confirm\)/i,               // Enter confirmation
    /\(esc to cancel\)/i,                  // Esc to cancel hints

    // Selection/Menu prompts with numbered options
    /\d+\.\s*(Yes|No|Cancel|Skip|Allow|Deny|Accept|Reject)\b/i,
    /❯\s*\d+\./,                           // Chevron with numbered selection
    />\s*\d+\.\s/,                         // "> 1." style selection
    /\(Use arrow keys\)/i,                 // Selection menu hint

    // Permission/Approval prompts (Claude asking to do something)
    /Do you want to (create|edit|delete|write|read|run|execute|allow|proceed|continue|overwrite|replace|install|update|remove)/i,
    /Allow this/i,
    /Allow .+ to/i,
    /Approve this/i,
    /Confirm this/i,

    // Direct questions requiring user decision
    /What would you like/i,
    /What should I/i,
    /How would you like/i,
    /Which .+ would you/i,
    /Which .+ should/i,
    /Would you like to/i,
    /Would you like me to/i,
    /Should I\s/i,
    /Shall I\s/i,

    // Selection prompts
    /Choose /i,
    /Select /i,
    /Pick /i,
  ];

  // Check if there's an actual user input prompt
  let hasUserInputPrompt = false;
  for (const pattern of userInputPatterns) {
    if (pattern.test(cleanRecentChunks) || pattern.test(cleanExtendedContext)) {
      hasUserInputPrompt = true;
      break;
    }
  }

  // Only return "waiting" if we found an actual question/selection prompt
  if (hasUserInputPrompt) {
    return 'waiting';
  }

  // Patterns that indicate Claude finished and is back to idle prompt
  // These are prompts WITHOUT an accompanying question
  const idlePromptPatterns = [
    /❯\s*$/m,                              // Just the chevron prompt at end
    /^\s*❯\s*$/m,                          // Chevron on its own line
    /\$\s*$/m,                             // Shell prompt at end
  ];

  // Check for completion patterns
  for (const pattern of CLAUDE_PATTERNS.completed) {
    if (pattern.test(cleanRecentChunks)) {
      return 'completed';
    }
  }

  // If we see just a prompt (❯ or $) without a question, Claude is done/idle
  for (const pattern of idlePromptPatterns) {
    if (pattern.test(cleanRecentChunks)) {
      // Make sure there's no active work happening
      const now = Date.now();
      const lastActivityTime = new Date(agent.lastActivity).getTime();
      const timeSinceActivity = now - lastActivityTime;

      // If no activity for more than 2 seconds and just showing prompt, it's completed
      if (timeSinceActivity > 2000) {
        return 'completed';
      }
    }
  }

  // If we have recent output but no clear indicator:
  // - If there was activity in the last few seconds, assume running
  // - Otherwise keep current status
  const now = Date.now();
  const lastActivityTime = new Date(agent.lastActivity).getTime();
  const timeSinceActivity = now - lastActivityTime;

  // If activity within last 2 seconds, likely still running
  if (timeSinceActivity < 2000 && agent.output.length > 0) {
    if (agent.status === 'idle' || agent.status === 'completed') {
      // New activity on an idle/completed agent means it's running again
      return 'running';
    }
    return agent.status === 'error' ? 'error' : 'running';
  }

  // Keep current status if no clear indicator
  return agent.status;
}

// ============== Agent Persistence ==============

const DATA_DIR = path.join(os.homedir(), '.claude-manager');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const APP_SETTINGS_FILE = path.join(DATA_DIR, 'app-settings.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// App settings functions
function loadAppSettings(): AppSettings {
  const defaults: AppSettings = {
    notificationsEnabled: true,
    notifyOnWaiting: true,
    notifyOnComplete: true,
    notifyOnError: true,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
  };
  try {
    if (fs.existsSync(APP_SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(APP_SETTINGS_FILE, 'utf-8'));
      return { ...defaults, ...saved };
    }
  } catch (err) {
    console.error('Failed to load app settings:', err);
  }
  return defaults;
}

function saveAppSettings(settings: AppSettings) {
  try {
    ensureDataDir();
    fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save app settings:', err);
  }
}

let appSettings = loadAppSettings();

// ============== Telegram Bot Service ==============
let telegramBot: TelegramBot | null = null;

// Track if Super Agent task was initiated from Telegram (to send response back)
let superAgentTelegramTask = false;
let superAgentOutputBuffer: string[] = [];

// Character emoji mapping for Telegram
const TG_CHARACTER_FACES: Record<string, string> = {
  robot: '🤖', ninja: '🥷', wizard: '🧙', astronaut: '👨‍🚀',
  knight: '⚔️', pirate: '🏴‍☠️', alien: '👽', viking: '🪓', frog: '🐸',
};

// Helper to detect super agent
function isSuperAgent(agent: AgentStatus): boolean {
  const name = agent.name?.toLowerCase() || '';
  return name.includes('super agent') || name.includes('orchestrator');
}

// Find or get the super agent
function getSuperAgent(): AgentStatus | undefined {
  return Array.from(agents.values()).find(a => isSuperAgent(a));
}

// Format agent status for Telegram
function formatAgentStatus(agent: AgentStatus): string {
  const isSuper = isSuperAgent(agent);
  const emoji = isSuper ? '👑' : (TG_CHARACTER_FACES[agent.character || ''] || '🤖');
  const statusEmoji = {
    idle: '⚪', running: '🟢', completed: '✅', error: '🔴', waiting: '🟡'
  }[agent.status] || '⚪';

  let text = `${emoji} *${agent.name || 'Unnamed'}* ${statusEmoji}\n`;
  text += `   Status: ${agent.status}\n`;
  if (agent.currentTask) {
    text += `   Task: ${agent.currentTask.slice(0, 50)}${agent.currentTask.length > 50 ? '...' : ''}\n`;
  }
  // Don't show project for Super Agent
  if (!isSuper) {
    text += `   Project: \`${agent.projectPath.split('/').pop()}\``;
  }
  return text;
}

// Send message to Telegram
function sendTelegramMessage(text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
  if (!telegramBot || !appSettings.telegramChatId) return;
  try {
    // Telegram has a 4096 char limit, truncate if needed
    const maxLen = 4000;
    const truncated = text.length > maxLen ? text.slice(0, maxLen) + '\n\n_(truncated)_' : text;
    telegramBot.sendMessage(appSettings.telegramChatId, truncated, { parse_mode: parseMode });
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    // Try without markdown if it fails (in case of formatting issues)
    try {
      telegramBot.sendMessage(appSettings.telegramChatId, text.replace(/[*_`\[\]]/g, ''));
    } catch {
      // Give up
    }
  }
}

// Extract meaningful response from Super Agent output and send to Telegram
function sendSuperAgentResponseToTelegram(agent: AgentStatus) {
  // Use the captured output buffer if available, otherwise use agent output
  const rawOutput = superAgentOutputBuffer.length > 0
    ? superAgentOutputBuffer.join('')
    : agent.output.slice(-100).join('');

  // Remove ANSI escape codes
  const cleanOutput = rawOutput
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\x1b\[\?[0-9]*[hl]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '') // OSC sequences
    .replace(/[\x00-\x09\x0B-\x1F]/g, ''); // Control chars except newline

  const lines = cleanOutput.split('\n');

  // Find the actual response content - it usually comes after tool results
  // Look for text that's NOT:
  // - Tool use indicators (MCP, ⎿, ●, ⏺)
  // - System messages (---, ctrl+, claude-mgr)
  // - Empty lines at the edges

  const responseLines: string[] = [];
  let foundToolResult = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty
    if (!trimmed) continue;

    // Track when we've seen tool results
    if (trimmed.includes('⎿') || trimmed.includes('(MCP)')) {
      foundToolResult = true;
      continue;
    }

    // Skip system indicators
    if (trimmed.startsWith('●') || trimmed.startsWith('⏺') ||
        trimmed.includes('ctrl+') || trimmed.startsWith('---') ||
        trimmed.startsWith('>') || trimmed.startsWith('$') ||
        trimmed.includes('╭') || trimmed.includes('╰') ||
        trimmed.includes('│') && trimmed.length < 5) {
      continue;
    }

    // After tool results, collect the response text
    if (foundToolResult && trimmed.length > 3) {
      responseLines.push(trimmed);
    }
  }

  // If we found response lines, send them
  if (responseLines.length > 0) {
    // Get the most relevant parts (last portion, likely the summary)
    const response = responseLines.slice(-40).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (response.length > 10) {
      sendTelegramMessage(`👑 ${response}`);
      superAgentOutputBuffer = [];
      return;
    }
  }

  // Fallback: just send the last meaningful text we can find
  const fallbackLines = lines
    .map(l => l.trim())
    .filter(l => l.length > 10 &&
      !l.includes('(MCP)') &&
      !l.includes('⎿') &&
      !l.startsWith('●') &&
      !l.startsWith('⏺') &&
      !l.includes('ctrl+'))
    .slice(-20);

  if (fallbackLines.length > 0) {
    sendTelegramMessage(`👑 ${fallbackLines.join('\n')}`);
  } else {
    sendTelegramMessage(`✅ Super Agent completed the task.`);
  }

  superAgentOutputBuffer = [];
}

// Initialize Telegram bot
function initTelegramBot() {
  // Stop existing bot if any
  if (telegramBot) {
    telegramBot.stopPolling();
    telegramBot = null;
  }

  if (!appSettings.telegramEnabled || !appSettings.telegramBotToken) {
    console.log('Telegram bot disabled or no token');
    return;
  }

  try {
    telegramBot = new TelegramBot(appSettings.telegramBotToken, { polling: true });
    console.log('Telegram bot started');

    // Handle /start command
    telegramBot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id.toString();

      // Save chat ID for future messages
      if (appSettings.telegramChatId !== chatId) {
        appSettings.telegramChatId = chatId;
        saveAppSettings(appSettings);
        // Notify frontend of chat ID change
        mainWindow?.webContents.send('settings:updated', appSettings);
      }

      telegramBot?.sendMessage(chatId,
        `👑 *Claude Manager Bot Connected!*\n\n` +
        `I'll help you manage your agents remotely.\n\n` +
        `*Commands:*\n` +
        `/status - Show all agents status\n` +
        `/agents - List agents with details\n` +
        `/projects - List all projects\n` +
        `/start\\_agent <name> <task> - Start an agent\n` +
        `/stop\\_agent <name> - Stop an agent\n` +
        `/ask <message> - Send to Super Agent\n` +
        `/usage - Show usage & cost stats\n` +
        `/help - Show this help message\n\n` +
        `Or just type a message to talk to the Super Agent!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /help command
    telegramBot.onText(/\/help/, (msg) => {
      telegramBot?.sendMessage(msg.chat.id,
        `📖 *Available Commands*\n\n` +
        `/status - Quick overview of all agents\n` +
        `/agents - Detailed list of all agents\n` +
        `/projects - List all projects with their agents\n` +
        `/start\\_agent <name> <task> - Start an agent with a task\n` +
        `/stop\\_agent <name> - Stop a running agent\n` +
        `/ask <message> - Send a message to Super Agent\n` +
        `/usage - Show usage & cost stats\n` +
        `/help - Show this help message\n\n` +
        `💡 *Tips:*\n` +
        `• Just type a message to talk directly to Super Agent\n` +
        `• Super Agent can manage other agents for you\n` +
        `• Use /status to monitor progress`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /projects command
    telegramBot.onText(/\/projects/, (msg) => {
      const agentList = Array.from(agents.values()).filter(a => !isSuperAgent(a));

      if (agentList.length === 0) {
        telegramBot?.sendMessage(msg.chat.id, '📭 No projects with agents yet.');
        return;
      }

      // Group agents by project path
      const projectsMap = new Map<string, AgentStatus[]>();
      agentList.forEach(agent => {
        const path = agent.projectPath;
        if (!projectsMap.has(path)) {
          projectsMap.set(path, []);
        }
        projectsMap.get(path)!.push(agent);
      });

      let text = `📂 *Projects*\n\n`;

      projectsMap.forEach((projectAgents, path) => {
        const projectName = path.split('/').pop() || 'Unknown';
        text += `📁 *${projectName}*\n`;
        text += `   \`${path}\`\n`;
        text += `   👥 Agents: ${projectAgents.map(a => {
          const emoji = TG_CHARACTER_FACES[a.character || ''] || '🤖';
          const status = a.status === 'running' ? '🟢' : a.status === 'waiting' ? '🟡' : a.status === 'error' ? '🔴' : '⚪';
          return `${emoji}${a.name}${status}`;
        }).join(', ')}\n\n`;
      });

      telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // Handle /status command
    telegramBot.onText(/\/status/, (msg) => {
      const agentList = Array.from(agents.values());
      if (agentList.length === 0) {
        telegramBot?.sendMessage(msg.chat.id, '📭 No agents created yet.');
        return;
      }

      // Helper to format agent info
      const formatAgent = (a: AgentStatus) => {
        const isSuper = isSuperAgent(a);
        const emoji = isSuper ? '👑' : (TG_CHARACTER_FACES[a.character || ''] || '🤖');
        const skills = a.skills.length > 0 ? a.skills.slice(0, 2).join(', ') + (a.skills.length > 2 ? '...' : '') : '';
        let line = `  ${emoji} *${a.name}*\n`;
        // Don't show project for Super Agent
        if (!isSuper) {
          const project = a.projectPath.split('/').pop() || 'Unknown';
          line += `      📁 \`${project}\``;
          if (skills) line += ` | 🛠 ${skills}`;
        } else if (skills) {
          line += `      🛠 ${skills}`;
        }
        if (a.currentTask && a.status === 'running') {
          line += `\n      💬 _${a.currentTask.slice(0, 40)}${a.currentTask.length > 40 ? '...' : ''}_`;
        }
        return line;
      };

      // Sort to put Super Agent first
      const sortSuperFirst = (agents: AgentStatus[]) =>
        [...agents].sort((a, b) => (isSuperAgent(b) ? 1 : 0) - (isSuperAgent(a) ? 1 : 0));

      const running = sortSuperFirst(agentList.filter(a => a.status === 'running'));
      const waiting = sortSuperFirst(agentList.filter(a => a.status === 'waiting'));
      const idle = sortSuperFirst(agentList.filter(a => a.status === 'idle' || a.status === 'completed'));
      const error = sortSuperFirst(agentList.filter(a => a.status === 'error'));

      let text = `📊 *Agents Status*\n\n`;
      if (running.length > 0) {
        text += `🟢 *Running (${running.length}):*\n`;
        running.forEach(a => {
          text += formatAgent(a) + '\n';
        });
        text += '\n';
      }
      if (waiting.length > 0) {
        text += `🟡 *Waiting (${waiting.length}):*\n`;
        waiting.forEach(a => {
          text += formatAgent(a) + '\n';
        });
        text += '\n';
      }
      if (error.length > 0) {
        text += `🔴 *Error (${error.length}):*\n`;
        error.forEach(a => {
          text += formatAgent(a) + '\n';
        });
        text += '\n';
      }
      if (idle.length > 0) {
        text += `⚪ *Idle (${idle.length}):*\n`;
        idle.forEach(a => {
          text += formatAgent(a) + '\n';
        });
      }

      telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // Handle /agents command (detailed list)
    telegramBot.onText(/\/agents/, (msg) => {
      const agentList = Array.from(agents.values());
      if (agentList.length === 0) {
        telegramBot?.sendMessage(msg.chat.id, '📭 No agents created yet.');
        return;
      }

      let text = `🤖 *All Agents*\n\n`;
      agentList.forEach(a => {
        text += formatAgentStatus(a) + '\n\n';
      });

      telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // Handle /start_agent command
    telegramBot.onText(/\/start_agent\s+(.+)/, async (msg, match) => {
      if (!match) return;
      const input = match[1].trim();
      const firstSpaceIndex = input.indexOf(' ');

      let agentName: string;
      let task: string;

      if (firstSpaceIndex === -1) {
        telegramBot?.sendMessage(msg.chat.id, '⚠️ Usage: /start\\_agent <agent name> <task>', { parse_mode: 'Markdown' });
        return;
      }

      agentName = input.substring(0, firstSpaceIndex).toLowerCase();
      task = input.substring(firstSpaceIndex + 1).trim();

      const agent = Array.from(agents.values()).find(a =>
        a.name?.toLowerCase().includes(agentName) || a.id === agentName
      );

      if (!agent) {
        telegramBot?.sendMessage(msg.chat.id, `❌ Agent "${agentName}" not found.`);
        return;
      }

      if (agent.status === 'running') {
        telegramBot?.sendMessage(msg.chat.id, `⚠️ ${agent.name} is already running.`);
        return;
      }

      try {
        // Start the agent using the existing IPC mechanism
        const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");

        // Initialize PTY if needed
        if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
          const ptyId = await initAgentPty(agent);
          agent.ptyId = ptyId;
        }

        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (!ptyProcess) {
          telegramBot?.sendMessage(msg.chat.id, '❌ Failed to initialize agent terminal.');
          return;
        }

        // Build command
        let command = 'claude';
        if (agent.skipPermissions) command += ' --dangerously-skip-permissions';
        if (agent.secondaryProjectPath) {
          command += ` --add-dir '${agent.secondaryProjectPath.replace(/'/g, "'\\''")}'`;
        }
        command += ` '${task.replace(/'/g, "'\\''")}'`;

        agent.status = 'running';
        agent.currentTask = task.slice(0, 100);
        agent.lastActivity = new Date().toISOString();
        ptyProcess.write(`cd '${workingPath}' && ${command}`);
        ptyProcess.write('\r');
        saveAgents();

        const emoji = isSuperAgent(agent) ? '👑' : (TG_CHARACTER_FACES[agent.character || ''] || '🤖');
        telegramBot?.sendMessage(msg.chat.id,
          `🚀 Started *${agent.name}*\n\n${emoji} Task: ${task}`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('Failed to start agent from Telegram:', err);
        telegramBot?.sendMessage(msg.chat.id, `❌ Failed to start agent: ${err}`);
      }
    });

    // Handle /stop_agent command
    telegramBot.onText(/\/stop_agent\s+(.+)/, (msg, match) => {
      if (!match) return;
      const agentName = match[1].trim().toLowerCase();

      const agent = Array.from(agents.values()).find(a =>
        a.name?.toLowerCase().includes(agentName) || a.id === agentName
      );

      if (!agent) {
        telegramBot?.sendMessage(msg.chat.id, `❌ Agent "${agentName}" not found.`);
        return;
      }

      if (agent.status !== 'running' && agent.status !== 'waiting') {
        telegramBot?.sendMessage(msg.chat.id, `⚠️ ${agent.name} is not running.`);
        return;
      }

      // Stop the agent
      if (agent.ptyId) {
        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (ptyProcess) {
          ptyProcess.write('\x03'); // Ctrl+C
        }
      }
      agent.status = 'idle';
      agent.currentTask = undefined;
      saveAgents();

      telegramBot?.sendMessage(msg.chat.id, `🛑 Stopped *${agent.name}*`, { parse_mode: 'Markdown' });
    });

    // Handle /usage command (show usage and cost stats)
    telegramBot.onText(/\/usage/, async (msg) => {
      try {
        const stats = await getClaudeStats();

        if (!stats) {
          telegramBot?.sendMessage(msg.chat.id, '📊 No usage data available yet.');
          return;
        }

        // Token pricing per million tokens (MTok) - same as frontend
        const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number; cacheHitsPerMTok: number; cache5mWritePerMTok: number }> = {
          'claude-opus-4-5-20251101': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25 },
          'claude-opus-4-5': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25 },
          'claude-opus-4-1-20250501': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-opus-4-1': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-opus-4': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-sonnet-4-5-20251022': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-sonnet-4-5': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-sonnet-4': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-3-7-sonnet-20250219': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-haiku-4-5-20251022': { inputPerMTok: 1, outputPerMTok: 5, cacheHitsPerMTok: 0.10, cache5mWritePerMTok: 1.25 },
          'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5, cacheHitsPerMTok: 0.10, cache5mWritePerMTok: 1.25 },
          'claude-3-5-haiku-20241022': { inputPerMTok: 0.80, outputPerMTok: 4, cacheHitsPerMTok: 0.08, cache5mWritePerMTok: 1 },
        };

        const getModelPricing = (modelId: string) => {
          if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];
          const lower = modelId.toLowerCase();
          if (lower.includes('opus-4-5') || lower.includes('opus-4.5')) return MODEL_PRICING['claude-opus-4-5'];
          if (lower.includes('opus-4-1') || lower.includes('opus-4.1')) return MODEL_PRICING['claude-opus-4-1'];
          if (lower.includes('opus-4') || lower.includes('opus4')) return MODEL_PRICING['claude-opus-4'];
          if (lower.includes('sonnet-4-5') || lower.includes('sonnet-4.5')) return MODEL_PRICING['claude-sonnet-4-5'];
          if (lower.includes('sonnet-4') || lower.includes('sonnet4')) return MODEL_PRICING['claude-sonnet-4'];
          if (lower.includes('sonnet-3') || lower.includes('sonnet3')) return MODEL_PRICING['claude-3-7-sonnet-20250219'];
          if (lower.includes('haiku-4-5') || lower.includes('haiku-4.5')) return MODEL_PRICING['claude-haiku-4-5'];
          if (lower.includes('haiku-3-5') || lower.includes('haiku-3.5')) return MODEL_PRICING['claude-3-5-haiku-20241022'];
          return MODEL_PRICING['claude-sonnet-4'];
        };

        const getModelDisplayName = (modelId: string): string => {
          const lower = modelId.toLowerCase();
          if (lower.includes('opus-4-5') || lower.includes('opus-4.5')) return 'Opus 4.5';
          if (lower.includes('opus-4-1') || lower.includes('opus-4.1')) return 'Opus 4.1';
          if (lower.includes('opus-4') || lower.includes('opus4')) return 'Opus 4';
          if (lower.includes('sonnet-4-5') || lower.includes('sonnet-4.5')) return 'Sonnet 4.5';
          if (lower.includes('sonnet-4') || lower.includes('sonnet4')) return 'Sonnet 4';
          if (lower.includes('sonnet-3') || lower.includes('sonnet3')) return 'Sonnet 3.7';
          if (lower.includes('haiku-4-5') || lower.includes('haiku-4.5')) return 'Haiku 4.5';
          if (lower.includes('haiku-3-5') || lower.includes('haiku-3.5')) return 'Haiku 3.5';
          return modelId.split('-').slice(0, 3).join(' ');
        };

        const calculateModelCost = (modelId: string, input: number, output: number, cacheRead: number, cacheWrite: number) => {
          const pricing = getModelPricing(modelId);
          return (input / 1_000_000) * pricing.inputPerMTok +
                 (output / 1_000_000) * pricing.outputPerMTok +
                 (cacheRead / 1_000_000) * pricing.cacheHitsPerMTok +
                 (cacheWrite / 1_000_000) * pricing.cache5mWritePerMTok;
        };

        // Calculate totals
        let totalCost = 0;
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        const modelBreakdown: Array<{ name: string; cost: number; tokens: number }> = [];

        if (stats.modelUsage) {
          Object.entries(stats.modelUsage).forEach(([modelId, usage]: [string, any]) => {
            const input = usage.inputTokens || 0;
            const output = usage.outputTokens || 0;
            const cacheRead = usage.cacheReadInputTokens || 0;
            const cacheWrite = usage.cacheCreationInputTokens || 0;

            totalInput += input;
            totalOutput += output;
            totalCacheRead += cacheRead;
            totalCacheWrite += cacheWrite;

            const cost = calculateModelCost(modelId, input, output, cacheRead, cacheWrite);
            totalCost += cost;

            modelBreakdown.push({
              name: getModelDisplayName(modelId),
              cost,
              tokens: input + output,
            });
          });
        }

        // Sort by cost
        modelBreakdown.sort((a, b) => b.cost - a.cost);

        // Format message
        let text = `📊 *Usage & Cost Summary*\n\n`;
        text += `💰 *Total Cost:* $${totalCost.toFixed(2)}\n`;
        text += `🔢 *Total Tokens:* ${((totalInput + totalOutput) / 1_000_000).toFixed(2)}M\n`;
        text += `📥 Input: ${(totalInput / 1_000_000).toFixed(2)}M\n`;
        text += `📤 Output: ${(totalOutput / 1_000_000).toFixed(2)}M\n`;
        text += `💾 Cache: ${(totalCacheRead / 1_000_000).toFixed(2)}M read\n\n`;

        if (modelBreakdown.length > 0) {
          text += `*By Model:*\n`;
          modelBreakdown.slice(0, 5).forEach(m => {
            const emoji = m.name.includes('Opus') ? '🟣' : m.name.includes('Sonnet') ? '🔵' : '🟢';
            text += `${emoji} ${m.name}: $${m.cost.toFixed(2)}\n`;
          });
        }

        if (stats.totalSessions || stats.totalMessages) {
          text += `\n*Activity:*\n`;
          if (stats.totalSessions) text += `📝 ${stats.totalSessions} sessions\n`;
          if (stats.totalMessages) text += `💬 ${stats.totalMessages} messages\n`;
        }

        if (stats.firstSessionDate) {
          text += `\n_Since ${new Date(stats.firstSessionDate).toLocaleDateString()}_`;
        }

        telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('Error getting usage stats:', err);
        telegramBot?.sendMessage(msg.chat.id, `❌ Error fetching usage data: ${err}`);
      }
    });

    // Handle /ask command (send to Super Agent)
    telegramBot.onText(/\/ask\s+(.+)/, async (msg, match) => {
      if (!match) return;
      const message = match[1].trim();
      await sendToSuperAgent(msg.chat.id.toString(), message);
    });

    // Handle regular messages (forward to Super Agent)
    telegramBot.on('message', async (msg) => {
      // Ignore commands
      if (msg.text?.startsWith('/')) return;
      if (!msg.text) return;

      // Save chat ID if not saved
      const chatId = msg.chat.id.toString();
      if (appSettings.telegramChatId !== chatId) {
        appSettings.telegramChatId = chatId;
        saveAppSettings(appSettings);
      }

      await sendToSuperAgent(chatId, msg.text);
    });

    // Handle polling errors
    telegramBot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
    });

  } catch (err) {
    console.error('Failed to initialize Telegram bot:', err);
  }
}

// Send message to Super Agent
async function sendToSuperAgent(chatId: string, message: string) {
  const superAgent = getSuperAgent();

  if (!superAgent) {
    telegramBot?.sendMessage(chatId,
      '👑 No Super Agent found.\n\nCreate one in Claude Manager first, or use /start\\_agent to start a specific agent.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    // Initialize PTY if needed
    if (!superAgent.ptyId || !ptyProcesses.has(superAgent.ptyId)) {
      const ptyId = await initAgentPty(superAgent);
      superAgent.ptyId = ptyId;
    }

    const ptyProcess = ptyProcesses.get(superAgent.ptyId);
    if (!ptyProcess) {
      telegramBot?.sendMessage(chatId, '❌ Failed to connect to Super Agent terminal.');
      return;
    }

    // If agent is running or waiting, send message to the existing Claude session
    if (superAgent.status === 'running' || superAgent.status === 'waiting') {
      // Track that this input came from Telegram
      superAgentTelegramTask = true;
      superAgentOutputBuffer = [];

      superAgent.currentTask = message.slice(0, 100);
      superAgent.lastActivity = new Date().toISOString();
      saveAgents();

      // Include Telegram context in the message - strip any newlines from Telegram input
      const telegramMessage = `[FROM TELEGRAM - Use send_telegram MCP tool to respond!] ${message.replace(/\r?\n/g, ' ').trim()}`;

      // Write the message first, then send Enter separately
      ptyProcess.write(telegramMessage);
      ptyProcess.write('\r');

      telegramBot?.sendMessage(chatId, `👑 Super Agent is processing...`);
    } else if (superAgent.status === 'idle' || superAgent.status === 'completed' || superAgent.status === 'error') {
      // No active session, start a new one
      const workingPath = (superAgent.worktreePath || superAgent.projectPath).replace(/'/g, "'\\''");

      // Build orchestrator prompt with user's message
      const orchestratorPrompt = `You are the Super Agent - an orchestrator that manages other agents using MCP tools.

THIS REQUEST IS FROM TELEGRAM - You MUST use send_telegram to respond!

AVAILABLE MCP TOOLS (from "claude-mgr-orchestrator"):
- list_agents: List all agents with status, project, ID
- get_agent_output: Read agent's terminal output (use to see responses!)
- start_agent: Start agent with a prompt (auto-sends to running agents too)
- send_message: Send message to agent (auto-starts idle agents)
- stop_agent: Stop a running agent
- create_agent: Create a new agent
- remove_agent: Delete an agent
- send_telegram: Send your response back to Telegram (USE THIS!)

WORKFLOW FOR TELEGRAM REQUESTS:
1. Use start_agent or send_message with your task/question
2. Wait 5-10 seconds for the agent to process
3. Use get_agent_output to read their response
4. Use send_telegram to send a summary/response back to the user

IMPORTANT - AUTONOMOUS MODE:
When giving tasks to agents, ALWAYS include these instructions in your prompt:
- "Work autonomously without asking for user feedback or choices"
- "Make decisions on your own and proceed with the best approach"
- "Do not wait for user confirmation - execute the task fully"
This is because the user is on Telegram and cannot respond to agent questions.

CRITICAL: This request came from Telegram. When you have an answer, you MUST call send_telegram with your response. The user is waiting on Telegram for your reply!

USER REQUEST: ${message}`;

      let command = 'claude';

      // Add MCP config
      const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        command += ` --mcp-config '${mcpConfigPath}'`;
      }

      if (superAgent.skipPermissions) command += ' --dangerously-skip-permissions';
      command += ` '${orchestratorPrompt.replace(/'/g, "'\\''")}'`;

      superAgent.status = 'running';
      superAgent.currentTask = message.slice(0, 100);
      superAgent.lastActivity = new Date().toISOString();

      // Track that this task came from Telegram
      superAgentTelegramTask = true;
      superAgentOutputBuffer = [];

      // Start new Claude session
      ptyProcess.write(`cd '${workingPath}' && ${command}`);
        ptyProcess.write('\r');
      saveAgents();

      telegramBot?.sendMessage(chatId, `👑 Super Agent is processing your request...`);
    } else {
      telegramBot?.sendMessage(chatId,
        `👑 Super Agent is in ${superAgent.status} state. Try again in a moment.`
      );
    }
  } catch (err) {
    console.error('Failed to send to Super Agent:', err);
    telegramBot?.sendMessage(chatId, `❌ Error: ${err}`);
  }
}

// Stop Telegram bot
function stopTelegramBot() {
  if (telegramBot) {
    telegramBot.stopPolling();
    telegramBot = null;
    console.log('Telegram bot stopped');
  }
}

// Auto-start the Super Agent on app startup
async function autoStartSuperAgent() {
  const superAgent = getSuperAgent();
  if (!superAgent) {
    console.log('No Super Agent found - skipping auto-start');
    return;
  }

  console.log(`Found Super Agent: ${superAgent.name} (status: ${superAgent.status})`);

  // Only auto-start if idle, completed, or error
  if (superAgent.status !== 'idle' && superAgent.status !== 'completed' && superAgent.status !== 'error') {
    console.log(`Super Agent is ${superAgent.status} - skipping auto-start`);
    return;
  }

  try {
    // Initialize PTY if needed
    if (!superAgent.ptyId || !ptyProcesses.has(superAgent.ptyId)) {
      console.log('Initializing PTY for Super Agent...');
      const ptyId = await initAgentPty(superAgent);
      superAgent.ptyId = ptyId;
    }

    const ptyProcess = ptyProcesses.get(superAgent.ptyId);
    if (!ptyProcess) {
      console.error('Failed to get PTY process for Super Agent');
      return;
    }

    // Build orchestrator prompt
    const orchestratorPrompt = `You are the Super Agent - an orchestrator that manages other agents using MCP tools.

AVAILABLE MCP TOOLS (from "claude-mgr-orchestrator"):
- list_agents: List all agents with status, project, ID
- get_agent_output: Read agent's terminal output (use to see responses!)
- start_agent: Start agent with a prompt (auto-sends to running agents too)
- send_message: Send message to agent (auto-starts idle agents)
- stop_agent: Stop a running agent
- create_agent: Create a new agent
- remove_agent: Delete an agent

WORKFLOW - When asked to talk to an agent:
1. Use start_agent or send_message with your question (both auto-handle idle/running states)
2. Wait 5-10 seconds for the agent to process
3. Use get_agent_output to read their response
4. Report the response back to the user

IMPORTANT:
- ALWAYS check get_agent_output after sending a message to see the response
- Keep responses concise
- NEVER explore codebases - you only manage agents

Say hello and list the current agents.`;

    const workingPath = (superAgent.worktreePath || superAgent.projectPath).replace(/'/g, "'\\''");

    let command = 'claude';

    // Add MCP config
    const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
    if (fs.existsSync(mcpConfigPath)) {
      command += ` --mcp-config '${mcpConfigPath}'`;
    }

    if (superAgent.skipPermissions) command += ' --dangerously-skip-permissions';
    command += ` '${orchestratorPrompt.replace(/'/g, "'\\''")}'`;

    superAgent.status = 'running';
    superAgent.currentTask = 'Initializing Super Agent...';
    superAgent.lastActivity = new Date().toISOString();

    console.log('Auto-starting Super Agent...');
    ptyProcess.write(`cd '${workingPath}' && ${command}`);
        ptyProcess.write('\r');
    saveAgents();

    console.log('Super Agent auto-started successfully');
  } catch (err) {
    console.error('Failed to auto-start Super Agent:', err);
  }
}

// Track if agents have been loaded (to prevent saving empty state before load)
let agentsLoaded = false;

// Save agents to disk
function saveAgents() {
  try {
    // Don't save if agents haven't been loaded yet (prevents wiping data on early calls)
    if (!agentsLoaded) {
      console.log('Skipping save - agents not loaded yet');
      return;
    }

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

    // Create backup before saving if file exists and has content
    if (fs.existsSync(AGENTS_FILE)) {
      const existingContent = fs.readFileSync(AGENTS_FILE, 'utf-8');
      if (existingContent.trim().length > 2) { // More than just "[]"
        const backupFile = path.join(DATA_DIR, 'agents.backup.json');
        fs.writeFileSync(backupFile, existingContent);
      }
    }

    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agentsArray, null, 2));
    console.log(`Saved ${agentsArray.length} agents to disk`);
  } catch (err) {
    console.error('Failed to save agents:', err);
  }
}

// Load agents from disk
function loadAgents() {
  try {
    if (!fs.existsSync(AGENTS_FILE)) {
      console.log('No agents file found, starting fresh');
      agentsLoaded = true;
      return;
    }

    const data = fs.readFileSync(AGENTS_FILE, 'utf-8');

    // Handle empty file
    if (!data.trim() || data.trim() === '[]') {
      console.log('Agents file is empty, checking for backup...');
      // Try to restore from backup
      const backupFile = path.join(DATA_DIR, 'agents.backup.json');
      if (fs.existsSync(backupFile)) {
        const backupData = fs.readFileSync(backupFile, 'utf-8');
        if (backupData.trim() && backupData.trim() !== '[]') {
          console.log('Restoring agents from backup...');
          fs.writeFileSync(AGENTS_FILE, backupData);
          // Re-read the restored file
          loadAgents();
          return;
        }
      }
      agentsLoaded = true;
      return;
    }

    const agentsArray = JSON.parse(data) as AgentStatus[];

    for (const agent of agentsArray) {
      // Check if project path still exists - but NEVER skip agents!
      // Just mark them as having a missing path so UI can show warning
      const workingPath = agent.worktreePath || agent.projectPath;
      if (!fs.existsSync(workingPath)) {
        console.warn(`Agent ${agent.id} has missing path: ${workingPath} - marking as pathMissing`);
        agent.pathMissing = true;
      } else {
        agent.pathMissing = false;
      }

      // Reset status to idle since PTY is not running
      agent.status = 'idle';
      agent.ptyId = undefined;

      agents.set(agent.id, agent);
    }

    console.log(`Loaded ${agents.size} agents from disk`);
    agentsLoaded = true;
  } catch (err) {
    console.error('Failed to load agents:', err);
    agentsLoaded = true; // Still set to true to allow new agents to be saved
  }
}

// Initialize a PTY for a restored agent
async function initAgentPty(agent: AgentStatus): Promise<string> {
  const shell = process.env.SHELL || '/bin/zsh';
  const cwd = agent.worktreePath || agent.projectPath;

  console.log(`Initializing PTY for restored agent ${agent.id} in ${cwd}`);

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: {
      ...process.env as { [key: string]: string },
      CLAUDE_SKILLS: agent.skills.join(','),
      CLAUDE_AGENT_ID: agent.id,
      CLAUDE_PROJECT_PATH: agent.projectPath,
    },
  });

  const ptyId = uuidv4();
  ptyProcesses.set(ptyId, ptyProcess);

  // Forward PTY output to renderer
  ptyProcess.onData((data) => {
    const agentData = agents.get(agent.id);
    if (agentData) {
      agentData.output.push(data);
      agentData.lastActivity = new Date().toISOString();

      // Memory is handled by claude-mem plugin via hooks

      // Capture Super Agent output for Telegram
      if (superAgentTelegramTask && isSuperAgent(agentData)) {
        superAgentOutputBuffer.push(data);
        // Keep buffer reasonable
        if (superAgentOutputBuffer.length > 200) {
          superAgentOutputBuffer = superAgentOutputBuffer.slice(-100);
        }
      }

      // Check if agent was manually stopped recently (within 3 seconds)
      // If so, don't override the status with detection
      const manuallyStoppedAt = (agentData as AgentStatus & { _manuallyStoppedAt?: number })._manuallyStoppedAt;
      const wasRecentlyStopped = manuallyStoppedAt && (Date.now() - manuallyStoppedAt) < 3000;

      if (!wasRecentlyStopped) {
        // Detect status changes when we receive output
        // This ensures we catch prompts even if the agent was marked as completed/idle
        const newStatus = detectAgentStatus(agentData);
        if (newStatus !== agentData.status) {
          agentData.status = newStatus;
          // Send notification
          handleStatusChangeNotification(agentData, newStatus);
          // Send status change event
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
    const agentData = agents.get(agent.id);
    if (agentData) {
      const newStatus = exitCode === 0 ? 'completed' : 'error';
      agentData.status = newStatus;
      agentData.lastActivity = new Date().toISOString();
      // Memory sessions are handled by claude-mem via hooks
      // Send notification
      handleStatusChangeNotification(agentData, newStatus);
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

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
  } else {
    // In production, use the custom app:// protocol to properly serve static files
    // This fixes issues with absolute paths like /logo.png not resolving correctly
    mainWindow.loadURL('app://-/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle loading errors
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, errorCode, errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });
}

// Register custom protocol for serving static files
// This must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(async () => {
  // Start claude-mem worker service (memory is handled by claude-mem plugin)
  const claudeMemStarted = await startClaudeMemWorker();
  if (claudeMemStarted) {
    console.log('Claude-mem memory system active');
  } else {
    console.log('Claude-mem not available - install the plugin for memory features');
  }

  // Load persisted agents before creating window
  loadAgents();

  // Auto-setup MCP orchestrator if not already configured
  await setupMcpOrchestrator();

  // Configure memory hooks for Claude Code
  await configureMemoryHooks();

  // Initialize Telegram bot if enabled
  initTelegramBot();

  // Auto-start Super Agent if it exists
  await autoStartSuperAgent();

  // Register the app:// protocol handler
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    const basePath = getAppBasePath();
    console.log('Registering app:// protocol with basePath:', basePath);

    protocol.handle('app', (request) => {
      let urlPath = request.url.replace('app://', '');

      // Remove the host part (e.g., "localhost" or "-")
      const slashIndex = urlPath.indexOf('/');
      if (slashIndex !== -1) {
        urlPath = urlPath.substring(slashIndex);
      } else {
        urlPath = '/';
      }

      // Default to index.html for directory requests
      if (urlPath === '/' || urlPath === '') {
        urlPath = '/index.html';
      }

      // Handle page routes (e.g., /agents/, /settings/) - serve their index.html
      if (urlPath.endsWith('/')) {
        urlPath = urlPath + 'index.html';
      }

      // Remove leading slash for path.join
      const relativePath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
      const filePath = path.join(basePath, relativePath);

      console.log(`app:// request: ${request.url} -> ${filePath}`);

      // Check if file exists
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        return new Response(fs.readFileSync(filePath), {
          headers: { 'Content-Type': mimeType },
        });
      }

      // If it's a page route without .html, try adding index.html
      const htmlPath = path.join(basePath, relativePath, 'index.html');
      if (fs.existsSync(htmlPath)) {
        return new Response(fs.readFileSync(htmlPath), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      console.error(`File not found: ${filePath}`);
      return new Response('Not Found', { status: 404 });
    });
  }

  createWindow();

  // Start the HTTP API server for MCP orchestrator integration
  startApiServer();
});

app.on('window-all-closed', () => {
  // Save agents before quitting
  saveAgents();

  // Stop the API server
  stopApiServer();

  // Stop Telegram bot
  stopTelegramBot();

  // Kill all PTY processes
  ptyProcesses.forEach((ptyProcess) => {
    ptyProcess.kill();
  });
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Save agents when app is about to quit
app.on('before-quit', () => {
  saveAgents();
  stopClaudeMemWorker();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============== PTY Terminal IPC Handlers ==============

// Create a new PTY terminal
ipcMain.handle('pty:create', async (_event, { cwd, cols, rows }: { cwd?: string; cols?: number; rows?: number }) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: process.env as { [key: string]: string },
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
ipcMain.handle('pty:write', async (_event, { id, data }: { id: string; data: string }) => {
  const ptyProcess = ptyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Resize PTY
ipcMain.handle('pty:resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  const ptyProcess = ptyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Kill PTY
ipcMain.handle('pty:kill', async (_event, { id }: { id: string }) => {
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
ipcMain.handle('agent:create', async (_event, config: {
  projectPath: string;
  skills: string[];
  worktree?: WorktreeConfig;
  character?: AgentCharacter;
  name?: string;
  secondaryProjectPath?: string;
  skipPermissions?: boolean;
}) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  // Validate project path exists
  let cwd = config.projectPath;
  if (!fs.existsSync(cwd)) {
    console.warn(`Project path does not exist: ${cwd}, using home directory`);
    cwd = os.homedir();
  }

  let worktreePath: string | undefined;
  let branchName: string | undefined;

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
      } else {
        // Create the worktree with a new branch
        const { execSync } = await import('child_process');

        // Check if branch already exists
        try {
          execSync(`git rev-parse --verify ${branchName}`, { cwd, stdio: 'pipe' });
          // Branch exists, create worktree using existing branch
          execSync(`git worktree add "${worktreePath}" ${branchName}`, { cwd, stdio: 'pipe' });
          console.log(`Created worktree using existing branch ${branchName}`);
        } catch {
          // Branch doesn't exist, create worktree with new branch
          execSync(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd, stdio: 'pipe' });
          console.log(`Created worktree with new branch ${branchName}`);
        }
      }

      // Use the worktree path as the working directory
      cwd = worktreePath;
    } catch (err) {
      console.error(`Failed to create git worktree:`, err);
      // Continue without worktree if creation fails
      worktreePath = undefined;
      branchName = undefined;
    }
  }

  console.log(`Creating PTY for agent ${id} with shell ${shell} in ${cwd}`);

  // Create PTY for this agent
  let ptyProcess: pty.IPty;
  try {
    ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: {
        ...process.env as { [key: string]: string },
        CLAUDE_SKILLS: config.skills.join(','),
        CLAUDE_AGENT_ID: id,
        CLAUDE_PROJECT_PATH: config.projectPath,
      },
    });
    console.log(`PTY created successfully for agent ${id}, PID: ${ptyProcess.pid}`);
  } catch (err) {
    console.error(`Failed to create PTY for agent ${id}:`, err);
    throw err;
  }

  const ptyId = uuidv4();
  ptyProcesses.set(ptyId, ptyProcess);

  // Validate secondary project path if provided
  let secondaryProjectPath: string | undefined;
  if (config.secondaryProjectPath) {
    if (fs.existsSync(config.secondaryProjectPath)) {
      secondaryProjectPath = config.secondaryProjectPath;
      console.log(`Secondary project path validated: ${secondaryProjectPath}`);
    } else {
      console.warn(`Secondary project path does not exist: ${config.secondaryProjectPath}`);
    }
  }

  const status: AgentStatus = {
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
      if (superAgentTelegramTask && isSuperAgent(agent)) {
        superAgentOutputBuffer.push(data);
        // Keep buffer reasonable
        if (superAgentOutputBuffer.length > 200) {
          superAgentOutputBuffer = superAgentOutputBuffer.slice(-100);
        }
      }

      // Check if agent was manually stopped recently (within 3 seconds)
      // If so, don't override the status with detection
      const manuallyStoppedAt = (agent as AgentStatus & { _manuallyStoppedAt?: number })._manuallyStoppedAt;
      const wasRecentlyStopped = manuallyStoppedAt && (Date.now() - manuallyStoppedAt) < 3000;

      if (!wasRecentlyStopped) {
        // Detect status changes when we receive output
        const newStatus = detectAgentStatus(agent);
        if (newStatus !== agent.status) {
          agent.status = newStatus;
          // Send notification
          handleStatusChangeNotification(agent, newStatus);
          // Send status change event
          mainWindow?.webContents.send('agent:status', {
            type: 'status',
            agentId: id,
            status: newStatus,
            timestamp: new Date().toISOString(),
          });
        }
      }
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
      const newStatus = exitCode === 0 ? 'completed' : 'error';
      agent.status = newStatus;
      agent.lastActivity = new Date().toISOString();
      // Send notification
      handleStatusChangeNotification(agent, newStatus);
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
ipcMain.handle('agent:start', async (_event, { id, prompt, options }: {
  id: string;
  prompt: string;
  options?: { model?: string; resume?: boolean }
}) => {
  const agent = agents.get(id);
  if (!agent) throw new Error('Agent not found');

  // Initialize PTY if agent was restored from disk and doesn't have one
  if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
    console.log(`Agent ${id} needs PTY initialization`);
    const ptyId = await initAgentPty(agent);
    agent.ptyId = ptyId;
  }

  const ptyProcess = ptyProcesses.get(agent.ptyId);
  if (!ptyProcess) throw new Error('PTY not found');

  // Build Claude Code command
  let command = 'claude';

  // Check if this is the Super Agent (orchestrator)
  const isSuperAgent = agent.name?.toLowerCase().includes('super agent') ||
                       agent.name?.toLowerCase().includes('orchestrator');

  // Add explicit MCP config for Super Agent to ensure orchestrator tools are loaded
  if (isSuperAgent) {
    const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
    if (fs.existsSync(mcpConfigPath)) {
      command += ` --mcp-config '${mcpConfigPath}'`;
    }
  }

  if (options?.model) {
    command += ` --model ${options.model}`;
  }

  if (options?.resume) {
    command += ' --resume';
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

  // Memory is now handled by claude-mem plugin via hooks
  // No need to inject memory context - it's automatic

  // Add the prompt (escape single quotes)
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
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
ipcMain.handle('agent:get', async (_event, id: string) => {
  const agent = agents.get(id);
  if (!agent) return null;

  // Initialize PTY if agent was restored from disk and doesn't have one
  if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
    console.log(`Initializing PTY for agent ${id} on get`);
    const ptyId = await initAgentPty(agent);
    agent.ptyId = ptyId;
  }

  return agent;
});

// Get all agents
ipcMain.handle('agent:list', async () => {
  return Array.from(agents.values());
});

// Update an agent (can update skills, secondaryProjectPath, skipPermissions, name, character)
ipcMain.handle('agent:update', async (_event, params: {
  id: string;
  skills?: string[];
  secondaryProjectPath?: string | null;
  skipPermissions?: boolean;
  name?: string;
  character?: AgentCharacter;
}) => {
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
    } else if (fs.existsSync(params.secondaryProjectPath)) {
      agent.secondaryProjectPath = params.secondaryProjectPath;
    } else {
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
ipcMain.handle('agent:stop', async (_event, id: string) => {
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
    (agent as AgentStatus & { _manuallyStoppedAt?: number })._manuallyStoppedAt = Date.now();
    saveAgents();

    // Send status change notification to frontend immediately
    mainWindow?.webContents.send('agent:status', {
      type: 'status',
      agentId: id,
      status: 'idle',
      timestamp: new Date().toISOString(),
    });
  }
  return { success: true };
});

// Remove an agent
ipcMain.handle('agent:remove', async (_event, id: string) => {
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
      const { execSync } = await import('child_process');
      console.log(`Removing worktree at ${agent.worktreePath}`);
      execSync(`git worktree remove "${agent.worktreePath}" --force`, { cwd: agent.projectPath, stdio: 'pipe' });
      console.log(`Worktree removed successfully`);
    } catch (err) {
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
ipcMain.handle('agent:setSecondaryProject', async (_event, { id, secondaryProjectPath }: { id: string; secondaryProjectPath: string | null }) => {
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
  } else {
    // Clear the secondary project path
    agent.secondaryProjectPath = undefined;
    console.log(`Cleared secondary project path for agent ${id}`);
  }

  // Save updated agents to disk
  saveAgents();

  return { success: true, agent };
});

// Send input to an agent
ipcMain.handle('agent:input', async (_event, { id, input }: { id: string; input: string }) => {
  const agent = agents.get(id);
  if (agent?.ptyId) {
    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      try {
        ptyProcess.write(input);
        return { success: true };
      } catch (err) {
        console.error('Failed to write to PTY:', err);
        return { success: false, error: 'Failed to write to PTY' };
      }
    }
  }
  return { success: false, error: 'PTY not found' };
});

// Resize agent PTY
ipcMain.handle('agent:resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  const agent = agents.get(id);
  if (agent?.ptyId) {
    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
        return { success: true };
      } catch (err) {
        console.error('Failed to resize PTY:', err);
        return { success: false, error: 'Failed to resize PTY' };
      }
    }
  }
  return { success: false, error: 'PTY not found' };
});

// ============== Skills IPC Handlers ==============

// Store for skill installation PTYs
const skillPtyProcesses: Map<string, pty.IPty> = new Map();

// Start skill installation (creates interactive PTY)
ipcMain.handle('skill:install-start', async (_event, { repo, cols, rows }: { repo: string; cols?: number; rows?: number }) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
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
  let command: string;
  if (parts.length >= 3) {
    // Has skill name: owner/repo/skill-name
    const repoPath = `${parts[0]}/${parts[1]}`;
    const skillName = parts.slice(2).join('/');
    command = `npx skills add https://github.com/${repoPath} --skill ${skillName}`;
  } else {
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
ipcMain.handle('skill:install-write', async (_event, { id, data }: { id: string; data: string }) => {
  const ptyProcess = skillPtyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Resize skill installation PTY
ipcMain.handle('skill:install-resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  const ptyProcess = skillPtyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Kill skill installation PTY
ipcMain.handle('skill:install-kill', async (_event, { id }: { id: string }) => {
  const ptyProcess = skillPtyProcesses.get(id);
  if (ptyProcess) {
    ptyProcess.kill();
    skillPtyProcesses.delete(id);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Legacy install (kept for backwards compatibility)
ipcMain.handle('skill:install', async (_event, repo: string) => {
  // Just start the installation and return immediately
  // The actual interaction happens via skill:install-start
  return { success: true, message: 'Use skill:install-start for interactive installation' };
});

// Get installed skills from Claude config
ipcMain.handle('skill:list-installed', async () => {
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
  } catch {
    return [];
  }
});

// ============== Claude Data IPC Handlers ==============

// Read Claude Code settings
async function getClaudeSettings() {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) return null;
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return null;
  }
}

// Read Claude Code stats
async function getClaudeStats() {
  try {
    // Primary stats are in stats-cache.json
    const statsCachePath = path.join(os.homedir(), '.claude', 'stats-cache.json');
    if (fs.existsSync(statsCachePath)) {
      const statsCache = JSON.parse(fs.readFileSync(statsCachePath, 'utf-8'));
      return statsCache;
    }

    // Fallback to statsig_user_metadata.json if it exists
    const statsPath = path.join(os.homedir(), '.claude', 'statsig_user_metadata.json');
    if (fs.existsSync(statsPath)) {
      return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    }

    return null;
  } catch {
    return null;
  }
}

// Read Claude Code projects
async function getClaudeProjects() {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) return [];

    const projects: Array<{
      id: string;
      path: string;
      name: string;
      sessions: Array<{ id: string; timestamp: number }>;
      lastAccessed: number;
    }> = [];

    // Smart path decoding: Claude encodes paths by replacing / with -
    // But folder names can contain -, so we need to find the actual path
    const decodeClaudePath = (encoded: string): string => {
      const parts = encoded.split('-').filter(Boolean);

      // Recursive function to try all combinations
      const tryDecode = (index: number, currentPath: string): string | null => {
        if (index >= parts.length) {
          return fs.existsSync(currentPath) ? currentPath : null;
        }

        // Try adding with slash first (new directory)
        const withSlash = currentPath + '/' + parts[index];
        if (fs.existsSync(withSlash)) {
          const result = tryDecode(index + 1, withSlash);
          if (result) return result;
        }

        // Try combining remaining parts with dashes
        // This handles cases like "frontend-lite" being split into ["frontend", "lite"]
        for (let end = index + 1; end <= parts.length; end++) {
          const combined = parts.slice(index, end).join('-');
          const withCombined = currentPath + '/' + combined;

          if (fs.existsSync(withCombined)) {
            if (end === parts.length) {
              return withCombined;
            }
            const result = tryDecode(end, withCombined);
            if (result) return result;
          }
        }

        return null;
      };

      // Start with empty path (will add leading /)
      const result = tryDecode(0, '');

      if (result) return result;

      // Fallback to simple decode if nothing found
      let decoded = '/' + parts.join('/');
      return decoded;
    };

    const dirs = fs.readdirSync(projectsDir);
    for (const dir of dirs) {
      const fullPath = path.join(projectsDir, dir);
      const stat = fs.statSync(fullPath);
      if (!stat.isDirectory()) continue;

      // Decode project path smartly
      const decodedPath = decodeClaudePath(dir);

      // Get sessions
      const sessions: Array<{ id: string; timestamp: number }> = [];
      const files = fs.readdirSync(fullPath);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const sessionId = file.replace('.jsonl', '');
          const fileStat = fs.statSync(path.join(fullPath, file));
          sessions.push({ id: sessionId, timestamp: fileStat.mtimeMs });
        }
      }

      projects.push({
        id: dir,
        path: decodedPath,
        name: path.basename(decodedPath),
        sessions: sessions.sort((a, b) => b.timestamp - a.timestamp),
        lastAccessed: stat.mtimeMs,
      });
    }

    return projects.sort((a, b) => b.lastAccessed - a.lastAccessed);
  } catch {
    return [];
  }
}

// Read Claude Code plugins
async function getClaudePlugins() {
  try {
    const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(pluginsPath)) return [];
    const data = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Read skill metadata from a path
function readSkillMetadata(skillPath: string): { name: string; description?: string } | null {
  try {
    const metadataPath = path.join(skillPath, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      return { name: metadata.name || path.basename(skillPath), description: metadata.description };
    }
    return { name: path.basename(skillPath) };
  } catch {
    return { name: path.basename(skillPath) };
  }
}

// Read Claude Code skills
async function getClaudeSkills() {
  const skills: Array<{
    name: string;
    source: 'project' | 'user' | 'plugin';
    path: string;
    description?: string;
    projectName?: string;
  }> = [];

  // User skills from ~/.claude/skills
  const userSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  if (fs.existsSync(userSkillsDir)) {
    const entries = fs.readdirSync(userSkillsDir);
    for (const entry of entries) {
      const entryPath = path.join(userSkillsDir, entry);
      try {
        const realPath = fs.realpathSync(entryPath);
        const metadata = readSkillMetadata(realPath);
        if (metadata) {
          skills.push({
            name: metadata.name,
            source: 'user',
            path: realPath,
            description: metadata.description,
          });
        }
      } catch {
        // Skip broken symlinks
      }
    }
  }

  // User skills from ~/.agents/skills (alternative location)
  const agentsSkillsDir = path.join(os.homedir(), '.agents', 'skills');
  if (fs.existsSync(agentsSkillsDir)) {
    const entries = fs.readdirSync(agentsSkillsDir);
    for (const entry of entries) {
      const entryPath = path.join(agentsSkillsDir, entry);
      try {
        const realPath = fs.realpathSync(entryPath);
        const metadata = readSkillMetadata(realPath);
        if (metadata) {
          // Check if skill with same name already exists (avoid duplicates)
          const existingSkill = skills.find(s => s.name === metadata.name);
          if (!existingSkill) {
            skills.push({
              name: metadata.name,
              source: 'user',
              path: realPath,
              description: metadata.description,
            });
          }
        }
      } catch {
        // Skip broken symlinks
      }
    }
  }

  // Plugin skills from installed_plugins.json
  const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (fs.existsSync(pluginsPath)) {
    try {
      const plugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
      if (Array.isArray(plugins)) {
        for (const plugin of plugins) {
          skills.push({
            name: plugin.name || 'Unknown Plugin',
            source: 'plugin',
            path: plugin.path || '',
            description: plugin.description,
          });
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return skills;
}

// Read Claude Code history
async function getClaudeHistory(limit = 50) {
  try {
    const historyPath = path.join(os.homedir(), '.claude', '.history');
    if (!fs.existsSync(historyPath)) return [];

    const content = fs.readFileSync(historyPath, 'utf-8');
    const entries = content.trim().split('\n').filter(Boolean);

    return entries.slice(-limit).reverse().map((line) => {
      const [display, timestampStr, project] = line.split('\t');
      return {
        display: display || '',
        timestamp: parseInt(timestampStr || '0', 10),
        project: project || undefined,
      };
    });
  } catch {
    return [];
  }
}

// Get all Claude data
ipcMain.handle('claude:getData', async () => {
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
  } catch (err) {
    console.error('Failed to get Claude data:', err);
    return null;
  }
});

// ============== Settings IPC Handlers ==============

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

// Get Claude settings
ipcMain.handle('settings:get', async () => {
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
  } catch (err) {
    console.error('Failed to read settings:', err);
    return null;
  }
});

// Save Claude settings
ipcMain.handle('settings:save', async (_event, settings: {
  enabledPlugins?: Record<string, boolean>;
  env?: Record<string, string>;
  hooks?: Record<string, unknown>;
  includeCoAuthoredBy?: boolean;
  permissions?: { allow: string[]; deny: string[] };
}) => {
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
  } catch (err) {
    console.error('Failed to save settings:', err);
    return { success: false, error: String(err) };
  }
});

// Get Claude info (version, paths, etc.)
ipcMain.handle('settings:getInfo', async () => {
  try {
    const { execSync } = await import('child_process');

    // Try to get Claude version
    let claudeVersion = 'Unknown';
    try {
      claudeVersion = execSync('claude --version 2>/dev/null', { encoding: 'utf-8' }).trim();
    } catch {
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
  } catch (err) {
    console.error('Failed to get info:', err);
    return null;
  }
});

// ============== App Settings IPC Handlers (Notifications) ==============

// Get app settings (notifications, etc.)
ipcMain.handle('app:getSettings', async () => {
  return appSettings;
});

// Save app settings
ipcMain.handle('app:saveSettings', async (_event, newSettings: Partial<AppSettings>) => {
  try {
    const telegramChanged = newSettings.telegramEnabled !== undefined ||
                            newSettings.telegramBotToken !== undefined;

    appSettings = { ...appSettings, ...newSettings };
    saveAppSettings(appSettings);

    // Reinitialize Telegram bot if settings changed
    if (telegramChanged) {
      initTelegramBot();
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to save app settings:', err);
    return { success: false, error: String(err) };
  }
});

// Test Telegram connection
ipcMain.handle('telegram:test', async () => {
  if (!appSettings.telegramBotToken) {
    return { success: false, error: 'No bot token configured' };
  }

  try {
    const testBot = new TelegramBot(appSettings.telegramBotToken);
    const me = await testBot.getMe();
    return { success: true, botName: me.username };
  } catch (err) {
    console.error('Telegram test failed:', err);
    return { success: false, error: String(err) };
  }
});

// Send test message to Telegram
ipcMain.handle('telegram:sendTest', async () => {
  if (!telegramBot || !appSettings.telegramChatId) {
    return { success: false, error: 'Bot not connected or no chat ID. Send /start to the bot first.' };
  }

  try {
    await telegramBot.sendMessage(appSettings.telegramChatId, '✅ Test message from Claude Manager!');
    return { success: true };
  } catch (err) {
    console.error('Telegram send test failed:', err);
    return { success: false, error: String(err) };
  }
});

// ============== Memory Hooks Setup ==============

// Get the path to the bundled hooks directory
function getHooksPath(): string {
  let appPath = app.getAppPath();
  // If running from asar, use unpacked path
  if (appPath.includes('app.asar')) {
    appPath = appPath.replace('app.asar', 'app.asar.unpacked');
  }
  return path.join(appPath, 'hooks');
}

// Configure Claude Code hooks for memory system
async function configureMemoryHooks(): Promise<void> {
  try {
    const hooksDir = getHooksPath();

    // Check if hooks directory exists
    if (!fs.existsSync(hooksDir)) {
      console.log('Hooks directory not found at', hooksDir);
      return;
    }

    const claudeDir = path.join(os.homedir(), '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    // Ensure .claude directory exists
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Read existing settings
    let settings: {
      hooks?: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>>;
      [key: string]: unknown;
    } = {};

    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch {
        settings = {};
      }
    }

    // Initialize hooks if not present
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Define our hooks
    const postToolUseHook = path.join(hooksDir, 'post-tool-use.sh');
    const stopHook = path.join(hooksDir, 'on-stop.sh');
    const sessionStartHook = path.join(hooksDir, 'session-start.sh');
    const sessionEndHook = path.join(hooksDir, 'session-end.sh');
    const notificationHook = path.join(hooksDir, 'notification.sh');

    // Check which hooks exist
    const hasPostToolUse = fs.existsSync(postToolUseHook);
    const hasStop = fs.existsSync(stopHook);
    const hasSessionStart = fs.existsSync(sessionStartHook);
    const hasSessionEnd = fs.existsSync(sessionEndHook);
    const hasNotification = fs.existsSync(notificationHook);

    let updated = false;

    // Configure PostToolUse hook
    if (hasPostToolUse) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: postToolUseHook, timeout: 30 }]
      };

      // Check if already configured
      const existing = settings.hooks.PostToolUse || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('post-tool-use.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.PostToolUse = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure Stop hook
    if (hasStop) {
      const hookConfig = {
        hooks: [{ type: 'command', command: stopHook, timeout: 30 }]
      };

      const existing = settings.hooks.Stop || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('on-stop.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.Stop = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure SessionStart hook
    if (hasSessionStart) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: sessionStartHook, timeout: 30 }]
      };

      const existing = settings.hooks.SessionStart || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('session-start.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.SessionStart = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure SessionEnd hook
    if (hasSessionEnd) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: sessionEndHook, timeout: 30 }]
      };

      const existing = settings.hooks.SessionEnd || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('session-end.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.SessionEnd = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure Notification hook
    if (hasNotification) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: notificationHook, timeout: 30 }]
      };

      const existing = settings.hooks.Notification || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('notification.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.Notification = [...existing, hookConfig];
        updated = true;
      }
    }

    // Write updated settings
    if (updated) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('Memory hooks configured in', settingsPath);
    } else {
      console.log('Memory hooks already configured');
    }
  } catch (err) {
    console.error('Failed to configure memory hooks:', err);
  }
}

// ============== Orchestrator MCP Setup ==============

// Get the path to the bundled MCP orchestrator
function getMcpOrchestratorPath(): string {
  // In production, MCP orchestrator is in extraResources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mcp-orchestrator', 'dist', 'index.js');
  }
  // In development, it's in the project directory
  return path.join(__dirname, '..', 'mcp-orchestrator', 'dist', 'index.js');
}

// Auto-setup MCP orchestrator on app start using claude mcp add command
async function setupMcpOrchestrator(): Promise<void> {
  try {
    const orchestratorPath = getMcpOrchestratorPath();

    // Check if orchestrator exists
    if (!fs.existsSync(orchestratorPath)) {
      console.log('MCP orchestrator not found at', orchestratorPath);
      return;
    }

    const { execSync } = require('child_process');
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
        } else if (existingConfig) {
          console.log('MCP orchestrator path changed, updating...');
          console.log('  Old path:', existingConfig.args?.[0]);
          console.log('  New path:', orchestratorPath);
        }
      } catch {
        // Config parsing failed, will update
      }
    }

    if (!needsUpdate) {
      return;
    }

    // Remove existing config first (in case path changed)
    try {
      execSync('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
      console.log('Removed old MCP orchestrator config');
    } catch {
      // Ignore errors if it doesn't exist
    }

    // Add the MCP server using claude mcp add with -s user for global scope
    // Format: claude mcp add -s user <name> <command> [args...]
    const addCommand = `claude mcp add -s user claude-mgr-orchestrator node "${orchestratorPath}"`;
    console.log('Running:', addCommand);

    try {
      execSync(addCommand, { encoding: 'utf-8', stdio: 'pipe' });
      console.log('MCP orchestrator configured globally via claude mcp add -s user');
    } catch (addErr) {
      console.error('Failed to add MCP server via claude mcp add -s user:', addErr);
      // Fallback: also write to mcp.json for compatibility
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      let mcpConfig: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
      if (fs.existsSync(mcpConfigPath)) {
        try {
          mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
          if (!mcpConfig.mcpServers) {
            mcpConfig.mcpServers = {};
          }
        } catch {
          mcpConfig = { mcpServers: {} };
        }
      }

      mcpConfig.mcpServers!['claude-mgr-orchestrator'] = {
        command: 'node',
        args: [orchestratorPath]
      };

      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
      console.log('MCP orchestrator configured via mcp.json fallback');
    }
  } catch (err) {
    console.error('Failed to auto-setup MCP orchestrator:', err);
  }
}

// Check if orchestrator is configured (uses claude mcp list command)
ipcMain.handle('orchestrator:getStatus', async () => {
  try {
    const orchestratorPath = getMcpOrchestratorPath();
    const orchestratorExists = fs.existsSync(orchestratorPath);

    const { execSync } = require('child_process');

    // Check using claude mcp list
    let isConfigured = false;
    try {
      const listOutput = execSync('claude mcp list 2>&1', { encoding: 'utf-8' });
      isConfigured = listOutput.includes('claude-mgr-orchestrator');
    } catch {
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
      } catch {
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
  } catch (err) {
    console.error('Failed to get orchestrator status:', err);
    return { configured: false, error: String(err) };
  }
});

// Setup orchestrator using claude mcp add command
ipcMain.handle('orchestrator:setup', async () => {
  try {
    const orchestratorPath = getMcpOrchestratorPath();

    // Check if orchestrator exists
    if (!fs.existsSync(orchestratorPath)) {
      return {
        success: false,
        error: `MCP orchestrator not found at ${orchestratorPath}. Try reinstalling the app.`
      };
    }

    const { execSync } = require('child_process');

    // First try to remove any existing config to avoid duplicates (from both user and project scope)
    try {
      execSync('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      // Ignore errors if it doesn't exist
    }
    try {
      execSync('claude mcp remove claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      // Ignore errors if it doesn't exist in project scope
    }

    // Add the MCP server using claude mcp add with -s user for global scope
    const addCommand = `claude mcp add -s user claude-mgr-orchestrator node "${orchestratorPath}"`;
    console.log('Running:', addCommand);

    try {
      execSync(addCommand, { encoding: 'utf-8', stdio: 'pipe' });
      console.log('MCP orchestrator configured globally via claude mcp add -s user');
      return { success: true, method: 'claude-mcp-add-global' };
    } catch (addErr) {
      console.error('Failed to add MCP server via claude mcp add -s user:', addErr);

      // Fallback: write to mcp.json
      const claudeDir = path.join(os.homedir(), '.claude');
      const mcpConfigPath = path.join(claudeDir, 'mcp.json');

      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      let mcpConfig: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
      if (fs.existsSync(mcpConfigPath)) {
        try {
          mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
          if (!mcpConfig.mcpServers) {
            mcpConfig.mcpServers = {};
          }
        } catch {
          mcpConfig = { mcpServers: {} };
        }
      }

      mcpConfig.mcpServers!['claude-mgr-orchestrator'] = {
        command: 'node',
        args: [orchestratorPath]
      };

      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
      console.log('MCP orchestrator configured via mcp.json fallback');
      return { success: true, path: mcpConfigPath, method: 'mcp-json-fallback' };
    }
  } catch (err) {
    console.error('Failed to setup orchestrator:', err);
    return { success: false, error: String(err) };
  }
});

// Remove orchestrator from Claude's global config
ipcMain.handle('orchestrator:remove', async () => {
  try {
    const { execSync } = require('child_process');

    // Remove from global user scope
    try {
      execSync('claude mcp remove -s user claude-mgr-orchestrator 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    } catch {
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
      } catch {
        // Ignore parse errors
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to remove orchestrator:', err);
    return { success: false, error: String(err) };
  }
});

// ============== File System IPC Handlers ==============

ipcMain.handle('fs:list-projects', async () => {
  try {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(claudeDir)) return [];

    // Smart path decoding function (same as in getClaudeProjects)
    const decodeClaudePath = (encoded: string): string => {
      const parts = encoded.split('-').filter(Boolean);

      const tryDecode = (index: number, currentPath: string): string | null => {
        if (index >= parts.length) {
          return fs.existsSync(currentPath) ? currentPath : null;
        }

        const withSlash = currentPath + '/' + parts[index];
        if (fs.existsSync(withSlash)) {
          const result = tryDecode(index + 1, withSlash);
          if (result) return result;
        }

        for (let end = index + 1; end <= parts.length; end++) {
          const combined = parts.slice(index, end).join('-');
          const withCombined = currentPath + '/' + combined;

          if (fs.existsSync(withCombined)) {
            if (end === parts.length) {
              return withCombined;
            }
            const result = tryDecode(end, withCombined);
            if (result) return result;
          }
        }

        return null;
      };

      const result = tryDecode(0, '');
      if (result) return result;

      return '/' + parts.join('/');
    };

    const projectDirs = fs.readdirSync(claudeDir);
    const projects: { path: string; name: string; lastModified: string }[] = [];

    for (const dir of projectDirs) {
      const decodedPath = decodeClaudePath(dir);

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

    return projects.sort((a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  } catch (err) {
    console.error('Error listing projects:', err);
    return [];
  }
});

// Open folder dialog
ipcMain.handle('dialog:open-folder', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  return result.filePaths[0] || null;
});

// Open in external terminal
ipcMain.handle('shell:open-terminal', async (_event, { cwd, command }: { cwd: string; command?: string }) => {
  const shell = process.env.SHELL || '/bin/zsh';
  const script = command
    ? `tell application "Terminal" to do script "cd '${cwd}' && ${command}"`
    : `tell application "Terminal" to do script "cd '${cwd}'"`;

  const ptyProcess = pty.spawn(shell, ['-c', `osascript -e '${script.replace(/'/g, "'\\''")}'`], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  return new Promise((resolve) => {
    ptyProcess.onExit(() => {
      resolve({ success: true });
    });
  });
});

// Execute arbitrary command (uses PTY)
ipcMain.handle('shell:exec', async (_event, { command, cwd }: { command: string; cwd?: string }) => {
  return new Promise((resolve) => {
    const shell = process.env.SHELL || '/bin/zsh';
    const ptyProcess = pty.spawn(shell, ['-l', '-c', command], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || os.homedir(),
      env: process.env as { [key: string]: string },
    });

    let output = '';

    ptyProcess.onData((data) => {
      output += data;
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (exitCode === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, error: output, code: exitCode });
      }
    });
  });
});

// ============== Quick Terminal PTY Handlers ==============

// Store for quick terminal PTYs (separate from agent PTYs)
const quickPtyProcesses: Map<string, pty.IPty> = new Map();

// Start a new quick terminal PTY
ipcMain.handle('shell:startPty', async (_event, { cwd, cols, rows }: { cwd?: string; cols?: number; rows?: number }) => {
  const id = uuidv4();
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: process.env as { [key: string]: string },
  });

  quickPtyProcesses.set(id, ptyProcess);

  // Forward PTY output to renderer
  ptyProcess.onData((data) => {
    mainWindow?.webContents.send('shell:ptyOutput', { ptyId: id, data });
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('shell:ptyExit', { ptyId: id, exitCode });
    quickPtyProcesses.delete(id);
  });

  return id;
});

// Write to quick terminal PTY
ipcMain.handle('shell:writePty', async (_event, { ptyId, data }: { ptyId: string; data: string }) => {
  const ptyProcess = quickPtyProcesses.get(ptyId);
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Resize quick terminal PTY
ipcMain.handle('shell:resizePty', async (_event, { ptyId, cols, rows }: { ptyId: string; cols: number; rows: number }) => {
  const ptyProcess = quickPtyProcesses.get(ptyId);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});

// Kill quick terminal PTY
ipcMain.handle('shell:killPty', async (_event, { ptyId }: { ptyId: string }) => {
  const ptyProcess = quickPtyProcesses.get(ptyId);
  if (ptyProcess) {
    ptyProcess.kill();
    quickPtyProcesses.delete(ptyId);
    return { success: true };
  }
  return { success: false, error: 'PTY not found' };
});
