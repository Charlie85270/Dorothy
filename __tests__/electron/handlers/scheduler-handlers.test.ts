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
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc: Record<string, unknown> = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { if (event === 'close') cb(0); }),
      unref: vi.fn(),
    };
    return proc;
  }),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return { ...mod, homedir: () => tmpDir, platform: () => 'linux' as NodeJS.Platform };
});

function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for "${channel}"`);
  return fn({}, ...args);
}

// ── Setup ────────────────────────────────────────────────────────────────────

function writeTmpJson(rel: string, data: unknown): string {
  const full = path.join(tmpDir, rel);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2));
  return full;
}

beforeEach(() => {
  vi.resetModules();
  handlers = new Map();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-test-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('scheduler-handlers', () => {
  async function registerHandlers() {
    const { registerSchedulerHandlers } = await import('../../../electron/handlers/scheduler-handlers');
    registerSchedulerHandlers();
  }

  describe('scheduler:listTasks', () => {
    it('returns empty array when no schedules exist', async () => {
      await registerHandlers();
      const result = await invokeHandler('scheduler:listTasks') as { tasks: unknown[] };
      expect(result.tasks).toEqual([]);
    });

    it('reads tasks from global schedules.json', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'task-1', prompt: 'Review code', schedule: '0 9 * * *', projectPath: '/myproject', autonomous: true },
      ]);
      writeTmpJson('.dorothy/scheduler-metadata.json', {
        'task-1': {
          title: 'Code Review',
          notifications: { telegram: false, slack: false },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });

      await registerHandlers();
      const result = await invokeHandler('scheduler:listTasks') as { tasks: Array<Record<string, unknown>> };

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-1');
      expect(result.tasks[0].title).toBe('Code Review');
      expect(result.tasks[0].prompt).toBe('Review code');
      expect(result.tasks[0].schedule).toBe('0 9 * * *');
      expect(result.tasks[0].scheduleHuman).toBe('Daily at 9:00 AM');
      expect(result.tasks[0].autonomous).toBe(true);
    });

    it('reads tasks from project-level schedules.json', async () => {
      const projectDir = '-Users-test-project';
      writeTmpJson(`.claude/projects/${projectDir}/schedules.json`, [
        { id: 'proj-task-1', prompt: 'Build project', schedule: '0 12 * * 1-5', projectPath: '/test/project' },
      ]);

      await registerHandlers();
      const result = await invokeHandler('scheduler:listTasks') as { tasks: Array<Record<string, unknown>> };

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('proj-task-1');
    });

    it('deduplicates tasks between global and project schedules', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'shared-task', prompt: 'Shared task', schedule: '0 9 * * *', projectPath: '/project' },
      ]);
      writeTmpJson('.claude/projects/test/schedules.json', [
        { id: 'shared-task', prompt: 'Shared task duplicate', schedule: '0 9 * * *', projectPath: '/project' },
      ]);

      await registerHandlers();
      const result = await invokeHandler('scheduler:listTasks') as { tasks: Array<Record<string, unknown>> };

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('shared-task');
    });

    it('determines lastRunStatus from log file', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'task-status', prompt: 'Test', schedule: '0 9 * * *', projectPath: '/test' },
      ]);
      // Create a log file with error content
      const logDir = path.join(tmpDir, '.claude', 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(path.join(logDir, 'task-status.log'),
        '=== Task started at 2026-01-01 ===\nSome error occurred\n=== Task completed at 2026-01-01 ===\n'
      );

      await registerHandlers();
      const result = await invokeHandler('scheduler:listTasks') as { tasks: Array<Record<string, unknown>> };

      expect(result.tasks[0].lastRunStatus).toBe('error');
      expect(result.tasks[0].lastRun).toBeDefined();
    });

    it('falls back to prompt/task field names', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'old-task', task: 'Old-format task', cron: '0 9 * * *', project: '/old' },
      ]);

      await registerHandlers();
      const result = await invokeHandler('scheduler:listTasks') as { tasks: Array<Record<string, unknown>> };

      expect(result.tasks[0].prompt).toBe('Old-format task');
      expect(result.tasks[0].schedule).toBe('0 9 * * *');
    });

    it('defaults autonomous to true when not specified', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 't1', prompt: 'test', schedule: '0 9 * * *', projectPath: '/p' },
      ]);

      await registerHandlers();
      const result = await invokeHandler('scheduler:listTasks') as { tasks: Array<Record<string, unknown>> };
      expect(result.tasks[0].autonomous).toBe(true);
    });
  });

  describe('scheduler:createTask', () => {
    it('creates a new task and writes to schedules.json', async () => {
      await registerHandlers();

      const result = await invokeHandler('scheduler:createTask', {
        title: 'New Task',
        prompt: 'Do something',
        schedule: '0 9 * * *',
        projectPath: '/project',
        autonomous: true,
        notifications: { telegram: true, slack: false },
      }) as { success: boolean; taskId: string };

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('test-uuid-1234');

      // Verify schedules.json was written
      const schedulesPath = path.join(tmpDir, '.claude', 'schedules.json');
      const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
      expect(schedules).toHaveLength(1);
      expect(schedules[0].id).toBe('test-uuid-1234');
      expect(schedules[0].prompt).toBe('Do something');

      // Verify metadata was saved
      const metaPath = path.join(tmpDir, '.dorothy', 'scheduler-metadata.json');
      const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      expect(metadata['test-uuid-1234'].title).toBe('New Task');
      expect(metadata['test-uuid-1234'].notifications.telegram).toBe(true);
    });

    it('appends to existing schedules.json', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'existing', prompt: 'Existing task', schedule: '0 9 * * *', projectPath: '/p' },
      ]);

      await registerHandlers();
      await invokeHandler('scheduler:createTask', {
        prompt: 'Second task',
        schedule: '0 12 * * *',
        projectPath: '/project',
      });

      const schedules = JSON.parse(fs.readFileSync(
        path.join(tmpDir, '.claude', 'schedules.json'), 'utf-8'
      ));
      expect(schedules).toHaveLength(2);
    });

    it('handles corrupt schedules.json by resetting', async () => {
      const dir = path.join(tmpDir, '.claude');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'schedules.json'), 'not valid json');

      await registerHandlers();
      const result = await invokeHandler('scheduler:createTask', {
        prompt: 'Task after corrupt',
        schedule: '0 9 * * *',
        projectPath: '/p',
      }) as { success: boolean };

      expect(result.success).toBe(true);
    });

    it('saves worktree config when provided', async () => {
      await registerHandlers();
      await invokeHandler('scheduler:createTask', {
        prompt: 'Worktree task',
        schedule: '0 9 * * *',
        projectPath: '/p',
        worktree: { enabled: true, branchPrefix: 'feat/' },
      });

      const schedules = JSON.parse(fs.readFileSync(
        path.join(tmpDir, '.claude', 'schedules.json'), 'utf-8'
      ));
      expect(schedules[0].worktree).toEqual({ enabled: true, branchPrefix: 'feat/' });
    });
  });

  describe('scheduler:deleteTask', () => {
    it('removes task from schedules.json and metadata', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'to-delete', prompt: 'delete me', schedule: '0 9 * * *', projectPath: '/p' },
        { id: 'keep', prompt: 'keep me', schedule: '0 12 * * *', projectPath: '/p' },
      ]);
      writeTmpJson('.dorothy/scheduler-metadata.json', {
        'to-delete': { title: 'Delete', notifications: { telegram: false, slack: false }, createdAt: '2026-01-01' },
        'keep': { title: 'Keep', notifications: { telegram: false, slack: false }, createdAt: '2026-01-01' },
      });

      await registerHandlers();
      const result = await invokeHandler('scheduler:deleteTask', 'to-delete') as { success: boolean };

      expect(result.success).toBe(true);

      const schedules = JSON.parse(fs.readFileSync(
        path.join(tmpDir, '.claude', 'schedules.json'), 'utf-8'
      ));
      expect(schedules).toHaveLength(1);
      expect(schedules[0].id).toBe('keep');

      const metadata = JSON.parse(fs.readFileSync(
        path.join(tmpDir, '.dorothy', 'scheduler-metadata.json'), 'utf-8'
      ));
      expect(metadata['to-delete']).toBeUndefined();
      expect(metadata['keep']).toBeDefined();
    });

    it('removes the script file if it exists', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'scripted', prompt: 'test', schedule: '0 9 * * *', projectPath: '/p' },
      ]);
      const scriptsDir = path.join(tmpDir, '.dorothy', 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(path.join(scriptsDir, 'scripted.sh'), '#!/bin/bash\necho hi');

      await registerHandlers();
      await invokeHandler('scheduler:deleteTask', 'scripted');

      expect(fs.existsSync(path.join(scriptsDir, 'scripted.sh'))).toBe(false);
    });

    it('succeeds even when schedules.json does not exist', async () => {
      await registerHandlers();
      const result = await invokeHandler('scheduler:deleteTask', 'nonexistent') as { success: boolean };
      expect(result.success).toBe(true);
    });
  });

  describe('scheduler:updateTask', () => {
    it('updates task fields in schedules.json', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'upd-1', prompt: 'old prompt', schedule: '0 9 * * *', projectPath: '/p', autonomous: true },
      ]);
      writeTmpJson('.dorothy/scheduler-metadata.json', {
        'upd-1': { title: 'Old Title', notifications: { telegram: false, slack: false }, createdAt: '2026-01-01' },
      });

      await registerHandlers();
      const result = await invokeHandler('scheduler:updateTask', 'upd-1', {
        prompt: 'new prompt',
        autonomous: false,
      }) as { success: boolean };

      expect(result.success).toBe(true);

      const schedules = JSON.parse(fs.readFileSync(
        path.join(tmpDir, '.claude', 'schedules.json'), 'utf-8'
      ));
      expect(schedules[0].prompt).toBe('new prompt');
      expect(schedules[0].autonomous).toBe(false);
    });

    it('updates metadata (title, notifications)', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'meta-upd', prompt: 'test', schedule: '0 9 * * *', projectPath: '/p' },
      ]);
      writeTmpJson('.dorothy/scheduler-metadata.json', {
        'meta-upd': { title: 'Old', notifications: { telegram: false, slack: false }, createdAt: '2026-01-01' },
      });

      await registerHandlers();
      await invokeHandler('scheduler:updateTask', 'meta-upd', {
        title: 'New Title',
        notifications: { telegram: true, slack: true },
      });

      const metadata = JSON.parse(fs.readFileSync(
        path.join(tmpDir, '.dorothy', 'scheduler-metadata.json'), 'utf-8'
      ));
      expect(metadata['meta-upd'].title).toBe('New Title');
      expect(metadata['meta-upd'].notifications).toEqual({ telegram: true, slack: true });
    });

    it('returns error when task not found', async () => {
      writeTmpJson('.claude/schedules.json', []);
      await registerHandlers();

      const result = await invokeHandler('scheduler:updateTask', 'missing', {
        prompt: 'nope',
      }) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('scheduler:runTask', () => {
    it('runs existing script file', async () => {
      writeTmpJson('.claude/schedules.json', [
        { id: 'run-me', prompt: 'test', projectPath: '/p' },
      ]);
      const scriptsDir = path.join(tmpDir, '.dorothy', 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(path.join(scriptsDir, 'run-me.sh'), '#!/bin/bash\necho hi');

      await registerHandlers();
      const result = await invokeHandler('scheduler:runTask', 'run-me') as { success: boolean };
      expect(result.success).toBe(true);
    });

    it('returns error when task not found', async () => {
      writeTmpJson('.claude/schedules.json', []);
      await registerHandlers();

      const result = await invokeHandler('scheduler:runTask', 'ghost') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('scheduler:getLogs', () => {
    it('returns no-logs message when log file does not exist', async () => {
      await registerHandlers();
      const result = await invokeHandler('scheduler:getLogs', 'no-logs') as { logs: string; runs: unknown[] };
      expect(result.logs).toContain('No logs available');
      expect(result.runs).toEqual([]);
    });

    it('parses runs from log markers', async () => {
      const logsDir = path.join(tmpDir, '.claude', 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'parsed-task.log'), [
        '=== Task started at 2026-01-01 09:00 ===',
        'Running first task...',
        '{"type":"result","result":"done"}',
        '=== Task completed at 2026-01-01 09:05 ===',
        '=== Task started at 2026-01-02 09:00 ===',
        'Running second task...',
        '=== Task completed at 2026-01-02 09:03 ===',
      ].join('\n'));

      await registerHandlers();
      const result = await invokeHandler('scheduler:getLogs', 'parsed-task') as {
        runs: Array<{ startedAt: string; completedAt?: string; content: string }>;
      };

      expect(result.runs).toHaveLength(2);
      expect(result.runs[0].startedAt).toBe('2026-01-01 09:00');
      expect(result.runs[0].completedAt).toBe('2026-01-01 09:05');
      expect(result.runs[0].content).toContain('Running first task');
      expect(result.runs[1].startedAt).toBe('2026-01-02 09:00');
      expect(result.runs[1].completedAt).toBe('2026-01-02 09:03');
    });

    it('handles running task (no completion marker)', async () => {
      const logsDir = path.join(tmpDir, '.claude', 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'running-task.log'), [
        '=== Task started at 2026-01-01 09:00 ===',
        'Still running...',
      ].join('\n'));

      await registerHandlers();
      const result = await invokeHandler('scheduler:getLogs', 'running-task') as {
        runs: Array<{ startedAt: string; completedAt?: string }>;
      };

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].startedAt).toBe('2026-01-01 09:00');
      expect(result.runs[0].completedAt).toBeUndefined();
    });

    it('handles old log format without markers', async () => {
      const logsDir = path.join(tmpDir, '.claude', 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'old-format.log'), 'Some old log output\nLine 2\n');

      await registerHandlers();
      const result = await invokeHandler('scheduler:getLogs', 'old-format') as {
        runs: Array<{ startedAt: string; content: string }>;
      };

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].startedAt).toBe('Unknown');
      expect(result.runs[0].content).toContain('Some old log output');
    });

    it('appends error log to last run', async () => {
      const logsDir = path.join(tmpDir, '.claude', 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'errored.log'),
        '=== Task started at 2026-01-01 ===\nWork done\n=== Task completed at 2026-01-01 ===\n'
      );
      fs.writeFileSync(path.join(logsDir, 'errored.error.log'), 'Some stderr output\n');

      await registerHandlers();
      const result = await invokeHandler('scheduler:getLogs', 'errored') as {
        runs: Array<{ content: string }>;
      };

      expect(result.runs[0].content).toContain('=== Error Log ===');
      expect(result.runs[0].content).toContain('Some stderr output');
    });
  });

  describe('scheduler:fixMcpPaths', () => {
    it('succeeds when mcp.json does not exist', async () => {
      await registerHandlers();
      const result = await invokeHandler('scheduler:fixMcpPaths') as { success: boolean };
      expect(result.success).toBe(true);
    });

    it('succeeds when mcp.json has no mcpServers', async () => {
      writeTmpJson('.claude/mcp.json', { version: 1 });
      await registerHandlers();
      const result = await invokeHandler('scheduler:fixMcpPaths') as { success: boolean };
      expect(result.success).toBe(true);
    });
  });
});

// ── Pure function tests (replicated logic since not exported) ──────────────

describe('cronToHuman (logic)', () => {
  function cronToHuman(cron: string): string {
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (minute === '*' && hour === '*') return 'Every minute';
    if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return minute === '0' ? 'Every hour' : `Every hour at :${minute.padStart(2, '0')}`;
    }
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      const h = parseInt(hour, 10);
      const m = minute.padStart(2, '0');
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `Daily at ${displayHour}:${m} ${period}`;
    }
    if (dayOfWeek === '1-5' && dayOfMonth === '*' && month === '*') {
      const h = parseInt(hour, 10);
      const m = minute.padStart(2, '0');
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `Weekdays at ${displayHour}:${m} ${period}`;
    }
    if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNum = parseInt(dayOfWeek, 10);
      const dayName = days[dayNum] || dayOfWeek;
      const h = parseInt(hour, 10);
      const m = minute.padStart(2, '0');
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${dayName}s at ${displayHour}:${m} ${period}`;
    }
    if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
      const h = parseInt(hour, 10);
      const m = minute.padStart(2, '0');
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const daySuffix = dayOfMonth === '1' ? 'st' : dayOfMonth === '2' ? 'nd' : dayOfMonth === '3' ? 'rd' : 'th';
      return `Monthly on the ${dayOfMonth}${daySuffix} at ${displayHour}:${m} ${period}`;
    }
    return cron;
  }

  it('every minute', () => expect(cronToHuman('* * * * *')).toBe('Every minute'));
  it('every hour', () => expect(cronToHuman('0 * * * *')).toBe('Every hour'));
  it('every hour at :15', () => expect(cronToHuman('15 * * * *')).toBe('Every hour at :15'));
  it('daily at 9:00 AM', () => expect(cronToHuman('0 9 * * *')).toBe('Daily at 9:00 AM'));
  it('daily at 2:30 PM', () => expect(cronToHuman('30 14 * * *')).toBe('Daily at 2:30 PM'));
  it('daily at midnight', () => expect(cronToHuman('0 0 * * *')).toBe('Daily at 12:00 AM'));
  it('daily at noon', () => expect(cronToHuman('0 12 * * *')).toBe('Daily at 12:00 PM'));
  it('weekdays at 9am', () => expect(cronToHuman('0 9 * * 1-5')).toBe('Weekdays at 9:00 AM'));
  it('mondays at 10am', () => expect(cronToHuman('0 10 * * 1')).toBe('Mondays at 10:00 AM'));
  it('sundays at 8:30am', () => expect(cronToHuman('30 8 * * 0')).toBe('Sundays at 8:30 AM'));
  it('monthly 1st', () => expect(cronToHuman('0 9 1 * *')).toBe('Monthly on the 1st at 9:00 AM'));
  it('monthly 2nd', () => expect(cronToHuman('0 9 2 * *')).toBe('Monthly on the 2nd at 9:00 AM'));
  it('monthly 3rd', () => expect(cronToHuman('0 9 3 * *')).toBe('Monthly on the 3rd at 9:00 AM'));
  it('monthly 15th', () => expect(cronToHuman('0 9 15 * *')).toBe('Monthly on the 15th at 9:00 AM'));
  it('returns raw for specific month', () => expect(cronToHuman('0 9 1 6 *')).toBe('0 9 1 6 *'));
  it('returns raw for invalid', () => expect(cronToHuman('invalid')).toBe('invalid'));
});

describe('getNextRunTime (logic)', () => {
  function getNextRunTime(cron: string): string | undefined {
    try {
      const parts = cron.split(' ');
      if (parts.length !== 5) return undefined;
      const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
      const now = new Date();
      const next = new Date(now);
      if (hour !== '*') next.setHours(parseInt(hour, 10));
      if (minute !== '*') next.setMinutes(parseInt(minute, 10));
      next.setSeconds(0);
      next.setMilliseconds(0);
      if (next <= now) next.setDate(next.getDate() + 1);
      if (dayOfWeek !== '*') {
        const targetDays = dayOfWeek.split(',').map(d => parseInt(d, 10));
        while (!targetDays.includes(next.getDay())) next.setDate(next.getDate() + 1);
      }
      if (dayOfMonth !== '*') {
        const targetDay = parseInt(dayOfMonth, 10);
        while (next.getDate() !== targetDay) next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    } catch { return undefined; }
  }

  it('returns valid ISO string', () => {
    const result = getNextRunTime('0 9 * * *');
    expect(result).toBeDefined();
    expect(new Date(result!).toISOString()).toBe(result);
  });

  it('returns undefined for invalid cron', () => {
    expect(getNextRunTime('bad')).toBeUndefined();
    expect(getNextRunTime('1 2')).toBeUndefined();
  });

  it('returns future date', () => {
    const result = getNextRunTime('0 9 * * *')!;
    expect(new Date(result).getTime()).toBeGreaterThan(Date.now() - 60000);
  });

  it('respects day-of-week', () => {
    const result = getNextRunTime('0 9 * * 1')!; // Monday
    expect(new Date(result).getDay()).toBe(1);
  });

  it('respects day-of-month', () => {
    const result = getNextRunTime('0 9 15 * *')!;
    expect(new Date(result).getDate()).toBe(15);
  });

  it('handles comma-separated days', () => {
    const result = getNextRunTime('0 9 * * 1,3,5')!;
    expect([1, 3, 5]).toContain(new Date(result).getDay());
  });
});

describe('getLastRunStatus (logic)', () => {
  function getLastRunStatus(logContent: string): 'success' | 'error' {
    const startRegex = /^=== Task started at .+? ===$/gm;
    let lastStartIndex = -1;
    let match: RegExpExecArray | null;
    while ((match = startRegex.exec(logContent)) !== null) {
      lastStartIndex = match.index + match[0].length;
    }
    const relevantContent = lastStartIndex >= 0 ? logContent.slice(lastStartIndex) : logContent;
    return relevantContent.includes('error') || relevantContent.includes('Error') ? 'error' : 'success';
  }

  it('detects success when no error keywords', () => {
    expect(getLastRunStatus('=== Task started at 2026-01-01 ===\nAll good\n=== Task completed ===')).toBe('success');
  });

  it('detects error from last run only', () => {
    const log = [
      '=== Task started at 2026-01-01 ===',
      'Some error occurred',
      '=== Task completed at 2026-01-01 ===',
      '=== Task started at 2026-01-02 ===',
      'All clear now',
      '=== Task completed at 2026-01-02 ===',
    ].join('\n');
    expect(getLastRunStatus(log)).toBe('success');
  });

  it('detects error in last run', () => {
    const log = [
      '=== Task started at 2026-01-01 ===',
      'All good',
      '=== Task completed at 2026-01-01 ===',
      '=== Task started at 2026-01-02 ===',
      'Error: something broke',
      '=== Task completed at 2026-01-02 ===',
    ].join('\n');
    expect(getLastRunStatus(log)).toBe('error');
  });

  it('handles old format without markers', () => {
    expect(getLastRunStatus('Just some output')).toBe('success');
    expect(getLastRunStatus('Error happened')).toBe('error');
  });
});
