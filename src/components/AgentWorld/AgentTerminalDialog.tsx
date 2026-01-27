'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
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
  FolderOpen,
  ChevronUp,
  ChevronDown,
  GitBranch,
  PanelRightClose,
  PanelRight,
  TerminalSquare,
} from 'lucide-react';
import type { AgentStatus } from '@/types/electron';
import { isElectron } from '@/hooks/useElectron';
import { CHARACTER_FACES, TERMINAL_THEME, QUICK_TERMINAL_THEME } from './constants';
import 'xterm/css/xterm.css';

// Lazy load heavy components to improve initial load time (bundle-dynamic-imports)
const GitPanel = dynamic(() => import('./GitPanel'), {
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
    </div>
  ),
});

const CodePanel = dynamic(() => import('./CodePanel'), {
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
    </div>
  ),
});

// Store PTY IDs per agent to persist terminals across dialog open/close
const persistentTerminals = new Map<string, { ptyId: string; outputBuffer: string[] }>();

interface AgentTerminalDialogProps {
  agent: AgentStatus | null;
  open: boolean;
  onClose: () => void;
  onStart: (agentId: string, prompt: string) => void;
  onStop: (agentId: string) => void;
}

// Memoized header component (rerender-memo)
const DialogHeader = memo(function DialogHeader({
  agent,
  character,
  showCodePanel,
  showGitPanel,
  showQuickTerminal,
  isFullscreen,
  hasActiveTerminal,
  onToggleCodePanel,
  onToggleGitPanel,
  onToggleTerminal,
  onOpenInFinder,
  onToggleFullscreen,
  onClose,
}: {
  agent: AgentStatus;
  character: string;
  showCodePanel: boolean;
  showGitPanel: boolean;
  showQuickTerminal: boolean;
  isFullscreen: boolean;
  hasActiveTerminal: boolean;
  onToggleCodePanel: () => void;
  onToggleGitPanel: () => void;
  onToggleTerminal: () => void;
  onOpenInFinder: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between bg-bg-tertiary/30">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{CHARACTER_FACES[character as keyof typeof CHARACTER_FACES] || '🤖'}</span>
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

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleCodePanel}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            showCodePanel
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
          }`}
          title={showCodePanel ? 'Hide code panel' : 'Show code panel'}
        >
          {showCodePanel ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
          Code
        </button>
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors relative ${
            showQuickTerminal
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
          }`}
          title={showQuickTerminal ? 'Hide terminal (process keeps running)' : 'Open terminal'}
        >
          <TerminalSquare className="w-3.5 h-3.5" />
          Terminal
          {hasActiveTerminal && !showQuickTerminal && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          )}
        </button>
        <button
          onClick={onToggleGitPanel}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            showGitPanel
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
          }`}
          title={showGitPanel ? 'Hide git panel' : 'Show git panel'}
        >
          <GitBranch className="w-3.5 h-3.5" />
          Git
        </button>
        <button
          onClick={onOpenInFinder}
          className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          title="Open in Finder"
        >
          <FolderOpen className="w-4 h-4 text-text-muted" />
        </button>
        <div className="w-px h-5 bg-border-primary mx-1" />
        <button
          onClick={onToggleFullscreen}
          className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
});

// Memoized footer component (rerender-memo)
const DialogFooter = memo(function DialogFooter({
  agent,
  prompt,
  onPromptChange,
  onStart,
  onStop,
}: {
  agent: AgentStatus;
  prompt: string;
  onPromptChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="px-5 py-3 border-t border-border-primary bg-bg-tertiary/30">
      {agent.pathMissing && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
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
            className={`flex-1 px-4 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm focus:outline-none focus:border-accent-cyan ${
              agent.pathMissing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            autoFocus={!agent.pathMissing}
          />
          <button
            onClick={onStart}
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
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 bg-accent-red/20 text-accent-red rounded-lg hover:bg-accent-red/30 transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      )}
    </div>
  );
});

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
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showQuickTerminal, setShowQuickTerminal] = useState(false);
  const [quickTerminalReady, setQuickTerminalReady] = useState(false);
  const [terminalMinimized, setTerminalMinimized] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const quickTerminalRef = useRef<HTMLDivElement>(null);
  const quickXtermRef = useRef<import('xterm').Terminal | null>(null);
  const quickFitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const quickPtyIdRef = useRef<string | null>(null);

  // Memoize project path to avoid recalculation (rerender-memo)
  const projectPath = useMemo(() => {
    return agent?.worktreePath || agent?.projectPath || '';
  }, [agent?.worktreePath, agent?.projectPath]);

  // Memoize character to avoid recalculation
  const character = useMemo(() => {
    return agent?.name?.toLowerCase() === 'bitwonka' ? 'frog' : agent?.character || 'robot';
  }, [agent?.name, agent?.character]);

  // Keep track of agent ID
  useEffect(() => {
    agentIdRef.current = agent?.id || null;
  }, [agent?.id]);

  // Initialize xterm when dialog opens
  useEffect(() => {
    if (!open || !agent) return;

    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    const initTerminal = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (!terminalRef.current) return;

      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initTerminal, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: TERMINAL_THEME,
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

        const fitAndResize = () => {
          try {
            fitAddon.fit();
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
        };

        fitAndResize();
        setTimeout(fitAndResize, 50);
        setTimeout(fitAndResize, 200);
        setTimeout(() => {
          fitAndResize();
          term.focus();
        }, 350);

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

        term.writeln(`\x1b[36m● Connected to ${agent.name || 'Agent'}\x1b[0m`);
        term.writeln('');

        if (window.electronAPI?.agent?.get) {
          try {
            const latestAgent = await window.electronAPI.agent.get(agent.id);
            if (latestAgent?.output && latestAgent.output.length > 0) {
              term.writeln(`\x1b[33m--- Previous output ---\x1b[0m`);
              latestAgent.output.forEach((line: string) => term.write(line));
              setTimeout(fitAndResize, 50);
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

    const fitAndResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Failed to fit terminal:', e);
        }
      }
    };

    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(terminalRef.current);
    return () => resizeObserver.disconnect();
  }, [terminalReady]);

  // Fit terminal when fullscreen or panels change
  useEffect(() => {
    if (!terminalReady || !fitAddonRef.current || !xtermRef.current) return;

    const timeouts = [
      setTimeout(() => {
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
      }, 50),
      setTimeout(() => fitAddonRef.current?.fit(), 150),
    ];

    return () => timeouts.forEach(clearTimeout);
  }, [isFullscreen, showCodePanel, showGitPanel, terminalReady]);

  // Quick terminal initialization
  useEffect(() => {
    const agentId = agent?.id;
    if (!showQuickTerminal || !agentId || !projectPath) return;

    if (quickXtermRef.current && quickPtyIdRef.current) return;

    const initQuickTerminal = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (!quickTerminalRef.current || quickXtermRef.current) return;

      const rect = quickTerminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initQuickTerminal, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: QUICK_TERMINAL_THEME,
        fontSize: 12,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(quickTerminalRef.current);
        quickXtermRef.current = term;
        quickFitAddonRef.current = fitAddon;

        fitAddon.fit();
        setTimeout(() => fitAddon.fit(), 100);
        setTimeout(() => {
          fitAddon.fit();
          term.focus();
        }, 250);

        const existing = persistentTerminals.get(agentId);

        if (existing) {
          quickPtyIdRef.current = existing.ptyId;
          setQuickTerminalReady(true);

          if (existing.outputBuffer.length > 0) {
            existing.outputBuffer.forEach((data) => term.write(data));
          }

          if (window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: existing.ptyId, cols: term.cols, rows: term.rows });
          }
        } else if (window.electronAPI?.pty?.create) {
          const { id: ptyId } = await window.electronAPI.pty.create({
            cwd: projectPath,
            cols: term.cols,
            rows: term.rows,
          });

          quickPtyIdRef.current = ptyId;
          persistentTerminals.set(agentId, { ptyId, outputBuffer: [] });
          setQuickTerminalReady(true);
        }

        term.onData(async (data) => {
          if (quickPtyIdRef.current && window.electronAPI?.pty?.write) {
            await window.electronAPI.pty.write({ id: quickPtyIdRef.current, data });
          }
        });

        term.onResize(({ cols, rows }) => {
          if (quickPtyIdRef.current && window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: quickPtyIdRef.current, cols, rows });
          }
        });
      } catch (e) {
        console.error('Failed to initialize quick terminal:', e);
      }
    };

    initQuickTerminal();

    return () => {
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    };
  }, [showQuickTerminal, agent?.id, projectPath]);

  // Cleanup xterm UI when dialog closes
  useEffect(() => {
    if (!open) {
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    }
  }, [open]);

  // Listen for quick terminal PTY output
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.pty?.onData) return;
    const agentId = agent?.id;

    const unsubscribe = window.electronAPI.pty.onData((event) => {
      if (agentId) {
        const existing = persistentTerminals.get(agentId);
        if (existing && event.id === existing.ptyId) {
          existing.outputBuffer.push(event.data);
          if (existing.outputBuffer.length > 1000) {
            existing.outputBuffer.shift();
          }

          if (quickXtermRef.current) {
            quickXtermRef.current.write(event.data);
          }
        }
      }
    });

    return unsubscribe;
  }, [agent?.id]);

  // Memoized callbacks (rerender-functional-setstate)
  const handleStart = useCallback(() => {
    if (agent && prompt.trim()) {
      onStart(agent.id, prompt.trim());
      setPrompt('');
    }
  }, [agent, prompt, onStart]);

  const handleStop = useCallback(() => {
    if (agent) {
      onStop(agent.id);
    }
  }, [agent, onStop]);

  const handleOpenInFinder = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.shell?.exec) return;
    try {
      await window.electronAPI.shell.exec({
        command: `open "${projectPath}"`,
        cwd: projectPath,
      });
    } catch (err) {
      console.error('Failed to open Finder:', err);
    }
  }, [projectPath]);

  const handleToggleCodePanel = useCallback(() => {
    setShowCodePanel((prev) => !prev);
  }, []);

  const handleToggleGitPanel = useCallback(() => {
    setShowGitPanel((prev) => !prev);
  }, []);

  const handleToggleTerminal = useCallback(() => {
    if (!showCodePanel) setShowCodePanel(true);
    setShowQuickTerminal((prev) => !prev);
  }, [showCodePanel]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const closeQuickTerminal = useCallback(() => {
    const agentId = agent?.id;
    if (agentId) {
      const existing = persistentTerminals.get(agentId);
      if (existing && window.electronAPI?.pty?.kill) {
        window.electronAPI.pty.kill({ id: existing.ptyId });
        persistentTerminals.delete(agentId);
      }
    }
    if (quickXtermRef.current) {
      quickXtermRef.current.dispose();
      quickXtermRef.current = null;
      quickFitAddonRef.current = null;
    }
    quickPtyIdRef.current = null;
    setQuickTerminalReady(false);
    setShowQuickTerminal(false);
  }, [agent?.id]);

  // Check if there's an active terminal session
  const hasActiveTerminal = useMemo(() => {
    return agent ? persistentTerminals.has(agent.id) : false;
  }, [agent]);

  // Compute dialog class
  const dialogClass = useMemo(() => {
    if (isFullscreen) return 'fixed inset-4';
    if (showCodePanel || showGitPanel) return 'w-full max-w-7xl h-[80vh]';
    return 'w-full max-w-4xl h-[80vh]';
  }, [isFullscreen, showCodePanel, showGitPanel]);

  if (!open || !agent) return null;

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
          className={`bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-2xl ${dialogClass} flex flex-col`}
        >
          <DialogHeader
            agent={agent}
            character={character}
            showCodePanel={showCodePanel}
            showGitPanel={showGitPanel}
            showQuickTerminal={showQuickTerminal}
            isFullscreen={isFullscreen}
            hasActiveTerminal={hasActiveTerminal}
            onToggleCodePanel={handleToggleCodePanel}
            onToggleGitPanel={handleToggleGitPanel}
            onToggleTerminal={handleToggleTerminal}
            onOpenInFinder={handleOpenInFinder}
            onToggleFullscreen={handleToggleFullscreen}
            onClose={onClose}
          />

          {/* Main Content */}
          <div className="flex-1 min-h-[300px] flex">
            {/* Terminal */}
            <div
              className={`relative ${
                showCodePanel && showGitPanel
                  ? 'w-1/3 border-r border-border-primary'
                  : showCodePanel || showGitPanel
                    ? 'w-1/2 border-r border-border-primary'
                    : 'flex-1'
              }`}
            >
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

            {/* Git Panel */}
            {showGitPanel && (
              <GitPanel
                projectPath={projectPath}
                className={showCodePanel ? 'w-1/3 border-r border-border-primary' : 'w-1/2'}
              />
            )}

            {/* Code Panel */}
            {showCodePanel && (
              <div className={`${showGitPanel ? 'w-1/3' : 'w-1/2'} flex flex-col`}>
                <CodePanel
                  projectPath={projectPath}
                  className={showQuickTerminal && !terminalMinimized ? 'h-1/2' : 'flex-1'}
                />

                {/* Quick Terminal */}
                {showQuickTerminal && (
                  <div
                    className={`${terminalMinimized ? 'h-8' : 'h-1/2'} border-t border-border-primary flex flex-col transition-all`}
                  >
                    <div className="px-3 py-1.5 border-b border-border-primary bg-bg-tertiary/30 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <TerminalSquare className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs font-medium text-text-secondary">Terminal</span>
                        <span className="text-[10px] text-text-muted font-mono">
                          {projectPath.split('/').pop()}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setTerminalMinimized((prev) => !prev)}
                          className="p-0.5 hover:bg-bg-tertiary rounded transition-colors"
                          title={terminalMinimized ? 'Expand terminal' : 'Minimize terminal'}
                        >
                          {terminalMinimized ? (
                            <ChevronUp className="w-3 h-3 text-text-muted" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-text-muted" />
                          )}
                        </button>
                        <button
                          onClick={closeQuickTerminal}
                          className="p-0.5 hover:bg-bg-tertiary rounded transition-colors"
                          title="Close terminal (kills process)"
                        >
                          <X className="w-3 h-3 text-text-muted" />
                        </button>
                      </div>
                    </div>
                    {!terminalMinimized && (
                      <div className="flex-1 relative">
                        <div
                          ref={quickTerminalRef}
                          className="absolute inset-0 bg-[#0f0f1a] p-1"
                          style={{ cursor: 'text' }}
                          onClick={() => quickXtermRef.current?.focus()}
                        />
                        {!quickTerminalReady && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]">
                            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter
            agent={agent}
            prompt={prompt}
            onPromptChange={setPrompt}
            onStart={handleStart}
            onStop={handleStop}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
