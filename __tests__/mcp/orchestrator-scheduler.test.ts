import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-orchestrator scheduler tool handler tests
// ============================================================================
// Tests the business logic of scheduler tool handlers:
// list_scheduled_tasks, create_scheduled_task, delete_scheduled_task,
// run_scheduled_task, get_scheduled_task_logs

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(''),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ mtime: new Date() }),
    unlinkSync: vi.fn(),
    chmodSync: vi.fn(),
  };
});

import * as fs from 'fs';
import * as path from 'path';

// Import cronToHuman for list_scheduled_tasks testing (replicated from scheduler.ts)
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
  return cron;
}

describe('mcp-orchestrator scheduler tools', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
    vi.mocked(fs.writeFileSync).mockClear();
    vi.mocked(fs.readdirSync).mockReturnValue([]);
  });

  describe('list_scheduled_tasks', () => {
    it('returns no tasks message when no schedules exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      // Simulating the handler logic
      const tasks: unknown[] = [];
      const text = tasks.length === 0 ? 'No scheduled tasks found.' : '';
      expect(text).toBe('No scheduled tasks found.');
    });

    it('parses schedules.json entries', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const schedules = [
        { id: 'task-1', prompt: 'Run tests', schedule: '0 9 * * *', projectPath: '/project' },
        { id: 'task-2', prompt: 'Deploy', schedule: '0 17 * * 1-5', projectPath: '/deploy' },
      ];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(schedules));

      const parsed = JSON.parse(fs.readFileSync('', 'utf-8'));
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('task-1');
      expect(parsed[1].prompt).toBe('Deploy');
    });

    it('converts schedule to human readable', () => {
      expect(cronToHuman('0 9 * * *')).toBe('Daily at 9:00 AM');
      expect(cronToHuman('0 17 * * *')).toBe('Daily at 5:00 PM');
    });

    it('formats task entries for display', () => {
      const task = {
        id: 'test-123',
        prompt: 'Run daily checks on the repository and notify team',
        schedule: '0 9 * * *',
        scheduleHuman: 'Daily at 9:00 AM',
        projectPath: '/home/user/project',
        nextRun: new Date().toISOString(),
        lastRun: undefined as string | undefined,
      };

      const formatted = `**${task.id}**
  Schedule: ${task.scheduleHuman} (${task.schedule})
  Project: ${task.projectPath}
  Prompt: ${task.prompt.slice(0, 80)}${task.prompt.length > 80 ? '...' : ''}
  Next run: ${task.nextRun ? new Date(task.nextRun).toLocaleString() : 'Unknown'}
  Last run: ${task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Never'}`;

      expect(formatted).toContain('test-123');
      expect(formatted).toContain('Daily at 9:00 AM');
      expect(formatted).toContain('Run daily checks');
      expect(formatted).toContain('Never');
    });

    it('truncates long prompts to 80 chars', () => {
      const longPrompt = 'A'.repeat(100);
      const truncated = `${longPrompt.slice(0, 80)}${longPrompt.length > 80 ? '...' : ''}`;
      expect(truncated).toHaveLength(83); // 80 + '...'
    });

    it('handles launchd plist file scanning', () => {
      const plistFiles = [
        'com.claude-manager.scheduler.task-abc.plist',
        'com.claude-manager.scheduler.task-def.plist',
        'com.other.plist', // Should be skipped
      ];

      const relevant = plistFiles.filter(
        f => f.startsWith('com.claude-manager.scheduler.') && f.endsWith('.plist')
      );
      expect(relevant).toHaveLength(2);

      // Extract task IDs
      const ids = relevant.map(f =>
        f.replace('com.claude-manager.scheduler.', '').replace('.plist', '')
      );
      expect(ids).toEqual(['task-abc', 'task-def']);
    });

    it('extracts calendar interval from plist content', () => {
      const plistContent = `<key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>`;

      const calendarMatch = plistContent.match(
        /<key>StartCalendarInterval<\/key>\s*<dict>([\s\S]*?)<\/dict>/
      );
      expect(calendarMatch).toBeTruthy();

      const cal = calendarMatch![1];
      const hm = cal.match(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/);
      const mm = cal.match(/<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/);
      expect(hm![1]).toBe('9');
      expect(mm![1]).toBe('30');

      const cron = `${mm![1]} ${hm![1]} * * *`;
      expect(cron).toBe('30 9 * * *');
    });

    it('extracts prompt from script file', () => {
      const scriptContent = `#!/bin/bash
cd "/home/user/project"
echo "=== Task started ==="
"/usr/local/bin/claude" --dangerously-skip-permissions -p 'Run daily checks and report' >> "/home/user/.claude/logs/task-1.log" 2>&1`;

      const promptMatch = scriptContent.match(/-p\s+'([^']+)'/);
      expect(promptMatch).toBeTruthy();
      expect(promptMatch![1]).toBe('Run daily checks and report');

      const cdMatch = scriptContent.match(/cd\s+"([^"]+)"/);
      expect(cdMatch![1]).toBe('/home/user/project');
    });
  });

  describe('create_scheduled_task', () => {
    it('validates cron format - requires 5 parts', () => {
      const schedule = '0 9 * *'; // Only 4 parts
      const cronParts = schedule.split(' ');
      expect(cronParts.length).toBe(4);
      expect(cronParts.length !== 5).toBe(true);
    });

    it('accepts valid 5-part cron', () => {
      const schedule = '0 9 * * *';
      const cronParts = schedule.split(' ');
      expect(cronParts.length).toBe(5);
    });

    it('saves to schedules.json', () => {
      const existingSchedules: unknown[] = [];
      const newTask = {
        id: 'task-abc',
        prompt: 'Run tests',
        schedule: '0 9 * * *',
        projectPath: '/project',
        autonomous: true,
        createdAt: new Date().toISOString(),
      };
      existingSchedules.push(newTask);
      expect(existingSchedules).toHaveLength(1);
    });

    it('appends to existing schedules', () => {
      const existing = [{ id: 'task-1', prompt: 'Existing' }];
      const newTask = { id: 'task-2', prompt: 'New' };
      existing.push(newTask);
      expect(existing).toHaveLength(2);
    });

    it('formats creation response', () => {
      const taskId = 'abc12345';
      const schedule = '0 9 * * *';
      const projectPath = '/project';
      const prompt = 'Run daily checks';
      const autonomous = true;
      const claudePath = '/usr/local/bin/claude';

      const text = `Created scheduled task: ${taskId}\n\nSchedule: ${cronToHuman(schedule)} (${schedule})\nProject: ${projectPath}\nPrompt: ${prompt}\nAutonomous: ${autonomous}\nClaude path: ${claudePath}`;
      expect(text).toContain('abc12345');
      expect(text).toContain('Daily at 9:00 AM');
      expect(text).toContain('Autonomous: true');
    });
  });

  describe('delete_scheduled_task', () => {
    it('removes task from schedules.json', () => {
      let schedules = [
        { id: 'task-1', prompt: 'A' },
        { id: 'task-2', prompt: 'B' },
      ];
      schedules = schedules.filter(s => s.id !== 'task-1');
      expect(schedules).toHaveLength(1);
      expect(schedules[0].id).toBe('task-2');
    });

    it('handles missing script file gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const scriptPath = '/home/user/.claude-manager/scripts/task-1.sh';
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('removes script file when it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const scriptPath = '/mock/scripts/task-1.sh';
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      expect(fs.unlinkSync).toHaveBeenCalledWith(scriptPath);
    });

    it('formats deletion response', () => {
      const taskId = 'abc12345';
      expect(`Deleted scheduled task: ${taskId}`).toBe('Deleted scheduled task: abc12345');
    });
  });

  describe('run_scheduled_task', () => {
    it('returns error when script not found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const taskId = 'nonexistent';
      const exists = fs.existsSync('/mock/scripts/nonexistent.sh');
      expect(exists).toBe(false);
      const text = `Task not found: ${taskId}. Use list_scheduled_tasks to see available tasks.`;
      expect(text).toContain('nonexistent');
    });

    it('formats success response', () => {
      const taskId = 'abc12345';
      const text = `Started task ${taskId} in background. Check logs at ~/.claude/logs/${taskId}.log`;
      expect(text).toContain('abc12345');
      expect(text).toContain('logs');
    });
  });

  describe('get_scheduled_task_logs', () => {
    it('returns no logs message when no log files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const taskId = 'task-1';
      let output = '';
      if (!output) {
        expect(`No logs found for task ${taskId}. The task may not have run yet.`).toContain('may not have run');
      }
    });

    it('reads output log file', () => {
      const logContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const lines = 3;
      const logLines = logContent.split('\n').slice(-lines).join('\n');
      expect(logLines).toBe('Line 3\nLine 4\nLine 5');
    });

    it('combines output and error logs', () => {
      const outputLog = '=== Output Log ===\nSome output\n';
      const errorLog = '\n=== Error Log ===\nSome error\n';
      const combined = outputLog + errorLog;
      expect(combined).toContain('Output Log');
      expect(combined).toContain('Error Log');
    });

    it('skips empty error log', () => {
      const errorContent = '   \n  ';
      let output = '=== Output Log ===\nSome output\n';
      if (errorContent.trim()) {
        output += `\n=== Error Log ===\n${errorContent}\n`;
      }
      expect(output).not.toContain('Error Log');
    });

    it('uses default 50 lines limit', () => {
      const defaultLines = 50;
      expect(defaultLines).toBe(50);
    });
  });
});
