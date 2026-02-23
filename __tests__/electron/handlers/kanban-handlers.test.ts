import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Mocks ────────────────────────────────────────────────────────────────────

let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
let tmpDir: string;

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn);
    }),
  },
  BrowserWindow: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'kanban-uuid-1234'),
}));

vi.mock('../../../electron/utils/kanban-generate', () => ({
  generateTaskFromPrompt: vi.fn(async (prompt: string) => ({
    title: `Generated: ${prompt}`,
    description: 'Auto-generated',
    projectPath: '/test',
    priority: 'medium',
    labels: [],
    requiredSkills: [],
  })),
}));

vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return { ...mod, homedir: () => tmpDir };
});

function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for "${channel}"`);
  return fn({}, ...args);
}

// ── Setup ────────────────────────────────────────────────────────────────────

let mockDeps: Record<string, unknown>;

beforeEach(() => {
  vi.resetModules();
  handlers = new Map();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-test-'));

  // Ensure data dir
  const dataDir = path.join(tmpDir, '.dorothy');
  fs.mkdirSync(dataDir, { recursive: true });

  mockDeps = {
    getMainWindow: vi.fn(() => ({ webContents: { send: vi.fn() } })),
    findMatchingAgent: vi.fn(async () => null),
    createAgentForTask: vi.fn(async () => 'agent-1'),
    startAgent: vi.fn(async () => {}),
    stopAgent: vi.fn(async () => {}),
    deleteAgent: vi.fn(async () => {}),
    getAgentOutput: vi.fn(() => []),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeKanbanFile(tasks: unknown[]): void {
  fs.writeFileSync(path.join(tmpDir, '.dorothy', 'kanban-tasks.json'), JSON.stringify(tasks, null, 2));
}

function readKanbanFile(): unknown[] {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.dorothy', 'kanban-tasks.json'), 'utf-8'));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('kanban-handlers', () => {
  async function registerHandlers() {
    const { registerKanbanHandlers } = await import('../../../electron/handlers/kanban-handlers');
    registerKanbanHandlers(mockDeps as any);
  }

  describe('kanban:list', () => {
    it('returns empty list when no tasks exist', async () => {
      await registerHandlers();
      const result = await invokeHandler('kanban:list') as { tasks: unknown[] };
      expect(result.tasks).toEqual([]);
    });

    it('returns stored tasks', async () => {
      writeKanbanFile([
        { id: 'task-1', title: 'Task One', column: 'backlog' },
        { id: 'task-2', title: 'Task Two', column: 'done' },
      ]);

      await registerHandlers();
      const result = await invokeHandler('kanban:list') as { tasks: Array<{ id: string }> };
      expect(result.tasks).toHaveLength(2);
    });
  });

  describe('kanban:create', () => {
    it('creates a task in backlog with defaults', async () => {
      await registerHandlers();

      const result = await invokeHandler('kanban:create', {
        title: 'New Task',
        description: 'Task description',
        projectId: 'proj-1',
        projectPath: '/test/project',
      }) as { success: boolean; task: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.task.title).toBe('New Task');
      expect(result.task.column).toBe('backlog');
      expect(result.task.priority).toBe('medium');
      expect(result.task.progress).toBe(0);
      expect(result.task.assignedAgentId).toBeNull();
    });

    it('assigns correct order based on existing backlog tasks', async () => {
      writeKanbanFile([
        { id: 'existing', title: 'Existing', column: 'backlog', order: 5 },
      ]);

      await registerHandlers();
      const result = await invokeHandler('kanban:create', {
        title: 'New',
        description: '',
        projectId: 'p',
        projectPath: '/p',
      }) as { success: boolean; task: Record<string, unknown> };

      expect(result.task.order).toBe(6);
    });

    it('accepts optional fields', async () => {
      await registerHandlers();

      const result = await invokeHandler('kanban:create', {
        title: 'Detailed Task',
        description: 'Desc',
        projectId: 'p',
        projectPath: '/p',
        requiredSkills: ['typescript'],
        priority: 'high',
        labels: ['bug', 'urgent'],
      }) as { success: boolean; task: Record<string, unknown> };

      expect(result.task.requiredSkills).toEqual(['typescript']);
      expect(result.task.priority).toBe('high');
      expect(result.task.labels).toEqual(['bug', 'urgent']);
    });
  });

  describe('kanban:update', () => {
    it('updates task fields', async () => {
      writeKanbanFile([
        { id: 'upd-1', title: 'Original', description: 'Desc', column: 'backlog', order: 0,
          projectId: 'p', projectPath: '/p', priority: 'low', progress: 0, labels: [],
          requiredSkills: [], assignedAgentId: null, agentCreatedForTask: false,
          createdAt: '2026-01-01', updatedAt: '2026-01-01', attachments: [] },
      ]);

      await registerHandlers();
      const result = await invokeHandler('kanban:update', {
        id: 'upd-1',
        title: 'Updated Title',
        priority: 'high',
        progress: 50,
      }) as { success: boolean; task: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.task.title).toBe('Updated Title');
      expect(result.task.priority).toBe('high');
      expect(result.task.progress).toBe(50);
    });

    it('returns error for non-existent task', async () => {
      writeKanbanFile([]);
      await registerHandlers();

      const result = await invokeHandler('kanban:update', { id: 'nope' }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('kanban:move', () => {
    const baseTask = {
      id: 'move-1', title: 'Move Me', description: '', column: 'backlog', order: 0,
      projectId: 'p', projectPath: '/p', priority: 'medium' as const, progress: 0, labels: [],
      requiredSkills: [], assignedAgentId: null, agentCreatedForTask: false,
      createdAt: '2026-01-01', updatedAt: '2026-01-01', attachments: [],
    };

    it('blocks moving from ongoing (except to done)', async () => {
      writeKanbanFile([{ ...baseTask, column: 'ongoing' }]);
      await registerHandlers();

      const result = await invokeHandler('kanban:move', { id: 'move-1', column: 'backlog' }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot move in-progress tasks');
    });

    it('blocks moving from done', async () => {
      writeKanbanFile([{ ...baseTask, column: 'done' }]);
      await registerHandlers();

      const result = await invokeHandler('kanban:move', { id: 'move-1', column: 'backlog' }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot move completed tasks');
    });

    it('allows moving ongoing to done', async () => {
      writeKanbanFile([{ ...baseTask, column: 'ongoing' }]);
      await registerHandlers();

      const result = await invokeHandler('kanban:move', { id: 'move-1', column: 'done' }) as { success: boolean; task: Record<string, unknown> };
      expect(result.success).toBe(true);
      expect(result.task.column).toBe('done');
      expect(result.task.progress).toBe(100);
      expect(result.task.completedAt).toBeDefined();
    });

    it('resets progress when moving to backlog', async () => {
      writeKanbanFile([{ ...baseTask, column: 'planned', progress: 30, assignedAgentId: 'agent-1' }]);
      await registerHandlers();

      const result = await invokeHandler('kanban:move', { id: 'move-1', column: 'backlog' }) as { success: boolean; task: Record<string, unknown> };
      expect(result.success).toBe(true);
      expect(result.task.progress).toBe(0);
      expect(result.task.assignedAgentId).toBeNull();
    });

    it('returns error for non-existent task', async () => {
      writeKanbanFile([]);
      await registerHandlers();

      const result = await invokeHandler('kanban:move', { id: 'ghost', column: 'planned' }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('kanban:delete', () => {
    it('removes task from storage', async () => {
      writeKanbanFile([
        { id: 'del-1', title: 'Delete', column: 'backlog', assignedAgentId: null },
        { id: 'keep-1', title: 'Keep', column: 'backlog', assignedAgentId: null },
      ]);

      await registerHandlers();
      const result = await invokeHandler('kanban:delete', 'del-1') as { success: boolean };
      expect(result.success).toBe(true);

      const tasks = readKanbanFile();
      expect(tasks).toHaveLength(1);
    });

    it('stops agent if task was ongoing', async () => {
      writeKanbanFile([
        { id: 'ongoing-del', title: 'Stop Me', column: 'ongoing', assignedAgentId: 'agent-x' },
      ]);

      await registerHandlers();
      await invokeHandler('kanban:delete', 'ongoing-del');

      expect(mockDeps.stopAgent).toHaveBeenCalledWith('agent-x');
    });

    it('returns error for non-existent task', async () => {
      writeKanbanFile([]);
      await registerHandlers();

      const result = await invokeHandler('kanban:delete', 'nope') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('kanban:reorder', () => {
    it('updates order of tasks', async () => {
      writeKanbanFile([
        { id: 't1', title: 'A', column: 'backlog', order: 0 },
        { id: 't2', title: 'B', column: 'backlog', order: 1 },
        { id: 't3', title: 'C', column: 'backlog', order: 2 },
      ]);

      await registerHandlers();
      const result = await invokeHandler('kanban:reorder', {
        taskIds: ['t3', 't1', 't2'],
        column: 'backlog',
      }) as { success: boolean };

      expect(result.success).toBe(true);

      const tasks = readKanbanFile() as Array<{ id: string; order: number }>;
      expect(tasks.find(t => t.id === 't3')?.order).toBe(0);
      expect(tasks.find(t => t.id === 't1')?.order).toBe(1);
      expect(tasks.find(t => t.id === 't2')?.order).toBe(2);
    });
  });

  describe('kanban:generate', () => {
    it('generates task from prompt', async () => {
      await registerHandlers();
      const result = await invokeHandler('kanban:generate', {
        prompt: 'Fix the login bug',
        availableProjects: [{ path: '/test', name: 'test' }],
      }) as { success: boolean; task: { title: string } };

      expect(result.success).toBe(true);
      expect(result.task.title).toContain('Fix the login bug');
    });

    it('returns error when prompt is empty', async () => {
      await registerHandlers();
      const result = await invokeHandler('kanban:generate', {
        prompt: '',
        availableProjects: [],
      }) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('prompt is required');
    });
  });

  describe('kanban:get', () => {
    it('returns task by ID', async () => {
      writeKanbanFile([
        { id: 'get-1', title: 'Found', column: 'backlog' },
      ]);

      await registerHandlers();
      const result = await invokeHandler('kanban:get', 'get-1') as { success: boolean; task: Record<string, unknown> };
      expect(result.success).toBe(true);
      expect(result.task.title).toBe('Found');
    });

    it('returns error for non-existent task', async () => {
      writeKanbanFile([]);
      await registerHandlers();

      const result = await invokeHandler('kanban:get', 'nope') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });
});
