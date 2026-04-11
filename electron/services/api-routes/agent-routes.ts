import * as path from 'path';
import * as fs from 'fs';
import * as pty from 'node-pty';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { agents, saveAgents, killStalePty, ensureProjectTrusted } from '../../core/agent-manager';
import { ptyProcesses, writeProgrammaticInput } from '../../core/pty-manager';
import { getProvider } from '../../providers';
import { buildFullPath } from '../../utils/path-builder';
import { AgentStatus, AgentCharacter } from '../../types';
import { RouteApp, RouteContext } from './types';

export function registerAgentRoutes(app_: RouteApp, ctx: RouteContext): void {
  // GET /api/agents/:id/wait — long-poll until agent status changes
  app_.get(/^\/api\/agents\/([^/]+)\/wait$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    const timeoutSec = parseInt(req.url.searchParams.get('timeout') || '300', 10);
    const currentStatus = agent.status;

    // Return immediately if already in terminal state
    if (currentStatus === 'completed' || currentStatus === 'error' || currentStatus === 'idle' || currentStatus === 'waiting') {
      sendJson({
        status: agent.status,
        lastCleanOutput: agent.lastCleanOutput,
        error: agent.error,
      });
      return;
    }

    // Long-poll: wait for status change event
    const agentId = req.params.id;
    let resolved = false;

    const respond = () => {
      if (resolved) return;
      resolved = true;
      const a = agents.get(agentId);
      sendJson({
        status: a?.status || 'idle',
        lastCleanOutput: a?.lastCleanOutput,
        error: a?.error,
      });
    };

    const onStatusChange = () => respond();
    ctx.agentStatusEmitter.on(`status:${agentId}`, onStatusChange);

    const timeout = setTimeout(() => {
      ctx.agentStatusEmitter.off(`status:${agentId}`, onStatusChange);
      if (!resolved) {
        resolved = true;
        const a = agents.get(agentId);
        sendJson({
          status: a?.status || 'running',
          lastCleanOutput: a?.lastCleanOutput,
          timeout: true,
        });
      }
    }, timeoutSec * 1000);

    // Clean up if client disconnects
    req.raw.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        ctx.agentStatusEmitter.off(`status:${agentId}`, onStatusChange);
      }
    });
  });

  // GET /api/agents
  app_.get('/api/agents', (req, sendJson) => {
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
  });

  // GET /api/agents/:id
  app_.get(/^\/api\/agents\/([^/]+)$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }
    sendJson({ agent });
  });

  // GET /api/agents/:id/output
  app_.get(/^\/api\/agents\/([^/]+)\/output$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }
    const lines = parseInt(req.url.searchParams.get('lines') || '100', 10);
    const output = agent.output.slice(-lines).join('');
    sendJson({ output, status: agent.status });
  });

  // POST /api/agents
  app_.post('/api/agents', (req, sendJson) => {
    const { projectPath, name, skills = [], character, permissionMode, secondaryProjectPath, orchestratorMode } = req.body as {
      projectPath: string;
      name?: string;
      skills?: string[];
      character?: AgentCharacter;
      permissionMode?: 'normal' | 'auto' | 'bypass';
      secondaryProjectPath?: string;
      orchestratorMode?: boolean;
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
      permissionMode: permissionMode || 'auto',
      orchestratorMode: orchestratorMode || false,
    };
    agents.set(id, agent);
    saveAgents();
    sendJson({ agent });
  });

  // POST /api/agents/:id/start
  app_.post(/^\/api\/agents\/([^/]+)\/start$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    const { prompt, model, permissionMode: bodyPermissionMode, printMode } = req.body as {
      prompt: string; model?: string; permissionMode?: 'normal' | 'auto' | 'bypass'; printMode?: boolean;
    };
    if (!prompt) {
      sendJson({ error: 'prompt is required' }, 400);
      return;
    }

    // Raw cwd for pty.spawn, shell-escaped form for the `cd` command. These
    // must be separate — passing the shell-escaped form to pty.spawn would
    // break when the path legitimately contains a single quote.
    const rawWorkingDir = agent.worktreePath || agent.projectPath;
    const workingDir = rawWorkingDir.replace(/'/g, "'\\''");

    // Resolve provider and binary — honours custom CLI paths in Settings and
    // the agent's provider (claude / openrouter / deepseek / mimo / etc.).
    const appSettings = ctx.getAppSettings();
    const cliProvider = getProvider(agent.provider);
    const binaryPath = cliProvider.resolveBinaryPath(appSettings);
    const escapedBinary = binaryPath.replace(/'/g, "'\\''");
    let command = `cd '${workingDir}' && '${escapedBinary}'`;

    const isAutomationAgent = agent.name?.toLowerCase().includes('automation:');
    const usePrintMode = printMode || isAutomationAgent;

    if (usePrintMode) {
      command += ' -p';
    }

    const isSuperAgentApi = agent.name?.toLowerCase().includes('super agent') ||
                            agent.name?.toLowerCase().includes('orchestrator');

    // Pass MCP config to all agents using a flag-strategy provider (all claude-based
    // providers, including OpenRouter/DeepSeek/etc.). Mirrors ipc-handlers behaviour.
    if (cliProvider.getMcpConfigStrategy() === 'flag') {
      const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        command += ` --mcp-config '${mcpConfigPath}'`;
      }
    }

    if (agent.secondaryProjectPath) {
      command += ` --add-dir '${agent.secondaryProjectPath.replace(/'/g, "'\\''")}'`;
    }
    const effectiveMode = bodyPermissionMode ?? agent.permissionMode ?? (agent.skipPermissions ? 'auto' : 'normal');
    if (effectiveMode === 'auto' || effectiveMode === 'bypass') {
      command += ' --dangerously-skip-permissions';
    }
    // BUG 5: orchestrator-mode agents cannot edit files directly — must delegate.
    if (isSuperAgentApi || agent.orchestratorMode) {
      command += ' --disallowed-tools "Edit" "Write" "MultiEdit" "NotebookEdit"';
    }
    const resolvedModel = model || agent.model;
    // 'default' is a Dorothy UI alias meaning "let Claude CLI pick"; omit the flag.
    if (resolvedModel && resolvedModel !== 'default') {
      // Allow the same characters as claude-provider.ts buildInteractiveCommand,
      // including brackets used by 1M-context variants (e.g. sonnet[1m]).
      if (!/^[a-zA-Z0-9._:\/\[\]-]+$/.test(resolvedModel)) {
        sendJson({ error: 'Invalid model name' }, 400);
        return;
      }
      command += ` --model '${resolvedModel}'`;
    }

    let finalPrompt = prompt;
    if (agent.skills && agent.skills.length > 0 && !isSuperAgentApi) {
      const skillsList = agent.skills.join(', ');
      finalPrompt = `[IMPORTANT: Use these skills for this session: ${skillsList}. Invoke them with /<skill-name> when relevant to the task.] ${prompt}`;
    }
    command += ` '${finalPrompt.replace(/'/g, "'\\''")}'`;

    const shell = '/bin/bash';
    const fullPath = buildFullPath();

    // Kill any existing PTY for this agent before spawning a new one.
    // Agents started via the API use one-shot PTYs that stay alive (the claude
    // process waits at a prompt after each task). Without this, every /start call
    // orphans the previous PTY+claude process, eventually exhausting resources.
    if (agent.ptyId) {
      const existingPty = ptyProcesses.get(agent.ptyId);
      if (existingPty) {
        existingPty.kill();
        ptyProcesses.delete(agent.ptyId);
      }
    }

    // BUG 6: pre-accept Claude Code's workspace trust dialog for this cwd.
    ensureProjectTrusted(rawWorkingDir);

    // Inject provider env vars: CLAUDE_* tracking vars + ANTHROPIC_BASE_URL /
    // ANTHROPIC_API_KEY for alt providers (OpenRouter, DeepSeek, MiMo, Moonshot,
    // Qwen, ZhipuAI). Claude provider just returns the CLAUDE_* vars.
    const providerEnvVars = cliProvider.getPtyEnvVars(agent.id, agent.projectPath, agent.skills || [], appSettings);
    const ptyProcess = pty.spawn(shell, ['-l', '-c', command], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: rawWorkingDir,
      env: {
        ...process.env,
        PATH: fullPath,
        TERM: 'xterm-256color',
        ...providerEnvVars,
      },
    });

    const ptyId = uuidv4();
    ptyProcesses.set(ptyId, ptyProcess);

    agent.ptyId = ptyId;
    agent.ptyCwd = rawWorkingDir;
    agent.status = 'running';
    agent.currentTask = prompt;
    agent.output = [];
    agent.lastCleanOutput = undefined;  // Clear stale output from previous task
    agent.error = undefined;            // Clear previous error state
    agent.lastActivity = new Date().toISOString();
    saveAgents();

    ptyProcess.onData((data: string) => {
      agent.output.push(data);
      if (agent.output.length > 10000) {
        agent.output = agent.output.slice(-5000);
      }
      agent.lastActivity = new Date().toISOString();

      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('agent:output', { agentId: agent.id, data });
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      // Delay status change to let hooks (on-stop.sh, task-completed.sh) finish
      // capturing output before wait_for_agent resolves.
      setTimeout(() => {
        if (agent.status === 'running') {
          agent.status = exitCode === 0 ? 'completed' : 'error';
        } else if (agent.status === 'waiting') {
          // PTY exited while agent was waiting for input — the claude process
          // crashed. Mark as error so /wait is unblocked and the orchestrator
          // can retry rather than hanging until timeout.
          agent.status = 'error';
        }
        if (exitCode !== 0) {
          agent.error = `Process exited with code ${exitCode}`;
        }
        agent.lastActivity = new Date().toISOString();
        ptyProcesses.delete(ptyId);
        saveAgents();
        ctx.agentStatusEmitter.emit(`status:${agent.id}`);
      }, 1500);
    });

    sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
  });

  // POST /api/agents/:id/stop
  app_.post(/^\/api\/agents\/([^/]+)\/stop$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
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
    ctx.agentStatusEmitter.emit(`status:${agent.id}`);
    sendJson({ success: true });
  });

  // POST /api/agents/:id/message
  app_.post(/^\/api\/agents\/([^/]+)\/message$/, async (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    const { message } = req.body as { message: string };
    if (!message) {
      sendJson({ error: 'message is required' }, 400);
      return;
    }

    // BUG 4 guard: if the agent's worktreePath changed after the PTY was
    // spawned, the existing PTY is stuck in the wrong cwd. Kill it so the
    // reconnect path below spawns fresh with the correct working directory.
    killStalePty(agent);

    if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
      // No live PTY — the claude process exited (e.g. crashed while 'waiting').
      // Auto-respawn: start a fresh one-shot claude session using the message
      // as the prompt, identical to the /start path.  This ensures send_message
      // and delegate_task reconnect transparently instead of timing out.
      const rawWorkingDir = agent.worktreePath || agent.projectPath;
      const workingDir = rawWorkingDir.replace(/'/g, "'\\''");
      const effectiveMode = agent.permissionMode ?? (agent.skipPermissions ? 'auto' : 'normal');

      // Resolve provider and binary for the reconnect session (mirrors /start path).
      const reconnectAppSettings = ctx.getAppSettings();
      const reconnectProvider = getProvider(agent.provider);
      const reconnectBinaryPath = reconnectProvider.resolveBinaryPath(reconnectAppSettings);
      const reconnectEscapedBinary = reconnectBinaryPath.replace(/'/g, "'\\''");
      let reconnectCmd = `cd '${workingDir}' && '${reconnectEscapedBinary}'`;
      if (effectiveMode === 'auto' || effectiveMode === 'bypass') {
        reconnectCmd += ' --dangerously-skip-permissions';
      }
      // BUG 5: orchestrator-mode agents cannot edit files directly — must delegate.
      const reconnectIsSuper = agent.name?.toLowerCase().includes('super agent') ||
                               agent.name?.toLowerCase().includes('orchestrator');
      if (reconnectIsSuper || agent.orchestratorMode) {
        reconnectCmd += ' --disallowed-tools "Edit" "Write" "MultiEdit" "NotebookEdit"';
      }
      // Pass MCP config to reconnected sessions (mirrors /start path).
      if (reconnectProvider.getMcpConfigStrategy() === 'flag') {
        const reconnectMcpPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
        if (fs.existsSync(reconnectMcpPath)) {
          reconnectCmd += ` --mcp-config '${reconnectMcpPath}'`;
        }
      }
      // Inject skills into reconnect prompt (mirrors /start path behaviour).
      let reconnectFinalMessage = message;
      if (agent.skills && agent.skills.length > 0 && !reconnectIsSuper) {
        const skillsList = agent.skills.join(', ');
        reconnectFinalMessage = `[IMPORTANT: Use these skills for this session: ${skillsList}. Invoke them with /<skill-name> when relevant to the task.] ${message}`;
      }
      reconnectCmd += ` '${reconnectFinalMessage.replace(/'/g, "'\\''")}'`;

      const reconnectShell = '/bin/bash';
      const reconnectPath = buildFullPath();
      // BUG 6: pre-accept Claude Code's workspace trust dialog for this cwd.
      ensureProjectTrusted(rawWorkingDir);
      // Inject provider env vars (ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY for alt providers).
      const reconnectProviderEnvVars = reconnectProvider.getPtyEnvVars(agent.id, agent.projectPath, agent.skills || [], reconnectAppSettings);
      const reconnectPty = pty.spawn(reconnectShell, ['-l', '-c', reconnectCmd], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: rawWorkingDir,
        env: {
          ...process.env as { [key: string]: string },
          PATH: reconnectPath,
          ...reconnectProviderEnvVars,
        },
      });

      const reconnectPtyId = uuidv4();
      ptyProcesses.set(reconnectPtyId, reconnectPty);
      agent.ptyId = reconnectPtyId;
      agent.ptyCwd = rawWorkingDir;
      agent.status = 'running';
      agent.currentTask = message.slice(0, 100);
      agent.lastActivity = new Date().toISOString();

      reconnectPty.onData((data: string) => {
        agent.output.push(data);
        if (agent.output.length > 10000) agent.output = agent.output.slice(-5000);
        agent.lastActivity = new Date().toISOString();
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
          ctx.mainWindow.webContents.send('agent:output', { agentId: agent.id, data });
        }
      });

      reconnectPty.onExit(({ exitCode }) => {
        setTimeout(() => {
          if (agent.status === 'running') {
            agent.status = exitCode === 0 ? 'completed' : 'error';
          } else if (agent.status === 'waiting') {
            agent.status = 'error';
          }
          if (exitCode !== 0) agent.error = `Process exited with code ${exitCode}`;
          agent.lastActivity = new Date().toISOString();
          ptyProcesses.delete(reconnectPtyId);
          saveAgents();
          ctx.agentStatusEmitter.emit(`status:${agent.id}`);
        }, 1500);
      });

      saveAgents();
      sendJson({ success: true });
      return;
    }

    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      writeProgrammaticInput(ptyProcess, message, true);
      agent.status = 'running';
      agent.lastActivity = new Date().toISOString();
      saveAgents();
      sendJson({ success: true });
      return;
    }
    sendJson({ error: 'Failed to send message - PTY not available' }, 500);
  });

  // DELETE /api/agents/:id
  app_.delete(/^\/api\/agents\/([^/]+)$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
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
    agents.delete(req.params.id);
    saveAgents();
    sendJson({ success: true });
  });
}
