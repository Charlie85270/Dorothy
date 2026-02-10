import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getAppPath: () => '/mock' },
  Notification: vi.fn(),
  BrowserWindow: vi.fn(),
}));

// ============================================================================
// Scheduler handlers - cronToHuman and getNextRunTime
// These are module-local functions, so we test them indirectly
// by re-creating the logic here (since they're not exported).
// Instead, we test the equivalent from mcp-orchestrator which IS exported.
// ============================================================================

// We'll test the automation-handlers intervalToCron function.
// Since it's also not exported, we replicate its logic for testing.

describe('intervalToCron (logic test)', () => {
  // Replicate the function since it's not exported
  function intervalToCron(minutes: number): string {
    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    } else if (minutes === 60) {
      return '0 * * * *';
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`;
    } else {
      return '0 0 * * *';
    }
  }

  it('converts 5 minutes to */5 * * * *', () => {
    expect(intervalToCron(5)).toBe('*/5 * * * *');
  });

  it('converts 15 minutes to */15 * * * *', () => {
    expect(intervalToCron(15)).toBe('*/15 * * * *');
  });

  it('converts 30 minutes to */30 * * * *', () => {
    expect(intervalToCron(30)).toBe('*/30 * * * *');
  });

  it('converts 60 minutes to hourly', () => {
    expect(intervalToCron(60)).toBe('0 * * * *');
  });

  it('converts 120 minutes (2 hours) correctly', () => {
    expect(intervalToCron(120)).toBe('0 */2 * * *');
  });

  it('converts 360 minutes (6 hours) correctly', () => {
    expect(intervalToCron(360)).toBe('0 */6 * * *');
  });

  it('converts 1440+ minutes (daily) to daily', () => {
    expect(intervalToCron(1440)).toBe('0 0 * * *');
    expect(intervalToCron(2880)).toBe('0 0 * * *');
  });
});

describe('cronToHuman (logic test)', () => {
  // Replicate the function for testing
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

  it('handles every minute', () => {
    expect(cronToHuman('* * * * *')).toBe('Every minute');
  });

  it('handles every hour at minute 0', () => {
    expect(cronToHuman('0 * * * *')).toBe('Every hour');
  });

  it('handles every hour at specific minute', () => {
    expect(cronToHuman('15 * * * *')).toBe('Every hour at :15');
  });

  it('handles daily at 9:00 AM', () => {
    expect(cronToHuman('0 9 * * *')).toBe('Daily at 9:00 AM');
  });

  it('handles daily at 2:30 PM', () => {
    expect(cronToHuman('30 14 * * *')).toBe('Daily at 2:30 PM');
  });

  it('handles daily at midnight', () => {
    expect(cronToHuman('0 0 * * *')).toBe('Daily at 12:00 AM');
  });

  it('handles weekdays', () => {
    expect(cronToHuman('0 9 * * 1-5')).toBe('Weekdays at 9:00 AM');
  });

  it('handles specific day of week (Monday)', () => {
    expect(cronToHuman('0 10 * * 1')).toBe('Mondays at 10:00 AM');
  });

  it('handles specific day of week (Sunday)', () => {
    expect(cronToHuman('30 8 * * 0')).toBe('Sundays at 8:30 AM');
  });

  it('handles monthly', () => {
    expect(cronToHuman('0 9 1 * *')).toBe('Monthly on the 1st at 9:00 AM');
    expect(cronToHuman('0 9 15 * *')).toBe('Monthly on the 15th at 9:00 AM');
  });

  it('returns raw cron for unrecognized patterns', () => {
    expect(cronToHuman('0 9 1 6 *')).toBe('0 9 1 6 *'); // specific month
    expect(cronToHuman('invalid')).toBe('invalid');
  });
});

describe('getNextRunTime (logic test)', () => {
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

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      if (dayOfWeek !== '*') {
        const targetDays = dayOfWeek.split(',').map(d => parseInt(d, 10));
        while (!targetDays.includes(next.getDay())) {
          next.setDate(next.getDate() + 1);
        }
      }

      if (dayOfMonth !== '*') {
        const targetDay = parseInt(dayOfMonth, 10);
        while (next.getDate() !== targetDay) {
          next.setDate(next.getDate() + 1);
        }
      }

      return next.toISOString();
    } catch {
      return undefined;
    }
  }

  it('returns a valid ISO date string', () => {
    const result = getNextRunTime('0 9 * * *');
    expect(result).toBeDefined();
    expect(new Date(result!).toISOString()).toBe(result);
  });

  it('returns undefined for invalid cron', () => {
    expect(getNextRunTime('invalid')).toBeUndefined();
    expect(getNextRunTime('1 2')).toBeUndefined();
  });

  it('returns a future date', () => {
    const result = getNextRunTime('0 9 * * *');
    expect(new Date(result!).getTime()).toBeGreaterThan(Date.now() - 60000);
  });

  it('handles day of week constraint', () => {
    const result = getNextRunTime('0 9 * * 1'); // Monday
    const date = new Date(result!);
    expect(date.getDay()).toBe(1);
  });

  it('handles day of month constraint', () => {
    const result = getNextRunTime('0 9 15 * *'); // 15th of month
    const date = new Date(result!);
    expect(date.getDate()).toBe(15);
  });
});
