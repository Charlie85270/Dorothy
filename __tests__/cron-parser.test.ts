import { describe, it, expect } from 'vitest';
import {
  expandField,
  detectStep,
  cronToCalendarEntries,
  calendarEntriesToCron,
  parseCronToPreset,
} from '../electron/utils/cron-parser';

// ─── expandField ─────────────────────────────────────────────────────────────

describe('expandField', () => {
  it('returns [undefined] for wildcard *', () => {
    expect(expandField('*', 24)).toEqual([undefined]);
  });

  it('expands */3 over 24 hours', () => {
    expect(expandField('*/3', 24)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
  });

  it('expands */2 over 24 hours', () => {
    expect(expandField('*/2', 24)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
  });

  it('expands */6 over 24 hours', () => {
    expect(expandField('*/6', 24)).toEqual([0, 6, 12, 18]);
  });

  it('expands */30 over 60 minutes', () => {
    expect(expandField('*/30', 60)).toEqual([0, 30]);
  });

  it('handles single value', () => {
    expect(expandField('9', 24)).toEqual([9]);
  });

  it('handles comma-separated values', () => {
    expect(expandField('1,7,13', 24)).toEqual([1, 7, 13]);
  });

  it('handles comma-separated with spaces', () => {
    expect(expandField('0, 6, 12, 18', 24)).toEqual([0, 6, 12, 18]);
  });
});

// ─── detectStep ──────────────────────────────────────────────────────────────

describe('detectStep', () => {
  it('detects */3 from [0,3,6,9,12,15,18,21]', () => {
    expect(detectStep([0, 3, 6, 9, 12, 15, 18, 21], 24)).toBe('*/3');
  });

  it('detects */6 from [0,6,12,18]', () => {
    expect(detectStep([0, 6, 12, 18], 24)).toBe('*/6');
  });

  it('returns null for non-regular pattern', () => {
    expect(detectStep([1, 7, 13], 24)).toBeNull();
  });

  it('returns null if not starting at 0', () => {
    expect(detectStep([3, 6, 9], 24)).toBeNull();
  });

  it('returns null for single value', () => {
    expect(detectStep([6], 24)).toBeNull();
  });

  it('returns null for two values not forming full step', () => {
    // [0, 8] would need [0,8,16] to be */8
    expect(detectStep([0, 8], 24)).toBeNull();
  });
});

// ─── cronToCalendarEntries ────────────────────────────────────────────────────

describe('cronToCalendarEntries', () => {
  it('converts "0 */3 * * *" to 8 entries', () => {
    const entries = cronToCalendarEntries('0 */3 * * *');
    expect(entries).toHaveLength(8);
    expect(entries.map(e => e.Hour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
    expect(entries.every(e => e.Minute === 0)).toBe(true);
  });

  it('converts "30 6,15 * * *" to 2 entries', () => {
    const entries = cronToCalendarEntries('30 6,15 * * *');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ Hour: 6, Minute: 30 });
    expect(entries[1]).toEqual({ Hour: 15, Minute: 30 });
  });

  it('converts "0 1,7,13 * * *" to 3 entries', () => {
    const entries = cronToCalendarEntries('0 1,7,13 * * *');
    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.Hour)).toEqual([1, 7, 13]);
  });

  it('converts "0 9 * * *" (daily at 9am) to 1 entry', () => {
    const entries = cronToCalendarEntries('0 9 * * *');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ Hour: 9, Minute: 0 });
  });

  it('converts "0 * * * *" (hourly) to 1 entry with no Hour', () => {
    const entries = cronToCalendarEntries('0 * * * *');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ Minute: 0 });
  });

  it('converts "0 9 1 * *" (monthly) correctly', () => {
    const entries = cronToCalendarEntries('0 9 1 * *');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ Hour: 9, Minute: 0, Day: 1 });
  });

  it('converts "0 9 * * 1" (weekly Monday) correctly', () => {
    const entries = cronToCalendarEntries('0 9 * * 1');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ Hour: 9, Minute: 0, Weekday: 1 });
  });

  it('throws on invalid cron', () => {
    expect(() => cronToCalendarEntries('0 9 * *')).toThrow();
  });
});

// ─── calendarEntriesToCron ────────────────────────────────────────────────────

describe('calendarEntriesToCron', () => {
  it('reconstructs "0 */3 * * *" from 8 entries', () => {
    const entries = [0, 3, 6, 9, 12, 15, 18, 21].map(h => ({ Hour: h, Minute: 0 }));
    expect(calendarEntriesToCron(entries)).toBe('0 */3 * * *');
  });

  it('reconstructs "30 6,15 * * *" from 2 entries', () => {
    const entries = [{ Hour: 6, Minute: 30 }, { Hour: 15, Minute: 30 }];
    expect(calendarEntriesToCron(entries)).toBe('30 6,15 * * *');
  });

  it('reconstructs "0 1,7,13 * * *" from 3 entries', () => {
    const entries = [1, 7, 13].map(h => ({ Hour: h, Minute: 0 }));
    expect(calendarEntriesToCron(entries)).toBe('0 1,7,13 * * *');
  });

  it('reconstructs single daily entry', () => {
    expect(calendarEntriesToCron([{ Hour: 9, Minute: 0 }])).toBe('0 9 * * *');
  });

  it('handles empty entries', () => {
    expect(calendarEntriesToCron([])).toBe('* * * * *');
  });

  it('round-trips "0 */6 * * *"', () => {
    const cron = '0 */6 * * *';
    const entries = cronToCalendarEntries(cron);
    expect(calendarEntriesToCron(entries)).toBe(cron);
  });

  it('round-trips "0 1,7,13 * * *"', () => {
    const cron = '0 1,7,13 * * *';
    const entries = cronToCalendarEntries(cron);
    expect(calendarEntriesToCron(entries)).toBe(cron);
  });
});

// ─── parseCronToPreset ────────────────────────────────────────────────────────

describe('parseCronToPreset', () => {
  it('"0 */3 * * *" → custom (step expression)', () => {
    const r = parseCronToPreset('0 */3 * * *');
    expect(r.preset).toBe('custom');
    expect(r.customCron).toBe('0 */3 * * *');
  });

  it('"0 */2 * * *" → custom', () => {
    expect(parseCronToPreset('0 */2 * * *').preset).toBe('custom');
  });

  it('"0 1,7,13 * * *" → custom (comma-separated hours)', () => {
    const r = parseCronToPreset('0 1,7,13 * * *');
    expect(r.preset).toBe('custom');
    expect(r.customCron).toBe('0 1,7,13 * * *');
  });

  it('"30 6,15 * * *" → custom', () => {
    expect(parseCronToPreset('30 6,15 * * *').preset).toBe('custom');
  });

  it('"0 * * * *" → hourly', () => {
    expect(parseCronToPreset('0 * * * *').preset).toBe('hourly');
  });

  it('"0 9 * * *" → daily at 09:00', () => {
    const r = parseCronToPreset('0 9 * * *');
    expect(r.preset).toBe('daily');
    expect(r.time).toBe('09:00');
  });

  it('"30 18 * * *" → daily at 18:30', () => {
    const r = parseCronToPreset('30 18 * * *');
    expect(r.preset).toBe('daily');
    expect(r.time).toBe('18:30');
  });

  it('"0 9 * * 1-5" → weekdays', () => {
    expect(parseCronToPreset('0 9 * * 1-5').preset).toBe('weekdays');
  });

  it('"0 9 1 * *" → monthly', () => {
    expect(parseCronToPreset('0 9 1 * *').preset).toBe('monthly');
  });

  it('"0 9 */2 * *" → every_n_days', () => {
    const r = parseCronToPreset('0 9 */2 * *');
    expect(r.preset).toBe('every_n_days');
    expect(r.intervalDays).toBe(2);
  });

  it('"0 9 * * 1,3,5" → specific_days', () => {
    const r = parseCronToPreset('0 9 * * 1,3,5');
    expect(r.preset).toBe('specific_days');
    expect(r.selectedDays).toEqual(['1', '3', '5']);
  });

  it('"0 0 * * *" → daily at midnight', () => {
    const r = parseCronToPreset('0 0 * * *');
    expect(r.preset).toBe('daily');
    expect(r.time).toBe('00:00');
  });

  it('"invalid" → custom', () => {
    expect(parseCronToPreset('invalid').preset).toBe('custom');
  });

  it('"* * * * *" → hourly (every minute treated as hourly-like)', () => {
    // minute=* hour=* dom=* → hourly preset
    expect(parseCronToPreset('* * * * *').preset).toBe('hourly');
  });
});
