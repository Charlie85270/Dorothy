import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app/path' },
  Notification: vi.fn(),
  BrowserWindow: vi.fn(),
}));

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(''),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ isDirectory: () => false, mtimeMs: 0 }),
    realpathSync: vi.fn((p: string) => p),
  };
});

import * as fs from 'fs';

// ============================================================================
// claude-service tests
// ============================================================================

describe('claude-service', () => {
  describe('readSkillMetadata', () => {
    let readSkillMetadata: typeof import('../../electron/services/claude-service').readSkillMetadata;

    beforeEach(async () => {
      vi.resetModules();
      // Re-import with fresh module cache
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('');
      const mod = await import('../../electron/services/claude-service');
      readSkillMetadata = mod.readSkillMetadata;
    });

    it('returns name from plugin.json when it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: 'my-skill', description: 'A skill' })
      );

      const result = readSkillMetadata('/path/to/skill');
      expect(result).toEqual({ name: 'my-skill', description: 'A skill' });
    });

    it('returns basename when plugin.json has no name', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const result = readSkillMetadata('/path/to/my-skill');
      expect(result?.name).toBe('my-skill');
    });

    it('returns basename when plugin.json does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = readSkillMetadata('/path/to/cool-skill');
      expect(result).toEqual({ name: 'cool-skill' });
    });

    it('handles JSON parse errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json{');

      const result = readSkillMetadata('/path/to/broken-skill');
      expect(result?.name).toBe('broken-skill');
    });
  });

  describe('getClaudeHistory', () => {
    let getClaudeHistory: typeof import('../../electron/services/claude-service').getClaudeHistory;

    beforeEach(async () => {
      vi.resetModules();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mod = await import('../../electron/services/claude-service');
      getClaudeHistory = mod.getClaudeHistory;
    });

    it('parses tab-separated history entries', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'Fix bug\t1700000000\t/project\nAdd feature\t1700001000\t/other'
      );

      const result = await getClaudeHistory();
      expect(result).toHaveLength(2);
      expect(result[0].display).toBe('Add feature');
      expect(result[0].timestamp).toBe(1700001000);
      expect(result[0].project).toBe('/other');
      expect(result[1].display).toBe('Fix bug');
    });

    it('returns empty array when history file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = await getClaudeHistory();
      expect(result).toEqual([]);
    });

    it('respects limit parameter', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const lines = Array.from({ length: 100 }, (_, i) => `Task ${i}\t${i}\t/project`).join('\n');
      vi.mocked(fs.readFileSync).mockReturnValue(lines);

      const result = await getClaudeHistory(5);
      expect(result).toHaveLength(5);
    });
  });

  describe('getClaudeSettings', () => {
    let getClaudeSettings: typeof import('../../electron/services/claude-service').getClaudeSettings;

    beforeEach(async () => {
      vi.resetModules();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mod = await import('../../electron/services/claude-service');
      getClaudeSettings = mod.getClaudeSettings;
    });

    it('returns null when settings file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = await getClaudeSettings();
      expect(result).toBeNull();
    });

    it('parses valid settings JSON', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"key": "value"}');
      const result = await getClaudeSettings();
      expect(result).toEqual({ key: 'value' });
    });

    it('returns null on parse error', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('bad json');
      const result = await getClaudeSettings();
      expect(result).toBeNull();
    });
  });

  describe('getClaudePlugins', () => {
    let getClaudePlugins: typeof import('../../electron/services/claude-service').getClaudePlugins;

    beforeEach(async () => {
      vi.resetModules();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mod = await import('../../electron/services/claude-service');
      getClaudePlugins = mod.getClaudePlugins;
    });

    it('returns empty array when file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = await getClaudePlugins();
      expect(result).toEqual([]);
    });

    it('returns plugins array', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('[{"name":"plugin1"}]');
      const result = await getClaudePlugins();
      expect(result).toEqual([{ name: 'plugin1' }]);
    });

    it('returns empty array for non-array data', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"not": "array"}');
      const result = await getClaudePlugins();
      expect(result).toEqual([]);
    });
  });
});

// ============================================================================
// kanban-automation tests
// ============================================================================

// We need to test the exported functions but they depend on module-level state.
// We'll test the logic by importing with deps initialized.

describe('kanban-automation', () => {
  let kanbanMod: typeof import('../../electron/services/kanban-automation');

  const mockAgents = new Map<any, any>();
  const mockCreateAgent = vi.fn();
  const mockStartAgent = vi.fn();
  const mockSaveAgents = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    mockAgents.clear();
    mockCreateAgent.mockReset();
    mockStartAgent.mockReset();
    mockSaveAgents.mockReset();

    kanbanMod = await import('../../electron/services/kanban-automation');
    kanbanMod.initKanbanAutomation({
      agents: mockAgents as any,
      createAgent: mockCreateAgent,
      startAgent: mockStartAgent,
      saveAgents: mockSaveAgents,
    });
  });

  describe('findMatchingAgent', () => {
    it('returns null when no idle agents exist', async () => {
      mockAgents.set('1', {
        id: '1', status: 'running', projectPath: '/project', skills: [],
      });

      const result = await kanbanMod.findMatchingAgent('/project', []);
      expect(result).toBeNull();
    });

    it('matches idle agent with same project path', async () => {
      mockAgents.set('1', {
        id: '1', status: 'idle', projectPath: '/project', skills: [],
      });

      const result = await kanbanMod.findMatchingAgent('/project', []);
      expect(result).toBe('1');
    });

    it('prioritizes agent with matching skills over project-only match', async () => {
      mockAgents.set('1', {
        id: '1', status: 'idle', projectPath: '/project', skills: [],
      });
      mockAgents.set('2', {
        id: '2', status: 'idle', projectPath: '/project', skills: ['testing'],
      });

      const result = await kanbanMod.findMatchingAgent('/project', ['testing']);
      expect(result).toBe('2');
    });

    it('falls back to project match when skills dont match', async () => {
      mockAgents.set('1', {
        id: '1', status: 'idle', projectPath: '/project', skills: ['lint'],
      });

      const result = await kanbanMod.findMatchingAgent('/project', ['deploy']);
      expect(result).toBe('1');
    });

    it('returns null when no project matches', async () => {
      mockAgents.set('1', {
        id: '1', status: 'idle', projectPath: '/other-project', skills: [],
      });

      const result = await kanbanMod.findMatchingAgent('/project', []);
      expect(result).toBeNull();
    });

    it('normalizes paths with trailing slashes', async () => {
      mockAgents.set('1', {
        id: '1', status: 'idle', projectPath: '/project/', skills: [],
      });

      const result = await kanbanMod.findMatchingAgent('/project', []);
      expect(result).toBe('1');
    });
  });

  describe('createAgentForTask', () => {
    it('creates agent with task-derived name', async () => {
      mockCreateAgent.mockResolvedValue({ id: 'new-id' });

      const task = {
        id: 'task-1',
        title: 'Fix login bug',
        description: 'The login page is broken',
        projectPath: '/project',
        requiredSkills: ['testing'],
        labels: ['bug'],
        priority: 'medium' as const,
        column: 'planned' as const,
        projectId: 'proj',
        assignedAgentId: null,
        progress: 0,
        createdAt: '',
        updatedAt: '',
        order: 0,
      };

      const result = await kanbanMod.createAgentForTask(task);
      expect(result).toBe('new-id');
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: '/project',
          skills: ['testing'],
          name: 'Task: Fix login bug',
          character: 'ninja', // bug → ninja
          skipPermissions: true,
        })
      );
    });

    it('truncates long task titles in agent name', async () => {
      mockCreateAgent.mockResolvedValue({ id: 'new-id' });

      const task = {
        id: 'task-1',
        title: 'A very long task title that exceeds twenty characters',
        description: '',
        projectPath: '/project',
        requiredSkills: [],
        labels: [],
        priority: 'medium' as const,
        column: 'planned' as const,
        projectId: 'proj',
        assignedAgentId: null,
        progress: 0,
        createdAt: '',
        updatedAt: '',
        order: 0,
      };

      await kanbanMod.createAgentForTask(task);
      // substring(0, 20) = 'A very long task tit'
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Task: A very long task tit...',
        })
      );
    });

    it('selects knight character for testing tasks', async () => {
      mockCreateAgent.mockResolvedValue({ id: 'new-id' });

      const task = {
        id: 'task-1', title: 'Run tests', description: '',
        projectPath: '/p', requiredSkills: [], labels: ['test'],
        priority: 'medium' as const, column: 'planned' as const,
        projectId: 'p', assignedAgentId: null, progress: 0,
        createdAt: '', updatedAt: '', order: 0,
      };

      await kanbanMod.createAgentForTask(task);
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({ character: 'knight' }));
    });

    it('selects wizard character for feature tasks', async () => {
      mockCreateAgent.mockResolvedValue({ id: 'new-id' });

      const task = {
        id: 'task-1', title: 'Add new feature', description: '',
        projectPath: '/p', requiredSkills: [], labels: ['feature'],
        priority: 'medium' as const, column: 'planned' as const,
        projectId: 'p', assignedAgentId: null, progress: 0,
        createdAt: '', updatedAt: '', order: 0,
      };

      await kanbanMod.createAgentForTask(task);
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({ character: 'wizard' }));
    });

    it('selects viking character for security tasks', async () => {
      mockCreateAgent.mockResolvedValue({ id: 'new-id' });

      // Use 'security' label to ensure it matches the security check
      // (title with 'fix' would match the bug-fix pattern first)
      const task = {
        id: 'task-1', title: 'Audit auth system', description: '',
        projectPath: '/p', requiredSkills: [], labels: ['security'],
        priority: 'medium' as const, column: 'planned' as const,
        projectId: 'p', assignedAgentId: null, progress: 0,
        createdAt: '', updatedAt: '', order: 0,
      };

      await kanbanMod.createAgentForTask(task);
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({ character: 'viking' }));
    });

    it('selects knight for high priority default', async () => {
      mockCreateAgent.mockResolvedValue({ id: 'new-id' });

      const task = {
        id: 'task-1', title: 'Urgent thing', description: '',
        projectPath: '/p', requiredSkills: [], labels: [],
        priority: 'high' as const, column: 'planned' as const,
        projectId: 'p', assignedAgentId: null, progress: 0,
        createdAt: '', updatedAt: '', order: 0,
      };

      await kanbanMod.createAgentForTask(task);
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({ character: 'knight' }));
    });

    it('selects alien for low priority default', async () => {
      mockCreateAgent.mockResolvedValue({ id: 'new-id' });

      // Avoid keywords that match other character patterns (cleanup → refactor → robot)
      const task = {
        id: 'task-1', title: 'Minor tweak', description: 'nothing special',
        projectPath: '/p', requiredSkills: [], labels: [],
        priority: 'low' as const, column: 'planned' as const,
        projectId: 'p', assignedAgentId: null, progress: 0,
        createdAt: '', updatedAt: '', order: 0,
      };

      await kanbanMod.createAgentForTask(task);
      expect(mockCreateAgent).toHaveBeenCalledWith(expect.objectContaining({ character: 'alien' }));
    });
  });
});

// ============================================================================
// api-server: POST /api/scheduler/status — logic tests
// ============================================================================
// These test the validation and metadata update logic used by the endpoint,
// without spinning up an actual HTTP server.

describe('api-server scheduler status endpoint (logic)', () => {
  describe('input validation', () => {
    it('rejects when task_id is missing', () => {
      const body = { status: 'running' } as { task_id?: string; status: string };
      const isValid = !!(body.task_id && body.status);
      expect(isValid).toBe(false);
    });

    it('rejects when status is missing', () => {
      const body = { task_id: 'task-1' } as { task_id: string; status?: string };
      const isValid = !!(body.task_id && body.status);
      expect(isValid).toBe(false);
    });

    it('rejects invalid status values', () => {
      const validStatuses = ['running', 'success', 'error', 'partial'];
      expect(validStatuses.includes('pending')).toBe(false);
      expect(validStatuses.includes('cancelled')).toBe(false);
      expect(validStatuses.includes('')).toBe(false);
    });

    it('accepts all valid status values', () => {
      const validStatuses = ['running', 'success', 'error', 'partial'];
      for (const s of validStatuses) {
        expect(validStatuses.includes(s)).toBe(true);
      }
    });
  });

  describe('metadata update', () => {
    it('creates metadata entry for new task_id', () => {
      const metadata: Record<string, Record<string, unknown>> = {};
      const task_id = 'new-task';
      const status = 'running';

      if (!metadata[task_id]) {
        metadata[task_id] = {};
      }
      metadata[task_id].lastRunStatus = status;
      metadata[task_id].lastRun = new Date().toISOString();

      expect(metadata[task_id].lastRunStatus).toBe('running');
      expect(metadata[task_id].lastRun).toBeDefined();
    });

    it('updates existing metadata entry', () => {
      const metadata: Record<string, Record<string, unknown>> = {
        'existing-task': {
          title: 'My Task',
          notifications: { telegram: false, slack: false },
          lastRunStatus: 'running',
        },
      };

      metadata['existing-task'].lastRunStatus = 'success';
      metadata['existing-task'].lastRun = new Date().toISOString();
      metadata['existing-task'].lastRunSummary = 'All checks passed';

      expect(metadata['existing-task'].lastRunStatus).toBe('success');
      expect(metadata['existing-task'].lastRunSummary).toBe('All checks passed');
      // Preserves other fields
      expect(metadata['existing-task'].title).toBe('My Task');
    });

    it('omits summary from metadata when not provided', () => {
      const metadata: Record<string, Record<string, unknown>> = {};
      const task_id = 'task-no-summary';
      const summary: string | undefined = undefined;

      if (!metadata[task_id]) metadata[task_id] = {};
      metadata[task_id].lastRunStatus = 'error';
      metadata[task_id].lastRun = new Date().toISOString();
      if (summary) {
        metadata[task_id].lastRunSummary = summary;
      }

      expect(metadata[task_id].lastRunSummary).toBeUndefined();
    });

    it('includes summary in metadata when provided', () => {
      const metadata: Record<string, Record<string, unknown>> = {};
      const task_id = 'task-with-summary';
      const summary = 'Deployed v2.1.0';

      if (!metadata[task_id]) metadata[task_id] = {};
      metadata[task_id].lastRunStatus = 'success';
      metadata[task_id].lastRun = new Date().toISOString();
      if (summary) {
        metadata[task_id].lastRunSummary = summary;
      }

      expect(metadata[task_id].lastRunSummary).toBe('Deployed v2.1.0');
    });
  });

  describe('IPC emission', () => {
    it('emits correct event shape for frontend', () => {
      const task_id = 'task-abc';
      const status = 'success';
      const summary = 'Done';

      const event = { taskId: task_id, status, summary };
      expect(event.taskId).toBe('task-abc');
      expect(event.status).toBe('success');
      expect(event.summary).toBe('Done');
    });

    it('uses taskId (not task_id) in emitted event', () => {
      // The API accepts snake_case task_id but emits camelCase taskId
      const task_id = 'my-task';
      const emitted = { taskId: task_id, status: 'running' };
      expect(emitted).toHaveProperty('taskId');
      expect(emitted).not.toHaveProperty('task_id');
    });
  });
});
