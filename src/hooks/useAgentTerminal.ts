import { useEffect, useRef, useState, useCallback } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { AgentProvider } from '@/types/electron';
import { getTerminalTheme } from '@/components/AgentWorld/constants';

interface UseAgentTerminalProps {
  selectedAgentId: string | null;
  terminalRef: React.RefObject<HTMLDivElement | null>;
  provider?: AgentProvider;
  terminalTheme?: 'dark' | 'light';
  terminalFontSize?: number;
  onReady?: (agentId: string) => void;
}

/**
 * Strip Ink/ANSI cursor movement sequences that break during output replay.
 * Keeps colors and basic formatting but removes cursor positioning that
 * only makes sense in a live render context.
 */
function stripCursorSequences(data: string): string {
  return data
    // Cursor movement: up/down/forward/back (\x1b[nA, \x1b[nB, etc.)
    .replace(/\x1b\[\d*[ABCDEFGH]/g, '')
    // Cursor position: \x1b[n;mH or \x1b[n;mf
    .replace(/\x1b\[\d*;\d*[Hf]/g, '')
    // Erase line: \x1b[nK
    .replace(/\x1b\[\d*K/g, '')
    // Erase display: \x1b[nJ
    .replace(/\x1b\[\d*J/g, '')
    // Save/restore cursor: \x1b[s, \x1b[u, \x1b7, \x1b8
    .replace(/\x1b\[?[su78]/g, '')
    // Hide/show cursor: \x1b[?25l, \x1b[?25h
    .replace(/\x1b\[\?25[lh]/g, '')
    // Alternate screen buffer: \x1b[?1049h/l
    .replace(/\x1b\[\?1049[hl]/g, '');
}

export function useAgentTerminal({ selectedAgentId, terminalRef, provider, terminalTheme = 'dark', terminalFontSize = 13, onReady }: UseAgentTerminalProps) {
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const selectedAgentIdRef = useRef<string | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Keep track of selected agent ID for event handling
  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  // Initialize xterm when an agent is selected
  useEffect(() => {
    if (!selectedAgentId || !terminalRef.current) return;

    // Clean up existing terminal if any
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    // Abort flag prevents the async initTerminal from completing after cleanup
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let clickContainer: HTMLElement | null = null;
    let clickHandler: (() => void) | null = null;

    const initTerminal = async () => {
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      if (cancelled) return;

      // Gemini CLI uses Ink (React for terminal) which relies on cursor movement
      // sequences for in-place updates. convertEol can interfere with these.
      // Claude/Codex work fine with convertEol so we only disable it for Gemini.
      const isGemini = provider === 'gemini';

      const container = terminalRef.current;
      if (!container || cancelled) return;

      const term = new Terminal({
        theme: getTerminalTheme(terminalTheme),
        fontSize: terminalFontSize,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 10000,
        convertEol: !isGemini,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);

      if (cancelled) {
        term.dispose();
        return;
      }

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Fit after a short delay to ensure proper sizing
      setTimeout(() => {
        if (cancelled) return;
        fitAddon.fit();
        term.focus();
        // Send initial resize to agent PTY (ignore errors if PTY not ready)
        if (window.electronAPI?.agent?.resize) {
          window.electronAPI.agent.resize({
            id: selectedAgentId,
            cols: term.cols,
            rows: term.rows,
          }).catch(() => {});
        }
      }, 100);

      // Focus terminal on click
      clickContainer = container;
      clickHandler = () => term.focus();
      container.addEventListener('click', clickHandler);

      // Handle user input - send to agent PTY
      // Filter out terminal query responses that xterm.js emits automatically.
      // These can arrive as full sequences (\x1b[?1;2c) or fragmented across
      // data events (just "1;2c"). Filter both forms.
      term.onData(async (data) => {
        // Drop entire data event if it's purely DA response fragments (e.g. "1;2c1;2c1;2c")
        if (/^(\x1b\[\?[\d;]*c|\d+;\d+c)+$/.test(data)) return;

        const cleaned = data
          .replace(/\x1b\[\?[\d;]*c/g, '')     // DA response: \x1b[?1;2c
          .replace(/\x1b\[\d+;\d+R/g, '')       // CPR response: \x1b[row;colR
          .replace(/\x1b\[(?:I|O)/g, '')         // Focus in/out: \x1b[I / \x1b[O
          .replace(/\d+;\d+c/g, '');             // Bare DA fragments: 1;2c
        if (!cleaned) return;
        const agentId = selectedAgentIdRef.current;
        if (agentId && window.electronAPI?.agent?.sendInput) {
          try {
            const result = await window.electronAPI.agent.sendInput({ id: agentId, input: cleaned });
            if (!result.success) {
              console.warn('Failed to send input to agent');
            }
          } catch (err) {
            console.error('Error sending input to agent:', err);
          }
        }
      });

      // Handle resize
      resizeObserver = new ResizeObserver(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const agentId = selectedAgentIdRef.current;
          if (agentId && xtermRef.current && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id: agentId,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {
              // Ignore resize errors (PTY might have exited)
            });
          }
        }
      });
      resizeObserver.observe(container);

      setTerminalReady(true);
      onReadyRef.current?.(selectedAgentId);

      // Write a welcome message
      term.writeln('\x1b[36m● Terminal connected to agent\x1b[0m');
      term.writeln('');

      if (cancelled) return;

      // Fetch latest agent data from main process to get all stored output
      if (window.electronAPI?.agent?.get) {
        try {
          const latestAgent = await window.electronAPI.agent.get(selectedAgentId);

          if (cancelled) return;

          if (latestAgent && latestAgent.output && latestAgent.output.length > 0) {
            term.writeln(`\x1b[33m--- Replaying ${latestAgent.output.length} previous output chunks ---\x1b[0m`);
            if (isGemini) {
              // Gemini CLI uses Ink which emits cursor movement sequences for
              // in-place updates. These don't replay correctly — strip them and
              // only keep text content with colors.
              latestAgent.output.forEach(line => {
                term.write(stripCursorSequences(line));
              });
            } else {
              latestAgent.output.forEach(line => {
                term.write(line);
              });
            }
          } else {
            term.writeln('\x1b[90m(No previous output)\x1b[0m');
          }
        } catch (err) {
          console.error('Failed to fetch agent data:', err);
          if (!cancelled) {
            term.writeln(`\x1b[31mFailed to fetch agent data: ${err}\x1b[0m`);
          }
        }
      } else if (!cancelled) {
        term.writeln('\x1b[31mElectron API not available\x1b[0m');
      }
    };

    initTerminal();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (clickContainer && clickHandler) {
        clickContainer.removeEventListener('click', clickHandler);
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [selectedAgentId, terminalRef, provider, terminalTheme, terminalFontSize]);

  // Listen for agent output events
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onOutput) {
      console.log('Agent output listener not set up - electronAPI not available');
      return;
    }

   
    const unsubscribe = window.electronAPI.agent.onOutput((event) => {
     
      if (event.agentId === selectedAgentIdRef.current && xtermRef.current) {
        xtermRef.current.write(event.data);
      } 
    });

    return unsubscribe;
  }, []);

  // Listen for agent error events
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onError) return;

    const unsubscribe = window.electronAPI.agent.onError((event) => {
      if (event.agentId === selectedAgentIdRef.current && xtermRef.current) {
        xtermRef.current.write(`\x1b[31m${event.data}\x1b[0m`);
      }
    });

    return unsubscribe;
  }, []);

  const clearTerminal = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  }, []);

  return {
    terminalReady,
    clearTerminal,
  };
}
