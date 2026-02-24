import { motion } from 'framer-motion';
import {
  CalendarClock,
  Clock,
  Bot,
  FolderOpen,
  Send,
  Play,
  FileText,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { SlackIcon } from '@/components/Settings/SlackIcon';
import type { ScheduledTask } from '../types';
import { formatNextRun } from '../utils';

interface TaskCardProps {
  task: ScheduledTask;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isRunning: boolean;
  runningTaskId: string | null;
  onRun: (taskId: string) => void;
  onViewLogs: (taskId: string) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (taskId: string) => void;
}

export function TaskCard({
  task,
  isExpanded,
  onToggleExpand,
  isRunning,
  runningTaskId,
  onRun,
  onViewLogs,
  onEdit,
  onDelete,
}: TaskCardProps) {
  return (
    <motion.div
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
          </div>

          <p className={`text-sm text-muted-foreground mb-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {task.prompt}
          </p>
          {task.prompt.length > 120 && (
            <button
              onClick={onToggleExpand}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              {isExpanded ? 'Show less' : 'Show more'}
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

            {task.lastRunStatus === 'running' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                RUNNING
              </span>
            )}

            {task.lastRunStatus === 'partial' && (
              <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded text-[10px] font-medium">
                PARTIAL
              </span>
            )}

            {task.lastRunStatus === 'success' && (
              <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded text-[10px] font-medium">
                SUCCESS
              </span>
            )}

            {task.lastRunStatus === 'error' && (
              <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded text-[10px] font-medium">
                ERROR
              </span>
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
            onClick={() => onRun(task.id)}
            disabled={runningTaskId === task.id}
            className="p-2 hover:bg-green-500/10 text-green-500 rounded-lg transition-colors disabled:opacity-50"
            title="Run now"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onViewLogs(task.id)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            title="View logs"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(task)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            title="Edit task"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
