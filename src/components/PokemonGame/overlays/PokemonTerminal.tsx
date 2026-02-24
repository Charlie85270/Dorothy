'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { isElectron } from '@/hooks/useElectron';
import 'xterm/css/xterm.css';

interface PokemonTerminalProps {
  title: string;
  repo: string;
  onDone: (success: boolean) => void;
  onCancel: () => void;
}

export default function PokemonTerminal({ title, repo, onDone, onCancel }: PokemonTerminalProps) {
  const [status, setStatus] = useState<'running' | 'success' | 'error'>('running');
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  // Initialize xterm on mount — exact same pattern as skills page
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

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
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current!);
      fitAddon.fit();

      xtermRef.current = term;

      // Handle user input - send to PTY
      term.onData((data) => {
        const cleaned = data.replace(/\x1b\[(?:I|O)/g, '');
        if (!cleaned) return;
        if (ptyIdRef.current && window.electronAPI?.skill?.installWrite) {
          window.electronAPI.skill.installWrite({ id: ptyIdRef.current, data: cleaned });
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (ptyIdRef.current && window.electronAPI?.skill?.installResize) {
          window.electronAPI.skill.installResize({
            id: ptyIdRef.current,
            cols: term.cols,
            rows: term.rows,
          });
        }
      });
      resizeObserver.observe(terminalRef.current!);

      setTerminalReady(true);
    };

    initTerminal();

    return () => {
      // Kill PTY process on unmount to prevent zombie processes
      if (ptyIdRef.current && window.electronAPI?.skill?.installKill) {
        window.electronAPI.skill.installKill({ id: ptyIdRef.current });
        ptyIdRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      setTerminalReady(false);
    };
  }, []);

  // Listen for PTY data - always subscribe on mount
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyData) return;

    const unsubscribe = window.electronAPI.skill.onPtyData(({ id, data }) => {
      if (id === ptyIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for PTY exit - always subscribe on mount
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyExit) return;

    const unsubscribe = window.electronAPI.skill.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setStatus(exitCode === 0 ? 'success' : 'error');
      }
    });

    return unsubscribe;
  }, []);

  // Start PTY only after terminal is ready
  useEffect(() => {
    if (!terminalReady || !window.electronAPI?.skill?.installStart) return;

    const startPty = async () => {
      try {
        const result = await window.electronAPI!.skill.installStart({ repo });
        ptyIdRef.current = result.id;
      } catch (err) {
        xtermRef.current?.writeln(
          `Failed to start installation: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
        setStatus('error');
      }
    };

    startPty();
  }, [terminalReady, repo]);

  // Close handler
  const handleClose = useCallback(() => {
    if (ptyIdRef.current && status === 'running') {
      window.electronAPI?.skill?.installKill({ id: ptyIdRef.current });
      ptyIdRef.current = null;
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      onCancel();
    } else {
      if (ptyIdRef.current && window.electronAPI?.skill?.installKill) {
        window.electronAPI.skill.installKill({ id: ptyIdRef.current });
      }
      ptyIdRef.current = null;
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      onDone(status === 'success');
    }
  }, [status, onDone, onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-card border border-border rounded-none overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-none flex items-center justify-center ${
              status !== 'running'
                ? status === 'success'
                  ? 'bg-green-500/20'
                  : 'bg-red-500/20'
                : 'bg-secondary'
            }`}>
              <span className="text-sm">
                {status === 'running' ? '...' : status === 'success' ? '✓' : '✗'}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground font-mono">{repo}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-secondary rounded-none"
          >
            <span className="text-lg">×</span>
          </button>
        </div>

        {/* Terminal content — exact same structure as skills page */}
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">
            This is an interactive terminal. Type your responses and press Enter when prompted.
          </p>
          <div
            ref={terminalRef}
            className="bg-[#0D0B08] rounded-none overflow-hidden"
            style={{ height: '400px' }}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {status !== 'running'
              ? `Exited with code ${status === 'success' ? 0 : 1}`
              : 'Waiting for installation to complete...'}
          </p>
          <button
            onClick={handleClose}
            className={`px-4 py-2 rounded-none font-medium ${
              status !== 'running'
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            }`}
          >
            {status !== 'running' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
