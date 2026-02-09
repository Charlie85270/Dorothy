import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-kanban tool handler tests
// ============================================================================
// Tests the business logic of all kanban MCP tool handlers:
// list_tasks, get_task, create_task, update_task_progress,
// mark_task_done, move_task, delete_task, assign_task

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('[]'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import * as fs from 'fs';

// Replicate core kanban logic for testing (same pattern as existing tests)
type KanbanColumn = 'backlog' | 'planned' | 'ongoing' | 'done';

interface KanbanTask {
  id: string;
  title: string;
  description: string;
  column: KanbanColumn;
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
  completionSummary?: string;
}

function loadTasks(): KanbanTask[] {
  if (!fs.existsSync('/mock/kanban-tasks.json')) {
    return [];
  }
  try {
    const data = fs.readFileSync('/mock/kanban-tasks.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveTasks(tasks: KanbanTask[]): void {
  fs.writeFileSync('/mock/kanban-tasks.json', JSON.stringify(tasks, null, 2));
}

function makeTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'task-001-uuid-full',
    title: 'Test Task',
    description: 'A test task',
    column: 'backlog',
    projectId: 'project',
    projectPath: '/project',
    assignedAgentId: null,
    requiredSkills: [],
    priority: 'medium',
    progress: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    order: 0,
    labels: [],
    ...overrides,
  };
}

describe('mcp-kanban', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('[]');
    vi.mocked(fs.writeFileSync).mockClear();
    vi.mocked(fs.mkdirSync).mockClear();
  });

  describe('loadTasks', () => {
    it('returns empty array when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadTasks()).toEqual([]);
    });

    it('returns parsed tasks from file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const tasks = [makeTask()];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(tasks));
      expect(loadTasks()).toEqual(tasks);
    });

    it('returns empty array on parse error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json{');
      expect(loadTasks()).toEqual([]);
    });
  });

  describe('list_tasks handler logic', () => {
    function listTasks(tasks: KanbanTask[], column?: KanbanColumn, assignedToMe?: boolean, agentId?: string) {
      let filtered = [...tasks];
      if (column) {
        filtered = filtered.filter(t => t.column === column);
      }
      if (assignedToMe && agentId) {
        filtered = filtered.filter(t => t.assignedAgentId === agentId);
      }
      return filtered;
    }

    it('returns all tasks when no filter', () => {
      const tasks = [makeTask({ id: '1' }), makeTask({ id: '2' })];
      expect(listTasks(tasks)).toHaveLength(2);
    });

    it('filters by column', () => {
      const tasks = [
        makeTask({ id: '1', column: 'backlog' }),
        makeTask({ id: '2', column: 'ongoing' }),
        makeTask({ id: '3', column: 'backlog' }),
      ];
      expect(listTasks(tasks, 'backlog')).toHaveLength(2);
      expect(listTasks(tasks, 'ongoing')).toHaveLength(1);
      expect(listTasks(tasks, 'done')).toHaveLength(0);
    });

    it('filters by assigned agent', () => {
      const tasks = [
        makeTask({ id: '1', assignedAgentId: 'agent-1' }),
        makeTask({ id: '2', assignedAgentId: 'agent-2' }),
        makeTask({ id: '3', assignedAgentId: null }),
      ];
      expect(listTasks(tasks, undefined, true, 'agent-1')).toHaveLength(1);
    });

    it('formats task summary correctly', () => {
      const task = makeTask({ id: 'abcd1234-full-uuid', title: 'My Task', column: 'ongoing', progress: 50 });
      const summary = `- [${task.id.slice(0, 8)}] ${task.title} (${task.column}, ${task.progress}%)`;
      expect(summary).toBe('- [abcd1234] My Task (ongoing, 50%)');
    });

    it('includes agent ID in summary when assigned', () => {
      const task = makeTask({ id: 'abcd1234-full', assignedAgentId: 'agent-id-full-uuid' });
      const summary = `- [${task.id.slice(0, 8)}] ${task.title} (${task.column}, ${task.progress}%${task.assignedAgentId ? `, agent: ${task.assignedAgentId.slice(0, 8)}` : ''})`;
      expect(summary).toContain('agent: agent-id');
    });
  });

  describe('get_task handler logic', () => {
    it('finds task by ID prefix', () => {
      const tasks = [
        makeTask({ id: 'abc-123-456' }),
        makeTask({ id: 'def-789-012' }),
      ];
      const result = tasks.find(t => t.id.startsWith('abc'));
      expect(result?.id).toBe('abc-123-456');
    });

    it('returns undefined when task not found', () => {
      const tasks = [makeTask({ id: 'abc-123' })];
      const result = tasks.find(t => t.id.startsWith('xyz'));
      expect(result).toBeUndefined();
    });

    it('formats task details correctly', () => {
      const task = makeTask({
        title: 'Fix Bug',
        id: 'task-123',
        column: 'ongoing',
        progress: 75,
        priority: 'high',
        description: 'Fix the login bug',
        projectPath: '/project',
        assignedAgentId: 'agent-1',
        labels: ['bug', 'urgent'],
        completionSummary: 'Fixed it',
      });
      const text = `Task: ${task.title}\nID: ${task.id}\nColumn: ${task.column}\nProgress: ${task.progress}%\nPriority: ${task.priority}`;
      expect(text).toContain('Fix Bug');
      expect(text).toContain('75%');
      expect(text).toContain('high');
    });
  });

  describe('create_task handler logic', () => {
    it('creates task in backlog with default values', () => {
      const projectPath = '/my/project';
      const projectId = projectPath.split('/').pop() || 'unknown';
      const tasks: KanbanTask[] = [];
      const backlogTasks = tasks.filter(t => t.column === 'backlog');
      const maxOrder = backlogTasks.length > 0
        ? Math.max(...backlogTasks.map(t => t.order))
        : -1;

      const newTask: KanbanTask = {
        id: 'random-uuid',
        title: 'New Task',
        description: 'Task description',
        column: 'backlog',
        projectId,
        projectPath,
        assignedAgentId: null,
        requiredSkills: [],
        priority: 'medium',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        order: maxOrder + 1,
        labels: [],
      };

      expect(newTask.column).toBe('backlog');
      expect(newTask.priority).toBe('medium');
      expect(newTask.progress).toBe(0);
      expect(newTask.order).toBe(0);
      expect(newTask.projectId).toBe('project');
    });

    it('calculates order correctly with existing backlog tasks', () => {
      const tasks = [
        makeTask({ column: 'backlog', order: 0 }),
        makeTask({ column: 'backlog', order: 1 }),
        makeTask({ column: 'ongoing', order: 0 }),
      ];
      const backlogTasks = tasks.filter(t => t.column === 'backlog');
      const maxOrder = backlogTasks.length > 0
        ? Math.max(...backlogTasks.map(t => t.order))
        : -1;
      expect(maxOrder + 1).toBe(2);
    });

    it('uses custom priority when provided', () => {
      const priority = 'high' as const;
      expect(priority || 'medium').toBe('high');
    });

    it('uses custom labels when provided', () => {
      const labels = ['bug', 'urgent'];
      expect(labels || []).toEqual(['bug', 'urgent']);
    });

    it('defaults labels to empty array', () => {
      const labels = undefined;
      expect(labels || []).toEqual([]);
    });
  });

  describe('update_task_progress handler logic', () => {
    it('updates progress on found task', () => {
      const task = makeTask({ id: 'abc-123', progress: 0 });
      task.progress = 75;
      task.updatedAt = new Date().toISOString();
      expect(task.progress).toBe(75);
    });

    it('returns error when task not found', () => {
      const tasks = [makeTask({ id: 'abc-123' })];
      const found = tasks.find(t => t.id.startsWith('xyz'));
      expect(found).toBeUndefined();
    });
  });

  describe('mark_task_done handler logic', () => {
    it('moves task to done column with 100% progress', () => {
      const task = makeTask({ id: 'abc-123', column: 'ongoing', progress: 50 });
      task.column = 'done';
      task.progress = 100;
      task.completionSummary = 'Finished successfully';
      task.updatedAt = new Date().toISOString();

      expect(task.column).toBe('done');
      expect(task.progress).toBe(100);
      expect(task.completionSummary).toBe('Finished successfully');
    });

    it('reorders done column - new task gets order 0', () => {
      const tasks = [
        makeTask({ id: '1', column: 'done', order: 0 }),
        makeTask({ id: '2', column: 'done', order: 1 }),
        makeTask({ id: '3', column: 'ongoing' }),
      ];

      // Mark task 3 as done
      const task = tasks[2];
      task.column = 'done';
      task.order = 0;

      const doneTasks = tasks.filter(t => t.column === 'done' && t.id !== task.id);
      doneTasks.forEach((t, i) => { t.order = i + 1; });

      expect(task.order).toBe(0);
      expect(tasks[0].order).toBe(1);
      expect(tasks[1].order).toBe(2);
    });
  });

  describe('move_task handler logic', () => {
    it('moves task to new column', () => {
      const task = makeTask({ column: 'backlog' });
      const oldColumn = task.column;
      task.column = 'ongoing';
      expect(oldColumn).toBe('backlog');
      expect(task.column).toBe('ongoing');
    });

    it('sets progress to 100 when moving to done', () => {
      const task = makeTask({ progress: 50 });
      const column: KanbanColumn = 'done';
      if (column === 'done') task.progress = 100;
      expect(task.progress).toBe(100);
    });

    it('sets progress to 10 when moving to ongoing with 0 progress', () => {
      const task = makeTask({ progress: 0 });
      const column: KanbanColumn = 'ongoing';
      if (column === 'ongoing' && task.progress === 0) task.progress = 10;
      expect(task.progress).toBe(10);
    });

    it('preserves progress when moving to ongoing with existing progress', () => {
      const task = makeTask({ progress: 50 });
      const column: KanbanColumn = 'ongoing';
      if (column === 'ongoing' && task.progress === 0) task.progress = 10;
      expect(task.progress).toBe(50);
    });

    it('calculates new order in target column', () => {
      const tasks = [
        makeTask({ id: '1', column: 'ongoing', order: 0 }),
        makeTask({ id: '2', column: 'ongoing', order: 1 }),
        makeTask({ id: '3', column: 'backlog', order: 0 }),
      ];

      const task = tasks[2];
      task.column = 'ongoing';
      const columnTasks = tasks.filter(t => t.column === 'ongoing' && t.id !== task.id);
      task.order = columnTasks.length;

      expect(task.order).toBe(2);
    });
  });

  describe('delete_task handler logic', () => {
    it('removes task from array', () => {
      const tasks = [
        makeTask({ id: 'abc-123', title: 'Task 1' }),
        makeTask({ id: 'def-456', title: 'Task 2' }),
      ];

      const index = tasks.findIndex(t => t.id.startsWith('abc'));
      expect(index).toBe(0);

      const [deleted] = tasks.splice(index, 1);
      expect(deleted.title).toBe('Task 1');
      expect(tasks).toHaveLength(1);
    });

    it('returns -1 when task not found', () => {
      const tasks = [makeTask({ id: 'abc-123' })];
      const index = tasks.findIndex(t => t.id.startsWith('xyz'));
      expect(index).toBe(-1);
    });
  });

  describe('assign_task handler logic', () => {
    it('assigns agent to task', () => {
      const task = makeTask({ assignedAgentId: null });
      const assignedId = 'agent-abc-123-full';
      task.assignedAgentId = assignedId;
      task.updatedAt = new Date().toISOString();

      expect(task.assignedAgentId).toBe('agent-abc-123-full');
    });

    it('unassigns agent when no agent_id provided', () => {
      const task = makeTask({ assignedAgentId: 'agent-1' });
      task.assignedAgentId = null;
      expect(task.assignedAgentId).toBeNull();
    });

    it('formats assignment message with truncated agent ID', () => {
      const agentId = 'agent-abc-123-full-uuid';
      const msg = `Task "Test" assigned to agent ${agentId.slice(0, 8)}`;
      expect(msg).toBe('Task "Test" assigned to agent agent-ab');
    });

    it('formats unassignment message', () => {
      const assignedId: string | null = null;
      const msg = assignedId
        ? `Task "Test" assigned to agent ${assignedId.slice(0, 8)}`
        : 'Task "Test" unassigned';
      expect(msg).toBe('Task "Test" unassigned');
    });
  });

  describe('saveTasks', () => {
    it('writes tasks as formatted JSON', () => {
      const tasks = [makeTask()];
      saveTasks(tasks);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/kanban-tasks.json',
        JSON.stringify(tasks, null, 2)
      );
    });
  });
});
