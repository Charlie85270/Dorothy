'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Activity, MessageSquare, FolderKanban } from 'lucide-react';
import type { HistoryEntry, ClaudeProject } from '@/lib/claude-code';

interface LiveActivityFeedProps {
  history: HistoryEntry[];
  projects: ClaudeProject[];
}

export default function LiveActivityFeed({ history, projects }: LiveActivityFeedProps) {
  // Get recent history items sorted by timestamp
  const recentHistory = [...history]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const getProjectName = (projectPath: string) => {
    const project = projects.find(p => p.path === projectPath);
    if (project) return project.name;
    return projectPath.split('/').pop() || projectPath;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const truncateMessage = (message: string, maxLength = 100) => {
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength) + '...';
  };

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-green" />
          <h3 className="text-sm font-medium">Recent Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
          </span>
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-border-primary max-h-80 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {recentHistory.map((entry, index) => (
            <motion.div
              key={`${entry.timestamp}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.03 }}
              className="px-5 py-4 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-lg bg-accent-cyan/10">
                  <MessageSquare className="w-3.5 h-3.5 text-accent-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary line-clamp-2">
                    {truncateMessage(entry.display)}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" />
                      {getProjectName(entry.project)}
                    </span>
                    <span>{formatTime(entry.timestamp)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {recentHistory.length === 0 && (
          <div className="px-5 py-8 text-center text-text-muted">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
