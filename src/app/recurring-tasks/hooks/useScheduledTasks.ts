import { useState, useEffect, useCallback } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { ScheduledTask, Agent } from '../types';

export function useScheduledTasks(showToast: (msg: string, type: 'success' | 'error' | 'info', ms?: number) => void) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSchedule, setFilterSchedule] = useState<string>('all');

  const loadTasks = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI?.scheduler?.listTasks();
      if (result?.tasks) {
        setTasks(result.tasks);
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const agentList = await window.electronAPI?.agent.list();
      if (agentList) {
        setAgents(agentList.map(a => ({
          id: a.id,
          name: a.name,
          projectPath: a.projectPath,
          status: a.status,
        })));
      }
    } catch (err) {
      console.error('Error loading agents:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadTasks(), loadAgents()]);
      setIsLoading(false);
    };
    init();
  }, [loadTasks, loadAgents]);

  // Smart polling
  useEffect(() => {
    if (!isElectron() || tasks.length === 0) return;

    const shouldPoll = () => {
      const now = Date.now();
      const fiveMin = 5 * 60 * 1000;
      const oneHour = 60 * 60 * 1000;
      if (runningTasks.size > 0) return true;
      return tasks.some(task => {
        if (task.nextRun && new Date(task.nextRun).getTime() - now < fiveMin) return true;
        if (task.lastRun && now - new Date(task.lastRun).getTime() < oneHour) return true;
        return false;
      });
    };

    const check = async () => {
      if (!shouldPoll()) return;
      const running = new Set<string>();
      await Promise.all(tasks.map(async (task) => {
        try {
          const result = await window.electronAPI?.scheduler?.getLogs(task.id);
          if (result?.runs?.some((r: { completedAt?: string }) => !r.completedAt)) {
            running.add(task.id);
          }
        } catch { /* ignore */ }
      }));
      setRunningTasks(prev => {
        const justFinished = [...prev].some(id => !running.has(id));
        if (justFinished) loadTasks();
        return running;
      });
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [tasks, runningTasks.size, loadTasks]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadTasks(), loadAgents()]);
    setIsRefreshing(false);
    showToast('Tasks refreshed', 'success');
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!isElectron()) return;
    if (!confirm('Are you sure you want to delete this scheduled task?')) return;
    try {
      await window.electronAPI?.scheduler?.deleteTask(taskId);
      await loadTasks();
      showToast('Task deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting task:', err);
      showToast('Failed to delete task', 'error', 3000);
    }
  };

  const handleRunTask = async (taskId: string) => {
    if (!isElectron()) return;
    setRunningTaskId(taskId);
    try {
      const result = await window.electronAPI?.scheduler?.runTask(taskId);
      if (result?.success) {
        showToast('Task started in background', 'success', 3000);
      } else {
        showToast(result?.error || 'Failed to run task', 'error', 3000);
      }
    } catch (err) {
      console.error('Error running task:', err);
      showToast('Failed to run task', 'error', 3000);
    }
    setRunningTaskId(null);
  };

  // Unique projects from tasks
  const projects = [...new Set(tasks.map(t => t.projectPath))];

  // Filtered tasks
  const filteredTasks = tasks.filter(task => {
    if (filterProject !== 'all' && task.projectPath !== filterProject) return false;
    if (filterSchedule !== 'all') {
      const isHourly = task.schedule.includes('* * * *');
      const isDaily = !isHourly && task.schedule.split(' ')[4] === '*';
      const isWeekly = task.schedule.split(' ')[4] !== '*';
      if (filterSchedule === 'hourly' && !isHourly) return false;
      if (filterSchedule === 'daily' && !isDaily) return false;
      if (filterSchedule === 'weekly' && !isWeekly) return false;
    }
    return true;
  });

  return {
    tasks,
    agents,
    isLoading,
    isRefreshing,
    runningTaskId,
    runningTasks,
    filterProject,
    setFilterProject,
    filterSchedule,
    setFilterSchedule,
    projects,
    filteredTasks,
    loadTasks,
    handleRefresh,
    handleDeleteTask,
    handleRunTask,
  };
}
