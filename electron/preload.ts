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
      secondaryProjectPath?: string;
      skipPermissions?: boolean;
      provider?: 'claude' | 'local';
      localModel?: string;
    }) => ipcRenderer.invoke('agent:create', config),
    update: (params: {
      id: string;
      skills?: string[];
      secondaryProjectPath?: string | null;
      skipPermissions?: boolean;
      name?: string;
      character?: string;
    }) => ipcRenderer.invoke('agent:update', params),
    start: (params: { id: string; prompt: string; options?: { model?: string; resume?: boolean; provider?: 'claude' | 'local'; localModel?: string } }) =>
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
    setSecondaryProject: (params: { id: string; secondaryProjectPath: string | null }) =>
      ipcRenderer.invoke('agent:setSecondaryProject', params),

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

  // Plugin management (with in-app terminal)
  plugin: {
    installStart: (params: { command: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke('plugin:install-start', params),
    installWrite: (params: { id: string; data: string }) =>
      ipcRenderer.invoke('plugin:install-write', params),
    installResize: (params: { id: string; cols: number; rows: number }) =>
      ipcRenderer.invoke('plugin:install-resize', params),
    installKill: (params: { id: string }) =>
      ipcRenderer.invoke('plugin:install-kill', params),
    onPtyData: (callback: (event: { id: string; data: string }) => void) => {
      const listener = (_: unknown, event: { id: string; data: string }) => callback(event);
      ipcRenderer.on('plugin:pty-data', listener);
      return () => ipcRenderer.removeListener('plugin:pty-data', listener);
    },
    onPtyExit: (callback: (event: { id: string; exitCode: number }) => void) => {
      const listener = (_: unknown, event: { id: string; exitCode: number }) => callback(event);
      ipcRenderer.on('plugin:pty-exit', listener);
      return () => ipcRenderer.removeListener('plugin:pty-exit', listener);
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
      telegramEnabled?: boolean;
      telegramBotToken?: string;
      telegramChatId?: string;
      slackEnabled?: boolean;
      slackBotToken?: string;
      slackAppToken?: string;
      slackSigningSecret?: string;
      slackChannelId?: string;
      socialDataEnabled?: boolean;
      socialDataApiKey?: string;
    }) =>
      ipcRenderer.invoke('app:saveSettings', settings),
    onUpdated: (callback: (settings: unknown) => void) => {
      const listener = (_: unknown, settings: unknown) => callback(settings);
      ipcRenderer.on('settings:updated', listener);
      return () => ipcRenderer.removeListener('settings:updated', listener);
    },
  },

  // Telegram bot
  telegram: {
    test: () =>
      ipcRenderer.invoke('telegram:test'),
    sendTest: () =>
      ipcRenderer.invoke('telegram:sendTest'),
    generateAuthToken: () =>
      ipcRenderer.invoke('telegram:generateAuthToken'),
    removeAuthorizedChatId: (chatId: string) =>
      ipcRenderer.invoke('telegram:removeAuthorizedChatId', chatId),
  },

  // Slack bot
  slack: {
    test: () =>
      ipcRenderer.invoke('slack:test'),
    sendTest: () =>
      ipcRenderer.invoke('slack:sendTest'),
  },

  // JIRA
  jira: {
    test: () =>
      ipcRenderer.invoke('jira:test'),
  },

  // SocialData (Twitter/X)
  socialData: {
    test: () =>
      ipcRenderer.invoke('socialdata:test'),
  },

  // X API (posting)
  xApi: {
    test: () =>
      ipcRenderer.invoke('xapi:test') as Promise<{ success: boolean; username?: string; error?: string }>,
  },

  // Local Model
  localModel: {
    detect: () =>
      ipcRenderer.invoke('localmodel:detect') as Promise<{ found: boolean; port?: number; url?: string }>,
  },

  // Tasmania (Local LLM)
  tasmania: {
    test: () =>
      ipcRenderer.invoke('tasmania:test'),
    getStatus: () =>
      ipcRenderer.invoke('tasmania:getStatus'),
    getModels: () =>
      ipcRenderer.invoke('tasmania:getModels'),
    loadModel: (modelPath: string) =>
      ipcRenderer.invoke('tasmania:loadModel', modelPath),
    stopModel: () =>
      ipcRenderer.invoke('tasmania:stopModel'),
    getMcpStatus: () =>
      ipcRenderer.invoke('tasmania:getMcpStatus'),
    setup: () =>
      ipcRenderer.invoke('tasmania:setup'),
    remove: () =>
      ipcRenderer.invoke('tasmania:remove'),
  },

  // Dialogs
  dialog: {
    openFolder: () =>
      ipcRenderer.invoke('dialog:open-folder'),
    openFiles: () =>
      ipcRenderer.invoke('dialog:open-files') as Promise<string[]>,
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

  // Orchestrator (Super Agent) management
  orchestrator: {
    getStatus: () =>
      ipcRenderer.invoke('orchestrator:getStatus'),
    setup: () =>
      ipcRenderer.invoke('orchestrator:setup'),
    remove: () =>
      ipcRenderer.invoke('orchestrator:remove'),
  },

  // Scheduler (native implementation)
  scheduler: {
    listTasks: () =>
      ipcRenderer.invoke('scheduler:listTasks'),
    createTask: (params: {
      agentId?: string;
      prompt: string;
      schedule: string;
      projectPath: string;
      autonomous: boolean;
      useWorktree?: boolean;
      notifications?: { telegram: boolean; slack: boolean };
    }) =>
      ipcRenderer.invoke('scheduler:createTask', params),
    deleteTask: (taskId: string) =>
      ipcRenderer.invoke('scheduler:deleteTask', taskId),
    updateTask: (taskId: string, updates: {
      prompt?: string;
      schedule?: string;
      projectPath?: string;
      autonomous?: boolean;
      notifications?: { telegram: boolean; slack: boolean };
    }) =>
      ipcRenderer.invoke('scheduler:updateTask', taskId, updates),
    runTask: (taskId: string) =>
      ipcRenderer.invoke('scheduler:runTask', taskId),
    getLogs: (taskId: string) =>
      ipcRenderer.invoke('scheduler:getLogs', taskId),
    fixMcpPaths: () =>
      ipcRenderer.invoke('scheduler:fixMcpPaths'),
  },

  // Automations
  automation: {
    list: () =>
      ipcRenderer.invoke('automation:list'),
    create: (params: {
      name: string;
      description?: string;
      sourceType: string;
      sourceConfig: string;
      scheduleMinutes?: number;
      scheduleCron?: string;
      eventTypes?: string[];
      onNewItem?: boolean;
      agentEnabled?: boolean;
      agentPrompt?: string;
      agentProjectPath?: string;
      outputTelegram?: boolean;
      outputSlack?: boolean;
      outputGitHubComment?: boolean;
      outputJiraComment?: boolean;
      outputJiraTransition?: string;
      outputTemplate?: string;
    } | Record<string, unknown>) =>
      ipcRenderer.invoke('automation:create', params),
    update: (id: string, params: { enabled?: boolean; name?: string }) =>
      ipcRenderer.invoke('automation:update', id, params),
    delete: (id: string) =>
      ipcRenderer.invoke('automation:delete', id),
    run: (id: string) =>
      ipcRenderer.invoke('automation:run', id),
    getLogs: (id: string) =>
      ipcRenderer.invoke('automation:getLogs', id),
  },

  // Kanban Board
  kanban: {
    list: () =>
      ipcRenderer.invoke('kanban:list'),
    get: (id: string) =>
      ipcRenderer.invoke('kanban:get', id),
    create: (params: {
      title: string;
      description: string;
      projectId: string;
      projectPath: string;
      requiredSkills?: string[];
      priority?: 'low' | 'medium' | 'high';
      labels?: string[];
    }) =>
      ipcRenderer.invoke('kanban:create', params),
    update: (params: {
      id: string;
      title?: string;
      description?: string;
      requiredSkills?: string[];
      priority?: 'low' | 'medium' | 'high';
      labels?: string[];
      progress?: number;
      assignedAgentId?: string | null;
    }) =>
      ipcRenderer.invoke('kanban:update', params),
    move: (params: { id: string; column: 'backlog' | 'planned' | 'ongoing' | 'done'; order?: number }) =>
      ipcRenderer.invoke('kanban:move', params),
    delete: (id: string) =>
      ipcRenderer.invoke('kanban:delete', id),
    reorder: (params: { taskIds: string[]; column: 'backlog' | 'planned' | 'ongoing' | 'done' }) =>
      ipcRenderer.invoke('kanban:reorder', params),
    generate: (params: { prompt: string; availableProjects: Array<{ path: string; name: string }> }) =>
      ipcRenderer.invoke('kanban:generate', params),
    // Event listeners
    onTaskCreated: (callback: (task: unknown) => void) => {
      const listener = (_: unknown, task: unknown) => callback(task);
      ipcRenderer.on('kanban:task-created', listener);
      return () => ipcRenderer.removeListener('kanban:task-created', listener);
    },
    onTaskUpdated: (callback: (task: unknown) => void) => {
      const listener = (_: unknown, task: unknown) => callback(task);
      ipcRenderer.on('kanban:task-updated', listener);
      return () => ipcRenderer.removeListener('kanban:task-updated', listener);
    },
    onTaskDeleted: (callback: (event: { id: string }) => void) => {
      const listener = (_: unknown, event: { id: string }) => callback(event);
      ipcRenderer.on('kanban:task-deleted', listener);
      return () => ipcRenderer.removeListener('kanban:task-deleted', listener);
    },
  },

  // Vault
  vault: {
    listDocuments: (params?: { folder_id?: string; tags?: string[] }) =>
      ipcRenderer.invoke('vault:listDocuments', params),
    getDocument: (id: string) =>
      ipcRenderer.invoke('vault:getDocument', id),
    createDocument: (params: {
      title: string;
      content: string;
      folder_id?: string;
      author: string;
      agent_id?: string;
      tags?: string[];
    }) =>
      ipcRenderer.invoke('vault:createDocument', params),
    updateDocument: (params: {
      id: string;
      title?: string;
      content?: string;
      tags?: string[];
      folder_id?: string | null;
    }) =>
      ipcRenderer.invoke('vault:updateDocument', params),
    deleteDocument: (id: string) =>
      ipcRenderer.invoke('vault:deleteDocument', id),
    search: (params: { query: string; limit?: number }) =>
      ipcRenderer.invoke('vault:search', params),
    listFolders: () =>
      ipcRenderer.invoke('vault:listFolders'),
    createFolder: (params: { name: string; parent_id?: string }) =>
      ipcRenderer.invoke('vault:createFolder', params),
    deleteFolder: (params: { id: string; recursive?: boolean }) =>
      ipcRenderer.invoke('vault:deleteFolder', params),
    attachFile: (params: { document_id: string; file_path: string }) =>
      ipcRenderer.invoke('vault:attachFile', params),
    // Event listeners
    onDocumentCreated: (callback: (doc: unknown) => void) => {
      const listener = (_: unknown, doc: unknown) => callback(doc);
      ipcRenderer.on('vault:document-created', listener);
      return () => ipcRenderer.removeListener('vault:document-created', listener);
    },
    onDocumentUpdated: (callback: (doc: unknown) => void) => {
      const listener = (_: unknown, doc: unknown) => callback(doc);
      ipcRenderer.on('vault:document-updated', listener);
      return () => ipcRenderer.removeListener('vault:document-updated', listener);
    },
    onDocumentDeleted: (callback: (event: { id: string }) => void) => {
      const listener = (_: unknown, event: { id: string }) => callback(event);
      ipcRenderer.on('vault:document-deleted', listener);
      return () => ipcRenderer.removeListener('vault:document-deleted', listener);
    },
  },

  // CLI Paths management
  cliPaths: {
    detect: () =>
      ipcRenderer.invoke('cliPaths:detect'),
    get: () =>
      ipcRenderer.invoke('cliPaths:get'),
    save: (paths: { claude: string; gh: string; node: string; additionalPaths: string[] }) =>
      ipcRenderer.invoke('cliPaths:save', paths),
  },

  // Updates
  updates: {
    check: () => ipcRenderer.invoke('app:checkForUpdates'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    onUpdateAvailable: (callback: (info: { currentVersion: string; latestVersion: string; downloadUrl: string; releaseUrl: string; releaseNotes: string; hasUpdate: boolean }) => void) => {
      const listener = (_: unknown, info: Parameters<typeof callback>[0]) => callback(info);
      ipcRenderer.on('app:update-available', listener);
      return () => ipcRenderer.removeListener('app:update-available', listener);
    },
  },

  // Platform info
  platform: process.platform,
});
