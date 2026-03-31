'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { isElectron } from '@/hooks/useElectron';
import { attachShiftEnterHandler } from '@/lib/terminal';
import { QUICK_TERMINAL_THEME } from './constants';
import type { PanelType } from './AgentDialogTypes';

// Module-level map: persist PTY sessions across dialog open/close
export const persistentTerminals = new Map<string, { ptyId: string; outputBuffer: string[] }>();

interface UseQuickTerminalOptions {
  agentId: string | undefined;
  projectPath: string;
  open: boolean;
  expandedPanels: Set<PanelType>;
  onCollapseTerminal: () => void;
}

export function useQuickTerminal({
  agentId,
  projectPath,
  open,
  expandedPanels,
  onCollapseTerminal,
}: UseQuickTerminalOptions) {
  const [quickTerminalReady, setQuickTerminalReady] = useState(false);
  const quickTerminalRef = useRef<HTMLDivElement>(null);
  const quickXtermRef = useRef<import('xterm').Terminal | null>(null);
  const quickFitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const quickPtyIdRef = useRef<string | null>(null);

  const hasActiveTerminal = agentId ? persistentTerminals.has(agentId) : false;

  // Initialize quick terminal when "Shell" panel opens
  useEffect(() => {
    const isOpen = expandedPanels.has('terminal');
    if (!isOpen || !agentId || !projectPath) return;
    if (quickXtermRef.current && quickPtyIdRef.current) return;

    let cancelled = false;

    const init = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (cancelled || !quickTerminalRef.current || quickXtermRef.current) return;

      const rect = quickTerminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(init, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: QUICK_TERMINAL_THEME,
        fontSize: 12,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(quickTerminalRef.current);
        if (cancelled) { term.dispose(); return; }

        quickXtermRef.current = term;
        quickFitAddonRef.current = fitAddon;

        fitAddon.fit();
        term.scrollToBottom();
        setTimeout(() => { fitAddon.fit(); term.scrollToBottom(); }, 100);
        setTimeout(() => { fitAddon.fit(); term.scrollToBottom(); term.focus(); }, 250);

        const existing = persistentTerminals.get(agentId);

        if (existing) {
          quickPtyIdRef.current = existing.ptyId;
          existing.outputBuffer.forEach((data) => term.write(data));
          if (window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: existing.ptyId, cols: term.cols, rows: term.rows });
          }
          setQuickTerminalReady(true);
        } else if (window.electronAPI?.pty?.create) {
          const { id: ptyId } = await window.electronAPI.pty.create({ cwd: projectPath, cols: term.cols, rows: term.rows });
          if (!cancelled) {
            quickPtyIdRef.current = ptyId;
            persistentTerminals.set(agentId, { ptyId, outputBuffer: [] });
            setQuickTerminalReady(true);
          }
        }

        attachShiftEnterHandler(term, (data) => {
          if (quickPtyIdRef.current && window.electronAPI?.pty?.write) {
            window.electronAPI.pty.write({ id: quickPtyIdRef.current, data }).catch(() => {});
          }
        });

        term.onData(async (data) => {
          if (/^(\x1b\[\?[\d;]*c|\d+;\d+c)+$/.test(data)) return;
          const cleaned = data
            .replace(/\x1b\[\?[\d;]*c/g, '')
            .replace(/\x1b\[\d+;\d+R/g, '')
            .replace(/\x1b\[(?:I|O)/g, '')
            .replace(/\d+;\d+c/g, '');
          if (!cleaned) return;
          if (quickPtyIdRef.current && window.electronAPI?.pty?.write) {
            await window.electronAPI.pty.write({ id: quickPtyIdRef.current, data: cleaned });
          }
        });

        term.onResize(({ cols, rows }) => {
          if (quickPtyIdRef.current && window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: quickPtyIdRef.current, cols, rows });
          }
        });
      } catch (e) {
        console.error('Failed to initialize quick terminal:', e);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    };
  }, [expandedPanels, agentId, projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dispose xterm UI when dialog closes (keep PTY alive in persistentTerminals)
  useEffect(() => {
    if (!open) {
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    }
  }, [open]);

  // Route incoming PTY data to xterm and buffer it
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.pty?.onData) return;
    return window.electronAPI.pty.onData((event) => {
      if (!agentId) return;
      const existing = persistentTerminals.get(agentId);
      if (!existing || event.id !== existing.ptyId) return;

      existing.outputBuffer.push(event.data);
      if (existing.outputBuffer.length > 1000) existing.outputBuffer.shift();
      quickXtermRef.current?.write(event.data);
    });
  }, [agentId]);

  const closeQuickTerminal = useCallback(() => {
    if (agentId) {
      const existing = persistentTerminals.get(agentId);
      if (existing && window.electronAPI?.pty?.kill) {
        window.electronAPI.pty.kill({ id: existing.ptyId });
        persistentTerminals.delete(agentId);
      }
    }
    if (quickXtermRef.current) {
      quickXtermRef.current.dispose();
      quickXtermRef.current = null;
      quickFitAddonRef.current = null;
    }
    quickPtyIdRef.current = null;
    setQuickTerminalReady(false);
    onCollapseTerminal();
  }, [agentId, onCollapseTerminal]);

  return {
    quickTerminalReady,
    quickTerminalRef,
    quickXtermRef,
    hasActiveTerminal,
    closeQuickTerminal,
  };
}
