'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ContextMenuState } from '../types';

export function useTerminalContextMenu() {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    agentId: null,
  });

  const openMenu = useCallback((e: React.MouseEvent, agentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ open: true, x: e.clientX, y: e.clientY, agentId });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuState(prev => ({ ...prev, open: false }));
  }, []);

  // Close on click outside or escape
  useEffect(() => {
    if (!menuState.open) return;

    const handleClick = () => closeMenu();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick);
      window.addEventListener('keydown', handleEsc);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuState.open, closeMenu]);

  return {
    menuState,
    openMenu,
    closeMenu,
  };
}
