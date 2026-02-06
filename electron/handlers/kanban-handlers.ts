import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { KANBAN_FILE, DATA_DIR } from '../constants';

// ============================================
// Kanban Board IPC handlers
// ============================================

// Types matching frontend
type KanbanColumn = 'backlog' | 'planned' | 'ongoing' | 'done';

interface TaskAttachment {
  path: string;
  name: string;
  type: 'image' | 'pdf' | 'document' | 'other';
  size?: number;
}

interface KanbanTask {
  id: string;
  title: string;
  description: string;
  column: KanbanColumn;
  projectId: string;
  projectPath: string;
  assignedAgentId: string | null;
  agentCreatedForTask: boolean;
  requiredSkills: string[];
  priority: 'low' | 'medium' | 'high';
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  order: number;
  labels: string[];
  completionSummary?: string;
  attachments: TaskAttachment[];
}

interface KanbanTaskCreate {
  title: string;
  description: string;
  projectId: string;
  projectPath: string;
  requiredSkills?: string[];
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
  attachments?: TaskAttachment[];
}

interface KanbanTaskUpdate {
  id: string;
  title?: string;
  description?: string;
  requiredSkills?: string[];
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
  progress?: number;
  assignedAgentId?: string | null;
  completionSummary?: string;
}

// Dependencies interface
export interface KanbanHandlerDependencies {
  getMainWindow: () => BrowserWindow | null;
  findMatchingAgent: (projectPath: string, requiredSkills: string[]) => Promise<string | null>;
  createAgentForTask: (task: KanbanTask) => Promise<string>;
  startAgent: (agentId: string, prompt: string, kanbanTaskId?: string) => Promise<void>;
  stopAgent: (agentId: string) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  getAgentOutput: (agentId: string) => string[];
}

let deps: KanbanHandlerDependencies | null = null;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadTasks(): KanbanTask[] {
  ensureDir();
  if (!fs.existsSync(KANBAN_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(KANBAN_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveTasks(tasks: KanbanTask[]): void {
  ensureDir();
  fs.writeFileSync(KANBAN_FILE, JSON.stringify(tasks, null, 2));
}

function emitTaskEvent(eventName: string, task: KanbanTask): void {
  deps?.getMainWindow()?.webContents.send(eventName, task);
}

/**
 * Register all Kanban IPC handlers
 */
export function registerKanbanHandlers(dependencies: KanbanHandlerDependencies): void {
  deps = dependencies;

  // List all tasks
  ipcMain.handle('kanban:list', async () => {
    try {
      const tasks = loadTasks();
      return { tasks };
    } catch (err) {
      console.error('Error listing kanban tasks:', err);
      return { tasks: [], error: err instanceof Error ? err.message : 'Failed to list tasks' };
    }
  });

  // Create a new task (defaults to backlog)
  ipcMain.handle('kanban:create', async (_event, params: KanbanTaskCreate) => {
    try {
      const tasks = loadTasks();

      // Find max order in backlog for positioning
      const backlogTasks = tasks.filter(t => t.column === 'backlog');
      const maxOrder = backlogTasks.length > 0
        ? Math.max(...backlogTasks.map(t => t.order))
        : -1;

      const newTask: KanbanTask = {
        id: uuidv4(),
        title: params.title,
        description: params.description,
        column: 'backlog',
        projectId: params.projectId,
        projectPath: params.projectPath,
        assignedAgentId: null,
        agentCreatedForTask: false,
        requiredSkills: params.requiredSkills || [],
        priority: params.priority || 'medium',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        order: maxOrder + 1,
        labels: params.labels || [],
        attachments: params.attachments || [],
      };

      tasks.push(newTask);
      saveTasks(tasks);

      emitTaskEvent('kanban:task-created', newTask);

      return { success: true, task: newTask };
    } catch (err) {
      console.error('Error creating kanban task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create task' };
    }
  });

  // Update task properties (not column - use move for that)
  ipcMain.handle('kanban:update', async (_event, params: KanbanTaskUpdate) => {
    try {
      const tasks = loadTasks();
      const index = tasks.findIndex(t => t.id === params.id);

      if (index === -1) {
        return { success: false, error: 'Task not found' };
      }

      const task = tasks[index];

      // Update allowed fields
      if (params.title !== undefined) task.title = params.title;
      if (params.description !== undefined) task.description = params.description;
      if (params.requiredSkills !== undefined) task.requiredSkills = params.requiredSkills;
      if (params.priority !== undefined) task.priority = params.priority;
      if (params.labels !== undefined) task.labels = params.labels;
      if (params.progress !== undefined) task.progress = params.progress;
      if (params.assignedAgentId !== undefined) task.assignedAgentId = params.assignedAgentId;
      if (params.completionSummary !== undefined) task.completionSummary = params.completionSummary;

      task.updatedAt = new Date().toISOString();

      saveTasks(tasks);
      emitTaskEvent('kanban:task-updated', task);

      return { success: true, task };
    } catch (err) {
      console.error('Error updating kanban task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update task' };
    }
  });

  // Move task to a different column (triggers automation for planned)
  ipcMain.handle('kanban:move', async (_event, params: { id: string; column: KanbanColumn; order?: number }) => {
    try {
      const tasks = loadTasks();
      const index = tasks.findIndex(t => t.id === params.id);

      if (index === -1) {
        return { success: false, error: 'Task not found' };
      }

      const task = tasks[index];
      const previousColumn = task.column;
      const targetColumn = params.column;

      // Block moving ongoing tasks - they can only be deleted to stop
      if (previousColumn === 'ongoing' && targetColumn !== 'done') {
        console.log(`Blocked move: ongoing task "${task.title}" cannot be moved (delete to stop agent)`);
        return { success: false, error: 'Cannot move in-progress tasks. Delete to stop the agent.' };
      }

      // Block moving done tasks
      if (previousColumn === 'done') {
        console.log(`Blocked move: done task "${task.title}" cannot be moved`);
        return { success: false, error: 'Cannot move completed tasks.' };
      }

      // Calculate new order in target column
      const columnTasks = tasks.filter(t => t.column === targetColumn && t.id !== task.id);
      const newOrder = params.order ?? (columnTasks.length > 0
        ? Math.max(...columnTasks.map(t => t.order)) + 1
        : 0);

      // Update task
      task.column = targetColumn;
      task.order = newOrder;
      task.updatedAt = new Date().toISOString();

      // Reset progress when moving back to backlog
      if (targetColumn === 'backlog') {
        task.progress = 0;
        task.assignedAgentId = null;
      }

      // Set completedAt when moving to done and cleanup agent if needed
      if (targetColumn === 'done') {
        task.completedAt = new Date().toISOString();
        task.progress = 100;

        // Delete agent if it was created specifically for this task
        if (task.agentCreatedForTask && task.assignedAgentId && deps) {
          console.log(`Deleting agent ${task.assignedAgentId} created for task "${task.title}"`);
          try {
            await deps.deleteAgent(task.assignedAgentId);
          } catch (deleteErr) {
            console.error('Failed to delete agent:', deleteErr);
          }
        }
      }

      let agentSpawned = false;
      let agentId: string | null = null;

      // Trigger automation when moving to "planned"
      if (targetColumn === 'planned' && previousColumn !== 'planned' && deps) {
        console.log(`Task "${task.title}" moved to planned - triggering automation`);

        try {
          // Try to find a matching agent first
          agentId = await deps.findMatchingAgent(task.projectPath, task.requiredSkills);

          if (!agentId) {
            // Create a new agent for this task
            console.log('No matching agent found, creating new agent');
            agentId = await deps.createAgentForTask(task);
            agentSpawned = true;
            task.agentCreatedForTask = true;
          } else {
            console.log(`Found matching agent: ${agentId}`);
            task.agentCreatedForTask = false;
          }

          // Assign agent to task
          task.assignedAgentId = agentId;

          // Save task in planned state first (visual feedback)
          saveTasks(tasks);
          emitTaskEvent('kanban:task-updated', task);

          // Wait 3 seconds for visual feedback before moving to ongoing
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Move to ongoing
          task.column = 'ongoing';
          task.updatedAt = new Date().toISOString();

          // Save before starting agent
          saveTasks(tasks);
          emitTaskEvent('kanban:task-updated', task);

          // Build prompt from task
          let prompt = `# Task: ${task.title}\n\n${task.description}`;

          // Add attachments section if there are any
          if (task.attachments && task.attachments.length > 0) {
            prompt += '\n\n## Reference Files\n';
            prompt += 'The following files are attached for reference. Please read/view them to understand the context:\n\n';
            for (const attachment of task.attachments) {
              prompt += `- ${attachment.name}: \`${attachment.path}\`\n`;
            }
          }

          // Add task completion instructions
          prompt += '\n\n## Task Completion\n';
          prompt += `**Task ID:** \`${task.id}\`\n\n`;
          prompt += `**IMPORTANT:** When you have completed this task, you MUST call the \`mark_task_done\` MCP tool with:\n`;
          prompt += `- \`task_id\`: \`${task.id}\`\n`;
          prompt += `- \`summary\`: A brief 1-3 sentence summary of what you accomplished\n\n`;
          prompt += `This will move the task to the "Done" column on the kanban board.`;

          // Start the agent with kanban task ID for hook-based completion
          await deps.startAgent(agentId, prompt, task.id);

          console.log(`Agent ${agentId} started for task "${task.title}" (kanban task: ${task.id})`);
        } catch (automationErr) {
          console.error('Automation error:', automationErr);
          // Task stays in planned if automation fails
          task.column = 'planned';
        }
      }

      saveTasks(tasks);
      emitTaskEvent('kanban:task-updated', task);

      return {
        success: true,
        task,
        agentSpawned,
        agentId,
      };
    } catch (err) {
      console.error('Error moving kanban task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to move task' };
    }
  });

  // Delete a task (stops agent if ongoing)
  ipcMain.handle('kanban:delete', async (_event, id: string) => {
    try {
      const tasks = loadTasks();
      const index = tasks.findIndex(t => t.id === id);

      if (index === -1) {
        return { success: false, error: 'Task not found' };
      }

      const [deletedTask] = tasks.splice(index, 1);

      // Stop the agent if task was in progress
      if (deletedTask.assignedAgentId && deletedTask.column === 'ongoing' && deps) {
        console.log(`Stopping agent ${deletedTask.assignedAgentId} for deleted task "${deletedTask.title}"`);
        try {
          await deps.stopAgent(deletedTask.assignedAgentId);
        } catch (stopErr) {
          console.error('Failed to stop agent:', stopErr);
          // Continue with deletion even if stop fails
        }
      }

      saveTasks(tasks);

      deps?.getMainWindow()?.webContents.send('kanban:task-deleted', { id });

      return { success: true };
    } catch (err) {
      console.error('Error deleting kanban task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete task' };
    }
  });

  // Reorder tasks within a column
  ipcMain.handle('kanban:reorder', async (_event, params: { taskIds: string[]; column: KanbanColumn }) => {
    try {
      const tasks = loadTasks();

      // Update order for each task in the array
      params.taskIds.forEach((taskId, index) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.column === params.column) {
          task.order = index;
          task.updatedAt = new Date().toISOString();
        }
      });

      saveTasks(tasks);

      // Emit update for all affected tasks
      params.taskIds.forEach(taskId => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          emitTaskEvent('kanban:task-updated', task);
        }
      });

      return { success: true };
    } catch (err) {
      console.error('Error reordering kanban tasks:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to reorder tasks' };
    }
  });

  // Get a single task by ID
  ipcMain.handle('kanban:get', async (_event, id: string) => {
    try {
      const tasks = loadTasks();
      const task = tasks.find(t => t.id === id);

      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      return { success: true, task };
    } catch (err) {
      console.error('Error getting kanban task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get task' };
    }
  });
}

// Export for direct use in automation service
export { loadTasks, saveTasks, emitTaskEvent };
export type { KanbanTask, KanbanColumn };
