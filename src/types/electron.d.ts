export interface AgentEvent {
  type: string;
  agentId: string;
  ptyId?: string;
  data: string;
  timestamp: string;
  exitCode?: number;
}

export interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

export type AgentCharacter = 'robot' | 'ninja' | 'wizard' | 'astronaut' | 'knight' | 'pirate' | 'alien' | 'viking' | 'frog';

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
    }) => Promise<AgentStatus & { ptyId: string }>;
    start: (params: { id: string; prompt: string; options?: { model?: string; resume?: boolean } }) => Promise<{ success: boolean }>;
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
    }>;
    save: (settings: {
      notificationsEnabled?: boolean;
      notifyOnWaiting?: boolean;
      notifyOnComplete?: boolean;
      notifyOnError?: boolean;
    }) => Promise<{ success: boolean; error?: string }>;
  };

  // Dialogs
  dialog: {
    openFolder: () => Promise<string | null>;
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

  // Platform info
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
