'use client';

import { motion } from 'framer-motion';
import { X, CheckCircle2, Clock, FolderGit2, Trash2 } from 'lucide-react';
import type { KanbanTask } from '@/types/kanban';

interface KanbanDoneSummaryProps {
  task: KanbanTask;
  onClose: () => void;
  onDelete: () => void;
}

export function KanbanDoneSummary({ task, onClose, onDelete }: KanbanDoneSummaryProps) {
  const projectName = task.projectPath.split('/').pop() || task.projectId;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-green-500/5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-500">Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                title="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Project */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderGit2 className="w-4 h-4" />
              <span>{projectName}</span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-foreground line-through opacity-80">
              {task.title}
            </h2>

            {/* Description */}
            {task.description && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Original Request
                </h3>
                <p className="text-sm text-muted-foreground bg-secondary/30 rounded-lg px-4 py-3">
                  {task.description}
                </p>
              </div>
            )}

            {/* Completion Summary */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Agent Output
              </h3>
              <div className="bg-secondary/30 rounded-lg px-4 py-3 max-h-[300px] overflow-y-auto">
                {task.completionSummary ? (
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
                    {task.completionSummary}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    No output captured
                  </p>
                )}
              </div>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-6 pt-4 border-t border-border/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
              {task.completedAt && (
                <div className="flex items-center gap-1.5 text-green-500">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed {new Date(task.completedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end px-6 py-4 border-t border-border bg-secondary/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
