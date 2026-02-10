'use client';

interface ResizeHandleProps {
  type: 'col' | 'row';
  index: number;
  onMouseDown: (e: React.MouseEvent, type: 'col' | 'row', index: number) => void;
}

export default function ResizeHandle({ type, index, onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className={`
        absolute z-10 group
        ${type === 'col'
          ? 'top-0 bottom-0 w-1 cursor-col-resize hover:bg-cyan-500/30'
          : 'left-0 right-0 h-1 cursor-row-resize hover:bg-cyan-500/30'
        }
      `}
      onMouseDown={e => onMouseDown(e, type, index)}
    >
      <div
        className={`
          absolute bg-cyan-500/0 group-hover:bg-cyan-500/50 transition-colors
          ${type === 'col' ? 'w-px top-0 bottom-0 left-1/2 -translate-x-1/2' : 'h-px left-0 right-0 top-1/2 -translate-y-1/2'}
        `}
      />
    </div>
  );
}
