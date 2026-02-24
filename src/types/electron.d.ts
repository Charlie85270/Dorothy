export interface AgentEvent {
  type: string;
  agentId: string;
  ptyId?: string;
  data: string;
  timestamp: string;
  exitCode?: number;
}

export interface KanbanTaskElectron {
  id: string;
  title: string;
  description: string;
  column: 'backlog' | 'planned' | 'ongoing' | 'done';
  projectId: string;
  projectPath: string;
  assignedAgentId: string | null;
  requiredSkills: string[];
  priority: 'low' | 'medium' | 'high';
  progress: number;
  createdAt: string;
  updatedAt: string;
  order: number;
  labels: string[];
}

export interface VaultDocumentElectron {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  author: string;
  agent_id: string | null;
  tags: string; // JSON array string
  created_at: string;
  updated_at: string;
  snippet?: string; // From FTS search results
}

export interface VaultFolderElectron {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultAttachmentElectron {
  id: string;
  document_id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  created_at: string;
}

export interface MemoryFile {
  name: string;
  path: string;
  content: string;
  size: number;
  lastModified: string;
  isEntrypoint: boolean;
}

export interface ProjectMemory {
  id: string;
  projectName: string;
  projectPath: string;
  memoryDir: string;
  files: MemoryFile[];
  totalSize: number;
  lastModified: string;
  hasMemory: boolean;
}

export interface ImportPreview {
  name: string;
  description: string;
  width: number;
  height: number;
  npcCount: number;
  buildingCount: number;
  screenshot: string;
}

export interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

export type AgentCharacter = 'robot' | 'ninja' | 'wizard' | 'astronaut' | 'knight' | 'pirate' | 'alien' | 'viking' | 'frog';

export type AgentProvider = 'claude' | 'local';

export interface AgentStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'waiting';
  projectPath: string;
  secondaryProjectPath?: string; // Secondary project added via --add-dir
  worktreePath?: string;
  branchName?: string;
  skills: string[];
  currentTask?: string;
  output: string[];
  lastActivity: string;
  error?: string;
  ptyId?: string;
  character?: AgentCharacter;
  name?: string;
  pathMissing?: boolean; // True if project path no longer exists
  skipPermissions?: boolean; // If true, use --dangerously-skip-permissions flag
  provider?: AgentProvider;   // 'claude' (default) or 'local' (Tasmania)
  localModel?: string;        // Tasmania model name when provider is 'local'
}

export interface PtyDataEvent {
  id: string;
  data: string;
}

export interface PtyExitEvent {
  id: string;
  exitCode: number;
}

export interface SkillInstallOutputEvent {
  repo: string;
  data: string;
}

export interface ElectronAPI {
  // PTY terminal management
  pty: {
    create: (params: { cwd?: string; cols?: number; rows?: number }) => Promise<{ id: string }>;
    write: (params: { id: string; data: string }) => Promise<{ success: boolean }>;
    resize: (params: { id: string; cols: number; rows: number }) => Promise<{ success: boolean }>;
    kill: (params: { id: string }) => Promise<{ success: boolean }>;
    onData: (callback: (event: PtyDataEvent) => void) => () => void;
    onExit: (callback: (event: PtyExitEvent) => void) => () => void;
  };

  // Agent management
  agent: {
    create: (config: {
      projectPath: string;
      skills: string[];
      worktree?: WorktreeConfig;
      character?: AgentCharacter;
      name?: string;
      secondaryProjectPath?: string;
      skipPermissions?: boolean;
      provider?: AgentProvider;
      localModel?: string;
    }) => Promise<AgentStatus & { ptyId: string }>;
    update: (params: {
      id: string;
      skills?: string[];
      secondaryProjectPath?: string | null;
      skipPermissions?: boolean;
      name?: string;
      character?: AgentCharacter;
    }) => Promise<{ success: boolean; error?: string; agent?: AgentStatus }>;
    start: (params: { id: string; prompt: string; options?: { model?: string; resume?: boolean; provider?: AgentProvider; localModel?: string } }) => Promise<{ success: boolean }>;
    get: (id: string) => Promise<AgentStatus | null>;
    list: () => Promise<AgentStatus[]>;
    stop: (id: string) => Promise<{ success: boolean }>;
    remove: (id: string) => Promise<{ success: boolean }>;
    sendInput: (params: { id: string; input: string }) => Promise<{ success: boolean }>;
    resize: (params: { id: string; cols: number; rows: number }) => Promise<{ success: boolean }>;
    setSecondaryProject: (params: { id: string; secondaryProjectPath: string | null }) => Promise<{ success: boolean; error?: string; agent?: AgentStatus }>;
    onOutput: (callback: (event: AgentEvent) => void) => () => void;
    onError: (callback: (event: AgentEvent) => void) => () => void;
    onComplete: (callback: (event: AgentEvent) => void) => () => void;
    onToolUse: (callback: (event: AgentEvent) => void) => () => void;
    onStatus?: (callback: (event: { type: string; agentId: string; status: string; timestamp: string }) => void) => () => void;
  };

  // Skills management
  skill: {
    install: (repo: string) => Promise<{ success: boolean; output?: string; message?: string }>;
    installStart: (params: { repo: string; cols?: number; rows?: number }) => Promise<{ id: string; repo: string }>;
    installWrite: (params: { id: string; data: string }) => Promise<{ success: boolean }>;
    installResize: (params: { id: string; cols: number; rows: number }) => Promise<{ success: boolean }>;
    installKill: (params: { id: string }) => Promise<{ success: boolean }>;
    listInstalled: () => Promise<string[]>;
    onPtyData: (callback: (event: { id: string; data: string }) => void) => () => void;
    onPtyExit: (callback: (event: { id: string; exitCode: number }) => void) => () => void;
    onInstallOutput: (callback: (event: SkillInstallOutputEvent) => void) => () => void;
  };

  // Plugin management (with in-app terminal)
  plugin?: {
    installStart: (params: { command: string; cols?: number; rows?: number }) => Promise<{ id: string; command: string }>;
    installWrite: (params: { id: string; data: string }) => Promise<{ success: boolean }>;
    installResize: (params: { id: string; cols: number; rows: number }) => Promise<{ success: boolean }>;
    installKill: (params: { id: string }) => Promise<{ success: boolean }>;
    onPtyData: (callback: (event: { id: string; data: string }) => void) => () => void;
    onPtyExit: (callback: (event: { id: string; exitCode: number }) => void) => () => void;
  };

  // File system
  fs: {
    listProjects: () => Promise<{ path: string; name: string; lastModified: string }[]>;
  };

  // Claude data
  claude: {
    getData: () => Promise<{
      settings: unknown;
      stats: unknown;
      projects: unknown[];
      plugins: unknown[];
      skills: Array<{ name: string; source: 'project' | 'user' | 'plugin'; path: string; description?: string; projectName?: string }>;
      history: Array<{ display: string; timestamp: number; project?: string }>;
      activeSessions: string[];
    } | null>;
  };

  // Settings
  settings: {
    get: () => Promise<{
      enabledPlugins: Record<string, boolean>;
      env: Record<string, string>;
      hooks: Record<string, unknown>;
      includeCoAuthoredBy: boolean;
      permissions: { allow: string[]; deny: string[] };
    } | null>;
    save: (settings: {
      enabledPlugins?: Record<string, boolean>;
      env?: Record<string, string>;
      hooks?: Record<string, unknown>;
      includeCoAuthoredBy?: boolean;
      permissions?: { allow: string[]; deny: string[] };
    }) => Promise<{ success: boolean; error?: string }>;
    getInfo: () => Promise<{
      claudeVersion: string;
      configPath: string;
      settingsPath: string;
      platform: string;
      arch: string;
      nodeVersion: string;
      electronVersion: string;
    } | null>;
  };

  // App settings (notifications, etc.)
  appSettings?: {
    get: () => Promise<{
      notificationsEnabled: boolean;
      notifyOnWaiting: boolean;
      notifyOnComplete: boolean;
      notifyOnError: boolean;
      telegramEnabled: boolean;
      telegramBotToken: string;
      telegramChatId: string;
      telegramAuthToken: string;
      telegramAuthorizedChatIds: string[];
      telegramRequireMention: boolean;
      slackEnabled: boolean;
      slackBotToken: string;
      slackAppToken: string;
      slackSigningSecret: string;
      slackChannelId: string;
      jiraEnabled: boolean;
      jiraDomain: string;
      jiraEmail: string;
      jiraApiToken: string;
      socialDataEnabled: boolean;
      socialDataApiKey: string;
      tasmaniaEnabled: boolean;
      tasmaniaServerPath: string;
      cliPaths?: {
        claude: string;
        gh: string;
        node: string;
        additionalPaths: string[];
      };
    }>;
    save: (settings: {
      notificationsEnabled?: boolean;
      notifyOnWaiting?: boolean;
      notifyOnComplete?: boolean;
      notifyOnError?: boolean;
      telegramEnabled?: boolean;
      telegramBotToken?: string;
      telegramChatId?: string;
      telegramAuthToken?: string;
      telegramAuthorizedChatIds?: string[];
      telegramRequireMention?: boolean;
      slackEnabled?: boolean;
      slackBotToken?: string;
      slackAppToken?: string;
      slackSigningSecret?: string;
      slackChannelId?: string;
      jiraEnabled?: boolean;
      jiraDomain?: string;
      jiraEmail?: string;
      jiraApiToken?: string;
      socialDataEnabled?: boolean;
      socialDataApiKey?: string;
      tasmaniaEnabled?: boolean;
      tasmaniaServerPath?: string;
      cliPaths?: {
        claude: string;
        gh: string;
        node: string;
        additionalPaths: string[];
      };
    }) => Promise<{ success: boolean; error?: string }>;
    onUpdated?: (callback: (settings: unknown) => void) => () => void;
  };

  // Telegram bot
  telegram?: {
    test: () => Promise<{ success: boolean; botName?: string; error?: string }>;
    sendTest: () => Promise<{ success: boolean; error?: string }>;
    generateAuthToken: () => Promise<{ success: boolean; token?: string; error?: string }>;
    removeAuthorizedChatId: (chatId: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Slack bot
  slack?: {
    test: () => Promise<{ success: boolean; botName?: string; error?: string }>;
    sendTest: () => Promise<{ success: boolean; error?: string }>;
  };

  // JIRA
  jira?: {
    test: () => Promise<{ success: boolean; displayName?: string; email?: string; error?: string }>;
  };

  // SocialData (Twitter/X)
  socialData?: {
    test: () => Promise<{ success: boolean; error?: string }>;
  };

  // X API (posting)
  xApi?: {
    test: () => Promise<{ success: boolean; username?: string; error?: string }>;
  };

  // Tasmania (Local LLM)
  tasmania?: {
    test: () => Promise<{ success: boolean; serverExists: boolean; apiReachable: boolean; error?: string }>;
    getStatus: () => Promise<{
      status: 'stopped' | 'starting' | 'running' | 'error';
      backend: string | null;
      port: number | null;
      modelName: string | null;
      modelPath: string | null;
      endpoint: string | null;
      startedAt: number | null;
      error?: string;
    }>;
    getModels: () => Promise<{
      models: Array<{
        name: string;
        filename: string;
        path: string;
        sizeBytes: number;
        repo: string | null;
        quantization: string | null;
        parameters: string | null;
        architecture: string | null;
      }>;
      error?: string;
    }>;
    loadModel: (modelPath: string) => Promise<{ success: boolean; error?: string }>;
    stopModel: () => Promise<{ success: boolean; error?: string }>;
    getMcpStatus: () => Promise<{ configured: boolean; error?: string }>;
    setup: () => Promise<{ success: boolean; error?: string }>;
    remove: () => Promise<{ success: boolean; error?: string }>;
  };

  // Dialogs
  dialog: {
    openFolder: () => Promise<string | null>;
    openFiles: () => Promise<string[]>;
  };

  // Shell operations
  shell: {
    openTerminal: (params: { cwd: string; command?: string }) => Promise<{ success: boolean }>;
    exec: (params: { command: string; cwd?: string }) => Promise<{ success: boolean; output?: string; error?: string; code?: number }>;
    // Quick terminal PTY
    startPty?: (params: { cwd?: string; cols?: number; rows?: number }) => Promise<string>;
    writePty?: (params: { ptyId: string; data: string }) => Promise<{ success: boolean }>;
    resizePty?: (params: { ptyId: string; cols: number; rows: number }) => Promise<{ success: boolean }>;
    killPty?: (params: { ptyId: string }) => Promise<{ success: boolean }>;
    onPtyOutput?: (callback: (event: { ptyId: string; data: string }) => void) => () => void;
    onPtyExit?: (callback: (event: { ptyId: string; exitCode: number }) => void) => () => void;
  };

  // Orchestrator (Super Agent) management
  orchestrator?: {
    getStatus: () => Promise<{
      configured: boolean;
      orchestratorPath?: string;
      orchestratorExists?: boolean;
      currentConfig?: unknown;
      reason?: string;
      error?: string;
    }>;
    setup: () => Promise<{
      success: boolean;
      path?: string;
      error?: string;
    }>;
    remove: () => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  // Scheduler (native implementation)
  scheduler?: {
    listTasks: () => Promise<{
      tasks: Array<{
        id: string;
        prompt: string;
        schedule: string;
        scheduleHuman: string;
        projectPath: string;
        agentId?: string;
        agentName?: string;
        autonomous: boolean;
        worktree?: {
          enabled: boolean;
          branchPrefix?: string;
        };
        notifications: {
          telegram: boolean;
          slack: boolean;
        };
        createdAt: string;
        lastRun?: string;
        lastRunStatus?: 'success' | 'error' | 'running' | 'partial';
        nextRun?: string;
      }>;
    }>;
    createTask: (params: {
      title?: string;
      agentId?: string;
      prompt: string;
      schedule: string;
      projectPath: string;
      autonomous: boolean;
      useWorktree?: boolean;
      notifications?: {
        telegram: boolean;
        slack: boolean;
      };
    }) => Promise<{ success: boolean; error?: string; taskId?: string }>;
    deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    updateTask: (taskId: string, updates: {
      title?: string;
      prompt?: string;
      schedule?: string;
      projectPath?: string;
      autonomous?: boolean;
      notifications?: { telegram: boolean; slack: boolean };
    }) => Promise<{ success: boolean; error?: string }>;
    runTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    getLogs: (taskId: string) => Promise<{
      logs: string;
      runs?: Array<{ startedAt: string; completedAt?: string; content: string }>;
      error?: string;
    }>;
    fixMcpPaths: () => Promise<{ success: boolean; error?: string }>;
    watchLogs: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    unwatchLogs: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    onLogData: (callback: (event: { taskId: string; data: string }) => void) => () => void;
    onTaskStatus: (callback: (event: { taskId: string; status: string; summary?: string }) => void) => () => void;
  };

  // Automations
  automation?: {
    list: () => Promise<{
      automations: Array<{
        id: string;
        name: string;
        description?: string;
        enabled: boolean;
        createdAt: string;
        updatedAt: string;
        schedule: { type: 'cron' | 'interval'; cron?: string; intervalMinutes?: number };
        source: { type: string; config: Record<string, unknown> };
        trigger: { eventTypes: string[]; onNewItem: boolean; onUpdatedItem?: boolean };
        agent: { enabled: boolean; projectPath?: string; prompt: string; model?: string };
        outputs: Array<{ type: string; enabled: boolean; template?: string }>;
      }>;
    }>;
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
    } | Record<string, unknown>) => Promise<{ success: boolean; error?: string; automationId?: string }>;
    update: (id: string, params: { enabled?: boolean; name?: string }) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    run: (id: string) => Promise<{ success: boolean; error?: string; itemsProcessed?: number; itemsFound?: number }>;
    getLogs: (id: string) => Promise<{
      runs: Array<{
        id: string;
        startedAt: string;
        completedAt?: string;
        content: string;
        status: 'completed' | 'error' | 'running';
      }>;
      logs: string;
      error?: string;
    }>;
  };

  // CLI paths management
  cliPaths?: {
    detect: () => Promise<{
      claude: string;
      gh: string;
      node: string;
    }>;
    get: () => Promise<{
      claude: string;
      gh: string;
      node: string;
      additionalPaths: string[];
    }>;
    save: (paths: {
      claude: string;
      gh: string;
      node: string;
      additionalPaths: string[];
    }) => Promise<{ success: boolean; error?: string }>;
  };

  // Vault
  vault?: {
    listDocuments: (params?: { folder_id?: string; tags?: string[] }) => Promise<{ documents: VaultDocumentElectron[]; error?: string }>;
    getDocument: (id: string) => Promise<{ document?: VaultDocumentElectron; attachments?: VaultAttachmentElectron[]; error?: string }>;
    createDocument: (params: {
      title: string;
      content: string;
      folder_id?: string;
      author: string;
      agent_id?: string;
      tags?: string[];
    }) => Promise<{ success: boolean; document?: VaultDocumentElectron; error?: string }>;
    updateDocument: (params: {
      id: string;
      title?: string;
      content?: string;
      tags?: string[];
      folder_id?: string | null;
    }) => Promise<{ success: boolean; document?: VaultDocumentElectron; error?: string }>;
    deleteDocument: (id: string) => Promise<{ success: boolean; error?: string }>;
    search: (params: { query: string; limit?: number }) => Promise<{ results: VaultDocumentElectron[]; error?: string }>;
    listFolders: () => Promise<{ folders: VaultFolderElectron[]; error?: string }>;
    createFolder: (params: { name: string; parent_id?: string }) => Promise<{ success: boolean; folder?: VaultFolderElectron; error?: string }>;
    deleteFolder: (params: { id: string; recursive?: boolean }) => Promise<{ success: boolean; error?: string }>;
    attachFile: (params: { document_id: string; file_path: string }) => Promise<{ success: boolean; attachment?: VaultAttachmentElectron; error?: string }>;
    onDocumentCreated: (callback: (doc: VaultDocumentElectron) => void) => () => void;
    onDocumentUpdated: (callback: (doc: VaultDocumentElectron) => void) => () => void;
    onDocumentDeleted: (callback: (event: { id: string }) => void) => () => void;
  };

  // Kanban board
  kanban?: {
    list: () => Promise<{ tasks: KanbanTaskElectron[]; error?: string }>;
    get: (id: string) => Promise<{ success: boolean; task?: KanbanTaskElectron; error?: string }>;
    create: (params: {
      title: string;
      description: string;
      projectId: string;
      projectPath: string;
      requiredSkills?: string[];
      priority?: 'low' | 'medium' | 'high';
      labels?: string[];
    }) => Promise<{ success: boolean; task?: KanbanTaskElectron; error?: string }>;
    update: (params: {
      id: string;
      title?: string;
      description?: string;
      requiredSkills?: string[];
      priority?: 'low' | 'medium' | 'high';
      labels?: string[];
      progress?: number;
      assignedAgentId?: string | null;
    }) => Promise<{ success: boolean; task?: KanbanTaskElectron; error?: string }>;
    move: (params: {
      id: string;
      column: 'backlog' | 'planned' | 'ongoing' | 'done';
      order?: number;
    }) => Promise<{
      success: boolean;
      task?: KanbanTaskElectron;
      agentSpawned?: boolean;
      agentId?: string;
      error?: string;
    }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    reorder: (params: {
      taskIds: string[];
      column: 'backlog' | 'planned' | 'ongoing' | 'done';
    }) => Promise<{ success: boolean; error?: string }>;
    generate: (params: {
      prompt: string;
      availableProjects: Array<{ path: string; name: string }>;
    }) => Promise<{
      success: boolean;
      task?: {
        title: string;
        description: string;
        projectPath: string;
        projectId: string;
        priority: 'low' | 'medium' | 'high';
        labels: string[];
        requiredSkills: string[];
      };
      error?: string;
    }>;
    onTaskCreated: (callback: (task: KanbanTaskElectron) => void) => () => void;
    onTaskUpdated: (callback: (task: KanbanTaskElectron) => void) => () => void;
    onTaskDeleted: (callback: (event: { id: string }) => void) => () => void;
  };

  // World (generative zones)
  world?: {
    listZones: () => Promise<{ zones: unknown[]; error?: string }>;
    getZone: (zoneId: string) => Promise<{ zone: unknown | null; error?: string }>;
    exportZone: (params: { zoneId: string; screenshot: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    importZone: () => Promise<{ success: boolean; preview?: ImportPreview; zone?: unknown; error?: string }>;
    confirmImport: (zone: unknown) => Promise<{ success: boolean; zoneId?: string; error?: string }>;
    deleteZone: (zoneId: string) => Promise<{ success: boolean; error?: string }>;
    onZoneUpdated: (callback: (zone: unknown) => void) => () => void;
    onZoneDeleted: (callback: (event: { id: string }) => void) => () => void;
  };

  // Updates
  updates?: {
    check: () => Promise<{
      currentVersion: string;
      latestVersion: string;
      downloadUrl: string;
      releaseUrl: string;
      releaseNotes: string;
      hasUpdate: boolean;
    } | null>;
    openExternal: (url: string) => Promise<{ success: boolean }>;
    onUpdateAvailable: (callback: (info: {
      currentVersion: string;
      latestVersion: string;
      downloadUrl: string;
      releaseUrl: string;
      releaseNotes: string;
      hasUpdate: boolean;
    }) => void) => () => void;
  };

  // Native Claude memory (reads ~/.claude/projects/*/memory/)
  memory?: {
    listProjects: () => Promise<{ projects: ProjectMemory[]; error: string | null }>;
    readFile: (filePath: string) => Promise<{ content: string; error?: string }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    createFile: (memoryDir: string, fileName: string, content?: string) => Promise<{ success: boolean; file?: MemoryFile; error?: string }>;
    deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };

  // API
  api?: {
    getToken: () => Promise<string>;
  };

  // Get home path helper
  getHomePath?: () => string;

  // Platform info
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
