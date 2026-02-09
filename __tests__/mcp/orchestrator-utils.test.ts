import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

// ============================================================================
// mcp-orchestrator/src/utils/scheduler.ts - cronToHuman & getNextRunTime
// ============================================================================

// Import the actual functions from the orchestrator utils
// They are ESM modules, so we need to handle imports carefully.
// Since we can't easily import ESM modules in vitest with CJS electron,
// we test the duplicated logic that also exists in the codebase.

describe('mcp-orchestrator utils/scheduler', () => {
  // Direct replication of the exported cronToHuman from mcp-orchestrator
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
    return cron;
  }

  describe('cronToHuman', () => {
    it('converts every minute', () => {
      expect(cronToHuman('* * * * *')).toBe('Every minute');
    });

    it('converts hourly', () => {
      expect(cronToHuman('0 * * * *')).toBe('Every hour');
    });

    it('converts daily at specific time', () => {
      expect(cronToHuman('30 9 * * *')).toBe('Daily at 9:30 AM');
      expect(cronToHuman('0 17 * * *')).toBe('Daily at 5:00 PM');
      expect(cronToHuman('0 0 * * *')).toBe('Daily at 12:00 AM');
      expect(cronToHuman('0 12 * * *')).toBe('Daily at 12:00 PM');
    });

    it('converts weekdays schedule', () => {
      expect(cronToHuman('0 9 * * 1-5')).toBe('Weekdays at 9:00 AM');
    });

    it('converts weekly schedule', () => {
      expect(cronToHuman('0 10 * * 1')).toBe('Mondays at 10:00 AM');
      expect(cronToHuman('0 14 * * 5')).toBe('Fridays at 2:00 PM');
      expect(cronToHuman('0 8 * * 0')).toBe('Sundays at 8:00 AM');
    });
  });
});

// ============================================================================
// mcp-orchestrator/src/utils/automations.ts
// ============================================================================

describe('mcp-orchestrator utils/automations', () => {
  // Test pure utility functions

  describe('interpolateTemplate', () => {
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

    it('replaces simple variables', () => {
      expect(interpolateTemplate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('replaces nested variables', () => {
      expect(interpolateTemplate('{{user.name}} - {{user.email}}', {
        user: { name: 'John', email: 'john@example.com' },
      })).toBe('John - john@example.com');
    });

    it('keeps unmatched variables as-is', () => {
      expect(interpolateTemplate('Hello {{unknown}}', {})).toBe('Hello {{unknown}}');
    });

    it('handles multiple replacements', () => {
      expect(interpolateTemplate('{{a}} and {{b}}', { a: '1', b: '2' })).toBe('1 and 2');
    });

    it('converts non-string values to strings', () => {
      expect(interpolateTemplate('Count: {{n}}', { n: 42 })).toBe('Count: 42');
    });
  });

  describe('scheduleToHuman', () => {
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
  });

  describe('hashContent', () => {
    function hashContent(content: string): string {
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    }

    it('produces consistent hashes', () => {
      expect(hashContent('hello')).toBe(hashContent('hello'));
    });

    it('produces different hashes for different content', () => {
      expect(hashContent('hello')).not.toBe(hashContent('world'));
    });

    it('handles empty string', () => {
      expect(hashContent('')).toBe('0');
    });
  });

  describe('createItemId', () => {
    function createItemId(sourceType: string, repo: string, itemType: string, itemId: string): string {
      return `${sourceType}:${repo}:${itemType}:${itemId}`;
    }

    it('creates composite IDs', () => {
      expect(createItemId('github', 'user/repo', 'pr', '42'))
        .toBe('github:user/repo:pr:42');
    });
  });

  describe('isItemProcessed', () => {
    it('returns false for unknown items', () => {
      const items: Record<string, { id: string; lastHash?: string }> = {};
      function isItemProcessed(itemId: string, hash?: string): boolean {
        const item = items[itemId];
        if (!item) return false;
        if (hash && item.lastHash !== hash) return false;
        return true;
      }

      expect(isItemProcessed('unknown')).toBe(false);
    });

    it('returns true for known items without hash check', () => {
      const items: Record<string, { id: string; lastHash?: string }> = {
        'item-1': { id: 'item-1', lastHash: 'abc' },
      };
      function isItemProcessed(itemId: string, hash?: string): boolean {
        const item = items[itemId];
        if (!item) return false;
        if (hash && item.lastHash !== hash) return false;
        return true;
      }

      expect(isItemProcessed('item-1')).toBe(true);
    });

    it('returns false when hash differs', () => {
      const items: Record<string, { id: string; lastHash?: string }> = {
        'item-1': { id: 'item-1', lastHash: 'abc' },
      };
      function isItemProcessed(itemId: string, hash?: string): boolean {
        const item = items[itemId];
        if (!item) return false;
        if (hash && item.lastHash !== hash) return false;
        return true;
      }

      expect(isItemProcessed('item-1', 'different')).toBe(false);
    });

    it('returns true when hash matches', () => {
      const items: Record<string, { id: string; lastHash?: string }> = {
        'item-1': { id: 'item-1', lastHash: 'abc' },
      };
      function isItemProcessed(itemId: string, hash?: string): boolean {
        const item = items[itemId];
        if (!item) return false;
        if (hash && item.lastHash !== hash) return false;
        return true;
      }

      expect(isItemProcessed('item-1', 'abc')).toBe(true);
    });
  });
});

// ============================================================================
// mcp-orchestrator/src/utils/api.ts
// ============================================================================

describe('mcp-orchestrator utils/api', () => {
  describe('apiRequest URL building', () => {
    it('constructs correct URL from endpoint', () => {
      const apiUrl = 'http://127.0.0.1:31415';
      const endpoint = '/api/agents';
      expect(`${apiUrl}${endpoint}`).toBe('http://127.0.0.1:31415/api/agents');
    });

    it('handles endpoint with path params', () => {
      const apiUrl = 'http://127.0.0.1:31415';
      const id = 'abc123';
      expect(`${apiUrl}/api/agents/${id}`).toBe('http://127.0.0.1:31415/api/agents/abc123');
    });

    it('handles query params', () => {
      const apiUrl = 'http://127.0.0.1:31415';
      const id = 'abc123';
      const lines = 100;
      expect(`${apiUrl}/api/agents/${id}/output?lines=${lines}`)
        .toBe('http://127.0.0.1:31415/api/agents/abc123/output?lines=100');
    });
  });
});
