'use client';

import { useState } from 'react';
import type { AgentTickItem, DisplayStatus } from '@/types/electron';
import { useTrayTerminal } from './useTrayTerminal';

const CHARACTER_FACES: Record<string, string> = {
  robot: '\u{1F916}',
  ninja: '\u{1F977}',
  wizard: '\u{1F9D9}',
  astronaut: '\u{1F468}\u{200D}\u{1F680}',
  knight: '\u2694\uFE0F',
  pirate: '\u{1F3F4}\u{200D}\u2620\uFE0F',
  alien: '\u{1F47D}',
  viking: '\u{1FA93}',
  frog: '\u{1F438}',
};

interface TrayAgentItemProps {
  agent: AgentTickItem;
  expanded: boolean;
  onToggle: () => void;
}

function StatusIndicator({ displayStatus }: { displayStatus: DisplayStatus }) {
  switch (displayStatus) {
    case 'working':
      return (
        <span className="relative flex h-3.5 w-3.5 flex-shrink-0">
          <span className="animate-spin absolute inline-flex h-full w-full rounded-full border-2 border-transparent border-t-[var(--success)] border-r-[var(--success)]" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 m-auto" style={{ background: 'var(--success)' }} />
        </span>
      );
    case 'waiting':
      return (
        <span className="relative flex h-3.5 w-3.5 flex-shrink-0">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: 'var(--warning)' }} />
          <span className="relative inline-flex rounded-full h-2 w-2 m-auto" style={{ background: 'var(--warning)' }} />
        </span>
      );
    case 'done':
      return (
        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--success)' }} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'error':
      return (
        <span className="inline-flex rounded-full h-2.5 w-2.5 flex-shrink-0" style={{ background: 'var(--danger)' }} />
      );
    case 'ready':
      return (
        <span className="inline-flex rounded-full h-2.5 w-2.5 flex-shrink-0" style={{ background: 'var(--success)' }} />
      );
    case 'stopped':
    default:
      return (
        <span className="inline-flex rounded-full h-2.5 w-2.5 bg-border flex-shrink-0" />
      );
  }
}

export default function TrayAgentItem({
  agent,
  expanded,
  onToggle,
}: TrayAgentItemProps) {
  const [terminalEl, setTerminalEl] = useState<HTMLDivElement | null>(null);

  useTrayTerminal({ agentId: agent.id, container: terminalEl });

  const charEmoji = CHARACTER_FACES[agent.character || ''] || '\u{1F916}';
  const isWorking = agent.displayStatus === 'working';
  const isWaiting = agent.displayStatus === 'waiting';
  const isActive = isWorking || isWaiting;
  const subtitle = isActive
    ? (agent.currentTask || agent.projectName || '')
    : (agent.projectName || agent.currentTask || '');

  return (
    <div className="border-b border-border">
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 transition-colors text-left"
      >
        <span className="text-base flex-shrink-0">{charEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground truncate">
            {agent.name}
          </div>
          {subtitle && (
            <div className={`text-[10px] truncate mt-0.5 ${
              isActive ? 'text-foreground/70' : 'text-muted-foreground'
            }`}>
              {subtitle}
            </div>
          )}
        </div>
        <StatusIndicator displayStatus={agent.displayStatus} />
        <svg
          className={`w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded terminal */}
      {expanded && (
        <div className="bg-[#1a1a2e]">
          <div
            ref={setTerminalEl}
            className="h-[380px] w-full overflow-hidden"
          />
        </div>
      )}
    </div>
  );
}
