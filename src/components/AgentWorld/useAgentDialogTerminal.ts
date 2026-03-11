'use client';

import { useState, useEffect, useRef } from 'react';
import type { AgentStatus } from '@/types/electron';
import { isElectron } from '@/hooks/useElectron';
import { attachShiftEnterHandler, stripCursorSequences } from '@/lib/terminal';
import { TERMINAL_THEME } from './constants';

// Clean xterm query/focus escape sequences out of user input before forwarding.
function cleanInput(data: string): string {
  return data
    .replace(/\x1b\[\?[\d;]*c/g, '')
    .replace(/\x1b\[\d+;\d+R/g, '')
    .replace(/\x1b\[(?:I|O)/g, '')
    .replace(/\d+;\d+c/g, '');
}

interface UseAgentDialogTerminalOptions {
  open: boolean;
  agent: AgentStatus | null;
  isFullscreen: boolean;
  skipHistoricalOutput: boolean;
}

export function useAgentDialogTerminal({
  open,
  agent,
  isFullscreen,
  skipHistoricalOutput,
}: UseAgentDialogTerminalOptions) {
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const agentIdRef = useRef<string | null>(null);

  // Keep agentIdRef current
  useEffect(() => {
    agentIdRef.current = agent?.id || null;
  }, [agent?.id]);

  // Initialize terminal when dialog opens
  useEffect(() => {
    if (!open || !agent) return;

    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    let cancelled = false;

    const initTerminal = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (cancelled || !terminalRef.current) return;

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
        convertEol: agent.provider !== 'gemini',
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(terminalRef.current);
        if (cancelled) { term.dispose(); return; }

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const fitAndResize = () => {
          try {
            fitAddon.fit();
            if (window.electronAPI?.agent?.resize && agent?.id) {
              window.electronAPI.agent.resize({ id: agent.id, cols: term.cols, rows: term.rows }).catch(() => {});
            }
          } catch (e) {
            console.warn('Failed to fit terminal:', e);
          }
        };

        fitAndResize();
        setTimeout(fitAndResize, 50);
        setTimeout(fitAndResize, 200);
        setTimeout(() => { fitAndResize(); term.focus(); }, 350);

        attachShiftEnterHandler(term, (data) => {
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.sendInput) {
            window.electronAPI.agent.sendInput({ id, input: data }).catch(() => {});
          }
        });

        term.onData(async (data) => {
          if (/^(\x1b\[\?[\d;]*c|\d+;\d+c)+$/.test(data)) return;
          const cleaned = cleanInput(data);
          if (!cleaned) return;
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.sendInput) {
            try {
              await window.electronAPI.agent.sendInput({ id, input: cleaned });
            } catch (err) {
              console.error('Error sending input:', err);
            }
          }
        });

        if (!cancelled) setTerminalReady(true);

        term.writeln(`\x1b[36m● Connected to ${agent.name || 'Agent'}\x1b[0m`);
        term.writeln('');

        if (window.electronAPI?.agent?.get) {
          try {
            const latestAgent = await window.electronAPI.agent.get(agent.id);
            if (latestAgent?.output?.length) {
              const isGemini = agent.provider === 'gemini';
              const writeLine = (line: string) => term.write(isGemini ? stripCursorSequences(line) : line);

              if (skipHistoricalOutput) {
                latestAgent.output.slice(-20).forEach(writeLine);
              } else {
                term.writeln('\x1b[33m--- Previous output ---\x1b[0m');
                latestAgent.output.forEach(writeLine);
              }
              setTimeout(fitAndResize, 50);
            }
          } catch (err) {
            console.error('Failed to fetch agent output:', err);
          }
        }
      } catch (e) {
        console.error('Failed to initialize terminal:', e);
      }
    };

    initTerminal();

    return () => {
      cancelled = true;
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [open, agent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to live agent output
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onOutput || !terminalReady || !agent?.id) return;
    agentIdRef.current = agent.id;
    return window.electronAPI.agent.onOutput((event) => {
      if (event.agentId === agent.id && xtermRef.current) {
        xtermRef.current.write(event.data);
      }
    });
  }, [terminalReady, agent?.id]);

  // Resize observer
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({ id, cols: xtermRef.current.cols, rows: xtermRef.current.rows }).catch(() => {});
          }
        } catch (e) {
          console.warn('Failed to fit terminal:', e);
        }
      }
    });
    observer.observe(terminalRef.current);
    return () => observer.disconnect();
  }, [terminalReady]);

  // Re-fit when entering/exiting fullscreen
  useEffect(() => {
    if (!terminalReady || !fitAddonRef.current || !xtermRef.current) return;
    const t1 = setTimeout(() => {
      fitAddonRef.current?.fit();
      const id = agentIdRef.current;
      if (id && xtermRef.current && window.electronAPI?.agent?.resize) {
        window.electronAPI.agent.resize({ id, cols: xtermRef.current.cols, rows: xtermRef.current.rows }).catch(() => {});
      }
    }, 50);
    const t2 = setTimeout(() => fitAddonRef.current?.fit(), 150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isFullscreen, terminalReady]);

  return { terminalReady, terminalRef, xtermRef, agentIdRef };
}
