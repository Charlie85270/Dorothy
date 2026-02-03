"use strict";
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
exports.getTelegramBot = exports.appSettings = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
// Constants
const constants_1 = require("./constants");
// Core modules
const window_manager_1 = require("./core/window-manager");
const agent_manager_1 = require("./core/agent-manager");
const pty_manager_1 = require("./core/pty-manager");
// Services
const api_server_1 = require("./services/api-server");
const telegram_bot_1 = require("./services/telegram-bot");
Object.defineProperty(exports, "getTelegramBot", { enumerable: true, get: function () { return telegram_bot_1.getTelegramBot; } });
const slack_bot_1 = require("./services/slack-bot");
const claude_service_1 = require("./services/claude-service");
const hooks_manager_1 = require("./services/hooks-manager");
const mcp_orchestrator_1 = require("./services/mcp-orchestrator");
// Handlers
const ipc_handlers_1 = require("./handlers/ipc-handlers");
const scheduler_handlers_1 = require("./handlers/scheduler-handlers");
// Utils
const utils_1 = require("./utils");
// ============== App Settings Management ==============
let appSettings = loadAppSettings();
exports.appSettings = appSettings;
function loadAppSettings() {
    const defaults = {
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
        verboseModeEnabled: false,
    };
    try {
        if (fs.existsSync(constants_1.APP_SETTINGS_FILE)) {
            const saved = JSON.parse(fs.readFileSync(constants_1.APP_SETTINGS_FILE, 'utf-8'));
            return { ...defaults, ...saved };
        }
    }
    catch (err) {
        console.error('Failed to load app settings:', err);
    }
    return defaults;
}
function saveAppSettingsToFile(settings) {
    try {
        (0, utils_1.ensureDataDir)();
        fs.writeFileSync(constants_1.APP_SETTINGS_FILE, JSON.stringify(settings, null, 2));
    }
    catch (err) {
        console.error('Failed to save app settings:', err);
    }
}
// ============== Telegram Bot Initialization ==============
function initTelegramBot() {
    // First inject dependencies into the Telegram bot service
    (0, telegram_bot_1.initTelegramBotService)(agent_manager_1.agents, pty_manager_1.ptyProcesses, appSettings, (0, window_manager_1.getMainWindow)(), () => (0, utils_1.getSuperAgent)(agent_manager_1.agents), agent_manager_1.saveAgents, claude_service_1.getClaudeStats, (agent) => (0, agent_manager_1.initAgentPty)(agent, (0, window_manager_1.getMainWindow)(), handleStatusChangeNotificationWrapper, agent_manager_1.saveAgents), saveAppSettingsToFile);
    // Then initialize the bot with handlers
    (0, telegram_bot_1.initTelegramBot)();
}
// ============== Notification Handler Wrapper ==============
function handleStatusChangeNotificationWrapper(agent, newStatus) {
    (0, agent_manager_1.handleStatusChangeNotification)(agent, newStatus, appSettings, utils_1.sendNotification, (text) => (0, telegram_bot_1.sendTelegramMessage)(text), telegram_bot_1.sendSuperAgentResponseToTelegram);
}
// ============== IPC Handler Dependencies ==============
function createIpcDependencies() {
    return {
        // State
        ptyProcesses: pty_manager_1.ptyProcesses,
        agents: agent_manager_1.agents,
        skillPtyProcesses: pty_manager_1.skillPtyProcesses,
        quickPtyProcesses: pty_manager_1.quickPtyProcesses,
        pluginPtyProcesses: pty_manager_1.pluginPtyProcesses,
        // Functions
        getMainWindow: window_manager_1.getMainWindow,
        getAppSettings: () => appSettings,
        setAppSettings: (settings) => { exports.appSettings = appSettings = settings; },
        saveAppSettings: saveAppSettingsToFile,
        saveAgents: agent_manager_1.saveAgents,
        initAgentPty: (agent) => (0, agent_manager_1.initAgentPty)(agent, (0, window_manager_1.getMainWindow)(), handleStatusChangeNotificationWrapper, agent_manager_1.saveAgents),
        detectAgentStatus: utils_1.detectAgentStatus,
        handleStatusChangeNotification: handleStatusChangeNotificationWrapper,
        isSuperAgent: utils_1.isSuperAgent,
        getMcpOrchestratorPath: mcp_orchestrator_1.getMcpOrchestratorPath,
        initTelegramBot,
        initSlackBot: () => (0, slack_bot_1.initSlackBot)(appSettings, (settings) => {
            exports.appSettings = appSettings = settings;
            saveAppSettingsToFile(settings);
        }, (0, window_manager_1.getMainWindow)()),
        getTelegramBot: telegram_bot_1.getTelegramBot,
        getSlackApp: slack_bot_1.getSlackApp,
        getSuperAgentTelegramTask: () => {
            // Import from agent-manager state
            const { superAgentTelegramTask } = require('./core/agent-manager');
            return superAgentTelegramTask;
        },
        getSuperAgentOutputBuffer: agent_manager_1.getSuperAgentOutputBuffer,
        setSuperAgentOutputBuffer: (buffer) => {
            // This is handled internally by agent-manager
            (0, agent_manager_1.clearSuperAgentOutputBuffer)();
            buffer.forEach(item => (0, agent_manager_1.getSuperAgentOutputBuffer)().push(item));
        },
        // Claude data functions
        getClaudeSettings: claude_service_1.getClaudeSettings,
        getClaudeStats: claude_service_1.getClaudeStats,
        getClaudeProjects: claude_service_1.getClaudeProjects,
        getClaudePlugins: claude_service_1.getClaudePlugins,
        getClaudeSkills: claude_service_1.getClaudeSkills,
        getClaudeHistory: claude_service_1.getClaudeHistory,
    };
}
// ============== API Server Initialization ==============
function initApiServer() {
    (0, api_server_1.startApiServer)((0, window_manager_1.getMainWindow)(), appSettings, telegram_bot_1.getTelegramBot, slack_bot_1.getSlackApp, (0, slack_bot_1.getSlackResponseChannel)(), (0, slack_bot_1.getSlackResponseThreadTs)(), handleStatusChangeNotificationWrapper, utils_1.sendNotification, (agent) => (0, agent_manager_1.initAgentPty)(agent, (0, window_manager_1.getMainWindow)(), handleStatusChangeNotificationWrapper, agent_manager_1.saveAgents));
}
// ============== App Initialization ==============
// Register protocol schemes before app is ready
(0, window_manager_1.registerProtocolSchemes)();
electron_1.app.whenReady().then(async () => {
    console.log('App ready, initializing...');
    // Ensure data directory exists
    (0, utils_1.ensureDataDir)();
    // Load agents from disk
    (0, agent_manager_1.loadAgents)();
    // Setup protocol handler for production
    (0, window_manager_1.setupProtocolHandler)();
    // Create the main window
    (0, window_manager_1.createWindow)();
    // Set the main window reference in utils
    (0, utils_1.setMainWindow)((0, window_manager_1.getMainWindow)());
    // Register all IPC handlers
    const deps = createIpcDependencies();
    (0, ipc_handlers_1.registerIpcHandlers)(deps);
    (0, scheduler_handlers_1.registerSchedulerHandlers)();
    (0, mcp_orchestrator_1.registerMcpOrchestratorHandlers)();
    // Initialize services
    initTelegramBot();
    (0, slack_bot_1.initSlackBot)(appSettings, (settings) => {
        exports.appSettings = appSettings = settings;
        saveAppSettingsToFile(settings);
    }, (0, window_manager_1.getMainWindow)());
    initApiServer();
    // Setup MCP orchestrator and hooks
    await (0, mcp_orchestrator_1.setupMcpOrchestrator)();
    await (0, hooks_manager_1.configureStatusHooks)();
    console.log('App initialization complete');
});
// Quit when all windows are closed (except on macOS)
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Re-create window on macOS when dock icon is clicked
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        (0, window_manager_1.createWindow)();
        (0, utils_1.setMainWindow)((0, window_manager_1.getMainWindow)());
    }
});
// Save agents before quitting
electron_1.app.on('before-quit', () => {
    console.log('App quitting, saving agents...');
    (0, agent_manager_1.saveAgents)();
});
// Handle certificate errors in development
electron_1.app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.startsWith('https://localhost')) {
        event.preventDefault();
        callback(true);
    }
    else {
        callback(false);
    }
});
//# sourceMappingURL=main.js.map