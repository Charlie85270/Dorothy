'use client';
import { useEffect, useState } from 'react';
import { NPC, GameAssets } from '../types';
import { getPokemonFrame } from '../sprites';

interface BattleOverlayProps {
  npc: NPC;
  assets: GameAssets;
  onAction: (action: 'talk' | 'info' | 'run') => void;
}

export default function BattleOverlay({ npc, assets, onAction }: BattleOverlayProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entering, setEntering] = useState(true);
  const actions = [
    { id: 'talk' as const, label: 'TALK', desc: 'Open terminal' },
    { id: 'info' as const, label: 'INFO', desc: 'View details' },
    { id: 'run' as const, label: 'RUN', desc: 'Go back' },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': case 'w':
          setSelectedIndex(i => Math.max(0, i - 1));
          break;
        case 'ArrowDown': case 's':
          setSelectedIndex(i => Math.min(actions.length - 1, i + 1));
          break;
        case ' ': case 'Enter':
          onAction(actions[selectedIndex].id);
          break;
        case 'Escape':
          onAction('run');
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, onAction]);

  // Get pokemon sprite for canvas rendering
  const pokemonCanvas = (() => {
    if (!assets.back || npc.spriteIndex === undefined) return null;
    const row = Math.floor(npc.spriteIndex / 25);
    const col = npc.spriteIndex % 25;
    const frame = getPokemonFrame(row, col);
    return { img: assets.back, ...frame };
  })();

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.85)',
        animation: entering ? 'fadeIn 0.3s ease-out' : undefined,
      }}
    >
      <div className="flex flex-col items-center gap-6 max-w-lg w-full mx-4">
        {/* Battle Background */}
        <div className="relative w-full aspect-[3/2] border-4 border-gray-700 rounded-lg overflow-hidden bg-gradient-to-b from-green-200 to-green-400">
          {assets.pokemonBattle && (
            <img
              src={assets.pokemonBattle.src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          )}

          {/* Pokemon Sprite */}
          <div className="absolute right-8 top-4 w-32 h-32">
            {pokemonCanvas ? (
              <canvas
                ref={canvas => {
                  if (!canvas || !pokemonCanvas) return;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return;
                  canvas.width = 128;
                  canvas.height = 128;
                  ctx.imageSmoothingEnabled = false;
                  ctx.clearRect(0, 0, 128, 128);
                  ctx.drawImage(
                    pokemonCanvas.img,
                    pokemonCanvas.sx, pokemonCanvas.sy, pokemonCanvas.sw, pokemonCanvas.sh,
                    8, 8, 112, 112
                  );
                }}
                width={128}
                height={128}
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center text-4xl"
                style={{ backgroundColor: '#f8a848', border: '3px solid #c07020' }}>
                <span className="font-bold text-white" style={{ fontFamily: 'monospace' }}>
                  {npc.name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Agent Info Panel */}
          <div className="absolute left-4 top-4 bg-white/90 border-2 border-gray-800 rounded px-3 py-2" style={{ fontFamily: 'monospace' }}>
            <div className="font-bold text-black text-lg">{npc.name}</div>
            {npc.agentStatus && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  npc.agentStatus === 'running' ? 'bg-green-500' :
                  npc.agentStatus === 'idle' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-gray-700 capitalize">{npc.agentStatus}</span>
              </div>
            )}
            {npc.agentProject && (
              <div className="text-xs text-gray-500 mt-0.5">{npc.agentProject}</div>
            )}
          </div>
        </div>

        {/* Action Menu */}
        <div className="w-full border-4 border-gray-800 rounded-lg bg-white p-3" style={{ fontFamily: 'monospace' }}>
          <div className="text-sm text-gray-500 mb-2">What will you do?</div>
          <div className="grid grid-cols-1 gap-1">
            {actions.map((action, i) => (
              <button
                key={action.id}
                onClick={() => onAction(action.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{i === selectedIndex ? '\u25b6' : ' '}</span>
                <span className="font-bold">{action.label}</span>
                <span className="text-sm opacity-60 ml-auto">{action.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
