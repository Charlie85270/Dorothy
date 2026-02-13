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
} from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';

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
  { value: 'daily', label: 'Daily', cron: '0 9 * * *' },
  { value: 'weekdays', label: 'Weekdays', cron: '0 9 * * 1-5' },
  { value: 'weekly', label: 'Weekly', cron: '0 9 * * 1' },
  { value: 'monthly', label: 'Monthly', cron: '0 9 1 * *' },
  { value: 'custom', label: 'Custom cron', cron: '' },
];

export default function RecurringTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<{ taskId: string; logs: string } | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSchedule, setFilterSchedule] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    agentId: '',
    projectPath: '',
    prompt: '',
    schedulePreset: 'daily',
    customCron: '',
    time: '09:00',
    days: ['1', '2', '3', '4', '5'], // Mon-Fri
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
      let cron = formData.customCron;
      if (formData.schedulePreset !== 'custom') {
        const preset = SCHEDULE_PRESETS.find(p => p.value === formData.schedulePreset);
        if (preset) {
          // Replace time in preset
          const [hour, minute] = formData.time.split(':');
          cron = preset.cron.replace(/^0 \*/, `${minute} ${hour}`).replace(/^0 9/, `${minute} ${hour}`);
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

      if (!projectPath) {
        setCreateError('Please select an agent or enter a project path');
        setIsCreating(false);
        return;
      }

      const result = await window.electronAPI?.scheduler?.createTask({
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
          prompt: '',
          schedulePreset: 'daily',
          customCron: '',
          time: '09:00',
          days: ['1', '2', '3', '4', '5'],
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
      if (result?.logs) {
        setSelectedLogs({ taskId, logs: result.logs });
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
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
                        <span className="font-medium text-sm font-mono">{task.id}</span>
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
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {task.prompt}
                      </p>

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
                  <div>
                    <label className="block text-sm font-medium mb-2">Time</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg"
                    />
                  </div>
                </div>

                {formData.schedulePreset === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Custom Cron Expression</label>
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
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold">Task Logs: {selectedLogs.taskId}</h2>
                <button
                  onClick={() => setSelectedLogs(null)}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-[#0D0B08]">
                <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                  {selectedLogs.logs || 'No logs available'}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
