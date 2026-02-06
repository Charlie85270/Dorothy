'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  Bot,
  MessageSquare,
  Paperclip,
  Calendar,
  CheckCircle2,
  StopCircle,
  FolderGit2,
  Wrench,
  Play,
  Terminal,
} from 'lucide-react';
import type { KanbanTask, KanbanColumn } from '@/types/kanban';
import { getLabelColor } from '../constants';

interface KanbanCardProps {
  task: KanbanTask;
  onEdit?: (task: KanbanTask) => void;
  onDelete?: (taskId: string) => void;
  onStart?: (taskId: string, column: KanbanColumn) => Promise<{ success: boolean }>;
  onOpenTerminal?: (agentId: string) => void;
  isDragging?: boolean;
  isBeingDragged?: boolean;
}

export function KanbanCard({ task, onEdit, onDelete, onStart, onOpenTerminal, isDragging, isBeingDragged }: KanbanCardProps) {
  // Disable drag for ongoing and done tasks
  const isOngoing = task.column === 'ongoing';
  const isDone = task.column === 'done';
  const isLocked = isOngoing || isDone;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
    disabled: isLocked, // Disable drag for ongoing and done tasks
  });

  // Get project name from path
  const projectName = task.projectPath.split('/').pop() || task.projectId;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isTaskDragging = isDragging || isSortableDragging;
  const isAgentWorking = task.column === 'ongoing' && task.assignedAgentId;
  const isBacklog = task.column === 'backlog';

  // Handle start button click
  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStart) {
      await onStart(task.id, 'planned');
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isBeingDragged ? 0 : 1,
        y: 0,
        scale: isBeingDragged ? 0.95 : 1,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => onEdit?.(task)}
      {...attributes}
      {...listeners}
      className={`
        group relative bg-card rounded-xl p-4
        shadow-sm transition-all duration-200
        border border-border/50
        ${isLocked ? 'cursor-default' : 'cursor-pointer hover:shadow-md hover:border-border'}
        ${isTaskDragging ? 'scale-105 shadow-xl z-50 rotate-2' : ''}
        ${isAgentWorking ? 'ring-2 ring-green-500/30' : ''}
        ${isDone ? 'opacity-70' : ''}
        ${isBeingDragged ? 'pointer-events-none' : ''}
      `}
    >
      {/* Start button for backlog tasks */}
      {isBacklog && onStart && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={handleStart}
            className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Start task"
          >
            <Play className="w-4 h-4 text-green-500 fill-green-500" />
          </button>
        </div>
      )}

      {/* Agent working indicator + terminal/stop buttons for ongoing tasks */}
      {isAgentWorking && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {/* Terminal button */}
          {onOpenTerminal && task.assignedAgentId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTerminal(task.assignedAgentId!);
              }}
              className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
              title="View terminal"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
            </button>
          )}
          {/* Stop button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Stop this task and kill the agent?')) {
                onDelete?.(task.id);
              }
            }}
            className="p-1 rounded hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Stop task"
          >
            <StopCircle className="w-4 h-4 text-red-500" />
          </button>
          {/* Working indicator */}
          <span className="relative flex h-2.5 w-2.5 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </div>
      )}

      {/* Project name */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
        <FolderGit2 className="w-3 h-3" />
        <span className="truncate">{projectName}</span>
      </div>

      {/* Title */}
      <h4 className={`font-medium text-sm text-foreground mb-2 line-clamp-2 ${isDone ? 'line-through opacity-60' : ''}`}>
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Progress bar for ongoing tasks */}
      {task.column === 'ongoing' && task.progress > 0 && (
        <div className="mb-3">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-500"
              initial={{ width: 0 }}
              animate={{ width: `${task.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.labels.slice(0, 3).map((label) => {
            const colors = getLabelColor(label);
            return (
              <span
                key={label}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}
              >
                {label}
              </span>
            );
          })}
          {task.labels.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer with meta info */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-3 text-muted-foreground">
          {/* Agent indicator */}
          {task.assignedAgentId && (
            <div className="flex items-center gap-1 text-green-500">
              <Bot className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Skills count */}
          {task.requiredSkills.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" title={task.requiredSkills.join(', ')}>
              <Wrench className="w-3 h-3" />
              <span>{task.requiredSkills.length}</span>
            </div>
          )}

          {/* Attachments count */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-400" title={task.attachments.map(a => a.name).join(', ')}>
              <Paperclip className="w-3 h-3" />
              <span>{task.attachments.length}</span>
            </div>
          )}
        </div>

        {/* Done indicator */}
        {isDone && (
          <div className="flex items-center gap-1 text-green-500 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Done</span>
          </div>
        )}

        {/* Date */}
        {!isDone && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
