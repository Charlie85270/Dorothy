'use client';

import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { SendHorizontal } from 'lucide-react';

interface TerminalPanelInputProps {
  agentId: string;
  agentStatus: string;
  onSubmit: (agentId: string, input: string) => void;
  onBroadcastSubmit?: (input: string) => void;
  isBroadcasting: boolean;
}

export default function TerminalPanelInput({
  agentId,
  agentStatus,
  onSubmit,
  onBroadcastSubmit,
  isBroadcasting,
}: TerminalPanelInputProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (isBroadcasting && onBroadcastSubmit) {
      onBroadcastSubmit(trimmed + '\n');
    } else {
      onSubmit(agentId, trimmed + '\n');
    }

    setHistory(prev => [trimmed, ...prev].slice(0, 50));
    setHistoryIndex(-1);
    setInput('');
  }, [input, agentId, onSubmit, onBroadcastSubmit, isBroadcasting]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  }, [handleSubmit, history, historyIndex]);

  const isDisabled = agentStatus !== 'running' && agentStatus !== 'waiting';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 bg-secondary border-t border-border ${isBroadcasting ? 'ring-1 ring-primary/50' : ''}`}>
      <span className={`text-xs font-mono ${isBroadcasting ? 'text-cyan-400' : 'text-muted-foreground'}`}>
        {isBroadcasting ? '>' : '>'}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isDisabled
            ? 'Agent not running...'
            : isBroadcasting
              ? 'Broadcast to all agents...'
              : 'Send input to agent...'
        }
        disabled={isDisabled}
        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-mono disabled:opacity-40"
      />
      <button
        onClick={handleSubmit}
        disabled={isDisabled || !input.trim()}
        className="p-1 hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <SendHorizontal className="w-3 h-3" />
      </button>
    </div>
  );
}
