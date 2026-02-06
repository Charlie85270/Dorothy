'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import type { KanbanTask, KanbanColumn as KanbanColumnType } from '@/types/kanban';
import { KanbanCard } from './KanbanCard';
import { COLUMN_CONFIG } from '../constants';

interface KanbanColumnProps {
  column: KanbanColumnType;
  tasks: KanbanTask[];
  onAddTask?: () => void;
  onEditTask?: (task: KanbanTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onStartTask?: (taskId: string, column: KanbanColumnType) => Promise<{ success: boolean }>;
  onOpenTerminal?: (agentId: string) => void;
  activeTaskId?: string;
}

export function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onOpenTerminal,
  activeTaskId,
}: KanbanColumnProps) {
  const config = COLUMN_CONFIG[column];

  const { setNodeRef, isOver } = useDroppable({
    id: column,
    data: {
      type: 'column',
      column,
    },
  });

  return (
    <div className="flex flex-col flex-1 min-w-[200px]">
      {/* Column header - minimal style */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm text-foreground tracking-wide">
            {config.title}
          </h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button className="p-1 rounded hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Accent bar */}
      <div className={`h-0.5 ${config.accentColor} rounded-full mb-4`} />

      {/* Tasks container */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 space-y-3 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto
          rounded-lg transition-all duration-200 px-0.5
          ${isOver ? 'bg-primary/5' : ''}
        `}
      >
        <SortableContext
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence mode="popLayout">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onStart={column === 'backlog' ? onStartTask : undefined}
                  onOpenTerminal={column === 'ongoing' ? onOpenTerminal : undefined}
                  isBeingDragged={task.id === activeTaskId}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-12 text-muted-foreground/50 text-sm"
              >
                {config.emptyText}
              </motion.div>
            )}
          </AnimatePresence>
        </SortableContext>

        {/* Drop indicator */}
        {isOver && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 60 }}
            className="border-2 border-dashed border-primary/30 rounded-xl bg-primary/5"
          />
        )}
      </div>
    </div>
  );
}
