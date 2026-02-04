/**
 * claude.mgr - Main Electron Entry Point
 *
 * This file initializes and wires together all the modular components:
 * - Window management and protocol handling
 * - Agent state and PTY management
 * - IPC handlers for renderer communication
 * - External services (Telegram, Slack, HTTP API)
 * - MCP orchestrator integration
 * - Scheduler for automated tasks
 */

import { app, BrowserWindow } from 'electron';
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

// Utils
import {
  setMainWindow as setUtilsMainWindow,
  sendNotification,
  isSuperAgent,
  getSuperAgent,
  detectAgentStatus,
  ensureDataDir,
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
    slackEnabled: false,
    slackBotToken: '',
    slackAppToken: '',
    slackSigningSecret: '',
    slackChannelId: '',
    verboseModeEnabled: false,
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
    detectAgentStatus,
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

  // Initialize services
  initTelegramBot();
  initSlackBot(appSettings, (settings) => {
    appSettings = settings;
    saveAppSettingsToFile(settings);
  }, getMainWindow());
  initApiServer();

  // Setup MCP orchestrator and hooks
  await setupMcpOrchestrator();
  await configureStatusHooks();

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

// Save agents before quitting
app.on('before-quit', () => {
  console.log('App quitting, saving agents...');
  saveAgents();
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
