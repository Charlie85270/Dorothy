'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';

interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

interface UseXtermTerminalOptions {
  theme: TerminalTheme;
  fontSize?: number;
  fontFamily?: string;
  scrollback?: number;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

interface UseXtermTerminalResult {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  isReady: boolean;
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
  getSize: () => { cols: number; rows: number } | null;
}

export function useXtermTerminal(
  isActive: boolean,
  options: UseXtermTerminalOptions
): UseXtermTerminalResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize terminal
  useEffect(() => {
    if (!isActive) return;

    let mounted = true;
    let cleanupFn: (() => void) | null = null;

    const initTerminal = async () => {
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 150));

      if (!mounted || !containerRef.current) return;

      // Ensure container has dimensions
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initTerminal, 100);
        return;
      }

      // Dynamic import to avoid SSR issues
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      if (!mounted) return;

      const term = new Terminal({
        theme: options.theme,
        fontSize: options.fontSize ?? 13,
        fontFamily: options.fontFamily ?? 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: options.scrollback ?? 10000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(containerRef.current);
        terminalRef.current = term;
        fitAddonRef.current = fitAddon;

        // Fit terminal multiple times to handle animation timing
        const fitAndNotify = () => {
          try {
            fitAddon.fit();
            options.onResize?.(term.cols, term.rows);
          } catch (e) {
            console.warn('Failed to fit terminal:', e);
          }
        };

        fitAndNotify();
        setTimeout(fitAndNotify, 50);
        setTimeout(fitAndNotify, 200);
        setTimeout(() => {
          fitAndNotify();
          term.focus();
        }, 350);

        // Handle user input
        if (options.onData) {
          term.onData(options.onData);
        }

        setIsReady(true);

        cleanupFn = () => {
          term.dispose();
          terminalRef.current = null;
          fitAddonRef.current = null;
        };
      } catch (e) {
        console.error('Failed to initialize terminal:', e);
      }
    };

    initTerminal();

    return () => {
      mounted = false;
      cleanupFn?.();
      setIsReady(false);
    };
  }, [isActive, options.theme, options.fontSize, options.fontFamily, options.scrollback]);

  // Handle resize
  useEffect(() => {
    if (!isReady || !containerRef.current || !fitAddonRef.current) return;

    const fitAndResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
          options.onResize?.(terminalRef.current.cols, terminalRef.current.rows);
        } catch (e) {
          console.warn('Failed to fit terminal:', e);
        }
      }
    };

    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [isReady, options.onResize]);

  const write = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  const writeln = useCallback((data: string) => {
    terminalRef.current?.writeln(data);
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    if (fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
      } catch (e) {
        console.warn('Failed to fit terminal:', e);
      }
    }
  }, []);

  const getSize = useCallback(() => {
    if (terminalRef.current) {
      return { cols: terminalRef.current.cols, rows: terminalRef.current.rows };
    }
    return null;
  }, []);

  return {
    terminalRef: containerRef,
    isReady,
    write,
    writeln,
    clear,
    focus,
    fit,
    getSize,
  };
}
