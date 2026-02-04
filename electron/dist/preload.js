"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected APIs to renderer
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // PTY terminal management
    pty: {
        create: (params) => electron_1.ipcRenderer.invoke('pty:create', params),
        write: (params) => electron_1.ipcRenderer.invoke('pty:write', params),
        resize: (params) => electron_1.ipcRenderer.invoke('pty:resize', params),
        kill: (params) => electron_1.ipcRenderer.invoke('pty:kill', params),
        // Event listeners
        onData: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('pty:data', listener);
            return () => electron_1.ipcRenderer.removeListener('pty:data', listener);
        },
        onExit: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('pty:exit', listener);
            return () => electron_1.ipcRenderer.removeListener('pty:exit', listener);
        },
    },
    // Agent management
    agent: {
        create: (config) => electron_1.ipcRenderer.invoke('agent:create', config),
        update: (params) => electron_1.ipcRenderer.invoke('agent:update', params),
        start: (params) => electron_1.ipcRenderer.invoke('agent:start', params),
        get: (id) => electron_1.ipcRenderer.invoke('agent:get', id),
        list: () => electron_1.ipcRenderer.invoke('agent:list'),
        stop: (id) => electron_1.ipcRenderer.invoke('agent:stop', id),
        remove: (id) => electron_1.ipcRenderer.invoke('agent:remove', id),
        sendInput: (params) => electron_1.ipcRenderer.invoke('agent:input', params),
        resize: (params) => electron_1.ipcRenderer.invoke('agent:resize', params),
        setSecondaryProject: (params) => electron_1.ipcRenderer.invoke('agent:setSecondaryProject', params),
        // Event listeners
        onOutput: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('agent:output', listener);
            return () => electron_1.ipcRenderer.removeListener('agent:output', listener);
        },
        onError: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('agent:error', listener);
            return () => electron_1.ipcRenderer.removeListener('agent:error', listener);
        },
        onComplete: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('agent:complete', listener);
            return () => electron_1.ipcRenderer.removeListener('agent:complete', listener);
        },
        onToolUse: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('agent:tool_use', listener);
            return () => electron_1.ipcRenderer.removeListener('agent:tool_use', listener);
        },
        onStatus: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('agent:status', listener);
            return () => electron_1.ipcRenderer.removeListener('agent:status', listener);
        },
    },
    // Skills management
    skill: {
        install: (repo) => electron_1.ipcRenderer.invoke('skill:install', repo),
        installStart: (params) => electron_1.ipcRenderer.invoke('skill:install-start', params),
        installWrite: (params) => electron_1.ipcRenderer.invoke('skill:install-write', params),
        installResize: (params) => electron_1.ipcRenderer.invoke('skill:install-resize', params),
        installKill: (params) => electron_1.ipcRenderer.invoke('skill:install-kill', params),
        listInstalled: () => electron_1.ipcRenderer.invoke('skill:list-installed'),
        onPtyData: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('skill:pty-data', listener);
            return () => electron_1.ipcRenderer.removeListener('skill:pty-data', listener);
        },
        onPtyExit: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('skill:pty-exit', listener);
            return () => electron_1.ipcRenderer.removeListener('skill:pty-exit', listener);
        },
        onInstallOutput: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('skill:install-output', listener);
            return () => electron_1.ipcRenderer.removeListener('skill:install-output', listener);
        },
    },
    // Plugin management (with in-app terminal)
    plugin: {
        installStart: (params) => electron_1.ipcRenderer.invoke('plugin:install-start', params),
        installWrite: (params) => electron_1.ipcRenderer.invoke('plugin:install-write', params),
        installResize: (params) => electron_1.ipcRenderer.invoke('plugin:install-resize', params),
        installKill: (params) => electron_1.ipcRenderer.invoke('plugin:install-kill', params),
        onPtyData: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('plugin:pty-data', listener);
            return () => electron_1.ipcRenderer.removeListener('plugin:pty-data', listener);
        },
        onPtyExit: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('plugin:pty-exit', listener);
            return () => electron_1.ipcRenderer.removeListener('plugin:pty-exit', listener);
        },
    },
    // File system
    fs: {
        listProjects: () => electron_1.ipcRenderer.invoke('fs:list-projects'),
    },
    // Claude data
    claude: {
        getData: () => electron_1.ipcRenderer.invoke('claude:getData'),
    },
    // Settings
    settings: {
        get: () => electron_1.ipcRenderer.invoke('settings:get'),
        save: (settings) => electron_1.ipcRenderer.invoke('settings:save', settings),
        getInfo: () => electron_1.ipcRenderer.invoke('settings:getInfo'),
    },
    // App settings (notifications, etc.)
    appSettings: {
        get: () => electron_1.ipcRenderer.invoke('app:getSettings'),
        save: (settings) => electron_1.ipcRenderer.invoke('app:saveSettings', settings),
        onUpdated: (callback) => {
            const listener = (_, settings) => callback(settings);
            electron_1.ipcRenderer.on('settings:updated', listener);
            return () => electron_1.ipcRenderer.removeListener('settings:updated', listener);
        },
    },
    // Telegram bot
    telegram: {
        test: () => electron_1.ipcRenderer.invoke('telegram:test'),
        sendTest: () => electron_1.ipcRenderer.invoke('telegram:sendTest'),
    },
    // Slack bot
    slack: {
        test: () => electron_1.ipcRenderer.invoke('slack:test'),
        sendTest: () => electron_1.ipcRenderer.invoke('slack:sendTest'),
    },
    // Dialogs
    dialog: {
        openFolder: () => electron_1.ipcRenderer.invoke('dialog:open-folder'),
    },
    // Shell operations
    shell: {
        openTerminal: (params) => electron_1.ipcRenderer.invoke('shell:open-terminal', params),
        exec: (params) => electron_1.ipcRenderer.invoke('shell:exec', params),
        // Quick terminal PTY
        startPty: (params) => electron_1.ipcRenderer.invoke('shell:startPty', params),
        writePty: (params) => electron_1.ipcRenderer.invoke('shell:writePty', params),
        resizePty: (params) => electron_1.ipcRenderer.invoke('shell:resizePty', params),
        killPty: (params) => electron_1.ipcRenderer.invoke('shell:killPty', params),
        // Event listeners for quick terminal
        onPtyOutput: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('shell:ptyOutput', listener);
            return () => electron_1.ipcRenderer.removeListener('shell:ptyOutput', listener);
        },
        onPtyExit: (callback) => {
            const listener = (_, event) => callback(event);
            electron_1.ipcRenderer.on('shell:ptyExit', listener);
            return () => electron_1.ipcRenderer.removeListener('shell:ptyExit', listener);
        },
    },
    // Orchestrator (Super Agent) management
    orchestrator: {
        getStatus: () => electron_1.ipcRenderer.invoke('orchestrator:getStatus'),
        setup: () => electron_1.ipcRenderer.invoke('orchestrator:setup'),
        remove: () => electron_1.ipcRenderer.invoke('orchestrator:remove'),
    },
    // Scheduler (native implementation)
    scheduler: {
        listTasks: () => electron_1.ipcRenderer.invoke('scheduler:listTasks'),
        createTask: (params) => electron_1.ipcRenderer.invoke('scheduler:createTask', params),
        deleteTask: (taskId) => electron_1.ipcRenderer.invoke('scheduler:deleteTask', taskId),
        runTask: (taskId) => electron_1.ipcRenderer.invoke('scheduler:runTask', taskId),
        getLogs: (taskId) => electron_1.ipcRenderer.invoke('scheduler:getLogs', taskId),
        fixMcpPaths: () => electron_1.ipcRenderer.invoke('scheduler:fixMcpPaths'),
    },
    // Automations
    automation: {
        list: () => electron_1.ipcRenderer.invoke('automation:list'),
        create: (params) => electron_1.ipcRenderer.invoke('automation:create', params),
        update: (id, params) => electron_1.ipcRenderer.invoke('automation:update', id, params),
        delete: (id) => electron_1.ipcRenderer.invoke('automation:delete', id),
        run: (id) => electron_1.ipcRenderer.invoke('automation:run', id),
        getLogs: (id) => electron_1.ipcRenderer.invoke('automation:getLogs', id),
    },
    // Platform info
    platform: process.platform,
});
//# sourceMappingURL=preload.js.map