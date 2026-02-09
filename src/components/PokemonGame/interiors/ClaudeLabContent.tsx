'use client';
import { useEffect, useState, useCallback } from 'react';
import { InteriorContentProps } from '../types';
import { getAgentSpritePath } from '../constants';
import { getPlayerFrame } from '../sprites';

export default function ClaudeLabContent({ onExit, onTalkToAgent, selectedNpcId, agents }: InteriorContentProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entering, setEntering] = useState(true);

  // Find agent data from the agents prop (for battle overlay display)
  const agent = agents?.find(a => a.id === selectedNpcId) || null;
  const agentSpritePath = selectedNpcId ? getAgentSpritePath(selectedNpcId, agent?.name) : '';

  // Super agent check — no DELETE for super agents
  const agentNameLower = (agent?.name || '').toLowerCase();
  const isSuperAgent = agentNameLower.includes('super agent') || agentNameLower.includes('orchestrator');

  const actions: { id: string; label: string }[] = [
    { id: 'talk', label: 'TALK' },
    { id: 'return', label: 'RETURN' },
    ...(!isSuperAgent ? [{ id: 'delete', label: 'DELETE' }] : []),
  ];

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Battle keyboard navigation
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
          handleAction(actions[selectedIndex].id);
          break;
        case 'Escape':
          onExit();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, onExit, actions.length]);

  const handleAction = useCallback((action: string) => {
    if (action === 'talk') {
      if (selectedNpcId && onTalkToAgent) {
        onTalkToAgent(selectedNpcId);
      }
    } else if (action === 'delete') {
      if (selectedNpcId && window.electronAPI?.agent?.remove) {
        window.electronAPI.agent.remove(selectedNpcId).catch(() => { });
      }
      onExit();
    } else if (action === 'return') {
      onExit();
    }
  }, [onExit, selectedNpcId, onTalkToAgent]);

  if (!selectedNpcId || !agent) {
    onExit();
    return null;
  }

  // Pixel font style reused across elements
  const pxFont: React.CSSProperties = {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: '1px',
    imageRendering: 'pixelated',
    WebkitFontSmoothing: 'none',
  };

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
        <img
          src="/pokemon/pokemon-battle.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ imageRendering: 'pixelated', zIndex: 1 }}
        />

        <div style={{
          position: 'absolute', left: '8%', top: '12%', zIndex: 10,
          ...pxFont, fontSize: '12px', color: '#282820', textTransform: 'uppercase',
        }}>
          {agent.name.length > 12 ? agent.name.substring(0, 12) : agent.name}
        </div>

        <div style={{ position: 'absolute', right: '20%', top: '10%', width: '18%', zIndex: 5 }}>
          <img src={agentSpritePath} alt={agent.name}
            style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }} />
        </div>

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

        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
          height: '30%', display: 'flex',
          borderTop: '4px solid #484848', imageRendering: 'pixelated',
        }}>
          <div style={{
            flex: '1 1 50%', background: '#f8f8f8',
            borderRight: '4px solid #484848', padding: '8px 14px',
            display: 'flex', alignItems: 'center', borderBottom: '4px solid #484848',
          }}>
            <span style={{ ...pxFont, fontSize: '14px', color: '#282828', lineHeight: '1.8' }}>
              What will<br />
              <span style={{ textTransform: 'uppercase' }}>
                {agent.name.length > 10 ? agent.name.substring(0, 10) : agent.name}
              </span> do?
            </span>
          </div>

          <div style={{
            flex: '1 1 50%', background: '#3870b8',
            borderBottom: '4px solid #284880', boxShadow: 'inset 0 0 0 3px #5090d0',
            padding: '6px 10px', display: 'grid',
            gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
            gap: '0px 8px', alignItems: 'center',
          }}>
            {actions.map((action, i) => (
              <button key={action.id} onClick={() => handleAction(action.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 4px' }}>
                <span style={{ ...pxFont, fontSize: '12px', color: '#f8d038',
                  width: '12px', textShadow: '1px 1px 0 #785800' }}>
                  {i === selectedIndex ? '\u25b6' : ''}
                </span>
                <span style={{ ...pxFont, fontSize: '15px',
                  color: action.id === 'delete' ? '#f85858' : '#f8f8f8',
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
