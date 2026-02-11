'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Terminal as TerminalIcon, X } from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';

interface InstallTerminalModalProps {
  show: boolean;
  command: string;
  onClose: () => void;
  onComplete: () => void;
}

export const InstallTerminalModal = ({ show, command, onClose, onComplete }: InstallTerminalModalProps) => {
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  // Initialize xterm when modal opens
  useEffect(() => {
    if (!show || !terminalRef.current || xtermRef.current) return;

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
        if (ptyIdRef.current && window.electronAPI?.plugin?.installWrite) {
          window.electronAPI.plugin.installWrite({ id: ptyIdRef.current, data });
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (ptyIdRef.current && window.electronAPI?.plugin?.installResize) {
          window.electronAPI.plugin.installResize({
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
      // Kill PTY process to prevent zombie processes
      if (ptyIdRef.current && window.electronAPI?.plugin?.installKill) {
        window.electronAPI.plugin.installKill({ id: ptyIdRef.current });
        ptyIdRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [show]);

  // Start PTY only after terminal is ready
  useEffect(() => {
    if (!terminalReady || !command || !window.electronAPI?.plugin?.installStart) return;

    const startPty = async () => {
      try {
        const result = await window.electronAPI?.plugin?.installStart({ command });
        if (!result) return;
        ptyIdRef.current = result.id;
      } catch (err) {
        console.error('Failed to start plugin installation:', err);
        onClose();
      }
    };

    startPty();
  }, [terminalReady, command, onClose]);

  // Listen for PTY data
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.plugin?.onPtyData) return;

    const unsubscribe = window.electronAPI.plugin.onPtyData(({ id, data }) => {
      if (id === ptyIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for PTY exit
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.plugin?.onPtyExit) return;

    const unsubscribe = window.electronAPI.plugin.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setInstallComplete(true);
        setInstallExitCode(exitCode);
      }
    });

    return unsubscribe;
  }, []);

  const handleClose = () => {
    if (ptyIdRef.current && window.electronAPI?.plugin?.installKill) {
      window.electronAPI.plugin.installKill({ id: ptyIdRef.current });
    }
    setInstallComplete(false);
    setInstallExitCode(null);
    ptyIdRef.current = null;
    onComplete();
    onClose();
  };

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-[#0D0B08] border border-border rounded-none overflow-hidden"
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <TerminalIcon className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-medium text-sm">Installing Plugin</h3>
              <p className="text-xs text-muted-foreground font-mono">{command}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {installComplete && (
              <span className={`text-xs px-2 py-1 ${
                installExitCode === 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {installExitCode === 0 ? 'Completed' : `Failed (${installExitCode})`}
              </span>
            )}
            {!installComplete && (
              <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </span>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-secondary rounded-none transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Content */}
        <div
          ref={terminalRef}
          className="h-[400px] p-2"
          style={{ backgroundColor: '#0D0B08' }}
        />

        {/* Terminal Footer */}
        <div className="px-4 py-3 border-t border-border bg-card flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {installComplete
              ? 'Installation finished. You can close this window.'
              : 'Installation in progress... You can interact with the terminal if needed.'}
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm bg-secondary hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
