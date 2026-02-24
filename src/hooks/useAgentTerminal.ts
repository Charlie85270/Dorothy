import { useEffect, useRef, useState, useCallback } from 'react';
import { isElectron } from '@/hooks/useElectron';

interface UseAgentTerminalProps {
  selectedAgentId: string | null;
  terminalRef: React.RefObject<HTMLDivElement | null>;
}

export function useAgentTerminal({ selectedAgentId, terminalRef }: UseAgentTerminalProps) {
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const selectedAgentIdRef = useRef<string | null>(null);

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

    const initTerminal = async () => {
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: {
          background: '#0D0B08',
          foreground: '#e4e4e7',
          cursor: '#3D9B94',
          cursorAccent: '#0D0B08',
          selectionBackground: '#3D9B9433',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#3D9B94',
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
      term.open(terminalRef.current!);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Fit after a short delay to ensure proper sizing
      setTimeout(async () => {
        fitAddon.fit();
        term.focus();
        // Send initial resize to agent PTY (ignore errors if PTY not ready)
        if (window.electronAPI?.agent?.resize) {
          try {
            await window.electronAPI.agent.resize({
              id: selectedAgentId,
              cols: term.cols,
              rows: term.rows,
            });
          } catch (err) {
            console.warn('Failed to resize agent PTY:', err);
          }
        }
      }, 100);

      // Focus terminal on click
      const container = terminalRef.current!;
      const handleClick = () => term.focus();
      container.addEventListener('click', handleClick);

      // Handle user input - send to agent PTY
      // Filter out xterm focus in/out reports (\x1b[I / \x1b[O) that Claude Code
      // requests via DECSET 1004 — these should not be forwarded as user input.
      term.onData(async (data) => {
        const cleaned = data.replace(/\x1b\[(?:I|O)/g, '');
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
      const resizeObserver = new ResizeObserver(() => {
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
      resizeObserver.observe(terminalRef.current!);

      setTerminalReady(true);

      // Write a welcome message
      term.writeln('\x1b[36m● Terminal connected to agent\x1b[0m');
      term.writeln('');

      // Fetch latest agent data from main process to get all stored output
      if (window.electronAPI?.agent?.get) {
        try {
          const latestAgent = await window.electronAPI.agent.get(selectedAgentId);
        
          if (latestAgent && latestAgent.output && latestAgent.output.length > 0) {
            term.writeln(`\x1b[33m--- Replaying ${latestAgent.output.length} previous output chunks ---\x1b[0m`);
            latestAgent.output.forEach(line => {
              term.write(line);
            });
          } else {
            term.writeln('\x1b[90m(No previous output)\x1b[0m');
          }
        } catch (err) {
          console.error('Failed to fetch agent data:', err);
          term.writeln(`\x1b[31mFailed to fetch agent data: ${err}\x1b[0m`);
        }
      } else {
        term.writeln('\x1b[31mElectron API not available\x1b[0m');
      }

      return () => {
        resizeObserver.disconnect();
        container.removeEventListener('click', handleClick);
      };
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
  }, [selectedAgentId, terminalRef]);

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
