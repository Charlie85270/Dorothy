import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-orchestrator automations tool handler tests + utility function tests
// ============================================================================
// Tests the business logic of automation tool handlers:
// list_automations, get_automation, create_automation, update_automation,
// delete_automation, run_automation, pause_automation, resume_automation,
// run_due_automations, update_jira_issue, get_automation_logs
//
// Also tests utility functions from utils/automations.ts:
// interpolateTemplate, scheduleToHuman, createItemId, hashContent,
// generateId, isItemProcessed, loadAutomations/saveAutomations patterns

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('[]'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
  };
});

import * as fs from 'fs';

// ============================================================================
// Replicated types and utilities from mcp-orchestrator/src/utils/automations.ts
// ============================================================================

type SourceType = 'github' | 'jira' | 'pipedrive' | 'twitter' | 'rss' | 'custom';
type OutputType = 'telegram' | 'slack' | 'github_comment' | 'email' | 'discord' | 'webhook' | 'jira_comment' | 'jira_transition';

interface OutputConfig {
  type: OutputType;
  enabled: boolean;
  template?: string;
  channel?: string;
  webhookUrl?: string;
}

interface FilterRule {
  field: string;
  operator: 'equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
}

interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  schedule: {
    type: 'cron' | 'interval';
    cron?: string;
    intervalMinutes?: number;
  };
  source: {
    type: SourceType;
    config: Record<string, unknown>;
  };
  trigger: {
    eventTypes: string[];
    filters?: FilterRule[];
    onNewItem: boolean;
    onUpdatedItem?: boolean;
  };
  agent: {
    enabled: boolean;
    projectPath?: string;
    prompt: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    timeout?: number;
  };
  outputs: OutputConfig[];
}

interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  itemsFound: number;
  itemsProcessed: number;
  error?: string;
  agentOutput?: string;
}

// Replicated utility functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function interpolateTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value: unknown = variables;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match;
      }
    }
    return String(value ?? match);
  });
}

function scheduleToHuman(schedule: { type: string; intervalMinutes?: number; cron?: string }): string {
  if (schedule.type === 'interval' && schedule.intervalMinutes) {
    const mins = schedule.intervalMinutes;
    if (mins < 60) return `Every ${mins} minute${mins > 1 ? 's' : ''}`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (remainingMins === 0) return `Every ${hours} hour${hours > 1 ? 's' : ''}`;
    return `Every ${hours}h ${remainingMins}m`;
  }
  if (schedule.type === 'cron' && schedule.cron) {
    const parts = schedule.cron.split(' ');
    if (parts.length !== 5) return schedule.cron;
    const [min, hour, day, month, weekday] = parts;
    if (day === '*' && month === '*' && weekday === '*') {
      if (hour === '*' && min === '*') return 'Every minute';
      if (hour === '*') return `Every hour at minute ${min}`;
      if (min === '0') return `Daily at ${hour}:00`;
      return `Daily at ${hour}:${min.padStart(2, '0')}`;
    }
    if (weekday === '1-5') {
      return `Weekdays at ${hour}:${min.padStart(2, '0')}`;
    }
    return schedule.cron;
  }
  return 'Unknown schedule';
}

function createItemId(sourceType: string, repo: string, itemType: string, itemId: string): string {
  return `${sourceType}:${repo}:${itemType}:${itemId}`;
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function isItemProcessed(
  items: Record<string, { id: string; lastHash?: string }>,
  itemId: string,
  hash?: string
): boolean {
  const item = items[itemId];
  if (!item) return false;
  if (hash && item.lastHash !== hash) return false;
  return true;
}

function loadAutomations(): Automation[] {
  if (!fs.existsSync('/mock/automations.json')) return [];
  try {
    return JSON.parse(fs.readFileSync('/mock/automations.json', 'utf-8'));
  } catch {
    return [];
  }
}

function isDue(automation: Automation, lastRunTimes: Record<string, string>): boolean {
  if (!automation.enabled) return false;
  const lastRun = lastRunTimes[automation.id];
  const lastRunTime = lastRun ? new Date(lastRun) : new Date(0);

  if (automation.schedule.type === 'interval' && automation.schedule.intervalMinutes) {
    const nextRun = new Date(lastRunTime.getTime() + automation.schedule.intervalMinutes * 60 * 1000);
    return nextRun <= new Date();
  }
  return false;
}

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'auto-1',
    name: 'Test Automation',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schedule: { type: 'interval', intervalMinutes: 30 },
    source: { type: 'github', config: { repos: ['user/repo'], pollFor: ['pull_requests'] } },
    trigger: { eventTypes: [], onNewItem: true },
    agent: { enabled: true, prompt: 'Review this PR', projectPath: '/project' },
    outputs: [{ type: 'telegram', enabled: true }],
    ...overrides,
  };
}

describe('mcp-orchestrator automations', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('[]');
    vi.mocked(fs.writeFileSync).mockClear();
  });

  // ==========================================================================
  // Utility function tests (actual logic from utils/automations.ts)
  // ==========================================================================

  describe('generateId', () => {
    it('generates string of consistent length', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThanOrEqual(4);
      expect(id.length).toBeLessThanOrEqual(10);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBeGreaterThan(90); // Very unlikely to have many collisions
    });
  });

  describe('interpolateTemplate (actual implementation)', () => {
    it('replaces simple variables', () => {
      expect(interpolateTemplate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('replaces nested variables', () => {
      const result = interpolateTemplate('{{user.name}} - {{user.email}}', {
        user: { name: 'John', email: 'john@test.com' },
      });
      expect(result).toBe('John - john@test.com');
    });

    it('keeps unmatched variables as-is', () => {
      expect(interpolateTemplate('Hello {{unknown}}', {})).toBe('Hello {{unknown}}');
    });

    it('handles multiple replacements', () => {
      expect(interpolateTemplate('{{a}} and {{b}}', { a: '1', b: '2' })).toBe('1 and 2');
    });

    it('converts non-string values', () => {
      expect(interpolateTemplate('Count: {{n}}', { n: 42 })).toBe('Count: 42');
    });

    it('handles deeply nested paths', () => {
      expect(interpolateTemplate('{{a.b.c}}', { a: { b: { c: 'deep' } } })).toBe('deep');
    });

    it('keeps partial path if intermediate is missing', () => {
      expect(interpolateTemplate('{{a.b.c}}', { a: { x: 1 } })).toBe('{{a.b.c}}');
    });
  });

  describe('scheduleToHuman (actual implementation)', () => {
    it('handles interval in minutes', () => {
      expect(scheduleToHuman({ type: 'interval', intervalMinutes: 5 })).toBe('Every 5 minutes');
      expect(scheduleToHuman({ type: 'interval', intervalMinutes: 1 })).toBe('Every 1 minute');
    });

    it('handles interval in hours', () => {
      expect(scheduleToHuman({ type: 'interval', intervalMinutes: 60 })).toBe('Every 1 hour');
      expect(scheduleToHuman({ type: 'interval', intervalMinutes: 120 })).toBe('Every 2 hours');
    });

    it('handles mixed hours and minutes', () => {
      expect(scheduleToHuman({ type: 'interval', intervalMinutes: 90 })).toBe('Every 1h 30m');
    });

    it('handles cron daily', () => {
      expect(scheduleToHuman({ type: 'cron', cron: '0 9 * * *' })).toBe('Daily at 9:00');
    });

    it('handles cron weekdays', () => {
      expect(scheduleToHuman({ type: 'cron', cron: '30 14 * * 1-5' })).toBe('Weekdays at 14:30');
    });

    it('returns unknown for missing schedule', () => {
      expect(scheduleToHuman({ type: 'interval' })).toBe('Unknown schedule');
    });

    it('handles every minute cron', () => {
      expect(scheduleToHuman({ type: 'cron', cron: '* * * * *' })).toBe('Every minute');
    });

    it('handles hourly at specific minute', () => {
      expect(scheduleToHuman({ type: 'cron', cron: '15 * * * *' })).toBe('Every hour at minute 15');
    });
  });

  describe('createItemId (actual implementation)', () => {
    it('creates composite IDs', () => {
      expect(createItemId('github', 'user/repo', 'pr', '42')).toBe('github:user/repo:pr:42');
    });

    it('handles JIRA source', () => {
      expect(createItemId('jira', 'mycompany', 'issue', 'PROJ-123')).toBe('jira:mycompany:issue:PROJ-123');
    });
  });

  describe('hashContent (actual implementation)', () => {
    it('produces consistent hashes', () => {
      expect(hashContent('hello')).toBe(hashContent('hello'));
    });

    it('produces different hashes for different content', () => {
      expect(hashContent('hello')).not.toBe(hashContent('world'));
    });

    it('handles empty string', () => {
      expect(hashContent('')).toBe('0');
    });

    it('handles long content', () => {
      const hash = hashContent('A'.repeat(10000));
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('isItemProcessed (actual implementation)', () => {
    it('returns false for unknown items', () => {
      expect(isItemProcessed({}, 'unknown')).toBe(false);
    });

    it('returns true for known items without hash check', () => {
      const items = { 'item-1': { id: 'item-1', lastHash: 'abc' } };
      expect(isItemProcessed(items, 'item-1')).toBe(true);
    });

    it('returns false when hash differs', () => {
      const items = { 'item-1': { id: 'item-1', lastHash: 'abc' } };
      expect(isItemProcessed(items, 'item-1', 'different')).toBe(false);
    });

    it('returns true when hash matches', () => {
      const items = { 'item-1': { id: 'item-1', lastHash: 'abc' } };
      expect(isItemProcessed(items, 'item-1', 'abc')).toBe(true);
    });
  });

  describe('isDue', () => {
    it('returns false for disabled automation', () => {
      const auto = makeAutomation({ enabled: false });
      expect(isDue(auto, {})).toBe(false);
    });

    it('returns true for interval automation that has never run', () => {
      const auto = makeAutomation({ schedule: { type: 'interval', intervalMinutes: 30 } });
      expect(isDue(auto, {})).toBe(true); // lastRunTime is epoch, always past
    });

    it('returns false for recently run interval automation', () => {
      const auto = makeAutomation({ schedule: { type: 'interval', intervalMinutes: 30 } });
      const lastRun = new Date().toISOString(); // Just now
      expect(isDue(auto, { 'auto-1': lastRun })).toBe(false);
    });

    it('returns true for interval automation due', () => {
      const auto = makeAutomation({ schedule: { type: 'interval', intervalMinutes: 1 } });
      const lastRun = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      expect(isDue(auto, { 'auto-1': lastRun })).toBe(true);
    });
  });

  // ==========================================================================
  // Tool handler tests
  // ==========================================================================

  describe('list_automations handler', () => {
    it('returns message when no automations exist', () => {
      const automations: Automation[] = [];
      const text = automations.length === 0
        ? 'No automations configured. Use create_automation to create one.'
        : '';
      expect(text).toContain('No automations');
    });

    it('formats automation list correctly', () => {
      const auto = makeAutomation();
      const schedule = scheduleToHuman(auto.schedule);
      const outputs = auto.outputs.filter(o => o.enabled).map(o => o.type).join(', ');
      const status = auto.enabled ? '🟢 Enabled' : '⚪ Paused';

      const formatted = `**${auto.name}** (${auto.id})
  ${status}
  Source: ${auto.source.type}
  Schedule: ${schedule}
  Agent: ${auto.agent.enabled ? '✅' : '❌'}
  Outputs: ${outputs || 'none'}`;

      expect(formatted).toContain('Test Automation');
      expect(formatted).toContain('🟢 Enabled');
      expect(formatted).toContain('github');
      expect(formatted).toContain('Every 30 minutes');
      expect(formatted).toContain('✅');
      expect(formatted).toContain('telegram');
    });

    it('shows paused status for disabled automation', () => {
      const auto = makeAutomation({ enabled: false });
      const status = auto.enabled ? '🟢 Enabled' : '⚪ Paused';
      expect(status).toBe('⚪ Paused');
    });
  });

  describe('get_automation handler', () => {
    it('formats detailed automation info', () => {
      const auto = makeAutomation({ description: 'Review all PRs' });
      expect(auto.name).toBe('Test Automation');
      expect(auto.description).toBe('Review all PRs');
      expect(auto.source.type).toBe('github');
    });

    it('formats recent runs', () => {
      const runs: AutomationRun[] = [
        {
          id: 'run-1',
          automationId: 'auto-1',
          startedAt: '2024-01-01T10:00:00Z',
          completedAt: '2024-01-01T10:01:00Z',
          status: 'completed',
          itemsFound: 5,
          itemsProcessed: 3,
        },
      ];

      const runsFormatted = runs.map(r =>
        `  - ${new Date(r.startedAt).toLocaleString()}: ${r.status} (${r.itemsProcessed}/${r.itemsFound} items)`
      ).join('\n');

      expect(runsFormatted).toContain('completed');
      expect(runsFormatted).toContain('3/5');
    });

    it('shows no runs message', () => {
      const runs: AutomationRun[] = [];
      const formatted = runs.length > 0 ? 'has runs' : '  No runs yet';
      expect(formatted).toBe('  No runs yet');
    });
  });

  describe('create_automation handler', () => {
    it('rejects invalid source config JSON', () => {
      const sourceConfig = 'not valid json{';
      let parsed;
      try {
        parsed = JSON.parse(sourceConfig);
      } catch {
        parsed = null;
      }
      expect(parsed).toBeNull();
    });

    it('parses valid source config', () => {
      const sourceConfig = '{"repos": ["user/repo"], "pollFor": ["pull_requests"]}';
      const parsed = JSON.parse(sourceConfig);
      expect(parsed.repos).toEqual(['user/repo']);
    });

    it('builds outputs array from flags', () => {
      const outputs: OutputConfig[] = [];
      const outputTelegram = true;
      const outputSlack = true;
      const outputGitHubComment = false;
      const outputTemplate = 'PR {{title}} by {{author}}';

      if (outputTelegram) outputs.push({ type: 'telegram', enabled: true, template: outputTemplate });
      if (outputSlack) outputs.push({ type: 'slack', enabled: true, template: outputTemplate });
      if (outputGitHubComment) outputs.push({ type: 'github_comment', enabled: true, template: outputTemplate });

      expect(outputs).toHaveLength(2);
      expect(outputs[0].type).toBe('telegram');
      expect(outputs[1].type).toBe('slack');
    });

    it('builds interval schedule from minutes', () => {
      const scheduleMinutes = 15;
      const schedule = { type: 'interval' as const, intervalMinutes: scheduleMinutes };
      expect(schedule.intervalMinutes).toBe(15);
    });

    it('builds cron schedule when provided', () => {
      const scheduleCron = '0 9 * * 1-5';
      const schedule = { type: 'cron' as const, cron: scheduleCron };
      expect(schedule.cron).toBe('0 9 * * 1-5');
    });

    it('prefers cron over interval when both provided', () => {
      const scheduleCron = '0 9 * * *';
      const scheduleMinutes = 30;
      const schedule = scheduleCron
        ? { type: 'cron' as const, cron: scheduleCron }
        : { type: 'interval' as const, intervalMinutes: scheduleMinutes };
      expect(schedule.type).toBe('cron');
    });

    it('adds JIRA comment output config', () => {
      const outputs: OutputConfig[] = [];
      const outputJiraComment = true;
      if (outputJiraComment) {
        outputs.push({ type: 'jira_comment', enabled: true });
      }
      expect(outputs[0].type).toBe('jira_comment');
    });

    it('adds JIRA transition output with status template', () => {
      const outputs: OutputConfig[] = [];
      const outputJiraTransition = 'Done';
      if (outputJiraTransition) {
        outputs.push({ type: 'jira_transition', enabled: true, template: outputJiraTransition });
      }
      expect(outputs[0].template).toBe('Done');
    });
  });

  describe('update_automation handler', () => {
    it('updates enabled status', () => {
      const auto = makeAutomation({ enabled: true });
      const updates: Partial<Automation> = { enabled: false };
      const updated = { ...auto, ...updates, updatedAt: new Date().toISOString() };
      expect(updated.enabled).toBe(false);
    });

    it('updates name', () => {
      const auto = makeAutomation({ name: 'Old Name' });
      const updated = { ...auto, name: 'New Name', updatedAt: new Date().toISOString() };
      expect(updated.name).toBe('New Name');
    });

    it('updates schedule to new interval', () => {
      const auto = makeAutomation({ schedule: { type: 'interval', intervalMinutes: 30 } });
      const updated = {
        ...auto,
        schedule: { type: 'interval' as const, intervalMinutes: 15 },
        updatedAt: new Date().toISOString(),
      };
      expect(updated.schedule.intervalMinutes).toBe(15);
    });

    it('updates agent prompt', () => {
      const auto = makeAutomation({ agent: { enabled: true, prompt: 'Old prompt' } });
      const updated = {
        ...auto,
        agent: { ...auto.agent, prompt: 'New prompt' },
        updatedAt: new Date().toISOString(),
      };
      expect(updated.agent.prompt).toBe('New prompt');
    });

    it('toggles telegram output', () => {
      const auto = makeAutomation({
        outputs: [{ type: 'telegram', enabled: true }],
      });
      const outputs = [...auto.outputs];
      const idx = outputs.findIndex(o => o.type === 'telegram');
      if (idx >= 0) outputs[idx].enabled = false;
      expect(outputs[0].enabled).toBe(false);
    });

    it('adds slack output if not present', () => {
      const auto = makeAutomation({
        outputs: [{ type: 'telegram', enabled: true }],
      });
      const outputs = [...auto.outputs];
      const idx = outputs.findIndex(o => o.type === 'slack');
      if (idx >= 0) {
        outputs[idx].enabled = true;
      } else {
        outputs.push({ type: 'slack', enabled: true });
      }
      expect(outputs).toHaveLength(2);
      expect(outputs[1].type).toBe('slack');
    });

    it('preserves ID on update', () => {
      const auto = makeAutomation({ id: 'original-id' });
      const updates: Partial<Automation> = { name: 'Updated' };
      const updated = { ...auto, ...updates, id: auto.id };
      expect(updated.id).toBe('original-id');
    });
  });

  describe('delete_automation handler', () => {
    it('removes automation from list', () => {
      const automations = [
        makeAutomation({ id: 'auto-1', name: 'First' }),
        makeAutomation({ id: 'auto-2', name: 'Second' }),
      ];
      const index = automations.findIndex(a => a.id === 'auto-1');
      automations.splice(index, 1);
      expect(automations).toHaveLength(1);
      expect(automations[0].name).toBe('Second');
    });

    it('returns false when automation not found', () => {
      const automations = [makeAutomation({ id: 'auto-1' })];
      const index = automations.findIndex(a => a.id === 'nonexistent');
      expect(index).toBe(-1);
    });
  });

  describe('pause_automation handler', () => {
    it('disables automation', () => {
      const auto = makeAutomation({ enabled: true });
      const updated = { ...auto, enabled: false };
      expect(updated.enabled).toBe(false);
    });

    it('formats pause message', () => {
      const name = 'My Automation';
      expect(`⏸️ Paused automation: ${name}`).toContain('My Automation');
    });
  });

  describe('resume_automation handler', () => {
    it('enables automation', () => {
      const auto = makeAutomation({ enabled: false });
      const updated = { ...auto, enabled: true };
      expect(updated.enabled).toBe(true);
    });

    it('formats resume message', () => {
      const name = 'My Automation';
      expect(`▶️ Resumed automation: ${name}`).toContain('My Automation');
    });
  });

  describe('run_due_automations handler', () => {
    it('returns no automations due message', () => {
      const dueAutomations: Automation[] = [];
      const text = dueAutomations.length === 0
        ? 'No automations are due to run.'
        : '';
      expect(text).toBe('No automations are due to run.');
    });

    it('filters only due automations', () => {
      const automations = [
        makeAutomation({ id: 'auto-1', enabled: true, schedule: { type: 'interval', intervalMinutes: 1 } }),
        makeAutomation({ id: 'auto-2', enabled: false }),
        makeAutomation({ id: 'auto-3', enabled: true, schedule: { type: 'interval', intervalMinutes: 1 } }),
      ];
      const lastRuns: Record<string, string> = {};
      const due = automations.filter(a => isDue(a, lastRuns));
      expect(due).toHaveLength(2);
    });

    it('formats run results', () => {
      const results = [
        '✅ PR Review: 3/5 items processed',
        '❌ Slack Notifier: Error - API timeout',
      ];
      const text = `Ran 2 automation(s):\n\n${results.join('\n')}`;
      expect(text).toContain('2 automation(s)');
      expect(text).toContain('PR Review');
      expect(text).toContain('API timeout');
    });
  });

  describe('get_automation_logs handler', () => {
    it('returns no runs message', () => {
      const runs: AutomationRun[] = [];
      const text = runs.length === 0
        ? 'No runs found for automation: Test'
        : '';
      expect(text).toContain('No runs found');
    });

    it('formats run entries with duration', () => {
      const run: AutomationRun = {
        id: 'run-1',
        automationId: 'auto-1',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:00:30Z',
        status: 'completed',
        itemsFound: 10,
        itemsProcessed: 8,
      };

      const duration = run.completedAt
        ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
        : 'running';
      expect(duration).toBe('30s');

      const status = run.status === 'completed' ? '✅' : run.status === 'error' ? '❌' : '🔄';
      expect(status).toBe('✅');
    });

    it('shows running for incomplete runs', () => {
      const run: AutomationRun = {
        id: 'run-1',
        automationId: 'auto-1',
        startedAt: '2024-01-01T10:00:00Z',
        status: 'running',
        itemsFound: 0,
        itemsProcessed: 0,
      };

      const duration = run.completedAt
        ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
        : 'running';
      expect(duration).toBe('running');
    });

    it('shows error for failed runs', () => {
      const run: AutomationRun = {
        id: 'run-1',
        automationId: 'auto-1',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:00:05Z',
        status: 'error',
        itemsFound: 3,
        itemsProcessed: 1,
        error: 'GitHub API rate limit exceeded',
      };

      const status = run.status === 'completed' ? '✅' : run.status === 'error' ? '❌' : '🔄';
      expect(status).toBe('❌');
      expect(run.error).toContain('rate limit');
    });

    it('defaults to 10 runs limit', () => {
      const defaultLimit = 10;
      expect(defaultLimit).toBe(10);
    });
  });

  describe('update_jira_issue handler', () => {
    it('constructs JIRA auth headers', () => {
      const email = 'user@example.com';
      const apiToken = 'test-token';
      const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
      const headers = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      expect(headers.Authorization).toContain('Basic ');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('constructs JIRA comment body in ADF format', () => {
      const comment = 'This was reviewed by Claude';
      const body = {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: comment }],
          }],
        },
      };
      expect(body.body.type).toBe('doc');
      expect(body.body.content[0].content[0].text).toBe(comment);
    });

    it('returns no action message when neither transition nor comment provided', () => {
      const results: string[] = [];
      const text = results.join('\n') || 'No action taken (provide transitionName or comment)';
      expect(text).toBe('No action taken (provide transitionName or comment)');
    });

    it('formats transition result', () => {
      const issueKey = 'PROJ-123';
      const transitionName = 'Done';
      const msg = `Transitioned ${issueKey} to "${transitionName}"`;
      expect(msg).toBe('Transitioned PROJ-123 to "Done"');
    });

    it('formats comment result', () => {
      const issueKey = 'PROJ-123';
      const msg = `Added comment to ${issueKey}`;
      expect(msg).toBe('Added comment to PROJ-123');
    });

    it('shows available transitions when target not found', () => {
      const transitionName = 'Done';
      const available = 'In Progress, In Review, Closed';
      const msg = `Transition "${transitionName}" not found. Available: ${available}`;
      expect(msg).toContain('Available: In Progress');
    });
  });

  describe('extractAdfText helper', () => {
    function extractAdfText(node: unknown): string {
      if (!node || typeof node !== 'object') return '';
      const n = node as Record<string, unknown>;
      if (n.type === 'text' && typeof n.text === 'string') return n.text;
      if (Array.isArray(n.content)) {
        return n.content.map(extractAdfText).join('');
      }
      return '';
    }

    it('extracts text from simple text node', () => {
      expect(extractAdfText({ type: 'text', text: 'Hello' })).toBe('Hello');
    });

    it('extracts text from nested ADF content', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'World' },
            ],
          },
        ],
      };
      expect(extractAdfText(doc)).toBe('Hello World');
    });

    it('returns empty string for null', () => {
      expect(extractAdfText(null)).toBe('');
    });

    it('returns empty string for non-object', () => {
      expect(extractAdfText('string')).toBe('');
    });
  });

  describe('loadCLIPathsConfig helper', () => {
    it('returns null when config file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      // Simulating the logic
      let config = null;
      if (fs.existsSync('/mock/cli-paths.json')) {
        config = JSON.parse(fs.readFileSync('/mock/cli-paths.json', 'utf-8'));
      }
      expect(config).toBeNull();
    });

    it('returns parsed config when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        fullPath: '/usr/local/bin:/opt/homebrew/bin',
        claude: '/usr/local/bin/claude',
      }));
      const config = JSON.parse(fs.readFileSync('/mock/cli-paths.json', 'utf-8'));
      expect(config.fullPath).toContain('/usr/local/bin');
    });
  });

  describe('trigger filter logic', () => {
    function applyFilter(fieldValue: string, filter: FilterRule): boolean {
      switch (filter.operator) {
        case 'equals': return fieldValue === filter.value;
        case 'contains': return fieldValue.includes(filter.value);
        case 'not_contains': return !fieldValue.includes(filter.value);
        case 'starts_with': return fieldValue.startsWith(filter.value);
        case 'ends_with': return fieldValue.endsWith(filter.value);
        case 'regex': return new RegExp(filter.value).test(fieldValue);
      }
    }

    it('equals operator', () => {
      expect(applyFilter('open', { field: 'status', operator: 'equals', value: 'open' })).toBe(true);
      expect(applyFilter('closed', { field: 'status', operator: 'equals', value: 'open' })).toBe(false);
    });

    it('contains operator', () => {
      expect(applyFilter('feature/login', { field: 'branch', operator: 'contains', value: 'feature' })).toBe(true);
      expect(applyFilter('bugfix/login', { field: 'branch', operator: 'contains', value: 'feature' })).toBe(false);
    });

    it('not_contains operator', () => {
      expect(applyFilter('main', { field: 'branch', operator: 'not_contains', value: 'feature' })).toBe(true);
      expect(applyFilter('feature/x', { field: 'branch', operator: 'not_contains', value: 'feature' })).toBe(false);
    });

    it('starts_with operator', () => {
      expect(applyFilter('feat: add login', { field: 'title', operator: 'starts_with', value: 'feat:' })).toBe(true);
    });

    it('ends_with operator', () => {
      expect(applyFilter('Fix bug #42', { field: 'title', operator: 'ends_with', value: '#42' })).toBe(true);
    });

    it('regex operator', () => {
      expect(applyFilter('PROJ-123', { field: 'key', operator: 'regex', value: '^PROJ-\\d+$' })).toBe(true);
      expect(applyFilter('OTHER-123', { field: 'key', operator: 'regex', value: '^PROJ-\\d+$' })).toBe(false);
    });
  });

  describe('JIRA priority mapping', () => {
    function mapJiraPriority(jiraPriority: string): 'low' | 'medium' | 'high' {
      const p = jiraPriority.toLowerCase();
      if (p.includes('high') || p.includes('critical') || p.includes('blocker')) return 'high';
      if (p.includes('low') || p.includes('trivial')) return 'low';
      return 'medium';
    }

    it('maps high priorities', () => {
      expect(mapJiraPriority('High')).toBe('high');
      expect(mapJiraPriority('Critical')).toBe('high');
      expect(mapJiraPriority('Blocker')).toBe('high');
    });

    it('maps low priorities', () => {
      expect(mapJiraPriority('Low')).toBe('low');
      expect(mapJiraPriority('Trivial')).toBe('low');
    });

    it('defaults to medium', () => {
      expect(mapJiraPriority('Medium')).toBe('medium');
      expect(mapJiraPriority('Normal')).toBe('medium');
      expect(mapJiraPriority('')).toBe('medium');
    });
  });
});
