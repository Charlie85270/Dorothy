'use client';

import { useEffect, useCallback } from 'react';

interface UseTerminalKeyboardOptions {
  panelAgentIds: string[];
  onFocusPanel: (agentId: string) => void;
  onToggleFullscreen: () => void;
  onToggleBroadcast: () => void;
  onToggleSidebar: () => void;
  onNewAgent: () => void;
  onExitFullscreen: () => void;
  isFullscreen: boolean;
}

export function useTerminalKeyboard({
  panelAgentIds,
  onFocusPanel,
  onToggleFullscreen,
  onToggleBroadcast,
  onToggleSidebar,
  onNewAgent,
  onExitFullscreen,
  isFullscreen,
}: UseTerminalKeyboardOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+1-9: Focus terminal by index
    if (e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1;
      if (index < panelAgentIds.length) {
        e.preventDefault();
        onFocusPanel(panelAgentIds[index]);
      }
      return;
    }

    // Ctrl+Shift shortcuts
    if (e.ctrlKey && e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          onNewAgent();
          break;
        case 'f':
          e.preventDefault();
          onToggleFullscreen();
          break;
        case 'b':
          e.preventDefault();
          onToggleBroadcast();
          break;
        case 's':
          e.preventDefault();
          onToggleSidebar();
          break;
      }
      return;
    }

    // Escape: exit fullscreen
    if (e.key === 'Escape' && isFullscreen) {
      e.preventDefault();
      onExitFullscreen();
    }
  }, [panelAgentIds, onFocusPanel, onToggleFullscreen, onToggleBroadcast, onToggleSidebar, onNewAgent, onExitFullscreen, isFullscreen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
