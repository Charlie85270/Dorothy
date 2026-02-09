'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';
import 'xterm/css/xterm.css';

interface SkillInstallDialogProps {
  open: boolean;
  repo: string;
  title: string;
  onClose: (success?: boolean) => void;
}

export default function SkillInstallDialog({ open, repo, title, onClose }: SkillInstallDialogProps) {
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  // Reset state when opening with new repo
  useEffect(() => {
    if (open) {
      setInstallComplete(false);
      setInstallExitCode(null);
      setTerminalReady(false);
    }
  }, [open, repo]);

  // Initialize xterm when dialog opens
  useEffect(() => {
    if (!open || !terminalRef.current || xtermRef.current) return;

    const initTerminal = async () => {
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
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
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current!);
      fitAddon.fit();

      xtermRef.current = term;

      // Handle user input - send to PTY
      term.onData((data) => {
        if (ptyIdRef.current && window.electronAPI?.skill?.installWrite) {
          window.electronAPI.skill.installWrite({ id: ptyIdRef.current, data });
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

      // Terminal is ready - signal that we can start the PTY
      setTerminalReady(true);
    };

    initTerminal();

    return () => {
      // Kill PTY process to prevent zombie processes
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
  }, [open]);

  // Start PTY only after terminal is ready
  useEffect(() => {
    if (!terminalReady || !repo || !window.electronAPI?.skill?.installStart) return;

    const startPty = async () => {
      try {
        const result = await window.electronAPI!.skill.installStart({ repo });
        ptyIdRef.current = result.id;
      } catch (err) {
        xtermRef.current?.writeln(
          `Failed to start installation: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
        setInstallComplete(true);
        setInstallExitCode(1);
      }
    };

    startPty();
  }, [terminalReady, repo]);

  // Listen for PTY data
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyData) return;

    const unsubscribe = window.electronAPI.skill.onPtyData(({ id, data }) => {
      if (id === ptyIdRef.current && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for PTY exit
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyExit) return;

    const unsubscribe = window.electronAPI.skill.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setInstallComplete(true);
        setInstallExitCode(exitCode);
      }
    });

    return unsubscribe;
  }, []);

  const handleClose = () => {
    if (ptyIdRef.current && !installComplete) {
      window.electronAPI?.skill?.installKill({ id: ptyIdRef.current });
    }
    ptyIdRef.current = null;
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
    onClose(installComplete && installExitCode === 0);
  };

  return (
    <AnimatePresence>
      {open && (
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-none flex items-center justify-center ${
                  installComplete
                    ? installExitCode === 0
                      ? 'bg-green-500/20'
                      : 'bg-red-500/20'
                    : 'bg-secondary'
                }`}>
                  {installComplete ? (
                    installExitCode === 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )
                  ) : (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {installComplete
                      ? installExitCode === 0
                        ? 'Installation Complete'
                        : 'Installation Failed'
                      : 'Installing Skill...'}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">{repo}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-secondary rounded-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-3">
                This is an interactive terminal. Type your responses and press Enter when prompted.
              </p>
              <div
                ref={terminalRef}
                className="bg-[#0a0a0f] rounded-none overflow-hidden"
                style={{ height: '400px' }}
              />
            </div>

            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {installComplete
                  ? `Exited with code ${installExitCode}`
                  : 'Waiting for installation to complete...'}
              </p>
              <button
                onClick={handleClose}
                className={`px-4 py-2 rounded-none font-medium ${
                  installComplete
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {installComplete ? 'Close' : 'Cancel'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
