export interface ScheduledTask {
  id: string;
  title?: string;
  prompt: string;
  schedule: string;
  scheduleHuman: string;
  projectPath: string;
  agentId?: string;
  agentName?: string;
  autonomous: boolean;
  worktree?: {
    enabled: boolean;
    branchPrefix?: string;
  };
  notifications: {
    telegram: boolean;
    slack: boolean;
  };
  createdAt: string;
  lastRun?: string;
  lastRunStatus?: 'success' | 'error';
  nextRun?: string;
}

export interface Agent {
  id: string;
  name?: string;
  projectPath: string;
  status: string;
}

export interface ScheduleFormFields {
  schedulePreset: string;
  customCron: string;
  time: string;
  intervalDays: number;
  selectedDays: string[];
}

export interface TaskLogRun {
  startedAt: string;
  completedAt?: string;
  content: string;
}

export interface SelectedLogs {
  taskId: string;
  logs: string;
  runs: TaskLogRun[];
  selectedRunIndex: number;
}

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

export const SCHEDULE_PRESETS = [
  { value: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { value: 'daily', label: 'Every day', cron: '0 9 * * *' },
  { value: 'every_n_days', label: 'Every N days', cron: '' },
  { value: 'specific_days', label: 'Specific days', cron: '' },
  { value: 'weekdays', label: 'Weekdays (Mon\u2013Fri)', cron: '0 9 * * 1-5' },
  { value: 'monthly', label: 'Monthly', cron: '0 9 1 * *' },
  { value: 'custom', label: 'Custom cron', cron: '' },
] as const;

export const DAY_OPTIONS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
] as const;
