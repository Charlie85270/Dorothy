'use client';

import { motion } from 'framer-motion';
import { Bot, Pause, Play, Square, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store';
import { AgentStatus } from '@/types';
import Link from 'next/link';

const statusConfig: Record<AgentStatus, { icon: typeof Bot; color: string; bg: string; label: string }> = {
  idle: { icon: Square, color: 'text-text-muted', bg: 'bg-text-muted/20', label: 'Idle' },
  running: { icon: Play, color: 'text-accent-green', bg: 'bg-accent-green/20', label: 'Running' },
  paused: { icon: Pause, color: 'text-accent-amber', bg: 'bg-accent-amber/20', label: 'Paused' },
  error: { icon: AlertTriangle, color: 'text-accent-red', bg: 'bg-accent-red/20', label: 'Error' },
  completed: { icon: Square, color: 'text-accent-cyan', bg: 'bg-accent-cyan/20', label: 'Completed' },
};

const modelColors: Record<string, string> = {
  opus: 'text-accent-purple bg-accent-purple/10',
  sonnet: 'text-accent-cyan bg-accent-cyan/10',
  haiku: 'text-accent-green bg-accent-green/10',
};

export default function AgentActivity() {
  const { agents, projects, tasks } = useStore();

  return (
    <div className="rounded-none-none border border-border-primary bg-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent-purple" />
          <h3 className="text-sm font-medium">Agent Activity</h3>
        </div>
        <Link href="/agents" className="text-xs text-accent-cyan hover:underline">
          View all →
        </Link>
      </div>

      {/* Agent List */}
      <div className="divide-y divide-border-primary">
        {agents.slice(0, 4).map((agent, index) => {
          const config = statusConfig[agent.status];
          const StatusIcon = config.icon;
          const project = projects.find(p => p.id === agent.assignedProject);
          const currentTask = tasks.find(t => t.id === agent.currentTask);

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="px-5 py-4 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`relative w-10 h-10 rounded-none-none ${config.bg} flex items-center justify-center`}>
                  <Bot className={`w-5 h-5 ${config.color}`} />
                  {agent.status === 'running' && (
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent-green rounded-full border border-bg-secondary">
                      <span className="absolute inset-0 rounded-none-full bg-accent-green animate-ping opacity-75" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{agent.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-none ${modelColors[agent.model]}`}>
                      {agent.model.toUpperCase()}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-none ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>

                  {project && (
                    <p className="text-xs text-text-muted mt-1">
                      Working on <span className="text-text-secondary">{project.name}</span>
                    </p>
                  )}

                  {currentTask && agent.status === 'running' && (
                    <div className="mt-2 p-2 rounded-none bg-bg-tertiary/50 border border-border-primary">
                      <p className="text-xs text-text-secondary truncate">{currentTask.title}</p>
                      <div className="mt-1.5 h-1 bg-bg-primary rounded-none-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${currentTask.progress}%` }}
                          className="h-full bg-accent-cyan rounded-none-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                    <span>{(agent.tokensUsed / 1000).toFixed(0)}k tokens</span>
                    <span>{agent.tasksCompleted} tasks done</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
