import { useState, useRef, useCallback } from 'react';
import type { CanvasStateHook } from './useCanvasState';

interface TouchRef {
  lastTouchDistance: number | null;
  lastTouchCenter: { x: number; y: number } | null;
  isPinching: boolean;
}

function getTouchDistance(touches: React.TouchList): number | null {
  if (touches.length < 2) return null;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches: React.TouchList): { x: number; y: number } {
  if (touches.length < 2) {
    return { x: touches[0].clientX, y: touches[0].clientY };
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

export function useCanvasGestures(canvasState: CanvasStateHook) {
  const { panOffset, setPanOffset, zoom, setZoom, setSelectedNodeId } = canvasState;

  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef({ startX: 0, startY: 0 });
  const touchRef = useRef<TouchRef>({
    lastTouchDistance: null,
    lastTouchCenter: null,
    isPinching: false,
  });

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-content') &&
        !(e.target as HTMLElement).closest('.node-card')) {
      setIsPanning(true);
      panRef.current = { startX: e.clientX - panOffset.x, startY: e.clientY - panOffset.y };
    }
  }, [panOffset]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panRef.current.startX,
        y: e.clientY - panRef.current.startY,
      });
    }
  }, [isPanning, setPanOffset]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.node-card')) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      touchRef.current.isPinching = true;
      touchRef.current.lastTouchDistance = getTouchDistance(e.touches);
      touchRef.current.lastTouchCenter = getTouchCenter(e.touches);
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      panRef.current = {
        startX: e.touches[0].clientX - panOffset.x,
        startY: e.touches[0].clientY - panOffset.y,
      };
    }
  }, [panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.node-card')) return;

    if (e.touches.length === 2 && touchRef.current.isPinching) {
      e.preventDefault();
      const newDistance = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);

      if (newDistance && touchRef.current.lastTouchDistance) {
        const scale = newDistance / touchRef.current.lastTouchDistance;
        const newZoom = Math.min(2, Math.max(0.3, zoom * scale));
        setZoom(newZoom);
      }

      if (touchRef.current.lastTouchCenter && newCenter) {
        const dx = newCenter.x - touchRef.current.lastTouchCenter.x;
        const dy = newCenter.y - touchRef.current.lastTouchCenter.y;
        setPanOffset((prev: { x: number; y: number }) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }

      touchRef.current.lastTouchDistance = newDistance;
      touchRef.current.lastTouchCenter = newCenter;
    } else if (e.touches.length === 1 && isPanning && !touchRef.current.isPinching) {
      setPanOffset({
        x: e.touches[0].clientX - panRef.current.startX,
        y: e.touches[0].clientY - panRef.current.startY,
      });
    }
  }, [isPanning, zoom, setZoom, setPanOffset]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchRef.current.isPinching = false;
      touchRef.current.lastTouchDistance = null;
      touchRef.current.lastTouchCenter = null;
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.node-card')) {
      setSelectedNodeId(null);
    }
  }, [setSelectedNodeId]);

  return {
    isPanning,
    handlers: {
      onMouseDown: handleCanvasMouseDown,
      onMouseMove: handleCanvasMouseMove,
      onMouseUp: handleCanvasMouseUp,
      onMouseLeave: handleCanvasMouseLeave,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onClick: handleCanvasClick,
    },
  };
}
