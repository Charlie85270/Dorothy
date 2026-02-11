'use client';

import { Activity, Cpu, DollarSign, Terminal } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';

interface StatusBarProps {
  agents: AgentStatus[];
}

export default function StatusBar({ agents }: StatusBarProps) {
  const running = agents.filter(a => a.status === 'running').length;
  const waiting = agents.filter(a => a.status === 'waiting').length;
  const idle = agents.filter(a => a.status === 'idle').length;
  const error = agents.filter(a => a.status === 'error').length;

  // Estimate total output tokens (rough: each output line ~10 tokens)
  const totalOutputLines = agents.reduce((sum, a) => sum + a.output.length, 0);

  return (
    <div className="flex items-center gap-4 px-3 py-1 bg-secondary border-t border-border !rounded-none text-[10px] text-muted-foreground">
      {/* Agent counts */}
      <div className="flex items-center gap-1.5">
        <Terminal className="w-3 h-3" />
        <span>{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex items-center gap-3">
        {running > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {running} running
          </span>
        )}
        {waiting > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            {waiting} waiting
          </span>
        )}
        {idle > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            {idle} idle
          </span>
        )}
        {error > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {error} error
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Output stats */}
      <div className="flex items-center gap-1.5">
        <Activity className="w-3 h-3" />
        <span>{totalOutputLines.toLocaleString()} output lines</span>
      </div>
    </div>
  );
}
