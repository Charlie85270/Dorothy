'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LayoutPreset } from '../types';
import { LAYOUT_PRESETS } from '../constants';

interface LayoutPresetSelectorProps {
  current: LayoutPreset;
  onChange: (preset: LayoutPreset) => void;
  disabledPresets?: LayoutPreset[];
}

// Visual grid icons as small SVG-like representations
function GridIcon({ preset, size = 20 }: { preset: LayoutPreset; size?: number }) {
  const def = LAYOUT_PRESETS[preset];
  const gap = 1;
  const cellW = (size - gap * (def.cols - 1)) / def.cols;
  const cellH = (size - gap * (def.rows - 1)) / def.rows;

  // Focus layout: first cell is wider
  if (preset === 'focus') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={0} y={0} width={size * 0.65} height={size} rx={1} fill="currentColor" opacity={0.6} />
        <rect x={size * 0.65 + gap} y={0} width={size * 0.35 - gap} height={size} rx={1} fill="currentColor" opacity={0.4} />
      </svg>
    );
  }

  const cells = [];
  for (let r = 0; r < def.rows; r++) {
    for (let c = 0; c < def.cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={c * (cellW + gap)}
          y={r * (cellH + gap)}
          width={cellW}
          height={cellH}
          rx={1}
          fill="currentColor"
          opacity={0.5}
        />
      );
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {cells}
    </svg>
  );
}

export default function LayoutPresetSelector({ current, onChange, disabledPresets = [] }: LayoutPresetSelectorProps) {
  const disabledSet = new Set(disabledPresets);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 bg-secondary border border-border hover:border-border transition-colors text-xs"
        style={{ borderRadius: 7 }}
      >
        <GridIcon preset={current} size={16} />
        <span className="text-foreground">{LAYOUT_PRESETS[current].label}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border shadow-xl z-50 min-w-[180px]">
          {(Object.keys(LAYOUT_PRESETS) as LayoutPreset[]).map(preset => {
            const isDisabled = disabledSet.has(preset);
            return (
              <button
                key={preset}
                onClick={() => { if (!isDisabled) { onChange(preset); setOpen(false); } }}
                className={`
                  flex items-center gap-3 w-full px-3 py-2 text-xs transition-colors
                  ${isDisabled
                    ? 'opacity-30 cursor-not-allowed'
                    : preset === current
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                  }
                `}
                title={isDisabled ? `Too few panels for current agents (max ${LAYOUT_PRESETS[preset].maxPanels})` : undefined}
              >
                <GridIcon preset={preset} size={18} />
                <span>{LAYOUT_PRESETS[preset].label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  max {LAYOUT_PRESETS[preset].maxPanels}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
