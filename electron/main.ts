
import { app, BrowserWindow, protocol } from 'electron';
import * as fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import { App as SlackApp } from '@slack/bolt';

// Import types
import { AppSettings } from './types';

// Import constants
import { APP_SETTINGS_FILE } from './constants';

// Import utilities
import { ensureDataDir, setMainWindow as setUtilsMainWindow } from './utils';

// Import core modules
import { ptyProcesses } from './core/pty-manager';
import {
  agents,
  saveAgents,
  loadAgents,
  initAgentPty,
  getSuperAgentOutputBuffer,
} from './core/agent-manager';
import {
  createWindow,
  registerProtocolSchemes,
  setupProtocolHandler,
  setMainWindow,
  getMainWindow,
} from './core/window-manager';

// Import services
import { startApiServer, stopApiServer } from './services/api-server';
import {
  initTelegramBot,
  stopTelegramBot,
  getTelegramBot,
  sendToSuperAgent,
} from './services/telegram-bot';
import {
  initSlackBot,
  stopSlackBot,
  getSlackApp,
  setGetClaudeStatsRef,
} from './services/slack-bot';
import { getClaudeStats } from './services/claude-service';
import { configureStatusHooks } from './services/hooks-manager';
import { setupMcpOrchestrator } from './services/mcp-orchestrator';

// Import handlers
import { registerIpcHandlers } from './handlers/ipc-handlers';

// ============== Global State ==============

let appSettings: AppSettings;

// ============== App Settings Functions ==============

function loadAppSettings(): AppSettings {
  const defaults: AppSettings = {
    notificationsEnabled: true,
    notifyOnWaiting: true,
    notifyOnComplete: true,
    notifyOnError: true,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    slackEnabled: false,
    slackBotToken: '',
    slackAppToken: '',
    slackSigningSecret: '',
    slackChannelId: '',
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

// ============== Auto-Start Function ==============

async function autoStartSuperAgent() {
  const superAgentEntry = Array.from(agents.values()).find((agent) => {
    const name = agent.name?.toLowerCase() || '';
    return name.includes('super agent') || name.includes('orchestrator');
  });

  if (!superAgentEntry) {
    console.log('No Super Agent found - skipping auto-start');
    return;
  }

  console.log(`Found Super Agent: ${superAgentEntry.name} (status: ${superAgentEntry.status})`);

  // Only auto-start if idle, completed, or error
  if (
    superAgentEntry.status !== 'idle' &&
    superAgentEntry.status !== 'completed' &&
    superAgentEntry.status !== 'error'
  ) {
    console.log(`Super Agent is ${superAgentEntry.status} - skipping auto-start`);
    return;
  }

  try {
    // Initialize PTY if needed
    if (!superAgentEntry.ptyId || !ptyProcesses.has(superAgentEntry.ptyId)) {
      console.log('Initializing PTY for Super Agent...');
      const ptyId = await initAgentPty(superAgentEntry);
      superAgentEntry.ptyId = ptyId;
    }

    const ptyProcess = ptyProcesses.get(superAgentEntry.ptyId);
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
4. Relay the response back to the user

IMPORTANT:
- Always read agent outputs with get_agent_output before responding
- Wait before reading output (agents need time to process)
- You can manage multiple agents in parallel
- Create new agents for new tasks if needed

You are running continuously. When users (via Telegram/Slack) send messages, they'll appear here.
Ready to orchestrate!`;

    // Update status
    superAgentEntry.status = 'running';
    superAgentEntry.currentTask = 'Orchestrator ready - awaiting tasks';
    superAgentEntry.lastActivity = new Date().toISOString();

    // Write the prompt
    ptyProcess.write(orchestratorPrompt + '\n');

    // Notify window
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('agent:statusChanged', {
        id: superAgentEntry.id,
        status: superAgentEntry.status,
        currentTask: superAgentEntry.currentTask,
      });
    }

    console.log('Super Agent auto-started successfully');
  } catch (err) {
    console.error('Failed to auto-start Super Agent:', err);
    superAgentEntry.status = 'error';
    superAgentEntry.error = String(err);
  }
}

// ============== Protocol Registration ==============
// This must be called before app.whenReady()

registerProtocolSchemes();

// ============== App Lifecycle Events ==============

app.whenReady().then(async () => {
  // Load app settings
  appSettings = loadAppSettings();

  // Load persisted agents
  loadAgents();

  // Auto-setup MCP orchestrator if not already configured
  await setupMcpOrchestrator();

  // Configure status hooks for Claude Code
  await configureStatusHooks();

  // Start API server
  startApiServer(
    agents,
    ptyProcesses,
    () => getMainWindow(),
    getSuperAgentOutputBuffer
  );

  // Set up Slack bot reference to getClaudeStats
  setGetClaudeStatsRef(getClaudeStats);

  // Initialize Telegram bot if enabled
  if (appSettings.telegramEnabled) {
    initTelegramBot(appSettings, agents, ptyProcesses, () => getMainWindow());
  }

  // Initialize Slack bot if enabled
  if (appSettings.slackEnabled) {
    initSlackBot(
      appSettings,
      agents,
      ptyProcesses,
      () => getMainWindow(),
      getClaudeStats
    );
  }

  // Register protocol handler
  setupProtocolHandler();

  // Create main window
  createWindow();

  // Register IPC handlers
  registerIpcHandlers({
    agents,
    ptyProcesses,
    getMainWindow,
    appSettings,
    loadAppSettings,
    saveAppSettings,
    getTelegramBot,
    getSlackApp,
    initTelegramBot: () => initTelegramBot(appSettings, agents, ptyProcesses, () => getMainWindow()),
    stopTelegramBot,
    initSlackBot: () => initSlackBot(appSettings, agents, ptyProcesses, () => getMainWindow(), getClaudeStats),
    stopSlackBot,
    sendToSuperAgent,
  });

  // Set main window reference in utils
  setUtilsMainWindow(getMainWindow());

  // Auto-start Super Agent if it exists
  await autoStartSuperAgent();
});

app.on('window-all-closed', () => {
  // Save agents before quitting
  saveAgents();

  // Stop the API server
  stopApiServer();

  // Stop Telegram bot
  stopTelegramBot();

  // Stop Slack bot
  stopSlackBot();

  // Kill all PTY processes
  ptyProcesses.forEach((ptyProcess) => {
    ptyProcess.kill();
  });

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  saveAgents();
});

app.on('activate', () => {
  if (getMainWindow() === null) {
    createWindow();
  }
});
