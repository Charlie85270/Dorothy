/**
 * Kanban Board Types
 *
 * Task management with automatic agent spawning when tasks move to "planned" column.
 */

export type KanbanColumn = 'backlog' | 'planned' | 'ongoing' | 'done';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskAttachment {
  path: string;                  // Full file path
  name: string;                  // Display name (filename)
  type: 'image' | 'pdf' | 'document' | 'other';
  size?: number;                 // File size in bytes
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  column: KanbanColumn;
  projectId: string;
  projectPath: string;           // For agent spawning
  assignedAgentId: string | null;
  agentCreatedForTask: boolean;  // If true, delete agent when task completes
  requiredSkills: string[];      // For agent matching
  priority: 'low' | 'medium' | 'high';
  progress: number;              // 0-100, synced from agent
  createdAt: string;
  updatedAt: string;
  completedAt?: string;          // When task was marked done
  order: number;                 // Position in column
  labels: string[];
  completionSummary?: string;    // Summary of what was done by the agent
  attachments: TaskAttachment[]; // Files attached to the task
  subtasks: Subtask[];
}

export interface KanbanTaskCreate {
  title: string;
  description: string;
  projectId: string;
  projectPath: string;
  requiredSkills?: string[];
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
  attachments?: TaskAttachment[];
}

export interface KanbanTaskUpdate {
  id: string;
  title?: string;
  description?: string;
  requiredSkills?: string[];
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
  progress?: number;
  assignedAgentId?: string | null;
  completionSummary?: string;
  subtasks?: Subtask[];
}

export interface KanbanMoveResult {
  success: boolean;
  task?: KanbanTask;
  agentSpawned?: boolean;
  agentId?: string;
  error?: string;
}

export const COLUMN_CONFIG: Record<KanbanColumn, { title: string; description: string; color: string }> = {
  backlog: {
    title: 'Backlog',
    description: 'Tasks waiting to be planned',
    color: 'gray',
  },
  planned: {
    title: 'Planned',
    description: 'Ready for agent assignment',
    color: 'blue',
  },
  ongoing: {
    title: 'Ongoing',
    description: 'Agent is working on it',
    color: 'amber',
  },
  done: {
    title: 'Done',
    description: 'Completed tasks',
    color: 'green',
  },
};

export const COLUMN_ORDER: KanbanColumn[] = ['backlog', 'planned', 'ongoing', 'done'];
