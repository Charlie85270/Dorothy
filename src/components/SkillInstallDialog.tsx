'use client';
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, X, Link2 } from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';
import ProviderBadge, { PROVIDER_CONFIG } from '@/components/ProviderBadge';
import 'xterm/css/xterm.css';

interface SkillInstallDialogProps {
  open: boolean;
  repo: string;
  title: string;
  onClose: (success?: boolean) => void;
  availableProviders?: string[];
}

export default function SkillInstallDialog({ open, repo, title, onClose, availableProviders = ['claude'] }: SkillInstallDialogProps) {
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set(['claude']));
  const [linkingStatus, setLinkingStatus] = useState<Record<string, 'pending' | 'done' | 'error'>>({});
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  // Reset state when opening with new repo
  useEffect(() => {
    if (open) {
      setInstallComplete(false);
      setInstallExitCode(null);
      setTerminalReady(false);
      setSelectedProviders(new Set(['claude']));
      setLinkingStatus({});
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

  // Listen for PTY exit — link to additional providers on success
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.skill?.onPtyExit) return;

    const unsubscribe = window.electronAPI.skill.onPtyExit(({ id, exitCode }) => {
      if (id === ptyIdRef.current) {
        setInstallComplete(true);
        setInstallExitCode(exitCode);

        // On success, symlink to additional providers
        if (exitCode === 0) {
          linkToAdditionalProviders();
        }
      }
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkToAdditionalProviders = async () => {
    // Extract skill name from repo (last segment after last /)
    const parts = repo.split('/');
    const skillName = parts.length >= 3 ? parts.slice(2).join('/') : parts[parts.length - 1];

    const additionalProviders = Array.from(selectedProviders).filter(p => p !== 'claude');
    if (additionalProviders.length === 0) return;

    for (const providerId of additionalProviders) {
      setLinkingStatus(prev => ({ ...prev, [providerId]: 'pending' }));
      try {
        const result = await window.electronAPI!.skill.linkToProvider({ skillName, providerId });
        setLinkingStatus(prev => ({ ...prev, [providerId]: result.success ? 'done' : 'error' }));
      } catch {
        setLinkingStatus(prev => ({ ...prev, [providerId]: 'error' }));
      }
    }
  };

  const toggleProvider = (id: string) => {
    if (id === 'claude') return; // Claude is always selected (primary installer)
    setSelectedProviders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const nonClaudeProviders = availableProviders.filter(p => p !== 'claude');

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

            {/* Provider Selector */}
            {nonClaudeProviders.length > 0 && (
              <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Install to:</span>
                {availableProviders.map(id => {
                  const config = PROVIDER_CONFIG[id];
                  if (!config) return null;
                  const isSelected = selectedProviders.has(id);
                  const isClaude = id === 'claude';
                  const status = linkingStatus[id];
                  const icon = config.icon;
                  return (
                    <button
                      key={id}
                      onClick={() => toggleProvider(id)}
                      disabled={isClaude || installComplete}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-secondary text-foreground'
                          : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                      } ${isClaude ? 'opacity-90 cursor-default' : ''}`}
                      style={{ borderRadius: 4 }}
                    >
                      {typeof icon === 'string' ? (
                        <img src={icon} alt={config.label} className="w-3 h-3 object-contain" />
                      ) : (
                        React.createElement(icon, { className: 'w-3 h-3' })
                      )}
                      <span>{config.label}</span>
                      {status === 'done' && <CheckCircle className="w-3 h-3" />}
                      {status === 'error' && <XCircle className="w-3 h-3 text-red-400" />}
                      {status === 'pending' && <Loader2 className="w-3 h-3 animate-spin" />}
                    </button>
                  );
                })}
                {installComplete && installExitCode === 0 && Object.keys(linkingStatus).length > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Linked via symlink
                  </span>
                )}
              </div>
            )}

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
                    ? 'bg-foreground text-background hover:bg-foreground/90'
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
