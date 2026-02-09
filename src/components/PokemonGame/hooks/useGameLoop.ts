'use client';
import { useEffect, useRef } from 'react';

export function useGameLoop(callback: (deltaTime: number) => void, running: boolean) {
  const callbackRef = useRef(callback);
  const frameIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!running) return;

    const loop = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const delta = Math.min(time - lastTimeRef.current, 50); // cap at 50ms to prevent spiral
      lastTimeRef.current = time;
      callbackRef.current(delta);
      frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      lastTimeRef.current = 0;
    };
  }, [running]);
}
