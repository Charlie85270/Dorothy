import { ipcMain, dialog, shell } from 'electron';
import { checkForUpdates } from '../services/update-checker';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as pty from 'node-pty';
import TelegramBot from 'node-telegram-bot-api';
import { App as SlackApp, LogLevel } from '@slack/bolt';

// Import types
import type { AgentStatus, WorktreeConfig, AgentCharacter, AppSettings, AgentProvider } from '../types';
import { buildFullPath } from '../utils/path-builder';

// Dependencies interface for dependency injection
export interface IpcHandlerDependencies {
  // State
  ptyProcesses: Map<string, pty.IPty>;
  agents: Map<string, AgentStatus>;
  skillPtyProcesses: Map<string, pty.IPty>;
  quickPtyProcesses: Map<string, pty.IPty>;
  pluginPtyProcesses: Map<string, pty.IPty>;

  // Functions
  getMainWindow: () => Electron.BrowserWindow | null;
  getAppSettings: () => AppSettings;
  setAppSettings: (settings: AppSettings) => void;
  saveAppSettings: (settings: AppSettings) => void;
  saveAgents: () => void;
  initAgentPty: (agent: AgentStatus) => Promise<string>;
  handleStatusChangeNotification: (agent: AgentStatus, newStatus: string) => void;
  isSuperAgent: (agent: AgentStatus) => boolean;
  getMcpOrchestratorPath: () => string;
  initTelegramBot: () => void;
  initSlackBot: () => void;
  getTelegramBot: () => TelegramBot | null;
  getSlackApp: () => SlackApp | null;
  getSuperAgentTelegramTask: () => boolean;
  getSuperAgentOutputBuffer: () => string[];
  setSuperAgentOutputBuffer: (buffer: string[]) => void;

  // Claude data functions
  getClaudeSettings: () => Promise<any>;
  getClaudeStats: () => Promise<any>;
  getClaudeProjects: () => Promise<any[]>;
  getClaudePlugins: () => Promise<any[]>;
  getClaudeSkills: () => Promise<any[]>;
  getClaudeHistory: (limit?: number) => Promise<any[]>;
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(deps: IpcHandlerDependencies): void {
  registerPtyHandlers(deps);
  registerAgentHandlers(deps);
  registerSkillHandlers(deps);
  registerPluginHandlers(deps);
  registerClaudeDataHandlers(deps);
  registerSettingsHandlers(deps);
  registerAppSettingsHandlers(deps);
  registerUpdateHandlers();
  // Orchestrator handlers are registered separately in services/mcp-orchestrator.ts
  registerTasmaniaHandlers(deps);
  registerFileSystemHandlers(deps);
  registerShellHandlers(deps);
}

// ============== PTY Terminal IPC Handlers ==============

function registerPtyHandlers(deps: IpcHandlerDependencies): void {
  const { ptyProcesses, getMainWindow } = deps;

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
}

// ============== Agent Management IPC Handlers ==============

function registerAgentHandlers(deps: IpcHandlerDependencies): void {
  const {
    agents,
    ptyProcesses,
    getMainWindow,
    getAppSettings,
    saveAgents,
    initAgentPty,
    handleStatusChangeNotification,
    isSuperAgent,
    getSuperAgentTelegramTask,
    getSuperAgentOutputBuffer,
    setSuperAgentOutputBuffer
  } = deps;

  // Create a new agent (now creates a PTY-backed terminal)
  ipcMain.handle('agent:create', async (_event, config: {
    projectPath: string;
    skills: string[];
    worktree?: WorktreeConfig;
    character?: AgentCharacter;
    name?: string;
    secondaryProjectPath?: string;
    skipPermissions?: boolean;
    provider?: 'claude' | 'local';
    localModel?: string;
  }) => {
    const id = uuidv4();
    const shell = '/bin/bash';

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
          
          } catch {
            // Branch doesn't exist, create worktree with new branch
            execSync(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd, stdio: 'pipe' });
          
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

    // Build PATH that includes user-configured paths, nvm, and other common locations for claude
    const currentSettings = getAppSettings();
    const cliExtraPaths: string[] = [];
    if (currentSettings.cliPaths) {
      if (currentSettings.cliPaths.claude) {
        cliExtraPaths.push(path.dirname(currentSettings.cliPaths.claude));
      }
      if (currentSettings.cliPaths.gh) {
        cliExtraPaths.push(path.dirname(currentSettings.cliPaths.gh));
      }
      if (currentSettings.cliPaths.node) {
        cliExtraPaths.push(path.dirname(currentSettings.cliPaths.node));
      }
      if (currentSettings.cliPaths.additionalPaths) {
        cliExtraPaths.push(...currentSettings.cliPaths.additionalPaths.filter(Boolean));
      }
    }
    const fullPath = buildFullPath(cliExtraPaths);

    // Create PTY for this agent
    // Strip CLAUDECODE env var to prevent "nested session" errors when launching claude
    const cleanEnv = { ...process.env as { [key: string]: string } };
    delete cleanEnv['CLAUDECODE'];

    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn(shell, ['-l'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: {
          ...cleanEnv,
          PATH: fullPath,
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
      provider: config.provider || 'claude',
      localModel: config.localModel,
    };
    agents.set(id, status);

    // Save agents to disk
    saveAgents();

    // Forward PTY output to renderer
    // Guard: skip if this PTY was replaced (e.g. local provider recreates PTY in agent:start)
    ptyProcess.onData((data) => {
      const agent = agents.get(id);
      if (!agent || agent.ptyId !== ptyId) return;

      agent.output.push(data);
      agent.lastActivity = new Date().toISOString();

      // Capture Super Agent output for Telegram
      if (getSuperAgentTelegramTask() && isSuperAgent(agent)) {
        const buffer = getSuperAgentOutputBuffer();
        buffer.push(data);
        if (buffer.length > 200) {
          setSuperAgentOutputBuffer(buffer.slice(-100));
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
      const agent = agents.get(id);
      // Skip status update if this PTY was replaced by a newer one
      if (agent && agent.ptyId === ptyId) {
        console.log(`Agent ${id} PTY exited with code ${exitCode}`);
        const newStatus = exitCode === 0 ? 'completed' : 'error';
        agent.status = newStatus;
        agent.lastActivity = new Date().toISOString();
        handleStatusChangeNotification(agent, newStatus);
        getMainWindow()?.webContents.send('agent:complete', {
          type: 'complete',
          agentId: id,
          ptyId,
          exitCode,
          timestamp: new Date().toISOString(),
        });
      }
      ptyProcesses.delete(ptyId);
    });

    return { ...status, ptyId };
  });

  // Start an agent with a prompt (sends command to PTY)
  ipcMain.handle('agent:start', async (_event, { id, prompt, options }: {
    id: string;
    prompt: string;
    options?: { model?: string; resume?: boolean; provider?: AgentProvider; localModel?: string }
  }) => {
    const agent = agents.get(id);
    if (!agent) throw new Error('Agent not found');

    // Initialize PTY if agent was restored from disk and doesn't have one
    if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
      console.log(`Agent ${id} needs PTY initialization`);
      const ptyId = await initAgentPty(agent);
      agent.ptyId = ptyId;
    }

    // Determine provider — prefer agent-level, fallback to options, default to 'claude'
    const provider = agent.provider || options?.provider || 'claude';
    const localModel = agent.localModel || options?.localModel;

    // ── For local provider, recreate PTY with Tasmania env vars baked in ──
    if (provider === 'local') {
      const { getTasmaniaStatus } = require('../services/tasmania-client') as typeof import('../services/tasmania-client');

      const tasmaniaStatus = await getTasmaniaStatus();
      if (tasmaniaStatus.status !== 'running' || !tasmaniaStatus.endpoint) {
        throw new Error('Tasmania is not running or no model is loaded. Start a model in Tasmania settings first.');
      }

      // Strip /v1 suffix from endpoint. Tasmania's TerminalPanel uses
      // `http://127.0.0.1:${port}` (no /v1), because Claude Code's SDK
      // appends /v1/messages itself. Including /v1 causes double-pathing
      // (http://…/v1/v1/messages) which breaks all API calls.
      const endpoint = tasmaniaStatus.endpoint!.replace(/\/v1\/?$/, '');
      const model = localModel || tasmaniaStatus.modelName || 'default';

      // Kill the existing PTY and recreate with env vars in the process environment.
      // Writing `export ...` to an already-running shell is racy — the shell may not
      // process the export before the claude command runs. Baking vars into pty.spawn()
      // guarantees they're in the process environment from the start.
      const oldPty = ptyProcesses.get(agent.ptyId!);
      if (oldPty) {
        oldPty.kill();
        ptyProcesses.delete(agent.ptyId!);
      }

      const currentSettings = getAppSettings();
      const extraPaths: string[] = [];
      if (currentSettings.cliPaths) {
        if (currentSettings.cliPaths.claude) extraPaths.push(path.dirname(currentSettings.cliPaths.claude));
        if (currentSettings.cliPaths.gh) extraPaths.push(path.dirname(currentSettings.cliPaths.gh));
        if (currentSettings.cliPaths.node) extraPaths.push(path.dirname(currentSettings.cliPaths.node));
        if (currentSettings.cliPaths.additionalPaths) extraPaths.push(...currentSettings.cliPaths.additionalPaths.filter(Boolean));
      }
      const fullPathForLocal = buildFullPath(extraPaths);

      const cleanEnvLocal = { ...process.env as { [key: string]: string } };
      delete cleanEnvLocal['CLAUDECODE'];

      const workingDir = agent.worktreePath || agent.projectPath;
      const cwd = fs.existsSync(workingDir) ? workingDir : os.homedir();

      const newPty = pty.spawn('/bin/bash', ['-l'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: {
          ...cleanEnvLocal,
          PATH: fullPathForLocal,
          CLAUDE_SKILLS: agent.skills.join(','),
          CLAUDE_AGENT_ID: agent.id,
          CLAUDE_PROJECT_PATH: agent.projectPath,
          // Match Tasmania's env var pattern exactly:
          // - ANTHROPIC_BASE_URL without /v1 (SDK appends /v1/messages)
          // - ANTHROPIC_MODEL with the raw local model name
          ANTHROPIC_BASE_URL: endpoint,
          ANTHROPIC_MODEL: model,
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        },
      });

      const newPtyId = uuidv4();
      ptyProcesses.set(newPtyId, newPty);
      agent.ptyId = newPtyId;

      // Re-attach event handlers
      newPty.onData((data) => {
        const agentData = agents.get(id);
        if (agentData) {
          agentData.output.push(data);
          agentData.lastActivity = new Date().toISOString();
          if (getSuperAgentTelegramTask() && isSuperAgent(agentData)) {
            const buffer = getSuperAgentOutputBuffer();
            buffer.push(data);
            if (buffer.length > 200) {
              setSuperAgentOutputBuffer(buffer.slice(-100));
            }
          }
        }
        getMainWindow()?.webContents.send('agent:output', {
          type: 'output',
          agentId: id,
          ptyId: newPtyId,
          data,
          timestamp: new Date().toISOString(),
        });
      });

      newPty.onExit(({ exitCode }) => {
        console.log(`Agent ${id} PTY exited with code ${exitCode}`);
        const agentData = agents.get(id);
        if (agentData) {
          const newStatus = exitCode === 0 ? 'completed' : 'error';
          agentData.status = newStatus;
          agentData.lastActivity = new Date().toISOString();
          handleStatusChangeNotification(agentData, newStatus);
        }
        ptyProcesses.delete(newPtyId);
        getMainWindow()?.webContents.send('agent:complete', {
          type: 'complete',
          agentId: id,
          ptyId: newPtyId,
          exitCode,
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Get the (potentially recreated) PTY process
    const ptyProcess = ptyProcesses.get(agent.ptyId!);
    if (!ptyProcess) throw new Error('PTY not found');

    // ── Claude Code CLI ──────────────────────────────────────────────
    const appSettingsForCommand = getAppSettings();
    let command = (appSettingsForCommand.cliPaths?.claude) || 'claude';

    // Check if this is the Super Agent (orchestrator)
    const isSuperAgentCheck = agent.name?.toLowerCase().includes('super agent') ||
                      agent.name?.toLowerCase().includes('orchestrator');

    // Add explicit MCP config for Super Agent to ensure orchestrator tools are loaded
    if (isSuperAgentCheck) {
      const { app } = await import('electron');
      const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        command += ` --mcp-config ${mcpConfigPath}`;
      }
      // Add super agent instructions (read via Node.js, not cat - asar compatibility)
      const { getSuperAgentInstructionsPath } = await import('../utils');
      const superAgentInstructionsPath = getSuperAgentInstructionsPath();
      if (fs.existsSync(superAgentInstructionsPath)) {

        command += ` --append-system-prompt-file ${superAgentInstructionsPath}`;
      }
    }

    if (options?.model && provider !== 'local') {
      command += ` --model ${options.model}`;
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
    command += finalPrompt ? ` '${escapedPrompt}'` : '';

    // Update status
    agent.status = 'running';
    agent.currentTask = prompt.slice(0, 100);
    agent.lastActivity = new Date().toISOString();

    // First cd to the appropriate directory (worktree if exists, otherwise project), then run claude
    const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");
    const fullCommand = `cd '${workingPath}' && ${command}`;

    // For local provider, the PTY was just recreated — wait for shell to initialize
    // before writing the command (matches Tasmania's 1s delay pattern).
    // For claude provider, the PTY has been alive since agent:create, so no delay needed.
    if (provider === 'local') {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          ptyProcess.write(fullCommand);
          ptyProcess.write('\r');
          resolve();
        }, 1000);
      });
    } else {
      ptyProcess.write(fullCommand);
      ptyProcess.write('\r');
    }

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
        ptyProcess.kill();
        ptyProcesses.delete(agent.ptyId);
      }
      agent.ptyId = undefined;
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.lastActivity = new Date().toISOString();
      // Mark as manually stopped to prevent status detection from overriding
      (agent as AgentStatus & { _manuallyStoppedAt?: number })._manuallyStoppedAt = Date.now();
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
}

// ============== Skills IPC Handlers ==============

function registerSkillHandlers(deps: IpcHandlerDependencies): void {
  const { skillPtyProcesses, getMainWindow } = deps;

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
}

// ============== Plugin IPC Handlers ==============

function registerPluginHandlers(deps: IpcHandlerDependencies): void {
  const { pluginPtyProcesses, getMainWindow } = deps;

  // Start plugin installation (creates interactive PTY)
  ipcMain.handle('plugin:install-start', async (_event, { command, cols, rows }: { command: string; cols?: number; rows?: number }) => {
    const id = uuidv4();
    const shell = process.env.SHELL || '/bin/zsh';

    const ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: os.homedir(),
      env: process.env as { [key: string]: string },
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
  ipcMain.handle('plugin:install-write', async (_event, { id, data }: { id: string; data: string }) => {
    const ptyProcess = pluginPtyProcesses.get(id);
    if (ptyProcess) {
      ptyProcess.write(data);
      return { success: true };
    }
    return { success: false, error: 'PTY not found' };
  });

  // Resize plugin installation PTY
  ipcMain.handle('plugin:install-resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    const ptyProcess = pluginPtyProcesses.get(id);
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
      return { success: true };
    }
    return { success: false, error: 'PTY not found' };
  });

  // Kill plugin installation PTY
  ipcMain.handle('plugin:install-kill', async (_event, { id }: { id: string }) => {
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

function registerClaudeDataHandlers(deps: IpcHandlerDependencies): void {
  const {
    getClaudeSettings,
    getClaudeStats,
    getClaudeProjects,
    getClaudePlugins,
    getClaudeSkills,
    getClaudeHistory
  } = deps;

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
}

// ============== Settings IPC Handlers ==============

function registerSettingsHandlers(_deps: IpcHandlerDependencies): void {
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
}

// ============== App Settings IPC Handlers (Notifications) ==============

function registerAppSettingsHandlers(deps: IpcHandlerDependencies): void {
  const {
    getMainWindow,
    getAppSettings,
    setAppSettings,
    saveAppSettings,
    initTelegramBot,
    initSlackBot,
    getTelegramBot,
    getSlackApp
  } = deps;

  // Get app settings (notifications, etc.)
  ipcMain.handle('app:getSettings', async () => {
    return getAppSettings();
  });

  // Save app settings
  ipcMain.handle('app:saveSettings', async (_event, newSettings: Partial<AppSettings>) => {
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
    } catch (err) {
      console.error('Failed to save app settings:', err);
      return { success: false, error: String(err) };
    }
  });

  // Test Telegram connection
  ipcMain.handle('telegram:test', async () => {
    const appSettings = getAppSettings();
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
    const appSettings = getAppSettings();
    const telegramBot = getTelegramBot();

    // Use the first authorized chat ID, or fall back to legacy chatId
    const chatId = appSettings.telegramAuthorizedChatIds?.[0] || appSettings.telegramChatId;

    if (!telegramBot || !chatId) {
      return { success: false, error: 'Bot not connected or no authorized users. Authenticate with /auth <token> first.' };
    }

    try {
      await telegramBot.sendMessage(chatId, '✅ Test message from Dorothy!');
      return { success: true };
    } catch (err) {
      console.error('Telegram send test failed:', err);
      return { success: false, error: String(err) };
    }
  });

  // Generate or regenerate Telegram auth token
  ipcMain.handle('telegram:generateAuthToken', async () => {
    const appSettings = getAppSettings();
    const crypto = require('crypto');
    const newToken = crypto.randomBytes(16).toString('hex');

    appSettings.telegramAuthToken = newToken;
    saveAppSettings(appSettings);
    setAppSettings(appSettings);

    return { success: true, token: newToken };
  });

  // Remove an authorized Telegram chat ID
  ipcMain.handle('telegram:removeAuthorizedChatId', async (_event, chatId: string) => {
    const appSettings = getAppSettings();

    if (!appSettings.telegramAuthorizedChatIds) {
      return { success: false, error: 'No authorized chat IDs' };
    }

    appSettings.telegramAuthorizedChatIds = appSettings.telegramAuthorizedChatIds.filter(
      (id: string) => id !== chatId
    );

    // If removing the legacy chatId, clear it too
    if (appSettings.telegramChatId === chatId) {
      appSettings.telegramChatId = appSettings.telegramAuthorizedChatIds[0] || '';
    }

    saveAppSettings(appSettings);
    setAppSettings(appSettings);

    // Notify frontend of settings change
    const mainWindow = getMainWindow();
    mainWindow?.webContents.send('settings:updated', appSettings);

    return { success: true };
  });

  // Test X API credentials (OAuth 1.0a)
  ipcMain.handle('xapi:test', async () => {
    const appSettings = getAppSettings();
    if (!appSettings.xApiKey || !appSettings.xApiSecret || !appSettings.xAccessToken || !appSettings.xAccessTokenSecret) {
      return { success: false, error: 'All 4 X API credentials are required' };
    }

    try {
      const crypto = require('crypto');
      const https = require('https');

      // OAuth 1.0a signing for GET /2/users/me
      const method = 'GET';
      const url = 'https://api.x.com/2/users/me';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(16).toString('hex');

      const percentEncode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c: string) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

      const oauthParams: Record<string, string> = {
        oauth_consumer_key: appSettings.xApiKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: appSettings.xAccessToken,
        oauth_version: '1.0',
      };

      const paramString = Object.keys(oauthParams).sort()
        .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`).join('&');
      const sigBase = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
      const sigKey = `${percentEncode(appSettings.xApiSecret)}&${percentEncode(appSettings.xAccessTokenSecret)}`;
      const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64');
      oauthParams['oauth_signature'] = signature;

      const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
        .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`).join(', ');

      const result = await new Promise<{ success: boolean; username?: string; error?: string }>((resolve) => {
        const req = https.request({
          hostname: 'api.x.com',
          port: 443,
          path: '/2/users/me',
          method: 'GET',
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
        }, (res: import('http').IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsed = JSON.parse(data);
                resolve({ success: true, username: parsed.data?.username });
              } catch {
                resolve({ success: false, error: 'Invalid response' });
              }
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}: ${data.slice(0, 200)}` });
            }
          });
        });
        req.on('error', (err: Error) => resolve({ success: false, error: err.message }));
        req.end();
      });
      return result;
    } catch (err) {
      console.error('X API test failed:', err);
      return { success: false, error: String(err) };
    }
  });

  // Test SocialData API key
  ipcMain.handle('socialdata:test', async () => {
    const appSettings = getAppSettings();
    if (!appSettings.socialDataApiKey) {
      return { success: false, error: 'No API key configured' };
    }

    try {
      const https = require('https');
      const result = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        const req = https.request({
          hostname: 'api.socialdata.tools',
          port: 443,
          path: '/twitter/user/elonmusk',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${appSettings.socialDataApiKey}`,
            'Accept': 'application/json',
          },
        }, (res: import('http').IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsed = JSON.parse(data);
                resolve({ success: true, error: undefined });
              } catch {
                resolve({ success: false, error: 'Invalid response from API' });
              }
            } else if (res.statusCode === 402) {
              resolve({ success: false, error: 'Insufficient credits on your SocialData account' });
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}: ${data.slice(0, 200)}` });
            }
          });
        });
        req.on('error', (err: Error) => resolve({ success: false, error: err.message }));
        req.end();
      });
      return result;
    } catch (err) {
      console.error('SocialData test failed:', err);
      return { success: false, error: String(err) };
    }
  });

  // Test Slack connection
  ipcMain.handle('slack:test', async () => {
    const appSettings = getAppSettings();
    if (!appSettings.slackBotToken || !appSettings.slackAppToken) {
      return { success: false, error: 'Bot token and App token are required' };
    }

    try {
      // Create a temporary Slack app to test the tokens
      const testApp = new SlackApp({
        token: appSettings.slackBotToken,
        appToken: appSettings.slackAppToken,
        socketMode: true,
        logLevel: LogLevel.ERROR,
      });

      // Test auth
      const authResult = await testApp.client.auth.test();
      await testApp.stop();

      return { success: true, botName: authResult.user };
    } catch (err) {
      console.error('Slack test failed:', err);
      return { success: false, error: String(err) };
    }
  });

  // Send test message to Slack
  ipcMain.handle('slack:sendTest', async () => {
    const appSettings = getAppSettings();
    const slackApp = getSlackApp();

    if (!slackApp || !appSettings.slackChannelId) {
      return { success: false, error: 'Bot not connected or no channel ID. Mention the bot or DM it first.' };
    }

    try {
      await slackApp.client.chat.postMessage({
        channel: appSettings.slackChannelId,
        text: ':white_check_mark: Test message from Dorothy!',
        mrkdwn: true,
      });
      return { success: true };
    } catch (err) {
      console.error('Slack send test failed:', err);
      return { success: false, error: String(err) };
    }
  });

  // ============== JIRA IPC Handlers ==============

  ipcMain.handle('jira:test', async () => {
    const appSettings = getAppSettings();
    if (!appSettings.jiraDomain || !appSettings.jiraEmail || !appSettings.jiraApiToken) {
      return { success: false, error: 'JIRA domain, email, and API token are all required' };
    }

    try {
      const auth = Buffer.from(`${appSettings.jiraEmail}:${appSettings.jiraApiToken}`).toString('base64');
      const res = await fetch(`https://${appSettings.jiraDomain}.atlassian.net/rest/api/3/myself`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, displayName: data.displayName, email: data.emailAddress };
      } else {
        const text = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
    } catch (err) {
      console.error('JIRA test failed:', err);
      return { success: false, error: String(err) };
    }
  });
}

// ============== Update Checker IPC Handlers ==============

function registerUpdateHandlers(): void {
  ipcMain.handle('app:checkForUpdates', async () => {
    return checkForUpdates();
  });

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    shell.openExternal(url);
    return { success: true };
  });
}

// ============== File System IPC Handlers ==============

function registerFileSystemHandlers(deps: IpcHandlerDependencies): void {
  const { getMainWindow } = deps;

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

        // Fallback to simple decode if nothing found
        let decoded = '/' + parts.join('/');
        return decoded;
      };

      const dirs = fs.readdirSync(claudeDir);
      const projects: Array<{ id: string; path: string; name: string }> = [];

      for (const dir of dirs) {
        const fullPath = path.join(claudeDir, dir);
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) continue;

        const decodedPath = decodeClaudePath(dir);
        projects.push({
          id: dir,
          path: decodedPath,
          name: path.basename(decodedPath),
        });
      }

      return projects;
    } catch (err) {
      console.error('Failed to list projects:', err);
      return [];
    }
  });

  // Open folder dialog
  ipcMain.handle('dialog:open-folder', async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ['openDirectory'],
    });
    return result.filePaths[0] || null;
  });

  // Open files dialog (for attachments)
  ipcMain.handle('dialog:open-files', async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
      ],
    });
    return result.filePaths || [];
  });
}

// ============== Tasmania IPC Handlers ==============

function registerTasmaniaHandlers(deps: IpcHandlerDependencies): void {
  const { getAppSettings } = deps;

  // Import shared Tasmania client
  const { tasmaniaFetch } = require('../services/tasmania-client') as typeof import('../services/tasmania-client');

  // Test: check MCP server exists + Control API reachable
  ipcMain.handle('tasmania:test', async () => {
    const appSettings = getAppSettings();
    const serverPath = appSettings.tasmaniaServerPath;
    const serverExists = serverPath ? fs.existsSync(serverPath) : false;

    let apiReachable = false;
    try {
      const res = await tasmaniaFetch('/api/status');
      apiReachable = res.ok;
    } catch {
      // API not reachable
    }

    return {
      success: serverExists && apiReachable,
      serverExists,
      apiReachable,
    };
  });

  // Get live server status from Control API
  ipcMain.handle('tasmania:getStatus', async () => {
    try {
      const res = await tasmaniaFetch('/api/status');
      if (!res.ok) {
        return { status: 'stopped' as const, backend: null, port: null, modelName: null, modelPath: null, endpoint: null, startedAt: null, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return {
        status: data.status || 'stopped',
        backend: data.backend || null,
        port: data.port || null,
        modelName: data.modelName || null,
        modelPath: data.modelPath || null,
        endpoint: data.endpoint || null,
        startedAt: data.startedAt || null,
      };
    } catch {
      return { status: 'stopped' as const, backend: null, port: null, modelName: null, modelPath: null, endpoint: null, startedAt: null };
    }
  });

  // List available local models from Control API
  ipcMain.handle('tasmania:getModels', async () => {
    try {
      const res = await tasmaniaFetch('/api/models');
      if (!res.ok) {
        return { models: [], error: `HTTP ${res.status}` };
      }
      const models = await res.json();
      return { models: Array.isArray(models) ? models : [] };
    } catch (err) {
      return { models: [], error: String(err) };
    }
  });

  // Start a model via Control API
  ipcMain.handle('tasmania:loadModel', async (_event, modelPath: string) => {
    try {
      const res = await tasmaniaFetch('/api/start', {
        method: 'POST',
        body: JSON.stringify({ modelPath }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Stop running model via Control API
  ipcMain.handle('tasmania:stopModel', async () => {
    try {
      const res = await tasmaniaFetch('/api/stop', { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Check if Tasmania MCP is registered in Claude Code
  ipcMain.handle('tasmania:getMcpStatus', async () => {
    try {
      const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
      let configured = false;

      if (fs.existsSync(mcpConfigPath)) {
        try {
          const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
          configured = mcpConfig?.mcpServers?.['tasmania'] !== undefined;
        } catch {
          // Ignore parse errors
        }
      }

      // Also check via claude mcp list if not found in mcp.json
      if (!configured) {
        try {
          const { execSync: execSyncImport } = await import('child_process');
          const stdout = execSyncImport('claude mcp list 2>/dev/null', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
          configured = stdout.includes('tasmania');
        } catch {
          // claude CLI not available
        }
      }

      return { configured };
    } catch (err) {
      return { configured: false, error: String(err) };
    }
  });

  // Register Tasmania MCP with Claude Code
  ipcMain.handle('tasmania:setup', async () => {
    try {
      const appSettings = getAppSettings();
      const serverPath = appSettings.tasmaniaServerPath;

      if (!serverPath) {
        return { success: false, error: 'MCP server path not configured. Set the path above first.' };
      }

      if (!fs.existsSync(serverPath)) {
        return { success: false, error: `MCP server not found at ${serverPath}` };
      }

      // Determine command based on file extension (.ts needs tsx, .js uses node)
      const command = serverPath.endsWith('.ts') ? 'npx' : 'node';
      const args = serverPath.endsWith('.ts') ? ['tsx', serverPath] : [serverPath];

      // Remove existing first
      try {
        const { execSync: execSyncImport } = await import('child_process');
        execSyncImport('claude mcp remove -s user tasmania 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
      } catch {
        // Ignore if doesn't exist
      }

      // Add via claude mcp add
      try {
        const { execSync: execSyncImport } = await import('child_process');
        const argsStr = args.map(a => `"${a}"`).join(' ');
        execSyncImport(`claude mcp add -s user tasmania ${command} ${argsStr}`, { encoding: 'utf-8', stdio: 'pipe' });
        return { success: true };
      } catch {
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
            if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
          } catch {
            mcpConfig = { mcpServers: {} };
          }
        }

        mcpConfig.mcpServers!['tasmania'] = { command, args };

        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Remove Tasmania MCP from Claude Code
  ipcMain.handle('tasmania:remove', async () => {
    try {
      // Remove from claude mcp
      try {
        const { execSync: execSyncImport } = await import('child_process');
        execSyncImport('claude mcp remove -s user tasmania 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
      } catch {
        // Ignore
      }

      // Also clean up mcp.json
      const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        try {
          const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
          if (mcpConfig?.mcpServers?.['tasmania']) {
            delete mcpConfig.mcpServers['tasmania'];
            fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
          }
        } catch {
          // Ignore parse errors
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}

// ============== Shell IPC Handlers ==============

function registerShellHandlers(deps: IpcHandlerDependencies): void {
  const { quickPtyProcesses, getMainWindow } = deps;

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
}
