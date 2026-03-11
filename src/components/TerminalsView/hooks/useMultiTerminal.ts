'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import type { AgentStatus } from '@/types/electron';
import { isElectron } from '@/hooks/useElectron';
import { TERMINAL_CONFIG } from '../constants';
import { getTerminalTheme } from '@/components/AgentWorld/constants';
import { attachShiftEnterHandler } from '@/lib/terminal';

interface TerminalEntry {
  terminal: Terminal;
  fitAddon: FitAddon;
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  disposed: boolean;
  lastCols: number;
  lastRows: number;
}

interface UseMultiTerminalOptions {
  agents: AgentStatus[];
  initialFontSize?: number;
  onFontSizeChange?: (size: number) => void;
  theme?: 'dark' | 'light';
  onTerminalReady?: (agentId: string) => void;
}

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 11;

// Safely fit a terminal and sync PTY dimensions
function safeFit(agentId: string, entry: TerminalEntry) {
  if (entry.disposed) return;
  try {
    entry.fitAddon.fit();
    const { cols, rows } = entry.terminal;
    // Only resize PTY if dimensions actually changed
    if (cols !== entry.lastCols || rows !== entry.lastRows) {
      entry.lastCols = cols;
      entry.lastRows = rows;
      if (isElectron()) {
        window.electronAPI!.agent.resize({ id: agentId, cols, rows }).catch(() => {});
      }
    }
  } catch {}
}

export function useMultiTerminal({ agents, initialFontSize, onFontSizeChange, theme = 'dark', onTerminalReady }: UseMultiTerminalOptions) {
  const terminalsRef = useRef<Map<string, TerminalEntry>>(new Map());
  const xtermModuleRef = useRef<{ Terminal: typeof Terminal; FitAddon: typeof FitAddon } | null>(null);
  const initializingRef = useRef<Set<string>>(new Set());
  const [fontSize, setFontSize] = useState(initialFontSize ?? DEFAULT_FONT_SIZE);
  const fitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevInitialFontSizeRef = useRef(initialFontSize);
  const onTerminalReadyRef = useRef(onTerminalReady);
  onTerminalReadyRef.current = onTerminalReady;

  // Load xterm modules once
  const loadModules = useCallback(async () => {
    if (xtermModuleRef.current) return xtermModuleRef.current;
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('xterm'),
      import('xterm-addon-fit'),
    ]);
    xtermModuleRef.current = { Terminal, FitAddon };
    return xtermModuleRef.current;
  }, []);

  // Debounced fit — coalesces rapid resize events into one fit+resize
  const debouncedFit = useCallback((agentId: string, delay = 80) => {
    const prev = fitTimersRef.current.get(agentId);
    if (prev) clearTimeout(prev);
    fitTimersRef.current.set(agentId, setTimeout(() => {
      fitTimersRef.current.delete(agentId);
      const entry = terminalsRef.current.get(agentId);
      if (entry && !entry.disposed) {
        safeFit(agentId, entry);
      }
    }, delay));
  }, []);

  // Create and attach a terminal to a container.
  // Uses a ResizeObserver to wait for the container to have real dimensions
  // instead of giving up after a single retry.
  const initTerminal = useCallback(async (agentId: string, container: HTMLDivElement) => {
    if (initializingRef.current.has(agentId)) return;
    initializingRef.current.add(agentId);

    try {
      const modules = await loadModules();

      // Wait for layout to settle so container has real dimensions
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const rect = container.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        // Container too small — wait for it to get real dimensions via ResizeObserver
        const ready = await new Promise<boolean>(resolve => {
          let resolved = false;
          const observer = new ResizeObserver((entries) => {
            if (resolved) return;
            for (const entry of entries) {
              const { width, height } = entry.contentRect;
              if (width >= 10 && height >= 10) {
                resolved = true;
                observer.disconnect();
                resolve(true);
                return;
              }
            }
          });
          observer.observe(container);
          // Safety timeout — don't wait forever
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              observer.disconnect();
              resolve(false);
            }
          }, 3000);
        });

        if (!ready || !container.isConnected) {
          initializingRef.current.delete(agentId);
          return;
        }
      }

      // Skip if already initialized (another path may have created it)
      const existing = terminalsRef.current.get(agentId);
      if (existing && !existing.disposed) {
        initializingRef.current.delete(agentId);
        return;
      }

      const term = new modules.Terminal({
        theme: getTerminalTheme(theme),
        fontSize,
        fontFamily: TERMINAL_CONFIG.fontFamily,
        cursorBlink: TERMINAL_CONFIG.cursorBlink,
        cursorStyle: TERMINAL_CONFIG.cursorStyle,
        scrollback: TERMINAL_CONFIG.scrollback,
        convertEol: TERMINAL_CONFIG.convertEol,
        allowProposedApi: true,
      });

      const fitAddon = new modules.FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);

      const entry: TerminalEntry = {
        terminal: term,
        fitAddon,
        container,
        resizeObserver: null!,
        disposed: false,
        lastCols: 0,
        lastRows: 0,
      };

      terminalsRef.current.set(agentId, entry);

      // Step 1: Initial fit — determines correct cols/rows for this panel size
      safeFit(agentId, entry);

      // Step 2: Replay historical output from Electron main process.
      // Fetch directly via IPC to avoid depending on React state (agents array).
      if (isElectron() && window.electronAPI?.agent?.get) {
        try {
          const agent = await window.electronAPI.agent.get(agentId);
          if (agent?.output?.length) {
            const outputStr = agent.output.join('');
            term.write(outputStr);
          }

          // Step 3: For running/waiting agents, the PTY resize from safeFit
          // will trigger Claude Code to redraw at correct dimensions.
          // For idle agents, just clear the garbled display.
          if (agent?.status === 'idle' || agent?.status === 'completed' || agent?.status === 'error') {
            term.write('\x1b[2J\x1b[H');
            term.write(`\x1b[90m— Session ${agent.status} —\x1b[0m\r\n`);
          }
        } catch {}
      }

      // Step 4: Fit again after content is written (may affect scrollbar)
      setTimeout(() => safeFit(agentId, entry), 50);
      setTimeout(() => safeFit(agentId, entry), 200);

      attachShiftEnterHandler(term, (data) => {
        if (isElectron()) {
          window.electronAPI!.agent.sendInput({ id: agentId, input: data }).catch(() => {});
        }
      });

      // Forward keyboard input from xterm to PTY
      // Filter out terminal query responses (DA, CPR, focus) that xterm.js emits
      // automatically — these must not be forwarded as user input.
      term.onData((data) => {
        if (/^(\x1b\[\?[\d;]*c|\d+;\d+c)+$/.test(data)) return;
        const cleaned = data
          .replace(/\x1b\[\?[\d;]*c/g, '')     // DA response: \x1b[?1;2c
          .replace(/\x1b\[\d+;\d+R/g, '')       // CPR response: \x1b[row;colR
          .replace(/\x1b\[(?:I|O)/g, '')         // Focus in/out: \x1b[I / \x1b[O
          .replace(/\d+;\d+c/g, '');             // Bare DA fragments: 1;2c
        if (!cleaned) return;
        if (isElectron()) {
          window.electronAPI!.agent.sendInput({ id: agentId, input: cleaned }).catch(() => {});
        }
      });

      // ResizeObserver — auto-fit when container dimensions change
      const resizeObserver = new ResizeObserver(() => {
        if (!entry.disposed) {
          debouncedFit(agentId);
        }
      });
      resizeObserver.observe(container);
      entry.resizeObserver = resizeObserver;

      // Notify caller that this terminal is ready to receive output
      onTerminalReadyRef.current?.(agentId);

    } finally {
      initializingRef.current.delete(agentId);
    }
  }, [loadModules, fontSize, debouncedFit, theme]);

  // Register a container element for an agent's terminal
  const registerContainer = useCallback((agentId: string, container: HTMLDivElement | null) => {
    if (!container) return;

    const existing = terminalsRef.current.get(agentId);
    if (existing?.container === container && !existing.disposed) {
      return;
    }

    // Dispose old terminal if switching containers
    if (existing && !existing.disposed) {
      existing.resizeObserver?.disconnect();
      existing.terminal.dispose();
      existing.disposed = true;
    }

    initTerminal(agentId, container);
  }, [initTerminal]);

  // Unregister and dispose a terminal
  const unregisterContainer = useCallback((agentId: string) => {
    const entry = terminalsRef.current.get(agentId);
    if (entry) {
      entry.resizeObserver?.disconnect();
      if (!entry.disposed) {
        entry.terminal.dispose();
        entry.disposed = true;
      }
    }
    terminalsRef.current.delete(agentId);
    const timer = fitTimersRef.current.get(agentId);
    if (timer) {
      clearTimeout(timer);
      fitTimersRef.current.delete(agentId);
    }
  }, []);

  // Write to a specific terminal
  const writeToTerminal = useCallback((agentId: string, data: string) => {
    const entry = terminalsRef.current.get(agentId);
    if (entry && !entry.disposed) {
      entry.terminal.write(data);
    }
  }, []);

  // Send input to agent PTY
  const sendInput = useCallback(async (agentId: string, input: string) => {
    if (!isElectron()) return;
    await window.electronAPI!.agent.sendInput({ id: agentId, input });
  }, []);

  // Broadcast input to all terminals
  const broadcastInput = useCallback(async (input: string) => {
    if (!isElectron()) return;
    const promises = Array.from(terminalsRef.current.keys()).map(agentId =>
      window.electronAPI!.agent.sendInput({ id: agentId, input })
    );
    await Promise.allSettled(promises);
  }, []);

  // Clear a specific terminal
  const clearTerminal = useCallback((agentId: string) => {
    const entry = terminalsRef.current.get(agentId);
    if (entry && !entry.disposed) {
      entry.terminal.clear();
    }
  }, []);

  // Focus a specific terminal
  const focusTerminal = useCallback((agentId: string) => {
    const entry = terminalsRef.current.get(agentId);
    if (entry && !entry.disposed) {
      entry.terminal.focus();
    }
  }, []);

  // Fit a specific terminal
  const fitTerminal = useCallback((agentId: string) => {
    const entry = terminalsRef.current.get(agentId);
    if (entry && !entry.disposed) {
      safeFit(agentId, entry);
    }
  }, []);

  // Fit all terminals
  const fitAll = useCallback(() => {
    terminalsRef.current.forEach((entry, agentId) => {
      if (!entry.disposed) {
        safeFit(agentId, entry);
      }
    });
  }, []);

  // Zoom: update font size on all terminals, refit, sync PTY dimensions
  const applyFontSize = useCallback((newSize: number) => {
    terminalsRef.current.forEach((entry, agentId) => {
      if (!entry.disposed) {
        entry.terminal.options.fontSize = newSize;
        // Delayed fit to let xterm recalculate character metrics
        setTimeout(() => {
          if (!entry.disposed) safeFit(agentId, entry);
        }, 10);
      }
    });
  }, []);

  // Sync fontSize state when the persisted initialFontSize prop changes
  // (e.g. settings loaded async, or changed from Settings page)
  useEffect(() => {
    if (initialFontSize !== undefined && initialFontSize !== prevInitialFontSizeRef.current) {
      prevInitialFontSizeRef.current = initialFontSize;
      setFontSize(initialFontSize);
      applyFontSize(initialFontSize);
    }
  }, [initialFontSize, applyFontSize]);

  const zoomIn = useCallback(() => {
    setFontSize(prev => {
      const next = Math.min(prev + 1, MAX_FONT_SIZE);
      applyFontSize(next);
      onFontSizeChange?.(next);
      return next;
    });
  }, [applyFontSize, onFontSizeChange]);

  const zoomOut = useCallback(() => {
    setFontSize(prev => {
      const next = Math.max(prev - 1, MIN_FONT_SIZE);
      applyFontSize(next);
      onFontSizeChange?.(next);
      return next;
    });
  }, [applyFontSize, onFontSizeChange]);

  const zoomReset = useCallback(() => {
    setFontSize(DEFAULT_FONT_SIZE);
    applyFontSize(DEFAULT_FONT_SIZE);
    onFontSizeChange?.(DEFAULT_FONT_SIZE);
  }, [applyFontSize, onFontSizeChange]);

  // Update theme on all live terminals when it changes
  useEffect(() => {
    const themeObj = getTerminalTheme(theme);
    terminalsRef.current.forEach((entry) => {
      if (!entry.disposed) {
        entry.terminal.options.theme = themeObj;
      }
    });
  }, [theme]);

  // Single global onOutput listener that dispatches to correct terminal
  useEffect(() => {
    if (!isElectron()) return;

    const unsubOutput = window.electronAPI!.agent.onOutput((event) => {
      writeToTerminal(event.agentId, event.data);
    });

    const unsubError = window.electronAPI!.agent.onError((event) => {
      writeToTerminal(event.agentId, `\x1b[31m${event.data}\x1b[0m`);
    });

    return () => {
      unsubOutput();
      unsubError();
    };
  }, [writeToTerminal]);

  // Cleanup all terminals on unmount
  useEffect(() => {
    return () => {
      terminalsRef.current.forEach((entry) => {
        entry.resizeObserver?.disconnect();
        if (!entry.disposed) {
          entry.terminal.dispose();
          entry.disposed = true;
        }
      });
      terminalsRef.current.clear();
      fitTimersRef.current.forEach(t => clearTimeout(t));
      fitTimersRef.current.clear();
    };
  }, []);

  return {
    registerContainer,
    unregisterContainer,
    sendInput,
    broadcastInput,
    clearTerminal,
    focusTerminal,
    fitTerminal,
    fitAll,
    writeToTerminal,
    zoomIn,
    zoomOut,
    zoomReset,
    fontSize,
  };
}
