import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { KANBAN_FILE, DATA_DIR } from '../constants';
import { generateTaskFromPrompt } from '../utils/kanban-generate';

// Helper: sync kanban column transitions to Linear issue status
async function syncKanbanToLinear(task: KanbanTask, targetColumn: KanbanColumn): Promise<void> {
  const linearLabel = task.labels?.find(l => l.startsWith('linear:') && l !== 'linear');
  if (!linearLabel) return;

  const identifier = linearLabel.replace('linear:', '');

  // Load Linear API key from app settings
  let linearApiKey: string | null = null;
  try {
    const settingsFile = path.join(os.homedir(), '.dorothy', 'app-settings.json');
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      if (settings.linearEnabled && settings.linearApiKey) {
        linearApiKey = settings.linearApiKey;
      }
    }
  } catch {
    return;
  }

  if (!linearApiKey) return;

  // Map kanban column to Linear state
  let targetState: string | null = null;
  let comment: string | null = null;

  switch (targetColumn) {
    case 'ongoing':
      targetState = 'In Progress';
      break;
    case 'done':
      targetState = 'Done';
      comment = `Task completed via Dorothy kanban board.${task.completionSummary ? `\n\n${task.completionSummary}` : ''}`;
      break;
    default:
      return; // No sync needed for backlog/planned
  }

  try {
    const [teamKey, numberStr] = identifier.split('-');
    const issueNumber = parseInt(numberStr, 10);

    // Find the issue ID
    const lookupRes = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Authorization': linearApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ issueSearch(filter: { number: { eq: ${issueNumber} }, team: { key: { eq: "${teamKey}" } } }, first: 1) { nodes { id } } }`,
      }),
    });

    if (!lookupRes.ok) return;
    const lookupData = await lookupRes.json();
    const issueId = lookupData.data?.issueSearch?.nodes?.[0]?.id;
    if (!issueId) return;

    // Transition if needed
    if (targetState) {
      const statesRes = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': linearApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ workflowStates(filter: { team: { key: { eq: "${teamKey}" } } }) { nodes { id name } } }`,
        }),
      });
      if (statesRes.ok) {
        const statesData = await statesRes.json();
        const states = statesData.data?.workflowStates?.nodes || [];
        const matchingState = states.find((s: { name: string }) =>
          s.name.toLowerCase() === targetState!.toLowerCase()
        );
        if (matchingState) {
          await fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: { 'Authorization': linearApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `mutation { issueUpdate(id: "${issueId}", input: { stateId: "${matchingState.id}" }) { success } }`,
            }),
          });
        }
      }
    }

    // Add comment if needed
    if (comment) {
      const escapedBody = comment.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Authorization': linearApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { commentCreate(input: { issueId: "${issueId}", body: "${escapedBody}" }) { success } }`,
        }),
      });
    }
  } catch (err) {
    console.error('Failed to sync kanban status to Linear:', err);
  }
}

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

      // Sync kanban status to Linear (fire-and-forget for ongoing/done transitions)
      if (targetColumn === 'ongoing' || targetColumn === 'done') {
        syncKanbanToLinear(task, targetColumn).catch(err =>
          console.error('Linear sync error:', err)
        );
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

        // Queue auto-advance: if this is a Linear task, move next backlog item to planned
        const linearLabelForQueue = task.labels?.find(l => l.startsWith('linear:') && l !== 'linear');
        if (linearLabelForQueue) {
          try {
            const allTasks = loadTasks();
            // Find other Linear backlog tasks from the same source (have 'linear' label)
            const nextBacklogTask = allTasks
              .filter(t => t.column === 'backlog' && t.labels?.includes('linear') && t.id !== task.id)
              .sort((a, b) => a.order - b.order)[0];

            if (nextBacklogTask) {
              console.log(`Queue auto-advance: moving "${nextBacklogTask.title}" to planned`);
              // Emit a synthetic move event via IPC (will be handled by the same move handler)
              // Use setTimeout to avoid re-entrancy
              setTimeout(() => {
                deps?.getMainWindow()?.webContents.send('kanban:auto-advance', {
                  taskId: nextBacklogTask.id,
                  column: 'planned',
                });
              }, 2000);
            }
          } catch (queueErr) {
            console.error('Queue auto-advance error:', queueErr);
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

          // Add JIRA-specific project discovery instructions
          const isJiraTask = task.labels?.some(l => l.startsWith('jira:'));
          if (isJiraTask) {
            prompt += '\n\n## Project Discovery\n';
            prompt += 'This task originates from JIRA. The configured project path may not be exact.\n';
            prompt += 'Before starting work, verify you are in the correct project directory:\n';
            prompt += '1. Check if the current working directory contains the relevant codebase\n';
            prompt += '2. If not, search for the project by listing directories under ~/Documents, ~/Projects, ~/repos, or ~/Desktop\n';
            prompt += '3. Look for directory names that match the JIRA project name, key, or related repository\n';
            prompt += '4. Use `ls` and `find` to locate the right project, then `cd` into it before starting work\n';
            prompt += '5. If you cannot find the project, proceed with the task in the current directory and note this in your completion summary\n';
          }

          // Add Linear-specific instructions
          const linearLabel = task.labels?.find(l => l.startsWith('linear:') && l !== 'linear');
          if (linearLabel) {
            const linearIdentifier = linearLabel.replace('linear:', '');
            prompt += '\n\n## Linear Integration\n';
            prompt += `This task originates from Linear issue **${linearIdentifier}**.\n\n`;
            prompt += `1. Call \`get_linear_issue\` with identifier "${linearIdentifier}" to read the full ticket details before starting.\n`;
            prompt += '2. Work through the requirements described in the issue.\n';
            prompt += `3. When done, call \`update_linear_issue\` with identifier "${linearIdentifier}" to:\n`;
            prompt += '   - Add a comment summarizing what you accomplished\n';
            prompt += '   - Transition the issue to "In Review" (stateName: "In Review")\n';

            // Add git workflow instructions
            const sanitizedId = linearIdentifier.toLowerCase();
            const sanitizedTitle = task.title
              .replace(/^\[.*?\]\s*/, '') // Remove [ENG-123] prefix
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 40);
            const branchName = `dorothy/${sanitizedId}-${sanitizedTitle}`;

            prompt += '\n\n## Git Workflow\n';
            prompt += `- Create a new branch: \`git checkout -b ${branchName}\`\n`;
            prompt += `- Commit with clear messages referencing ${linearIdentifier}\n`;
            prompt += `- When complete, create a PR: \`gh pr create --title "${linearIdentifier}: <short description>" --body "<summary of changes>"\`\n`;
            prompt += `- Call \`update_linear_issue\` to transition to "In Review" and comment with the PR link\n`;
            prompt += `- Call \`mark_task_done\` with the PR URL in the summary\n`;
          }

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

  // Generate task details from natural language prompt using Claude CLI
  ipcMain.handle('kanban:generate', async (_event, params: { prompt: string; availableProjects: Array<{ path: string; name: string }> }) => {
    const { prompt, availableProjects } = params;

    if (!prompt) {
      return { success: false, error: 'prompt is required' };
    }

    const task = await generateTaskFromPrompt(prompt, availableProjects);
    return { success: true, task };
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
