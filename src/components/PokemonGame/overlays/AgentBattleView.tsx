'use client';
import { useEffect, useState, useCallback } from 'react';
import { getPlayerFrame } from '../sprites';

interface BattleAction {
  id: string;
  label: string;
  color?: string; // optional custom color (e.g. red for DELETE)
}

interface AgentBattleViewProps {
  agentName: string;
  agentSpritePath: string;
  actions: BattleAction[];
  onAction: (actionId: string) => void;
  onEscape?: () => void;
}

export default function AgentBattleView({ agentName, agentSpritePath, actions, onAction, onEscape }: AgentBattleViewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entering, setEntering] = useState(true);

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Battle keyboard navigation (2-column grid)
  useEffect(() => {
    const cols = 2;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowLeft': case 'a':
          setSelectedIndex(i => i % cols === 0 ? i : i - 1);
          break;
        case 'ArrowRight': case 'd':
          setSelectedIndex(i => i % cols === cols - 1 || i + 1 >= actions.length ? i : i + 1);
          break;
        case 'ArrowUp': case 'w':
          setSelectedIndex(i => i - cols >= 0 ? i - cols : i);
          break;
        case 'ArrowDown': case 's':
          setSelectedIndex(i => i + cols < actions.length ? i + cols : i);
          break;
        case ' ': case 'Enter':
          onAction(actions[selectedIndex].id);
          break;
        case 'Escape':
          if (onEscape) onEscape();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, onAction, onEscape, actions]);

  const pxFont: React.CSSProperties = {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: '1px',
    imageRendering: 'pixelated',
    WebkitFontSmoothing: 'none',
  };

  const displayName = agentName.length > 12 ? agentName.substring(0, 12) : agentName;
  const menuName = agentName.length > 10 ? agentName.substring(0, 10) : agentName;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{
        backgroundColor: '#000',
        animation: entering ? 'fadeIn 0.3s ease-out' : undefined,
        imageRendering: 'pixelated',
      }}
    >
      <div className="relative w-full max-w-2xl mx-auto" style={{ aspectRatio: '240 / 160' }}>
        {/* Battle background */}
        <img
          src="/pokemon/pokemon-battle.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ imageRendering: 'pixelated', zIndex: 1 }}
        />

        {/* Agent name label */}
        <div style={{
          position: 'absolute', left: '8%', top: '12%', zIndex: 10,
          ...pxFont, fontSize: '12px', color: '#282820', textTransform: 'uppercase',
        }}>
          {displayName}
        </div>

        {/* Agent pokemon sprite (top-right) */}
        <div style={{ position: 'absolute', right: '20%', top: '10%', width: '18%', zIndex: 5 }}>
          <img src={agentSpritePath} alt={agentName}
            style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }} />
        </div>

        {/* Player back sprite (bottom-left) */}
        <div style={{ position: 'absolute', left: '18%', bottom: '26%', width: '16%', zIndex: 3 }}>
          <canvas
            ref={canvas => {
              if (!canvas) return;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              canvas.width = 96; canvas.height = 96;
              ctx.imageSmoothingEnabled = false;
              ctx.clearRect(0, 0, 96, 96);
              const playerImg = new Image();
              playerImg.src = '/pokemon/player/player-sprite.png';
              playerImg.onload = () => {
                const frame = getPlayerFrame('up', 0);
                ctx.drawImage(playerImg, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, 96, 96);
              };
            }}
            width={96} height={96}
            style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }}
          />
        </div>

        {/* Bottom action panel */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
          height: '30%', display: 'flex',
          borderTop: '4px solid #484848', imageRendering: 'pixelated',
        }}>
          {/* Text panel */}
          <div style={{
            flex: '1 1 50%', background: '#f8f8f8',
            borderRight: '4px solid #484848', padding: '8px 14px',
            display: 'flex', alignItems: 'center', borderBottom: '4px solid #484848',
          }}>
            <span style={{ ...pxFont, fontSize: '14px', color: '#282828', lineHeight: '1.8' }}>
              What will<br />
              <span style={{ textTransform: 'uppercase' }}>{menuName}</span> do?
            </span>
          </div>

          {/* Action buttons */}
          <div style={{
            flex: '1 1 50%', background: '#3870b8',
            borderBottom: '4px solid #284880', boxShadow: 'inset 0 0 0 3px #5090d0',
            padding: '6px 10px', display: 'grid',
            gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
            gap: '0px 8px', alignItems: 'center',
          }}>
            {actions.map((action, i) => (
              <button key={action.id} onClick={() => onAction(action.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 4px' }}>
                <span style={{ ...pxFont, fontSize: '12px', color: '#f8d038',
                  width: '12px', textShadow: '1px 1px 0 #785800' }}>
                  {i === selectedIndex ? '\u25b6' : ''}
                </span>
                <span style={{ ...pxFont, fontSize: '15px',
                  color: action.color || '#f8f8f8',
                  textShadow: '2px 2px 0 #282828' }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
