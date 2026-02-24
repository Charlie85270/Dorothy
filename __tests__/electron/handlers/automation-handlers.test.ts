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
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn(), end: vi.fn() },
    on: vi.fn((event: string, cb: () => void) => { if (event === 'close') cb(); }),
    unref: vi.fn(),
  })),
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

beforeEach(() => {
  vi.resetModules();
  handlers = new Map();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-test-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmpJson(rel: string, data: unknown): void {
  const full = path.join(tmpDir, rel);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('automation-handlers', () => {
  async function registerHandlers() {
    const { registerAutomationHandlers } = await import('../../../electron/handlers/automation-handlers');
    registerAutomationHandlers();
  }

  describe('automation:list', () => {
    it('returns empty list when no automations exist', async () => {
      await registerHandlers();
      const result = await invokeHandler('automation:list') as { automations: unknown[] };
      expect(result.automations).toEqual([]);
    });

    it('returns stored automations', async () => {
      writeTmpJson('.dorothy/automations.json', [
        { id: 'auto-1', name: 'Test Automation', enabled: true },
      ]);

      await registerHandlers();
      const result = await invokeHandler('automation:list') as { automations: Array<{ id: string }> };
      expect(result.automations).toHaveLength(1);
      expect(result.automations[0].id).toBe('auto-1');
    });
  });

  describe('automation:create', () => {
    it('creates a new automation', async () => {
      await registerHandlers();

      const result = await invokeHandler('automation:create', {
        name: 'New Automation',
        description: 'Test description',
        sourceType: 'github',
        sourceConfig: JSON.stringify({ repo: 'test/repo' }),
        scheduleMinutes: 30,
        eventTypes: ['push'],
        onNewItem: true,
        agentEnabled: true,
        agentPrompt: 'Handle this event',
      }) as { success: boolean; automationId: string };

      expect(result.success).toBe(true);
      expect(result.automationId).toBeTruthy();

      // Verify it was saved
      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      expect(automations).toHaveLength(1);
      expect(automations[0].name).toBe('New Automation');
      expect(automations[0].schedule.type).toBe('interval');
      expect(automations[0].schedule.intervalMinutes).toBe(30);
      expect(automations[0].source.type).toBe('github');
    });

    it('creates with cron schedule', async () => {
      await registerHandlers();

      const result = await invokeHandler('automation:create', {
        name: 'Cron Automation',
        sourceType: 'rss',
        sourceConfig: JSON.stringify({ url: 'https://example.com/feed' }),
        scheduleCron: '0 9 * * 1-5',
      }) as { success: boolean };

      expect(result.success).toBe(true);

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      expect(automations[0].schedule.type).toBe('cron');
      expect(automations[0].schedule.cron).toBe('0 9 * * 1-5');
    });

    it('creates with output configurations', async () => {
      await registerHandlers();

      await invokeHandler('automation:create', {
        name: 'Notifier',
        sourceType: 'github',
        sourceConfig: '{}',
        outputTelegram: true,
        outputSlack: true,
        outputGitHubComment: true,
        outputTemplate: 'New event: {{summary}}',
      });

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      expect(automations[0].outputs).toHaveLength(3);
      expect(automations[0].outputs.map((o: { type: string }) => o.type)).toContain('telegram');
      expect(automations[0].outputs.map((o: { type: string }) => o.type)).toContain('slack');
      expect(automations[0].outputs.map((o: { type: string }) => o.type)).toContain('github_comment');
    });

    it('returns error for invalid source config JSON', async () => {
      await registerHandlers();

      const result = await invokeHandler('automation:create', {
        name: 'Bad Config',
        sourceType: 'github',
        sourceConfig: 'not json',
      }) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid source config JSON');
    });
  });

  describe('automation:update', () => {
    it('updates automation name and enabled state', async () => {
      writeTmpJson('.dorothy/automations.json', [
        { id: 'upd-1', name: 'Original', enabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01',
          schedule: { type: 'interval', intervalMinutes: 60 }, source: { type: 'github', config: {} },
          trigger: { eventTypes: [], onNewItem: true }, agent: { enabled: false, prompt: '' }, outputs: [] },
      ]);

      await registerHandlers();
      const result = await invokeHandler('automation:update', 'upd-1', {
        name: 'Updated Name',
        enabled: false,
      }) as { success: boolean };

      expect(result.success).toBe(true);

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      expect(automations[0].name).toBe('Updated Name');
      expect(automations[0].enabled).toBe(false);
    });

    it('returns error for non-existent automation', async () => {
      writeTmpJson('.dorothy/automations.json', []);
      await registerHandlers();

      const result = await invokeHandler('automation:update', 'missing', { name: 'X' }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Automation not found');
    });
  });

  describe('automation:delete', () => {
    it('removes automation from storage', async () => {
      writeTmpJson('.dorothy/automations.json', [
        { id: 'del-1', name: 'Delete Me', enabled: true, schedule: { type: 'interval', intervalMinutes: 60 },
          source: { type: 'github', config: {} }, trigger: { eventTypes: [], onNewItem: true },
          agent: { enabled: false, prompt: '' }, outputs: [] },
      ]);

      await registerHandlers();
      const result = await invokeHandler('automation:delete', 'del-1') as { success: boolean };
      expect(result.success).toBe(true);

      const automations = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.dorothy', 'automations.json'), 'utf-8')
      );
      expect(automations).toHaveLength(0);
    });

    it('returns error for non-existent automation', async () => {
      writeTmpJson('.dorothy/automations.json', []);
      await registerHandlers();

      const result = await invokeHandler('automation:delete', 'nope') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Automation not found');
    });
  });

  describe('automation:run', () => {
    it('runs automation script if it exists', async () => {
      writeTmpJson('.dorothy/automations.json', [
        { id: 'run-1', name: 'Run Me', enabled: true, schedule: { type: 'interval', intervalMinutes: 60 },
          source: { type: 'github', config: {} }, trigger: { eventTypes: [], onNewItem: true },
          agent: { enabled: false, prompt: '' }, outputs: [] },
      ]);
      const scriptsDir = path.join(tmpDir, '.dorothy', 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(path.join(scriptsDir, 'automation-run-1.sh'), '#!/bin/bash');

      await registerHandlers();
      const result = await invokeHandler('automation:run', 'run-1') as { success: boolean };
      expect(result.success).toBe(true);
    });

    it('returns error when script not found', async () => {
      writeTmpJson('.dorothy/automations.json', [
        { id: 'no-script', name: 'No Script', enabled: true, schedule: { type: 'interval', intervalMinutes: 60 },
          source: { type: 'github', config: {} }, trigger: { eventTypes: [], onNewItem: true },
          agent: { enabled: false, prompt: '' }, outputs: [] },
      ]);

      await registerHandlers();
      const result = await invokeHandler('automation:run', 'no-script') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Automation script not found');
    });

    it('returns error for non-existent automation', async () => {
      writeTmpJson('.dorothy/automations.json', []);
      await registerHandlers();

      const result = await invokeHandler('automation:run', 'ghost') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Automation not found');
    });
  });

  describe('automation:getLogs', () => {
    it('returns no-logs message when log file does not exist', async () => {
      await registerHandlers();
      const result = await invokeHandler('automation:getLogs', 'no-logs') as { runs: unknown[]; logs: string };
      expect(result.runs).toEqual([]);
      expect(result.logs).toContain('No logs available');
    });

    it('parses runs from log markers', async () => {
      const logsDir = path.join(tmpDir, '.dorothy', 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'automation-parsed.log'), [
        '=== Automation started at 2026-01-01 09:00 ===',
        'Processing items...',
        '=== Automation completed at 2026-01-01 09:05 ===',
        '=== Automation started at 2026-01-02 09:00 ===',
        'Error: something failed',
        '=== Automation completed at 2026-01-02 09:03 ===',
      ].join('\n'));

      await registerHandlers();
      const result = await invokeHandler('automation:getLogs', 'parsed') as {
        runs: Array<{ startedAt: string; status: string }>;
      };

      // Returns most recent first
      expect(result.runs).toHaveLength(2);
      expect(result.runs[0].status).toBe('error'); // most recent first, has error
      expect(result.runs[1].status).toBe('completed');
    });

    it('detects running status when no completion marker', async () => {
      const logsDir = path.join(tmpDir, '.dorothy', 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(path.join(logsDir, 'automation-running.log'), [
        '=== Automation started at 2026-01-01 09:00 ===',
        'Still working...',
      ].join('\n'));

      await registerHandlers();
      const result = await invokeHandler('automation:getLogs', 'running') as {
        runs: Array<{ status: string }>;
      };

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].status).toBe('running');
    });
  });
});

// ── Pure function tests ──────────────────────────────────────────────────────

describe('intervalToCron (logic)', () => {
  function intervalToCron(minutes: number): string {
    if (minutes < 60) return `*/${minutes} * * * *`;
    if (minutes === 60) return '0 * * * *';
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`;
    }
    return '0 0 * * *';
  }

  it('5 minutes', () => expect(intervalToCron(5)).toBe('*/5 * * * *'));
  it('15 minutes', () => expect(intervalToCron(15)).toBe('*/15 * * * *'));
  it('30 minutes', () => expect(intervalToCron(30)).toBe('*/30 * * * *'));
  it('60 minutes (hourly)', () => expect(intervalToCron(60)).toBe('0 * * * *'));
  it('120 minutes (2 hours)', () => expect(intervalToCron(120)).toBe('0 */2 * * *'));
  it('360 minutes (6 hours)', () => expect(intervalToCron(360)).toBe('0 */6 * * *'));
  it('1440 minutes (daily)', () => expect(intervalToCron(1440)).toBe('0 0 * * *'));
  it('2880 minutes (>daily)', () => expect(intervalToCron(2880)).toBe('0 0 * * *'));
});
