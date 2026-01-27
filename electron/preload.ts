import { contextBridge, ipcRenderer } from 'electron';

// Agent event types
type AgentEventCallback = (event: {
  type: string;
  agentId: string;
  ptyId?: string;
  data: string;
  timestamp: string;
  exitCode?: number;
}) => void;

// PTY event types
type PtyDataCallback = (event: { id: string; data: string }) => void;
type PtyExitCallback = (event: { id: string; exitCode: number }) => void;

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // PTY terminal management
  pty: {
    create: (params: { cwd?: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke('pty:create', params),
    write: (params: { id: string; data: string }) =>
      ipcRenderer.invoke('pty:write', params),
    resize: (params: { id: string; cols: number; rows: number }) =>
      ipcRenderer.invoke('pty:resize', params),
    kill: (params: { id: string }) =>
      ipcRenderer.invoke('pty:kill', params),

    // Event listeners
    onData: (callback: PtyDataCallback) => {
      const listener = (_: unknown, event: { id: string; data: string }) => callback(event);
      ipcRenderer.on('pty:data', listener);
      return () => ipcRenderer.removeListener('pty:data', listener);
    },
    onExit: (callback: PtyExitCallback) => {
      const listener = (_: unknown, event: { id: string; exitCode: number }) => callback(event);
      ipcRenderer.on('pty:exit', listener);
      return () => ipcRenderer.removeListener('pty:exit', listener);
    },
  },

  // Agent management
  agent: {
    create: (config: {
      projectPath: string;
      skills: string[];
      worktree?: { enabled: boolean; branchName: string };
      character?: string;
      name?: string;
    }) => ipcRenderer.invoke('agent:create', config),
    start: (params: { id: string; prompt: string; options?: { model?: string; resume?: boolean } }) =>
      ipcRenderer.invoke('agent:start', params),
    get: (id: string) =>
      ipcRenderer.invoke('agent:get', id),
    list: () =>
      ipcRenderer.invoke('agent:list'),
    stop: (id: string) =>
      ipcRenderer.invoke('agent:stop', id),
    remove: (id: string) =>
      ipcRenderer.invoke('agent:remove', id),
    sendInput: (params: { id: string; input: string }) =>
      ipcRenderer.invoke('agent:input', params),
    resize: (params: { id: string; cols: number; rows: number }) =>
      ipcRenderer.invoke('agent:resize', params),

    // Event listeners
    onOutput: (callback: AgentEventCallback) => {
      const listener = (_: unknown, event: Parameters<AgentEventCallback>[0]) => callback(event);
      ipcRenderer.on('agent:output', listener);
      return () => ipcRenderer.removeListener('agent:output', listener);
    },
    onError: (callback: AgentEventCallback) => {
      const listener = (_: unknown, event: Parameters<AgentEventCallback>[0]) => callback(event);
      ipcRenderer.on('agent:error', listener);
      return () => ipcRenderer.removeListener('agent:error', listener);
    },
    onComplete: (callback: AgentEventCallback) => {
      const listener = (_: unknown, event: Parameters<AgentEventCallback>[0]) => callback(event);
      ipcRenderer.on('agent:complete', listener);
      return () => ipcRenderer.removeListener('agent:complete', listener);
    },
    onToolUse: (callback: AgentEventCallback) => {
      const listener = (_: unknown, event: Parameters<AgentEventCallback>[0]) => callback(event);
      ipcRenderer.on('agent:tool_use', listener);
      return () => ipcRenderer.removeListener('agent:tool_use', listener);
    },
    onStatus: (callback: (event: { type: string; agentId: string; status: string; timestamp: string }) => void) => {
      const listener = (_: unknown, event: { type: string; agentId: string; status: string; timestamp: string }) => callback(event);
      ipcRenderer.on('agent:status', listener);
      return () => ipcRenderer.removeListener('agent:status', listener);
    },
  },

  // Skills management
  skill: {
    install: (repo: string) =>
      ipcRenderer.invoke('skill:install', repo),
    installStart: (params: { repo: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke('skill:install-start', params),
    installWrite: (params: { id: string; data: string }) =>
      ipcRenderer.invoke('skill:install-write', params),
    installResize: (params: { id: string; cols: number; rows: number }) =>
      ipcRenderer.invoke('skill:install-resize', params),
    installKill: (params: { id: string }) =>
      ipcRenderer.invoke('skill:install-kill', params),
    listInstalled: () =>
      ipcRenderer.invoke('skill:list-installed'),
    onPtyData: (callback: (event: { id: string; data: string }) => void) => {
      const listener = (_: unknown, event: { id: string; data: string }) => callback(event);
      ipcRenderer.on('skill:pty-data', listener);
      return () => ipcRenderer.removeListener('skill:pty-data', listener);
    },
    onPtyExit: (callback: (event: { id: string; exitCode: number }) => void) => {
      const listener = (_: unknown, event: { id: string; exitCode: number }) => callback(event);
      ipcRenderer.on('skill:pty-exit', listener);
      return () => ipcRenderer.removeListener('skill:pty-exit', listener);
    },
    onInstallOutput: (callback: (event: { repo: string; data: string }) => void) => {
      const listener = (_: unknown, event: { repo: string; data: string }) => callback(event);
      ipcRenderer.on('skill:install-output', listener);
      return () => ipcRenderer.removeListener('skill:install-output', listener);
    },
  },

  // File system
  fs: {
    listProjects: () =>
      ipcRenderer.invoke('fs:list-projects'),
  },

  // Claude data
  claude: {
    getData: () =>
      ipcRenderer.invoke('claude:getData'),
  },

  // Settings
  settings: {
    get: () =>
      ipcRenderer.invoke('settings:get'),
    save: (settings: {
      enabledPlugins?: Record<string, boolean>;
      env?: Record<string, string>;
      hooks?: Record<string, unknown>;
      includeCoAuthoredBy?: boolean;
      permissions?: { allow: string[]; deny: string[] };
    }) =>
      ipcRenderer.invoke('settings:save', settings),
    getInfo: () =>
      ipcRenderer.invoke('settings:getInfo'),
  },

  // App settings (notifications, etc.)
  appSettings: {
    get: () =>
      ipcRenderer.invoke('app:getSettings'),
    save: (settings: {
      notificationsEnabled?: boolean;
      notifyOnWaiting?: boolean;
      notifyOnComplete?: boolean;
      notifyOnError?: boolean;
    }) =>
      ipcRenderer.invoke('app:saveSettings', settings),
  },

  // Dialogs
  dialog: {
    openFolder: () =>
      ipcRenderer.invoke('dialog:open-folder'),
  },

  // Shell operations
  shell: {
    openTerminal: (params: { cwd: string; command?: string }) =>
      ipcRenderer.invoke('shell:open-terminal', params),
    exec: (params: { command: string; cwd?: string }) =>
      ipcRenderer.invoke('shell:exec', params),
    // Quick terminal PTY
    startPty: (params: { cwd?: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke('shell:startPty', params),
    writePty: (params: { ptyId: string; data: string }) =>
      ipcRenderer.invoke('shell:writePty', params),
    resizePty: (params: { ptyId: string; cols: number; rows: number }) =>
      ipcRenderer.invoke('shell:resizePty', params),
    killPty: (params: { ptyId: string }) =>
      ipcRenderer.invoke('shell:killPty', params),
    // Event listeners for quick terminal
    onPtyOutput: (callback: (event: { ptyId: string; data: string }) => void) => {
      const listener = (_: unknown, event: { ptyId: string; data: string }) => callback(event);
      ipcRenderer.on('shell:ptyOutput', listener);
      return () => ipcRenderer.removeListener('shell:ptyOutput', listener);
    },
    onPtyExit: (callback: (event: { ptyId: string; exitCode: number }) => void) => {
      const listener = (_: unknown, event: { ptyId: string; exitCode: number }) => callback(event);
      ipcRenderer.on('shell:ptyExit', listener);
      return () => ipcRenderer.removeListener('shell:ptyExit', listener);
    },
  },

  // Platform info
  platform: process.platform,
});
