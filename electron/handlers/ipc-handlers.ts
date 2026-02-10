import { ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as pty from 'node-pty';
import TelegramBot from 'node-telegram-bot-api';
import { App as SlackApp, LogLevel } from '@slack/bolt';

// Import types
import type { AgentStatus, WorktreeConfig, AgentCharacter, AppSettings } from '../types';

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
  detectAgentStatus: (agent: AgentStatus) => 'running' | 'waiting' | 'completed' | 'error' | 'idle';
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
  // Orchestrator handlers are registered separately in services/mcp-orchestrator.ts
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
    detectAgentStatus,
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
    const homeDir = process.env.HOME || os.homedir();
    const existingPath = process.env.PATH || '';
    const additionalPaths: string[] = [];

    // Add user-configured CLI paths from settings
    if (currentSettings.cliPaths) {
      if (currentSettings.cliPaths.claude) {
        additionalPaths.push(path.dirname(currentSettings.cliPaths.claude));
      }
      if (currentSettings.cliPaths.gh) {
        additionalPaths.push(path.dirname(currentSettings.cliPaths.gh));
      }
      if (currentSettings.cliPaths.node) {
        additionalPaths.push(path.dirname(currentSettings.cliPaths.node));
      }
      if (currentSettings.cliPaths.additionalPaths) {
        additionalPaths.push(...currentSettings.cliPaths.additionalPaths.filter(Boolean));
      }
    }

    // Add common fallback locations
    additionalPaths.push(
      path.join(homeDir, '.nvm/versions/node/v20.11.1/bin'),
      path.join(homeDir, '.nvm/versions/node/v22.0.0/bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
      path.join(homeDir, '.local/bin'),
    );
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

    // Build Claude Code command — use full path from settings if configured
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

    if (options?.model) {
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

    ptyProcess.write(fullCommand);
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
      await telegramBot.sendMessage(chatId, '✅ Test message from Claude Manager!');
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
        text: ':white_check_mark: Test message from Claude Manager!',
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
