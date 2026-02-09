'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BUILDINGS } from '../constants';

interface GameMenuProps {
  onClose: () => void;
}

export default function GameMenu({ onClose }: GameMenuProps) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuItems = [
    { label: 'RESUME', action: () => onClose() },
    ...BUILDINGS.map(b => ({
      label: b.label,
      action: () => router.push(b.route),
    })),
  ];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': case 'w':
          setSelectedIndex(i => Math.max(0, i - 1));
          break;
        case 'ArrowDown': case 's':
          setSelectedIndex(i => Math.min(menuItems.length - 1, i + 1));
          break;
        case ' ': case 'Enter':
          menuItems[selectedIndex].action();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, onClose]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
      <div
        className="border-4 border-gray-800 rounded-lg bg-white p-4 min-w-[280px] max-h-[80vh] overflow-y-auto"
        style={{ fontFamily: 'monospace' }}
      >
        <h2 className="text-center font-bold text-xl text-black mb-4 border-b-2 border-gray-300 pb-2">
          MENU
        </h2>
        <div className="space-y-1">
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${
                i === selectedIndex
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span>{i === selectedIndex ? '▶' : ' '}</span>
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">ESC to close</p>
      </div>
    </div>
  );
}
