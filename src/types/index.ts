export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'completed';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type ProjectStatus = 'active' | 'archived' | 'paused';

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'code' | 'design' | 'data' | 'devops' | 'general';
  enabled: boolean;
}

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  model: 'opus' | 'sonnet' | 'haiku';
  currentTask: string | null;
  assignedProject: string | null;
  skills: string[];
  tokensUsed: number;
  tasksCompleted: number;
  createdAt: Date;
  lastActive: Date;
  logs: LogEntry[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  progress: number;
  assignedAgent: string | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  subtasks: Subtask[];
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  status: ProjectStatus;
  agents: string[];
  tasks: string[];
  createdAt: Date;
  updatedAt: Date;
  color: string;
}

export interface Entity {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'module';
  path: string;
  projectId: string;
  references: number;
  lastModified: Date;
}

export interface Chat {
  id: string;
  title: string;
  projectId: string | null;
  agentId: string | null;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  totalProjects: number;
  tokensUsedToday: number;
}
