import { memo } from 'react';
import { Play, Square, Terminal as TerminalIcon, AlertTriangle } from 'lucide-react';
import type { AgentStatus } from '@/types/electron';

interface AgentDialogFooterProps {
  agent: AgentStatus;
  prompt: string;
  onPromptChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
}

export const AgentDialogFooter = memo(function AgentDialogFooter({
  agent,
  prompt,
  onPromptChange,
  onStart,
  onStop,
}: AgentDialogFooterProps) {
  return (
    <div className="px-5 py-3 border-t border-border-primary bg-bg-tertiary/30">
      {agent.pathMissing && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-none text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Project path no longer exists: <code className="font-mono text-xs">{agent.projectPath}</code>
          </span>
        </div>
      )}
      {agent.status !== 'running' ? (
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !agent.pathMissing && onStart()}
            placeholder={agent.pathMissing ? 'Cannot start - path not found' : 'Enter a task for this agent...'}
            disabled={agent.pathMissing}
            className={`flex-1 px-4 py-2 bg-bg-primary border border-border-primary rounded-none text-sm focus:outline-none focus:border-accent-cyan ${
              agent.pathMissing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            autoFocus={!agent.pathMissing}
          />
          <button
            onClick={onStart}
            disabled={!prompt.trim() || agent.pathMissing}
            className={`flex items-center gap-2 px-4 py-2 rounded-none transition-colors disabled:opacity-50 ${
              agent.pathMissing
                ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
            }`}
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-accent-cyan">
            <TerminalIcon className="w-4 h-4" />
            <span>Agent is working: {agent.currentTask?.slice(0, 50)}...</span>
          </div>
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 bg-accent-red/20 text-accent-red rounded-none hover:bg-accent-red/30 transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      )}
    </div>
  );
});
