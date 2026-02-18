/**
 * Dorothy - Main Electron Entry Point
 *
 * This file initializes and wires together all the modular components:
 * - Window management and protocol handling
 * - Agent state and PTY management
 * - IPC handlers for renderer communication
 * - External services (Telegram, Slack, HTTP API)
 * - MCP orchestrator integration
 * - Scheduler for automated tasks
 */

import { app, BrowserWindow, Notification, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Types
import type { AppSettings, AgentStatus } from './types';

// Constants
import { DATA_DIR, APP_SETTINGS_FILE } from './constants';

// Core modules
import {
  createWindow,
  registerProtocolSchemes,
  setupProtocolHandler,
  getMainWindow,
  setMainWindow,
} from './core/window-manager';

import {
  agents,
  loadAgents,
  saveAgents,
  initAgentPty,
  handleStatusChangeNotification,
  setSuperAgentTelegramTask,
  getSuperAgentOutputBuffer,
  clearSuperAgentOutputBuffer,
} from './core/agent-manager';

import {
  ptyProcesses,
  quickPtyProcesses,
  skillPtyProcesses,
  pluginPtyProcesses,
  createQuickPty,
  killAllPty,
} from './core/pty-manager';

// Services
import { startApiServer } from './services/api-server';
import {
  initTelegramBotService,
  initTelegramBot as initTelegramBotHandlers,
  getTelegramBot,
  sendTelegramMessage,
  sendSuperAgentResponseToTelegram,
} from './services/telegram-bot';
import {
  initSlackBot,
  getSlackApp,
  getSlackResponseChannel,
  getSlackResponseThreadTs,
} from './services/slack-bot';
import {
  getClaudeSettings,
  getClaudeStats,
  getClaudeProjects,
  getClaudePlugins,
  getClaudeSkills,
  getClaudeHistory,
} from './services/claude-service';
import { configureStatusHooks } from './services/hooks-manager';
import {
  setupMcpOrchestrator,
  registerMcpOrchestratorHandlers,
  getMcpOrchestratorPath,
} from './services/mcp-orchestrator';

// Handlers
import { registerIpcHandlers, IpcHandlerDependencies } from './handlers/ipc-handlers';
import { registerSchedulerHandlers } from './handlers/scheduler-handlers';
import { registerAutomationHandlers } from './handlers/automation-handlers';
import { registerCLIPathsHandlers, getCLIPathsConfig } from './handlers/cli-paths-handlers';
import { registerKanbanHandlers, KanbanHandlerDependencies } from './handlers/kanban-handlers';
import { registerVaultHandlers } from './handlers/vault-handlers';
import { registerWorldHandlers } from './handlers/world-handlers';
import { initVaultDb, closeVaultDb } from './services/vault-db';
import { checkForUpdates } from './services/update-checker';
import { initKanbanAutomation, findMatchingAgent, createAgentForTask, startAgentForTask } from './services/kanban-automation';

// Utils
import {
  setMainWindow as setUtilsMainWindow,
  sendNotification,
  isSuperAgent,
  getSuperAgent,
  ensureDataDir,
  migrateFromClaudeManager,
} from './utils';

// ============== App Settings Management ==============

let appSettings: AppSettings = loadAppSettings();

function loadAppSettings(): AppSettings {
  const defaults: AppSettings = {
    notificationsEnabled: true,
    notifyOnWaiting: true,
    notifyOnComplete: true,
    notifyOnError: true,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    telegramAuthToken: '',
    telegramAuthorizedChatIds: [],
    telegramRequireMention: false,
    slackEnabled: false,
    slackBotToken: '',
    slackAppToken: '',
    slackSigningSecret: '',
    slackChannelId: '',
    jiraEnabled: false,
    jiraDomain: '',
    jiraEmail: '',
    jiraApiToken: '',
    socialDataEnabled: false,
    socialDataApiKey: '',
    xPostingEnabled: false,
    xApiKey: '',
    xApiSecret: '',
    xAccessToken: '',
    xAccessTokenSecret: '',
    tasmaniaEnabled: false,
    tasmaniaServerPath: '',
    verboseModeEnabled: false,
    autoCheckUpdates: true,
    cliPaths: {
      claude: '',
      gh: '',
      node: '',
      additionalPaths: [],
    },
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

function saveAppSettingsToFile(settings: AppSettings) {
  try {
    ensureDataDir();
    fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save app settings:', err);
  }
}

// ============== Telegram Bot Initialization ==============

function initTelegramBot() {
  // First inject dependencies into the Telegram bot service
  initTelegramBotService(
    agents,
    ptyProcesses,
    appSettings,
    getMainWindow(),
    () => getSuperAgent(agents),
    saveAgents,
    getClaudeStats,
    (agent: AgentStatus) => initAgentPty(
      agent,
      getMainWindow(),
      handleStatusChangeNotificationWrapper,
      saveAgents
    ),
    saveAppSettingsToFile
  );

  // Then initialize the bot with handlers
  initTelegramBotHandlers();
}

// ============== Notification Handler Wrapper ==============

function handleStatusChangeNotificationWrapper(agent: AgentStatus, newStatus: string) {
  handleStatusChangeNotification(
    agent,
    newStatus,
    appSettings,
    sendNotification,
    (text: string) => sendTelegramMessage(text),
    sendSuperAgentResponseToTelegram
  );
}

// ============== IPC Handler Dependencies ==============

function createIpcDependencies(): IpcHandlerDependencies {
  return {
    // State
    ptyProcesses,
    agents,
    skillPtyProcesses,
    quickPtyProcesses,
    pluginPtyProcesses,

    // Functions
    getMainWindow,
    getAppSettings: () => appSettings,
    setAppSettings: (settings: AppSettings) => { appSettings = settings; },
    saveAppSettings: saveAppSettingsToFile,
    saveAgents,
    initAgentPty: (agent: AgentStatus) => initAgentPty(
      agent,
      getMainWindow(),
      handleStatusChangeNotificationWrapper,
      saveAgents
    ),
    handleStatusChangeNotification: handleStatusChangeNotificationWrapper,
    isSuperAgent,
    getMcpOrchestratorPath,
    initTelegramBot,
    initSlackBot: () => initSlackBot(appSettings, (settings) => {
      appSettings = settings;
      saveAppSettingsToFile(settings);
    }, getMainWindow()),
    getTelegramBot,
    getSlackApp,
    getSuperAgentTelegramTask: () => {
      // Import from agent-manager state
      const { superAgentTelegramTask } = require('./core/agent-manager');
      return superAgentTelegramTask;
    },
    getSuperAgentOutputBuffer,
    setSuperAgentOutputBuffer: (buffer: string[]) => {
      // This is handled internally by agent-manager
      clearSuperAgentOutputBuffer();
      buffer.forEach(item => getSuperAgentOutputBuffer().push(item));
    },

    // Claude data functions
    getClaudeSettings,
    getClaudeStats,
    getClaudeProjects,
    getClaudePlugins,
    getClaudeSkills,
    getClaudeHistory,
  };
}

// ============== API Server Initialization ==============

function initApiServer() {
  startApiServer(
    getMainWindow(),
    appSettings,
    getTelegramBot,
    getSlackApp,
    getSlackResponseChannel(),
    getSlackResponseThreadTs(),
    handleStatusChangeNotificationWrapper,
    sendNotification,
    (agent: AgentStatus) => initAgentPty(
      agent,
      getMainWindow(),
      handleStatusChangeNotificationWrapper,
      saveAgents
    )
  );
}

// ============== App Initialization ==============

// Register protocol schemes before app is ready
registerProtocolSchemes();

app.whenReady().then(async () => {
  console.log('App ready, initializing...');

  // Ensure data directory exists
  ensureDataDir();

  // Migrate data from ~/.claude-manager if it exists (rebrand migration)
  migrateFromClaudeManager();

  // Load agents from disk
  loadAgents();

  // Setup protocol handler for production
  setupProtocolHandler();

  // Create the main window
  createWindow();

  // Set the main window reference in utils
  setUtilsMainWindow(getMainWindow());

  // Register all IPC handlers
  const deps = createIpcDependencies();
  registerIpcHandlers(deps);
  registerSchedulerHandlers();
  registerAutomationHandlers();
  registerMcpOrchestratorHandlers();
  registerCLIPathsHandlers({
    getAppSettings: () => appSettings,
    setAppSettings: (settings) => { appSettings = settings; },
    saveAppSettings: saveAppSettingsToFile,
  });

  // Initialize vault database
  initVaultDb();

  // Register vault handlers
  registerVaultHandlers({ getMainWindow });

  // Register world (generative zone) handlers
  registerWorldHandlers({ getMainWindow });

  // Initialize kanban automation service
  initKanbanAutomation({
    agents,
    createAgent: async (config) => {
      // Create agent directly - similar to agent:create handler
      const { v4: uuidv4 } = await import('uuid');
      const pty = await import('node-pty');

      const id = uuidv4();
      const shell = process.env.SHELL || '/bin/zsh';
      let cwd = config.projectPath;

      if (!fs.existsSync(cwd)) {
        cwd = os.homedir();
      }

      // Always include world-builder skill
      const allSkills = [...new Set([...config.skills, 'world-builder'])];

      const ptyProcess = pty.spawn(shell, ['-l'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: {
          ...process.env as { [key: string]: string },
          CLAUDE_SKILLS: allSkills.join(','),
          CLAUDE_AGENT_ID: id,
          CLAUDE_PROJECT_PATH: config.projectPath,
        },
      });

      const ptyId = uuidv4();
      ptyProcesses.set(ptyId, ptyProcess);

      const status: AgentStatus = {
        id,
        status: 'idle',
        projectPath: config.projectPath,
        skills: allSkills,
        output: [],
        lastActivity: new Date().toISOString(),
        ptyId,
        character: config.character || 'robot',
        name: config.name || `Agent ${id.slice(0, 4)}`,
        skipPermissions: config.skipPermissions || false,
      };

      agents.set(id, status);
      saveAgents();

      // Setup PTY event handlers
      ptyProcess.onData((data) => {
        const agent = agents.get(id);
        if (agent) {
          agent.output.push(data);
          agent.lastActivity = new Date().toISOString();
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
        if (agent) {
          const newStatus = exitCode === 0 ? 'completed' : 'error';
          agent.status = newStatus;
          agent.lastActivity = new Date().toISOString();
          handleStatusChangeNotificationWrapper(agent, newStatus);
        }
        ptyProcesses.delete(ptyId);
        // Emit status event so kanban sync can detect completion
        getMainWindow()?.webContents.send('agent:status', {
          type: 'status',
          agentId: id,
          status: exitCode === 0 ? 'completed' : 'error',
          timestamp: new Date().toISOString(),
        });
        getMainWindow()?.webContents.send('agent:complete', {
          type: 'complete',
          agentId: id,
          ptyId,
          exitCode,
          timestamp: new Date().toISOString(),
        });
      });

      return status;
    },
    startAgent: async (agentId, prompt) => {
      const agent = agents.get(agentId);
      if (!agent) throw new Error('Agent not found');

      // Initialize PTY if needed
      if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
        const ptyId = await initAgentPty(
          agent,
          getMainWindow(),
          handleStatusChangeNotificationWrapper,
          saveAgents
        );
        agent.ptyId = ptyId;
      }

      const ptyProcess = ptyProcesses.get(agent.ptyId);
      if (!ptyProcess) throw new Error('PTY not found');

      // Build Claude command - always use dangerous mode for kanban tasks
      let command = 'claude --dangerously-skip-permissions';
      if (appSettings.verboseModeEnabled) {
        command += ' --verbose';
      }

      // Build final prompt with skills
      let finalPrompt = prompt;
      if (agent.skills && agent.skills.length > 0) {
        const skillsList = agent.skills.join(', ');
        finalPrompt = `[IMPORTANT: Use these skills for this session: ${skillsList}. Invoke them with /<skill-name> when relevant to the task.] ${prompt}`;
      }

      const escapedPrompt = finalPrompt.replace(/'/g, "'\\''");
      command += ` '${escapedPrompt}'`;

      // Update status
      agent.status = 'running';
      agent.currentTask = prompt.slice(0, 100);
      agent.lastActivity = new Date().toISOString();

      const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");
      const fullCommand = `cd '${workingPath}' && ${command}`;

      // For long commands, write to a temp script to avoid PTY line-wrapping mangling
      if (fullCommand.length > 100) {
        const tmpScript = path.join(os.tmpdir(), `claude-agent-${agentId}.sh`);
        fs.writeFileSync(tmpScript, `#!/bin/bash\n${fullCommand}\n`, { mode: 0o755 });
        ptyProcess.write(`bash '${tmpScript}'\r`);
      } else {
        ptyProcess.write(fullCommand);
        ptyProcess.write('\r');
      }

      saveAgents();
    },
    saveAgents,
  });

  // Register kanban handlers
  registerKanbanHandlers({
    getMainWindow,
    findMatchingAgent,
    createAgentForTask,
    startAgent: startAgentForTask,
    stopAgent: async (agentId: string) => {
      const agent = agents.get(agentId);
      if (agent?.ptyId) {
        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (ptyProcess) {
          // Send Ctrl+C to interrupt
          ptyProcess.write('\x03');
        }
        agent.status = 'idle';
        agent.currentTask = undefined;
        agent.lastActivity = new Date().toISOString();
        saveAgents();

        getMainWindow()?.webContents.send('agent:status', {
          type: 'status',
          agentId,
          status: 'idle',
          timestamp: new Date().toISOString(),
        });
      }
    },
    deleteAgent: async (agentId: string) => {
      const agent = agents.get(agentId);
      if (agent) {
        // Stop PTY if running
        if (agent.ptyId) {
          const ptyProcess = ptyProcesses.get(agent.ptyId);
          if (ptyProcess) {
            ptyProcess.kill();
          }
          ptyProcesses.delete(agent.ptyId);
        }
        // Remove agent
        agents.delete(agentId);
        saveAgents();
        console.log(`Agent ${agentId} deleted`);
      }
    },
    getAgentOutput: (agentId: string) => {
      const agent = agents.get(agentId);
      return agent?.output || [];
    },
  });

  // Initialize services
  initTelegramBot();
  initSlackBot(appSettings, (settings) => {
    appSettings = settings;
    saveAppSettingsToFile(settings);
  }, getMainWindow());
  initApiServer();

  // Setup MCP orchestrator and hooks
  await setupMcpOrchestrator(appSettings);
  await configureStatusHooks();

  // Auto-check for updates on startup
  if (appSettings.autoCheckUpdates !== false) {
    setTimeout(async () => {
      try {
        const updateInfo = await checkForUpdates();
        if (updateInfo?.hasUpdate) {
          // Notify the renderer so the UI can show an in-app update banner
          const mainWin = getMainWindow();
          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('app:update-available', updateInfo);
          }

          // Also show OS notification as a secondary signal
          if (Notification.isSupported()) {
            const notification = new Notification({
              title: 'Update Available',
              body: `Dorothy ${updateInfo.latestVersion} is available (you have ${updateInfo.currentVersion})`,
            });
            notification.on('click', () => {
              shell.openExternal(updateInfo.releaseUrl);
            });
            notification.show();
          }
        }
      } catch (err) {
        console.error('Auto-update check failed:', err);
      }
    }, 5000); // Delay 5s to let the app finish loading
  }

  console.log('App initialization complete');
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-create window on macOS when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    setUtilsMainWindow(getMainWindow());
  }
});

// Save agents and kill all PTY processes before quitting
app.on('before-quit', () => {
  console.log('App quitting, saving agents and killing all PTY processes...');
  saveAgents();
  killAllPty();
  closeVaultDb();
});

// Handle certificate errors in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

export { appSettings, getTelegramBot };
