'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalProps {
  ptyId?: string;
  onData?: (data: string) => void;
  className?: string;
}

export default function Terminal({ ptyId, onData, className = '' }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0a0a0f',
        foreground: '#e4e4e7',
        cursor: '#22d3ee',
        cursorAccent: '#0a0a0f',
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
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    term.onData((data) => {
      onData?.(data);

      // If we have a PTY, send input to it
      if (ptyId && window.electronAPI?.pty) {
        window.electronAPI.pty.write({ id: ptyId, data });
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ptyId && window.electronAPI?.pty) {
        window.electronAPI.pty.resize({
          id: ptyId,
          cols: term.cols,
          rows: term.rows,
        });
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [ptyId, onData]);

  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, [initTerminal]);

  // Listen for PTY data
  useEffect(() => {
    if (!ptyId || !window.electronAPI?.pty) return;

    const unsubscribe = window.electronAPI.pty.onData(({ id, data }) => {
      if (id === ptyId && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, [ptyId]);

  // Public method to write to terminal
  const write = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  // Expose write method via ref
  useEffect(() => {
    if (terminalRef.current) {
      (terminalRef.current as HTMLDivElement & { terminalWrite?: (data: string) => void }).terminalWrite = write;
    }
  }, [write]);

  return (
    <div
      ref={terminalRef}
      className={`bg-[#0a0a0f] rounded-none overflow-hidden ${className}`}
      style={{ minHeight: '200px' }}
    />
  );
}

// Hook for using terminal imperatively
export function useTerminalWriter(terminalRef: React.RefObject<HTMLDivElement>) {
  const write = useCallback((data: string) => {
    const el = terminalRef.current as HTMLDivElement & { terminalWrite?: (data: string) => void };
    el?.terminalWrite?.(data);
  }, [terminalRef]);

  return { write };
}
