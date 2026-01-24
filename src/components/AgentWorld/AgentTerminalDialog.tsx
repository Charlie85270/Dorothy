'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Square,
  Terminal as TerminalIcon,
  Loader2,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';
import type { AgentStatus, AgentCharacter } from '@/types/electron';
import { isElectron } from '@/hooks/useElectron';
import 'xterm/css/xterm.css';

// Character emoji/icons for the face
const CHARACTER_FACES: Record<AgentCharacter, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🪓',
  frog: '🐸',
};

interface AgentTerminalDialogProps {
  agent: AgentStatus | null;
  open: boolean;
  onClose: () => void;
  onStart: (agentId: string, prompt: string) => void;
  onStop: (agentId: string) => void;
}

export default function AgentTerminalDialog({
  agent,
  open,
  onClose,
  onStart,
  onStop,
}: AgentTerminalDialogProps) {
  const [terminalReady, setTerminalReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const agentIdRef = useRef<string | null>(null);

  // Keep track of agent ID
  useEffect(() => {
    agentIdRef.current = agent?.id || null;
  }, [agent?.id]);

  // Initialize xterm when dialog opens
  useEffect(() => {
    if (!open || !agent) return;

    // Clean up existing terminal
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    // Wait for the DOM to be ready
    const initTerminal = async () => {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 150));

      if (!terminalRef.current) {
        console.warn('Terminal container not ready');
        return;
      }

      // Ensure the container has dimensions
      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn('Terminal container has no dimensions, retrying...');
        setTimeout(initTerminal, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: {
          background: '#1a1a2e',
          foreground: '#e4e4e7',
          cursor: '#22d3ee',
          cursorAccent: '#1a1a2e',
          selectionBackground: '#22d3ee33',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#22d3ee',
          white: '#e4e4e7',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#67e8f9',
          brightWhite: '#fafafa',
        },
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 10000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(terminalRef.current);
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Fit after opening
        setTimeout(() => {
          try {
            fitAddon.fit();
            term.focus();

            // Resize agent PTY
            if (window.electronAPI?.agent?.resize && agent?.id) {
              window.electronAPI.agent.resize({
                id: agent.id,
                cols: term.cols,
                rows: term.rows,
              }).catch(() => {});
            }
          } catch (e) {
            console.warn('Failed to fit terminal:', e);
          }
        }, 50);

        // Handle user input
        term.onData(async (data) => {
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.sendInput) {
            try {
              await window.electronAPI.agent.sendInput({ id, input: data });
            } catch (err) {
              console.error('Error sending input:', err);
            }
          }
        });

        setTerminalReady(true);

        // Load existing output
        term.writeln(`\x1b[36m● Connected to ${agent.name || 'Agent'}\x1b[0m`);
        term.writeln('');

        if (window.electronAPI?.agent?.get) {
          try {
            const latestAgent = await window.electronAPI.agent.get(agent.id);
            if (latestAgent && latestAgent.output && latestAgent.output.length > 0) {
              term.writeln(`\x1b[33m--- Previous output ---\x1b[0m`);
              latestAgent.output.forEach((line: string) => term.write(line));
            }
          } catch (err) {
            console.error('Failed to fetch agent:', err);
          }
        }
      } catch (e) {
        console.error('Failed to initialize terminal:', e);
      }
    };

    initTerminal();

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [open, agent?.id]);

  // Listen for agent output
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onOutput) return;

    const unsubscribe = window.electronAPI.agent.onOutput((event) => {
      if (event.agentId === agentIdRef.current && xtermRef.current) {
        xtermRef.current.write(event.data);
      }
    });

    return unsubscribe;
  }, []);

  // Handle resize
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const id = agentIdRef.current;
        if (id && xtermRef.current && window.electronAPI?.agent?.resize) {
          window.electronAPI.agent.resize({
            id,
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          }).catch(() => {});
        }
      }
    });

    resizeObserver.observe(terminalRef.current);
    return () => resizeObserver.disconnect();
  }, [terminalReady]);

  const handleStart = () => {
    if (agent && prompt.trim()) {
      onStart(agent.id, prompt.trim());
      setPrompt('');
    }
  };

  if (!open || !agent) return null;

  // Use "frog" character for agent named "bitwonka"
  const character = agent.name?.toLowerCase() === 'bitwonka'
    ? 'frog'
    : (agent.character || 'robot');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`
            bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-2xl
            ${isFullscreen ? 'fixed inset-4' : 'w-full max-w-4xl max-h-[80vh]'}
            flex flex-col
          `}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between bg-bg-tertiary/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{CHARACTER_FACES[character]}</span>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {agent.name || 'Agent'}
                  <span
                    className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${agent.status === 'running' ? 'bg-accent-cyan/20 text-accent-cyan' : ''}
                      ${agent.status === 'idle' ? 'bg-text-muted/20 text-text-muted' : ''}
                      ${agent.status === 'completed' ? 'bg-accent-green/20 text-accent-green' : ''}
                      ${agent.status === 'error' ? 'bg-accent-red/20 text-accent-red' : ''}
                    `}
                  >
                    {agent.status}
                  </span>
                </h3>
                <p className="text-xs text-text-muted font-mono truncate max-w-md">
                  {agent.projectPath.split('/').pop()}
                  {agent.branchName && (
                    <span className="text-accent-purple ml-2">({agent.branchName})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 min-h-[300px] relative">
            <div
              ref={terminalRef}
              className="absolute inset-0 bg-[#1a1a2e] p-2"
              style={{ cursor: 'text', minHeight: '300px' }}
              onClick={() => xtermRef.current?.focus()}
            />
            {!terminalReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
                <Loader2 className="w-6 h-6 animate-spin text-accent-cyan" />
              </div>
            )}
          </div>

          {/* Footer / Controls */}
          <div className="px-5 py-3 border-t border-border-primary bg-bg-tertiary/30">
            {/* Warning for missing path */}
            {agent.pathMissing && (
              <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Project path no longer exists: <code className="font-mono text-xs">{agent.projectPath}</code></span>
              </div>
            )}
            {agent.status !== 'running' ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !agent.pathMissing && handleStart()}
                  placeholder={agent.pathMissing ? "Cannot start - path not found" : "Enter a task for this agent..."}
                  disabled={agent.pathMissing}
                  className={`flex-1 px-4 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm focus:outline-none focus:border-accent-cyan ${agent.pathMissing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  autoFocus={!agent.pathMissing}
                />
                <button
                  onClick={handleStart}
                  disabled={!prompt.trim() || agent.pathMissing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
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
                  onClick={() => onStop(agent.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-red/20 text-accent-red rounded-lg hover:bg-accent-red/30 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
