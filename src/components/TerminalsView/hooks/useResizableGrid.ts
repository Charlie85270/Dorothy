'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizableGridOptions {
  cols: number;
  rows: number;
  enabled: boolean;
}

export function useResizableGrid({ cols, rows, enabled }: UseResizableGridOptions) {
  // Store column and row fractions as arrays (e.g., [1, 1] for equal 2-col)
  const [colFractions, setColFractions] = useState<number[]>(() => Array(cols).fill(1));
  const [rowFractions, setRowFractions] = useState<number[]>(() => Array(rows).fill(1));
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    type: 'col' | 'row';
    index: number;
    startPos: number;
    startFractions: number[];
  } | null>(null);

  // Reset fractions when grid dimensions change
  useEffect(() => {
    setColFractions(Array(cols).fill(1));
    setRowFractions(Array(rows).fill(1));
  }, [cols, rows]);

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    type: 'col' | 'row',
    index: number
  ) => {
    if (!enabled) return;
    e.preventDefault();
    draggingRef.current = {
      type,
      index,
      startPos: type === 'col' ? e.clientX : e.clientY,
      startFractions: type === 'col' ? [...colFractions] : [...rowFractions],
    };
  }, [enabled, colFractions, rowFractions]);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      const drag = draggingRef.current;
      if (!drag || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const totalSize = drag.type === 'col' ? rect.width : rect.height;
      const delta = (drag.type === 'col' ? e.clientX : e.clientY) - drag.startPos;
      const deltaFraction = (delta / totalSize) * drag.startFractions.length;

      const newFractions = [...drag.startFractions];
      const i = drag.index;
      const minFraction = 0.2;

      // Adjust adjacent fractions
      newFractions[i] = Math.max(minFraction, drag.startFractions[i] + deltaFraction);
      newFractions[i + 1] = Math.max(minFraction, drag.startFractions[i + 1] - deltaFraction);

      if (drag.type === 'col') {
        setColFractions(newFractions);
      } else {
        setRowFractions(newFractions);
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled]);

  const gridTemplateColumns = colFractions.map(f => `${f}fr`).join(' ');
  const gridTemplateRows = rowFractions.map(f => `${f}fr`).join(' ');

  return {
    containerRef,
    gridTemplateColumns,
    gridTemplateRows,
    handleMouseDown,
    isDragging: draggingRef.current !== null,
  };
}
