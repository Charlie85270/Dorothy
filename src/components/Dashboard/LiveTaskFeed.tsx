'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '@/store';
import { TaskStatus } from '@/types';

const statusConfig: Record<TaskStatus, { icon: typeof Activity; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-text-muted', label: 'Pending' },
  in_progress: { icon: Loader2, color: 'text-accent-cyan', label: 'In Progress' },
  completed: { icon: CheckCircle, color: 'text-accent-green', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-accent-red', label: 'Failed' },
};

export default function LiveTaskFeed() {
  const { tasks, agents } = useStore();
  const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'pending').slice(0, 5);

  return (
    <div className="rounded-none-none border border-border-primary bg-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <h3 className="text-sm font-medium">Live Task Feed</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-none-full bg-accent-green opacity-75"></span>
            <span className="relative inline-flex rounded-none-full h-2 w-2 bg-accent-green"></span>
          </span>
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>

      {/* Task List */}
      <div className="divide-y divide-border-primary">
        <AnimatePresence mode="popLayout">
          {activeTasks.map((task, index) => {
            const config = statusConfig[task.status];
            const StatusIcon = config.icon;
            const agent = agents.find(a => a.id === task.assignedAgent);

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="px-5 py-4 hover:bg-bg-tertiary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${config.color}`}>
                    <StatusIcon className={`w-4 h-4 ${task.status === 'in_progress' ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-none ${
                        task.status === 'in_progress' ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-bg-tertiary text-text-muted'
                      }`}>
                        {config.label}
                      </span>
                    </div>
                    {agent && (
                      <p className="text-xs text-text-muted mt-1">
                        Assigned to <span className="text-accent-purple">{agent.name}</span>
                      </p>
                    )}
                    {task.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                          <span>Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-bg-tertiary rounded-none-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${task.progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="h-full progress-animated rounded-none-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {activeTasks.length === 0 && (
          <div className="px-5 py-8 text-center text-text-muted">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}
