export interface AgentConfig {
  id: string;
  projectPath: string;
  skills: string[];
  prompt?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  createdAt: string; // ISO date string
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
  progress?: number;
  output: string[];
  lastActivity: string; // ISO date string
  error?: string;
  ptyId?: string;
  character?: AgentCharacter;
  name?: string;
  pathMissing?: boolean; // True if project path no longer exists
}

export interface AgentEvent {
  type: 'output' | 'status' | 'progress' | 'error' | 'complete' | 'tool_use' | 'thinking' | 'init';
  agentId: string;
  data: string;
  timestamp: string; // ISO date string
  agent?: AgentStatus;
}
