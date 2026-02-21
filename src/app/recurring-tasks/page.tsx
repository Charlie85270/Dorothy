'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarClock,
  Plus,
  RefreshCw,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  Bot,
  FolderOpen,
  Send,
  Filter,
  X,
  Play,
  Pencil,
} from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';
import SchedulerCalendar from '@/components/SchedulerCalendar';

// Slack Icon component
const SlackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512 512" fill="currentColor">
    <path d="M126.12,315.1A47.06,47.06,0,1,1,79.06,268h47.06Z"/>
    <path d="M149.84,315.1a47.06,47.06,0,0,1,94.12,0V432.94a47.06,47.06,0,1,1-94.12,0Z"/>
    <path d="M196.9,126.12A47.06,47.06,0,1,1,244,79.06v47.06Z"/>
    <path d="M196.9,149.84a47.06,47.06,0,0,1,0,94.12H79.06a47.06,47.06,0,0,1,0-94.12Z"/>
    <path d="M385.88,196.9A47.06,47.06,0,1,1,432.94,244H385.88Z"/>
    <path d="M362.16,196.9a47.06,47.06,0,0,1-94.12,0V79.06a47.06,47.06,0,1,1,94.12,0Z"/>
    <path d="M315.1,385.88A47.06,47.06,0,1,1,268,432.94V385.88Z"/>
    <path d="M315.1,362.16a47.06,47.06,0,0,1,0-94.12H432.94a47.06,47.06,0,1,1,0,94.12Z"/>
  </svg>
);

interface ScheduledTask {
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

interface Agent {
  id: string;
  name?: string;
  projectPath: string;
  status: string;
}

const SCHEDULE_PRESETS = [
  { value: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { value: 'daily', label: 'Every day', cron: '0 9 * * *' },
  { value: 'every_n_days', label: 'Every N days', cron: '' },
  { value: 'specific_days', label: 'Specific days', cron: '' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)', cron: '0 9 * * 1-5' },
  { value: 'monthly', label: 'Monthly', cron: '0 9 1 * *' },
  { value: 'custom', label: 'Custom cron', cron: '' },
];

const DAY_OPTIONS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
];

export default function RecurringTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<{
    taskId: string;
    logs: string;
    runs: Array<{ startedAt: string; completedAt?: string; content: string }>;
    selectedRunIndex: number;
  } | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [editForm, setEditForm] = useState({
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
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSchedule, setFilterSchedule] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    agentId: '',
    projectPath: '',
    title: '',
    prompt: '',
    schedulePreset: 'daily',
    customCron: '',
    time: '09:00',
    days: ['1', '2', '3', '4', '5'], // Mon-Fri
    intervalDays: 2,
    selectedDays: ['1'] as string[],
    autonomous: true,
    useWorktree: false,
    notifyTelegram: false,
    notifySlack: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load tasks
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

  // Load agents
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

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadTasks(), loadAgents()]);
    setIsRefreshing(false);
    setToast({ message: 'Tasks refreshed', type: 'success' });
    setTimeout(() => setToast(null), 2000);
  };

  // Create task
  const handleCreateTask = async () => {
    if (!isElectron()) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      // Build cron expression
      const [hour, minute] = formData.time.split(':');
      let cron = formData.customCron;
      if (formData.schedulePreset === 'hourly') {
        cron = '0 * * * *';
      } else if (formData.schedulePreset === 'every_n_days') {
        cron = `${minute} ${hour} */${formData.intervalDays} * *`;
      } else if (formData.schedulePreset === 'specific_days') {
        const days = [...formData.selectedDays].sort((a, b) => parseInt(a) - parseInt(b)).join(',');
        cron = `${minute} ${hour} * * ${days}`;
      } else if (formData.schedulePreset !== 'custom') {
        const preset = SCHEDULE_PRESETS.find(p => p.value === formData.schedulePreset);
        if (preset?.cron) {
          cron = preset.cron.replace(/^0 9/, `${minute} ${hour}`);
        }
      }

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

      // Get project path from selected agent or use direct input
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
        setFormData({
          agentId: '',
          projectPath: '',
          title: '',
          prompt: '',
          schedulePreset: 'daily',
          customCron: '',
          time: '09:00',
          days: ['1', '2', '3', '4', '5'],
          intervalDays: 2,
          selectedDays: ['1'],
          autonomous: true,
          useWorktree: false,
          notifyTelegram: false,
          notifySlack: false,
        });
        await loadTasks();
        setToast({ message: 'Task created successfully', type: 'success' });
        setTimeout(() => setToast(null), 2000);
      } else {
        setCreateError(result?.error || 'Failed to create task');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    }
    setIsCreating(false);
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!isElectron()) return;
    if (!confirm('Are you sure you want to delete this scheduled task?')) return;
    try {
      await window.electronAPI?.scheduler?.deleteTask(taskId);
      await loadTasks();
      setToast({ message: 'Task deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error('Error deleting task:', err);
      setToast({ message: 'Failed to delete task', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Run task now
  const handleRunTask = async (taskId: string) => {
    if (!isElectron()) return;
    setRunningTaskId(taskId);
    try {
      const result = await window.electronAPI?.scheduler?.runTask(taskId);
      if (result?.success) {
        setToast({ message: 'Task started in background', type: 'success' });
      } else {
        setToast({ message: result?.error || 'Failed to run task', type: 'error' });
      }
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Error running task:', err);
      setToast({ message: 'Failed to run task', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
    setRunningTaskId(null);
  };

  // View logs
  const handleViewLogs = async (taskId: string) => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI?.scheduler?.getLogs(taskId);
      if (result) {
        const runs = result.runs || [];
        setSelectedLogs({
          taskId,
          logs: result.logs,
          runs,
          selectedRunIndex: runs.length > 0 ? runs.length - 1 : 0, // default to latest run
        });
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Edit task — derive preset from cron
  const handleEditTask = (task: ScheduledTask) => {
    const cron = task.schedule;
    const parts = cron.split(' ');
    let preset = 'custom';
    let time = '09:00';
    let intervalDays = 2;
    let selectedDays: string[] = ['1'];

    if (parts.length === 5) {
      const [min, hr, dom, , dow] = parts;
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

  // Build cron from edit form
  const buildEditCron = (): string => {
    const [hour, minute] = editForm.time.split(':');
    if (editForm.schedulePreset === 'custom') return editForm.customCron;
    if (editForm.schedulePreset === 'hourly') return '0 * * * *';
    if (editForm.schedulePreset === 'every_n_days') {
      return `${minute} ${hour} */${editForm.intervalDays} * *`;
    }
    if (editForm.schedulePreset === 'specific_days') {
      const days = [...editForm.selectedDays].sort((a, b) => parseInt(a) - parseInt(b)).join(',');
      return `${minute} ${hour} * * ${days}`;
    }
    const preset = SCHEDULE_PRESETS.find(p => p.value === editForm.schedulePreset);
    if (!preset?.cron) return editForm.customCron;
    return preset.cron.replace(/^0 9/, `${minute} ${hour}`);
  };

  const handleSaveEdit = async () => {
    if (!isElectron() || !editingTask) return;
    setIsSavingEdit(true);
    try {
      const newCron = buildEditCron();
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
        setToast({ message: 'Task updated successfully', type: 'success' });
        setTimeout(() => setToast(null), 2000);
      } else {
        setToast({ message: result?.error || 'Failed to update task', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error('Error updating task:', err);
      setToast({ message: 'Failed to update task', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
    setIsSavingEdit(false);
  };

  // Get unique projects from tasks
  const projects = [...new Set(tasks.map(t => t.projectPath))];

  // Format relative time for next run
  const formatNextRun = (nextRun: string | undefined): string | null => {
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
  };

  // Filter tasks
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
    if (filterStatus !== 'all') {
      if (filterStatus === 'success' && task.lastRunStatus !== 'success') return false;
      if (filterStatus === 'error' && task.lastRunStatus !== 'error') return false;
      if (filterStatus === 'never' && task.lastRun) return false;
    }
    return true;
  });

  if (!isElectron()) {
    return (
      <div className="pt-4 lg:pt-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-yellow-500">This feature is only available in the desktop app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 pt-4 lg:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Scheduled Tasks</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Automate recurring tasks with your agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Calendar */}
      {!isLoading && tasks.length > 0 && (
        <SchedulerCalendar
          tasks={tasks}
          onRunTask={handleRunTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onViewLogs={handleViewLogs}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
              toast.type === 'success' ? 'bg-green-500/90 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 text-white' :
              'bg-blue-500/90 text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading scheduled tasks...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filters:</span>
              </div>

              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg"
              >
                <option value="all">All Projects</option>
                {projects.map(p => (
                  <option key={p} value={p}>{p.split('/').pop()}</option>
                ))}
              </select>

              <select
                value={filterSchedule}
                onChange={(e) => setFilterSchedule(e.target.value)}
                className="px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg"
              >
                <option value="all">All Schedules</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg"
              >
                <option value="all">All Status</option>
                <option value="success">Last run OK</option>
                <option value="error">Last run failed</option>
                <option value="never">Never run</option>
              </select>
            </div>
          )}

          {/* Task List */}
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-8 text-center">
                <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No scheduled tasks</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first scheduled task to automate recurring work.
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Task
                </button>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CalendarClock className="w-4 h-4 text-primary shrink-0" />
                        {task.title ? (
                          <span className="font-semibold text-sm">{task.title}</span>
                        ) : (
                          <span className="font-medium text-sm font-mono text-muted-foreground">{task.id}</span>
                        )}
                        {formatNextRun(task.nextRun) && (
                          <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] font-medium">
                            {formatNextRun(task.nextRun)}
                          </span>
                        )}
                        {task.lastRunStatus === 'success' && (
                          <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded text-[10px] font-medium">
                            SUCCESS
                          </span>
                        )}
                        {task.lastRunStatus === 'error' && (
                          <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded text-[10px] font-medium">
                            FAILED
                          </span>
                        )}
                      </div>

                      {/* Task prompt/description */}
                      <p className={`text-sm text-muted-foreground mb-1 ${expandedTasks.has(task.id) ? '' : 'line-clamp-2'}`}>
                        {task.prompt}
                      </p>
                      {task.prompt.length > 120 && (
                        <button
                          onClick={() => setExpandedTasks(prev => {
                            const next = new Set(prev);
                            if (next.has(task.id)) next.delete(task.id);
                            else next.add(task.id);
                            return next;
                          })}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                        >
                          {expandedTasks.has(task.id) ? 'Show less' : 'Show more'}
                        </button>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {task.scheduleHuman || task.schedule}
                        </div>

                        {task.agentName && (
                          <div className="flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            {task.agentName}
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />
                          {task.projectPath.split('/').pop()}
                        </div>

                        {task.lastRun && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last: {new Date(task.lastRun).toLocaleString()}
                          </div>
                        )}

                        {task.notifications.telegram && (
                          <div className="flex items-center gap-1 text-blue-400">
                            <Send className="w-3 h-3" />
                            Telegram
                          </div>
                        )}

                        {task.notifications.slack && (
                          <div className="flex items-center gap-1 text-purple-400">
                            <SlackIcon className="w-3 h-3" />
                            Slack
                          </div>
                        )}

                        {task.autonomous && (
                          <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-500 rounded text-[10px] font-medium">
                            AUTONOMOUS
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunTask(task.id)}
                        disabled={runningTaskId === task.id}
                        className="p-2 hover:bg-green-500/10 text-green-500 rounded-lg transition-colors disabled:opacity-50"
                        title="Run now"
                      >
                        {runningTaskId === task.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleViewLogs(task.id)}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        title="View logs"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditTask(task)}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        title="Edit task"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </>
      )}

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold">Create Scheduled Task</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Daily code review"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
                    autoFocus
                  />
                </div>

                {/* Agent Selection (optional) */}
                <div>
                  <label className="block text-sm font-medium mb-2">Agent (optional)</label>
                  <select
                    value={formData.agentId}
                    onChange={(e) => {
                      const selectedAgent = agents.find(a => a.id === e.target.value);
                      setFormData({
                        ...formData,
                        agentId: e.target.value,
                        projectPath: selectedAgent?.projectPath || formData.projectPath
                      });
                    }}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                  >
                    <option value="">No agent (use project path below)</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.id} - {agent.projectPath.split('/').pop()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Project Path (if no agent selected) */}
                {!formData.agentId && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Project Path</label>
                    <input
                      type="text"
                      value={formData.projectPath}
                      onChange={(e) => setFormData({ ...formData, projectPath: e.target.value })}
                      placeholder="/path/to/your/project"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                    />
                  </div>
                )}

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium mb-2">Task Prompt</label>
                  <textarea
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="What should Claude do?"
                    rows={4}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg resize-none"
                  />
                </div>

                {/* Schedule */}
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Schedule</label>
                      <select
                        value={formData.schedulePreset}
                        onChange={(e) => setFormData({ ...formData, schedulePreset: e.target.value })}
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                      >
                        {SCHEDULE_PRESETS.map(preset => (
                          <option key={preset.value} value={preset.value}>{preset.label}</option>
                        ))}
                      </select>
                    </div>
                    {formData.schedulePreset !== 'hourly' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Time</label>
                        <input
                          type="time"
                          value={formData.time}
                          onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                          className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {formData.schedulePreset === 'every_n_days' && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Every</span>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={formData.intervalDays}
                        onChange={(e) => setFormData({ ...formData, intervalDays: parseInt(e.target.value) || 2 })}
                        className="w-16 px-2 py-1.5 bg-secondary border border-border rounded text-sm text-center"
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                      <div className="flex items-center gap-1 ml-1">
                        {[2, 3, 7, 14].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setFormData({ ...formData, intervalDays: n })}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              formData.intervalDays === n
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary hover:bg-secondary/80 border border-border'
                            }`}
                          >
                            {n}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.schedulePreset === 'specific_days' && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {DAY_OPTIONS.map(day => {
                          const isSelected = formData.selectedDays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => {
                                const next = isSelected
                                  ? formData.selectedDays.filter(d => d !== day.value)
                                  : [...formData.selectedDays, day.value];
                                if (next.length > 0) setFormData({ ...formData, selectedDays: next });
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary hover:bg-secondary/80 border border-border'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {formData.schedulePreset === 'custom' && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={formData.customCron}
                        onChange={(e) => setFormData({ ...formData, customCron: e.target.value })}
                        placeholder="0 9 * * 1-5"
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: minute hour day month weekday (e.g., &apos;0 9 * * 1-5&apos; for weekdays at 9am)
                      </p>
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autonomous}
                      onChange={(e) => setFormData({ ...formData, autonomous: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <div>
                      <span className="text-sm font-medium">Run autonomously</span>
                      <p className="text-xs text-muted-foreground">Skip permission prompts during execution</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.useWorktree}
                      onChange={(e) => setFormData({ ...formData, useWorktree: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <div>
                      <span className="text-sm font-medium">Use git worktree</span>
                      <p className="text-xs text-muted-foreground">Run in isolated branch</p>
                    </div>
                  </label>
                </div>

                {/* Notifications */}
                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium mb-3">Send results to:</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notifyTelegram}
                        onChange={(e) => setFormData({ ...formData, notifyTelegram: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <Send className="w-4 h-4 text-blue-400" />
                      <span className="text-sm">Telegram</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notifySlack}
                        onChange={(e) => setFormData({ ...formData, notifySlack: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <SlackIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-sm">Slack</span>
                    </label>
                  </div>
                </div>

                {createError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">{createError}</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm hover:bg-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={isCreating || !formData.prompt || (!formData.agentId && !formData.projectPath)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Task
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Modal */}
      <AnimatePresence>
        {selectedLogs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedLogs(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                <h2 className="font-semibold shrink-0">Task Logs</h2>
                {selectedLogs.runs.length > 1 && (
                  <select
                    value={selectedLogs.selectedRunIndex}
                    onChange={(e) => setSelectedLogs({ ...selectedLogs, selectedRunIndex: parseInt(e.target.value) })}
                    className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg truncate"
                  >
                    {selectedLogs.runs.map((run, i) => (
                      <option key={i} value={i}>
                        {run.startedAt}{!run.completedAt ? ' (running)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedLogs.runs.length === 1 && (
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedLogs.runs[0].startedAt}{!selectedLogs.runs[0].completedAt ? ' (running)' : ''}
                  </span>
                )}
                <button
                  onClick={() => setSelectedLogs(null)}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {selectedLogs.runs.length > 0 && selectedLogs.runs[selectedLogs.selectedRunIndex] && (
                <div className="px-4 py-2 border-b border-border flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Started: {selectedLogs.runs[selectedLogs.selectedRunIndex].startedAt}
                  </div>
                  {selectedLogs.runs[selectedLogs.selectedRunIndex].completedAt ? (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Completed: {selectedLogs.runs[selectedLogs.selectedRunIndex].completedAt}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Still running...
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 overflow-auto p-4 bg-[#0D0B08]">
                <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                  {selectedLogs.runs.length > 0
                    ? (selectedLogs.runs[selectedLogs.selectedRunIndex]?.content || 'No content for this run')
                    : (selectedLogs.logs || 'No logs available')}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditingTask(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold">Edit Scheduled Task</h2>
                <button
                  onClick={() => setEditingTask(null)}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="e.g. Daily code review"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
                  />
                </div>

                {/* Project Path */}
                <div>
                  <label className="block text-sm font-medium mb-2">Project Path</label>
                  <input
                    type="text"
                    value={editForm.projectPath}
                    onChange={(e) => setEditForm({ ...editForm, projectPath: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                  />
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium mb-2">Task Prompt</label>
                  <textarea
                    value={editForm.prompt}
                    onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg resize-none text-sm"
                  />
                </div>

                {/* Schedule */}
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Schedule</label>
                      <select
                        value={editForm.schedulePreset}
                        onChange={(e) => setEditForm({ ...editForm, schedulePreset: e.target.value })}
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                      >
                        {SCHEDULE_PRESETS.map(preset => (
                          <option key={preset.value} value={preset.value}>{preset.label}</option>
                        ))}
                      </select>
                    </div>
                    {editForm.schedulePreset !== 'hourly' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Time</label>
                        <input
                          type="time"
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {editForm.schedulePreset === 'every_n_days' && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Every</span>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={editForm.intervalDays}
                        onChange={(e) => setEditForm({ ...editForm, intervalDays: parseInt(e.target.value) || 2 })}
                        className="w-16 px-2 py-1.5 bg-secondary border border-border rounded text-sm text-center"
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                      <div className="flex items-center gap-1 ml-1">
                        {[2, 3, 7, 14].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, intervalDays: n })}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              editForm.intervalDays === n
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary hover:bg-secondary/80 border border-border'
                            }`}
                          >
                            {n}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {editForm.schedulePreset === 'specific_days' && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {DAY_OPTIONS.map(day => {
                          const isSelected = editForm.selectedDays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => {
                                const next = isSelected
                                  ? editForm.selectedDays.filter(d => d !== day.value)
                                  : [...editForm.selectedDays, day.value];
                                if (next.length > 0) setEditForm({ ...editForm, selectedDays: next });
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary hover:bg-secondary/80 border border-border'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {editForm.schedulePreset === 'custom' && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={editForm.customCron}
                        onChange={(e) => setEditForm({ ...editForm, customCron: e.target.value })}
                        placeholder="0 9 * * 1-5"
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: minute hour day month weekday
                      </p>
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.autonomous}
                      onChange={(e) => setEditForm({ ...editForm, autonomous: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <div>
                      <span className="text-sm font-medium">Run autonomously</span>
                      <p className="text-xs text-muted-foreground">Skip permission prompts during execution</p>
                    </div>
                  </label>
                </div>

                {/* Notifications */}
                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium mb-3">Send results to:</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.notifyTelegram}
                        onChange={(e) => setEditForm({ ...editForm, notifyTelegram: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <Send className="w-4 h-4 text-blue-400" />
                      <span className="text-sm">Telegram</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.notifySlack}
                        onChange={(e) => setEditForm({ ...editForm, notifySlack: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <SlackIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-sm">Slack</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 text-sm hover:bg-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit || !editForm.prompt.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
