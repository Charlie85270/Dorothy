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
        start: (params) => electron_1.ipcRenderer.invoke('agent:start', params),
        get: (id) => electron_1.ipcRenderer.invoke('agent:get', id),
        list: () => electron_1.ipcRenderer.invoke('agent:list'),
        stop: (id) => electron_1.ipcRenderer.invoke('agent:stop', id),
        remove: (id) => electron_1.ipcRenderer.invoke('agent:remove', id),
        sendInput: (params) => electron_1.ipcRenderer.invoke('agent:input', params),
        resize: (params) => electron_1.ipcRenderer.invoke('agent:resize', params),
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
    // File system
    fs: {
        listProjects: () => electron_1.ipcRenderer.invoke('fs:list-projects'),
    },
    // Dialogs
    dialog: {
        openFolder: () => electron_1.ipcRenderer.invoke('dialog:open-folder'),
    },
    // Shell operations
    shell: {
        openTerminal: (params) => electron_1.ipcRenderer.invoke('shell:open-terminal', params),
        exec: (params) => electron_1.ipcRenderer.invoke('shell:exec', params),
    },
    // Platform info
    platform: process.platform,
});
//# sourceMappingURL=preload.js.map