'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Circle } from 'lucide-react';
import type { HistoryEntry } from '@/lib/claude-code';

interface TerminalLogProps {
  history: HistoryEntry[];
}

export default function TerminalLog({ history }: TerminalLogProps) {
  // Get last 15 entries sorted by timestamp
  const recentHistory = [...history]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-15);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getProjectShortName = (projectPath: string) => {
    const name = projectPath.split('/').pop() || projectPath;
    return name.slice(0, 12);
  };

  const truncateMessage = (message: string, maxLength = 60) => {
    // Clean up message
    const cleaned = message.replace(/\n/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength) + '...';
  };

  return (
    <div className="rounded-none border border-border-primary bg-bg-secondary overflow-hidden">
      {/* Header - looks like terminal titlebar */}
      <div className="px-4 py-3 border-b border-border-primary bg-bg-tertiary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Circle className="w-3 h-3 fill-accent-red text-accent-red" />
            <Circle className="w-3 h-3 fill-accent-amber text-accent-amber" />
            <Circle className="w-3 h-3 fill-accent-green text-accent-green" />
          </div>
          <span className="text-xs text-text-muted ml-2">claude-history — zsh</span>
        </div>
        <Terminal className="w-4 h-4 text-text-muted" />
      </div>

      {/* Log content */}
      <div className="p-4 h-64 overflow-y-auto font-mono text-xs leading-relaxed bg-[#0d0e12]">
        <AnimatePresence mode="popLayout">
          {recentHistory.map((entry, index) => (
            <motion.div
              key={`${entry.timestamp}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-start gap-2 py-0.5 hover:bg-white/[0.02]"
            >
              <span className="text-text-muted shrink-0">{formatTime(entry.timestamp)}</span>
              <span className="text-accent-purple shrink-0">[{getProjectShortName(entry.project)}]</span>
              <span className="text-accent-cyan shrink-0">$</span>
              <span className="text-text-secondary">{truncateMessage(entry.display)}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {recentHistory.length === 0 && (
          <div className="flex items-center gap-2 text-text-muted">
            <span className="animate-pulse">▌</span>
            <span>Waiting for activity...</span>
          </div>
        )}

        {/* Cursor line */}
        <div className="flex items-center gap-2 text-text-muted mt-1">
          <span className="text-accent-cyan">$</span>
          <span className="cursor-blink"></span>
        </div>
      </div>
    </div>
  );
}
