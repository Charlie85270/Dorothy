import { useState, useEffect, useRef, useCallback } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { Skill } from '@/lib/skills-database';

export interface SkillInstallState {
  showInstallTerminal: boolean;
  installingSkill: { name: string; repo: string } | null;
  installComplete: boolean;
  installExitCode: number | null;
  terminalRef: React.RefObject<HTMLDivElement | null>;
  handleInstallSkill: (skill: Skill) => void;
  closeInstallTerminal: () => void;
}

export function useSkillInstall(onRefreshSkills?: () => void): SkillInstallState {
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [installingSkill, setInstallingSkill] = useState<{ name: string; repo: string } | null>(null);
  const [installComplete, setInstallComplete] = useState(false);
  const [installExitCode, setInstallExitCode] = useState<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  // Initialize xterm when install terminal opens
  useEffect(() => {
    if (!showInstallTerminal || !terminalRef.current || xtermRef.current) return;

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

      // Handle user input
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

      setTerminalReady(true);
    };

    initTerminal();

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [showInstallTerminal]);

  // Start PTY after terminal is ready
  useEffect(() => {
    if (!terminalReady || !installingSkill || !window.electronAPI?.skill?.installStart) return;

    const startPty = async () => {
      try {
        const fullRepo = `${installingSkill.repo}/${installingSkill.name}`;
        const result = await window.electronAPI!.skill.installStart({ repo: fullRepo });
        ptyIdRef.current = result.id;
      } catch (err) {
        console.error('Failed to start installation:', err);
        setShowInstallTerminal(false);
        setInstallingSkill(null);
      }
    };

    startPty();
  }, [terminalReady, installingSkill]);

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
        if (exitCode === 0 && onRefreshSkills) {
          onRefreshSkills();
        }
      }
    });

    return unsubscribe;
  }, [onRefreshSkills]);

  const handleInstallSkill = useCallback((skill: Skill) => {
    setInstallingSkill({ name: skill.name, repo: skill.repo });
    setInstallComplete(false);
    setInstallExitCode(null);
    ptyIdRef.current = null;
    setShowInstallTerminal(true);
  }, []);

  const closeInstallTerminal = useCallback(() => {
    if (ptyIdRef.current && !installComplete) {
      window.electronAPI?.skill?.installKill({ id: ptyIdRef.current });
    }
    setShowInstallTerminal(false);
    setInstallingSkill(null);
    ptyIdRef.current = null;
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
  }, [installComplete]);

  return {
    showInstallTerminal,
    installingSkill,
    installComplete,
    installExitCode,
    terminalRef,
    handleInstallSkill,
    closeInstallTerminal,
  };
}
