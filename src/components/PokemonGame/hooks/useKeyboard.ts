'use client';
import { useEffect, useRef, useCallback } from 'react';

export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;  // space or enter
  cancel: boolean;  // escape
  start: boolean;   // enter on title screen
}

export function useKeyboard() {
  const keysRef = useRef<KeyState>({
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
    cancel: false,
    start: false,
  });

  const actionPressedRef = useRef(false);
  const cancelPressedRef = useRef(false);
  const startPressedRef = useRef(false);

  // These refs track one-shot presses (true only for one read)
  const actionJustPressedRef = useRef(false);
  const cancelJustPressedRef = useRef(false);
  const startJustPressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keys when focus is inside a terminal, input, or dialog
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.closest('.xterm')) {
        return;
      }

      // Prevent default for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' ', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          keysRef.current.up = true;
          break;
        case 'ArrowDown': case 's': case 'S':
          keysRef.current.down = true;
          break;
        case 'ArrowLeft': case 'a': case 'A':
          keysRef.current.left = true;
          break;
        case 'ArrowRight': case 'd': case 'D':
          keysRef.current.right = true;
          break;
        case ' ':
          keysRef.current.action = true;
          if (!actionPressedRef.current) {
            actionJustPressedRef.current = true;
            actionPressedRef.current = true;
          }
          break;
        case 'Enter':
          keysRef.current.start = true;
          if (!startPressedRef.current) {
            startJustPressedRef.current = true;
            startPressedRef.current = true;
          }
          break;
        case 'Escape':
          keysRef.current.cancel = true;
          if (!cancelPressedRef.current) {
            cancelJustPressedRef.current = true;
            cancelPressedRef.current = true;
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          keysRef.current.up = false;
          break;
        case 'ArrowDown': case 's': case 'S':
          keysRef.current.down = false;
          break;
        case 'ArrowLeft': case 'a': case 'A':
          keysRef.current.left = false;
          break;
        case 'ArrowRight': case 'd': case 'D':
          keysRef.current.right = false;
          break;
        case ' ':
          keysRef.current.action = false;
          actionPressedRef.current = false;
          break;
        case 'Enter':
          keysRef.current.start = false;
          startPressedRef.current = false;
          break;
        case 'Escape':
          keysRef.current.cancel = false;
          cancelPressedRef.current = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getKeys = useCallback(() => keysRef.current, []);

  const consumeAction = useCallback(() => {
    if (actionJustPressedRef.current) {
      actionJustPressedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const consumeCancel = useCallback(() => {
    if (cancelJustPressedRef.current) {
      cancelJustPressedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const consumeStart = useCallback(() => {
    if (startJustPressedRef.current) {
      startJustPressedRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { getKeys, consumeAction, consumeCancel, consumeStart };
}
