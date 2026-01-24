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
    }) => Promise<AgentStatus & { ptyId: string }>;
    start: (params: { id: string; prompt: string; options?: { model?: string; resume?: boolean } }) => Promise<{ success: boolean }>;
    get: (id: string) => Promise<AgentStatus | null>;
    list: () => Promise<AgentStatus[]>;
    stop: (id: string) => Promise<{ success: boolean }>;
    remove: (id: string) => Promise<{ success: boolean }>;
    sendInput: (params: { id: string; input: string }) => Promise<{ success: boolean }>;
    resize: (params: { id: string; cols: number; rows: number }) => Promise<{ success: boolean }>;
    onOutput: (callback: (event: AgentEvent) => void) => () => void;
    onError: (callback: (event: AgentEvent) => void) => () => void;
    onComplete: (callback: (event: AgentEvent) => void) => () => void;
    onToolUse: (callback: (event: AgentEvent) => void) => () => void;
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

  // Dialogs
  dialog: {
    openFolder: () => Promise<string | null>;
  };

  // Shell operations
  shell: {
    openTerminal: (params: { cwd: string; command?: string }) => Promise<{ success: boolean }>;
    exec: (params: { command: string; cwd?: string }) => Promise<{ success: boolean; output?: string; error?: string; code?: number }>;
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
