import { useState } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { Agent } from '../types';
import { buildCronExpression } from '../utils';

const INITIAL_FORM = {
  agentId: '',
  projectPath: '',
  title: '',
  prompt: '',
  schedulePreset: 'daily',
  customCron: '',
  time: '09:00',
  days: ['1', '2', '3', '4', '5'],
  intervalDays: 2,
  selectedDays: ['1'] as string[],
  autonomous: true,
  useWorktree: false,
  notifyTelegram: false,
  notifySlack: false,
};

export function useTaskForm(
  agents: Agent[],
  loadTasks: () => Promise<void>,
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void,
) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateTask = async () => {
    if (!isElectron()) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const cron = buildCronExpression({
        schedulePreset: formData.schedulePreset,
        customCron: formData.customCron,
        time: formData.time,
        intervalDays: formData.intervalDays,
        selectedDays: formData.selectedDays,
      });

      // Build prompt with notification instructions
      let fullPrompt = formData.prompt;
      if (formData.notifyTelegram || formData.notifySlack) {
        fullPrompt += '\n\nAfter completing this task, send a brief summary of the results';
        if (formData.notifyTelegram && formData.notifySlack) {
          fullPrompt += ' to both Telegram (using send_telegram MCP tool) and Slack (using send_slack MCP tool).';
        } else if (formData.notifyTelegram) {
          fullPrompt += ' to Telegram using the send_telegram MCP tool.';
        } else {
          fullPrompt += ' to Slack using the send_slack MCP tool.';
        }
      }

      const selectedAgent = agents.find(a => a.id === formData.agentId);
      const projectPath = formData.projectPath || selectedAgent?.projectPath || '';

      if (!formData.title.trim()) {
        setCreateError('Please enter a title for this task');
        setIsCreating(false);
        return;
      }

      if (!projectPath) {
        setCreateError('Please select an agent or enter a project path');
        setIsCreating(false);
        return;
      }

      const result = await window.electronAPI?.scheduler?.createTask({
        title: formData.title.trim(),
        agentId: formData.agentId || undefined,
        prompt: fullPrompt,
        schedule: cron,
        projectPath,
        autonomous: formData.autonomous,
        useWorktree: formData.useWorktree,
        notifications: {
          telegram: formData.notifyTelegram,
          slack: formData.notifySlack,
        },
      });

      if (result?.success) {
        setShowCreateForm(false);
        setFormData(INITIAL_FORM);
        await loadTasks();
        showToast('Task created successfully', 'success');
      } else {
        setCreateError(result?.error || 'Failed to create task');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    }
    setIsCreating(false);
  };

  return {
    showCreateForm,
    setShowCreateForm,
    formData,
    setFormData,
    isCreating,
    createError,
    handleCreateTask,
  };
}
