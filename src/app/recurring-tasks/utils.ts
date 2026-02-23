import { SCHEDULE_PRESETS, type ScheduleFormFields } from './types';

export function buildCronExpression(fields: ScheduleFormFields): string {
  const [hour, minute] = fields.time.split(':');

  if (fields.schedulePreset === 'custom') return fields.customCron;
  if (fields.schedulePreset === 'hourly') return '0 * * * *';
  if (fields.schedulePreset === 'every_n_days') {
    return `${minute} ${hour} */${fields.intervalDays} * *`;
  }
  if (fields.schedulePreset === 'specific_days') {
    const days = [...fields.selectedDays].sort((a, b) => parseInt(a) - parseInt(b)).join(',');
    return `${minute} ${hour} * * ${days}`;
  }

  const preset = SCHEDULE_PRESETS.find(p => p.value === fields.schedulePreset);
  if (!preset?.cron) return fields.customCron;
  return preset.cron.replace(/^0 9/, `${minute} ${hour}`);
}

export function formatNextRun(nextRun: string | undefined): string | null {
  if (!nextRun) return null;
  const now = new Date();
  const next = new Date(nextRun);
  const diffMs = next.getTime() - now.getTime();

  if (diffMs < 0) return null;

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'in < 1 min';
  if (diffMins < 60) return `in ${diffMins} min`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 1) return 'in 1 day';
  return `in ${diffDays} days`;
}
