'use client';

import { useEffect, useRef } from 'react';
import { attachShiftEnterHandler } from '@/lib/terminal';

interface UseTrayTerminalProps {
  agentId: string;
  // Callback-ref pattern: React sets this to the DOM element once mounted,
  // guaranteeing the element already has its CSS dimensions.
  container: HTMLDivElement | null;
}


export function useTrayTerminal({ agentId, container }: UseTrayTerminalProps) {
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  useEffect(() => {
    // container is null until the div mounts (callback-ref sets it).
    // When it is non-null, the element is already in the DOM with its CSS dimensions.
    if (!container) return;

    let cancelled = false;
    let unsubOutput: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const fitTimers: ReturnType<typeof setTimeout>[] = [];

    const init = async () => {
      // Wait for the container to be fully laid out (matches the approach used
      // in useAgentDialogTerminal which works correctly).
      await new Promise(resolve => setTimeout(resolve, 150));
      if (cancelled) return;

      if (container.getBoundingClientRect().width === 0) {
        setTimeout(init, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');
      if (cancelled) return;

      const term = new Terminal({
        theme: {
          background: '#1a1a2e',
          foreground: '#e4e4e7',
          cursor: '#3D9B94',
          cursorAccent: '#1a1a2e',
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
        fontSize: 11,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 3000,
        convertEol: true,
        overviewRulerWidth: 0,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);

      if (cancelled) { term.dispose(); return; }

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      const doFitAndResize = () => {
        if (cancelled) return;
        fitAddon.fit();
        window.electronAPI?.agent?.resize({
          id: agentIdRef.current,
          cols: term.cols,
          rows: term.rows,
        }).catch(() => {});
      };

      doFitAndResize();
      fitTimers.push(
        setTimeout(() => { if (!cancelled) doFitAndResize(); }, 50),
        setTimeout(() => { if (!cancelled) doFitAndResize(); }, 200),
        setTimeout(() => { if (!cancelled) doFitAndResize(); }, 350),
      );

      // Replay full session output with cursor sequences intact — xterm is a
      // proper terminal emulator and processes them correctly, rendering the
      // final screen state just like live output does.
      // Do NOT strip sequences: stripping causes duplicated/garbled text.
      setTimeout(async () => {
        if (cancelled) return;
        try {
          const agentData = await window.electronAPI?.agent?.get(agentId);
          if (!cancelled && agentData?.output?.length) {
            agentData.output.forEach(chunk => term.write(chunk));
            term.scrollToBottom();
            doFitAndResize();
            term.focus();
          }
        } catch { /* ignore */ }
      }, 400);

      attachShiftEnterHandler(term, (data) => {
        window.electronAPI?.agent?.sendInput({ id: agentIdRef.current, input: data });
      });

      term.onData((data) => {
        if (/^(\x1b\[\?[\d;]*c|\d+;\d+c)+$/.test(data)) return;
        const cleaned = data
          .replace(/\x1b\[\?[\d;]*c/g, '')
          .replace(/\x1b\[\d+;\d+R/g, '')
          .replace(/\x1b\[(?:I|O)/g, '')
          .replace(/\d+;\d+c/g, '');
        if (!cleaned) return;
        window.electronAPI?.agent?.sendInput({ id: agentIdRef.current, input: cleaned });
      });

      resizeObserver = new ResizeObserver(() => {
        if (!cancelled) doFitAndResize();
      });
      resizeObserver.observe(container);

      if (window.electronAPI?.agent?.onOutput) {
        unsubOutput = window.electronAPI.agent.onOutput((event) => {
          if (event.agentId === agentIdRef.current && xtermRef.current) {
            xtermRef.current.write(event.data);
          }
        });
      }
    };

    init();

    return () => {
      cancelled = true;
      fitTimers.forEach(clearTimeout);
      unsubOutput?.();
      resizeObserver?.disconnect();
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
  }, [container, agentId]);
}
