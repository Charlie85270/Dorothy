import { useState } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { ScheduledTask } from '../types';
import { buildCronExpression } from '../utils';

const INITIAL_EDIT = {
  title: '',
  prompt: '',
  schedulePreset: 'custom',
  customCron: '',
  time: '09:00',
  intervalDays: 2,
  selectedDays: ['1'] as string[],
  projectPath: '',
  autonomous: true,
  notifyTelegram: false,
  notifySlack: false,
};

export function useEditForm(
  loadTasks: () => Promise<void>,
  showToast: (msg: string, type: 'success' | 'error' | 'info', ms?: number) => void,
) {
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [editForm, setEditForm] = useState(INITIAL_EDIT);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleEditTask = (task: ScheduledTask) => {
    const cron = task.schedule;
    const parts = cron.split(' ');
    let preset = 'custom';
    let time = '09:00';
    let intervalDays = 2;
    let selectedDays: string[] = ['1'];

    if (parts.length === 5) {
      const [min, hr, dom, , dow] = parts;
      if (hr.includes(',') || min.includes(',') || hr.includes('/') || min.includes('/')) {
        preset = 'custom';
      } else {
        if (hr !== '*') {
          time = `${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
        }
        if (hr === '*' && dom === '*' && dow === '*') {
          preset = 'hourly';
        } else if (dom.startsWith('*/') && dow === '*') {
          preset = 'every_n_days';
          intervalDays = parseInt(dom.slice(2)) || 2;
        } else if (dom === '*' && dow === '1-5') {
          preset = 'weekdays';
        } else if (dom === '1' && dow === '*') {
          preset = 'monthly';
        } else if (dom === '*' && dow !== '*') {
          preset = 'specific_days';
          selectedDays = dow.split(',');
        } else if (dom === '*' && dow === '*') {
          preset = 'daily';
        }
      }
    }

    setEditingTask(task);
    setEditForm({
      title: task.title || '',
      prompt: task.prompt,
      schedulePreset: preset,
      customCron: preset === 'custom' ? cron : '',
      time,
      intervalDays,
      selectedDays,
      projectPath: task.projectPath,
      autonomous: task.autonomous,
      notifyTelegram: task.notifications.telegram,
      notifySlack: task.notifications.slack,
    });
  };

  const handleSaveEdit = async () => {
    if (!isElectron() || !editingTask) return;
    setIsSavingEdit(true);
    try {
      const newCron = buildCronExpression({
        schedulePreset: editForm.schedulePreset,
        customCron: editForm.customCron,
        time: editForm.time,
        intervalDays: editForm.intervalDays,
        selectedDays: editForm.selectedDays,
      });

      const updates: {
        title?: string;
        prompt?: string;
        schedule?: string;
        projectPath?: string;
        autonomous?: boolean;
        notifications?: { telegram: boolean; slack: boolean };
      } = {};

      if (editForm.title !== (editingTask.title || '')) updates.title = editForm.title;
      if (editForm.prompt !== editingTask.prompt) updates.prompt = editForm.prompt;
      if (newCron !== editingTask.schedule) updates.schedule = newCron;
      if (editForm.projectPath !== editingTask.projectPath) updates.projectPath = editForm.projectPath;
      if (editForm.autonomous !== editingTask.autonomous) updates.autonomous = editForm.autonomous;
      if (editForm.notifyTelegram !== editingTask.notifications.telegram ||
          editForm.notifySlack !== editingTask.notifications.slack) {
        updates.notifications = { telegram: editForm.notifyTelegram, slack: editForm.notifySlack };
      }

      if (Object.keys(updates).length === 0) {
        setEditingTask(null);
        return;
      }

      const result = await window.electronAPI?.scheduler?.updateTask(editingTask.id, updates);
      if (result?.success) {
        await loadTasks();
        setEditingTask(null);
        showToast('Task updated successfully', 'success');
      } else {
        showToast(result?.error || 'Failed to update task', 'error', 3000);
      }
    } catch (err) {
      console.error('Error updating task:', err);
      showToast('Failed to update task', 'error', 3000);
    }
    setIsSavingEdit(false);
  };

  return {
    editingTask,
    setEditingTask,
    editForm,
    setEditForm,
    isSavingEdit,
    handleEditTask,
    handleSaveEdit,
  };
}
