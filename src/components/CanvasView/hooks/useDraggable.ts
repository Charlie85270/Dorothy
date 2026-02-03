import { useState, useRef, useCallback } from 'react';
import { DRAG_THRESHOLD } from '../constants';

interface DragRef {
  startX: number;
  startY: number;
  hasMoved: boolean;
}

export function useDraggable(
  onDrag: (delta: { x: number; y: number }) => void,
  onSelect: () => void
) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragRef>({ startX: 0, startY: 0, hasMoved: false });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, hasMoved: false };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      if (!dragRef.current.hasMoved && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
        dragRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragRef.current.hasMoved) {
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        onDrag({ x: deltaX, y: deltaY });
      }
    };

    const handleMouseUp = () => {
      if (!dragRef.current.hasMoved) {
        onSelect();
      }
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDrag, onSelect]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.stopPropagation();
    const touch = e.touches[0];
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, hasMoved: false };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - dragRef.current.startX;
    const deltaY = touch.clientY - dragRef.current.startY;

    if (!dragRef.current.hasMoved && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      dragRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.startX = touch.clientX;
      dragRef.current.startY = touch.clientY;
      onDrag({ x: deltaX, y: deltaY });
    }
  }, [onDrag]);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.hasMoved) {
      onSelect();
    }
    setIsDragging(false);
  }, [onSelect]);

  return {
    isDragging,
    handleMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
