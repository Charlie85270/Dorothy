'use client';
import { useEffect } from 'react';
import { NPC } from '../types';

interface AgentInfoCardProps {
  npc: NPC;
  skills?: string[];
  onClose: () => void;
}

export default function AgentInfoCard({ npc, skills, onClose }: AgentInfoCardProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const pxFont: React.CSSProperties = {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: '1px',
    WebkitFontSmoothing: 'none',
  };

  // Generate a numeric ID from agent id string
  const numericId = Math.abs(
    npc.id.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
  ) % 100000;

  const statusColor =
    npc.agentStatus === 'running' ? '#38a858' :
    npc.agentStatus === 'idle' || npc.agentStatus === 'waiting' ? '#c8a008' :
    npc.agentStatus === 'completed' ? '#3870b8' :
    '#c83838';

  const statusLabel = npc.agentStatus
    ? npc.agentStatus.charAt(0).toUpperCase() + npc.agentStatus.slice(1)
    : 'Unknown';

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '460px',
          maxWidth: '92vw',
          imageRendering: 'pixelated',
          background: '#b8c8d8',
          border: '4px solid #505860',
          borderRadius: '4px',
          boxShadow: '0 0 0 2px #303840, 4px 6px 0 rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header bar ── */}
        <div style={{
          background: 'linear-gradient(180deg, #78a8d0 0%, #5888b0 100%)',
          borderBottom: '3px solid #406888',
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            ...pxFont,
            fontSize: '16px',
            color: '#f8f8f8',
            textShadow: '2px 2px 0 #385878',
            textTransform: 'uppercase',
            background: 'rgba(0,0,0,0.15)',
            padding: '2px 10px',
            border: '2px solid rgba(255,255,255,0.3)',
          }}>
            Agent Card
          </div>
          <div style={{
            ...pxFont,
            fontSize: '12px',
            color: '#f0f0f0',
            background: 'rgba(0,0,0,0.2)',
            padding: '2px 8px',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            IDNo.{String(numericId).padStart(5, '0')}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{
          position: 'relative',
          padding: '14px 16px',
          minHeight: '180px',
          background: 'repeating-linear-gradient(0deg, #e8f0f8 0px, #e8f0f8 2px, #f0f4f8 2px, #f0f4f8 4px)',
        }}>
          {/* Pokemon sprite (right side) */}
          <div style={{
            position: 'absolute',
            right: '16px',
            top: '10px',
            width: '96px',
            height: '96px',
            background: 'radial-gradient(ellipse at center, rgba(200,216,232,0.6) 0%, transparent 70%)',
          }}>
            {npc.spritePath && (
              <img
                src={npc.spritePath}
                alt={npc.name}
                style={{
                  width: '100%',
                  height: '100%',
                  imageRendering: 'pixelated',
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          {/* Info rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '65%' }}>
            {/* NAME */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                border: '2px solid #5888b0', background: 'transparent', flexShrink: 0,
              }} />
              <span style={{ ...pxFont, fontSize: '13px', color: '#384048' }}>NAME:</span>
              <span style={{ ...pxFont, fontSize: '15px', color: '#181820', textTransform: 'uppercase' }}>
                {npc.name.length > 14 ? npc.name.substring(0, 14) : npc.name}
              </span>
            </div>

            {/* STATUS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                border: '2px solid #5888b0', background: 'transparent', flexShrink: 0,
              }} />
              <span style={{ ...pxFont, fontSize: '13px', color: '#384048' }}>STATUS:</span>
              <span style={{
                ...pxFont, fontSize: '14px', color: statusColor,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: statusColor, display: 'inline-block',
                }} />
                {statusLabel}
              </span>
            </div>

            {/* PROJECT */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                border: '2px solid #5888b0', background: 'transparent', flexShrink: 0,
              }} />
              <span style={{ ...pxFont, fontSize: '13px', color: '#384048' }}>PROJECT:</span>
              <span style={{ ...pxFont, fontSize: '13px', color: '#181820' }}>
                {npc.agentProject || '---'}
              </span>
            </div>

            {/* TYPE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                border: '2px solid #5888b0', background: 'transparent', flexShrink: 0,
              }} />
              <span style={{ ...pxFont, fontSize: '13px', color: '#384048' }}>TYPE:</span>
              <span style={{ ...pxFont, fontSize: '13px', color: '#181820', textTransform: 'uppercase' }}>
                {(npc.name.toLowerCase().includes('super agent') || npc.name.toLowerCase().includes('orchestrator'))
                  ? 'Super Agent'
                  : 'Agent'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Bottom skills bar ── */}
        {skills && skills.length > 0 && (
          <div style={{
            background: 'linear-gradient(180deg, #90b0d0 0%, #6890b8 100%)',
            borderTop: '3px solid #506880',
            padding: '6px 14px 10px',
          }}>
            <div style={{
              ...pxFont,
              fontSize: '11px',
              color: '#f8f8f8',
              textShadow: '1px 1px 0 #385878',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}>
              Skills
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {skills.map((skill) => (
                <div key={skill} style={{
                  padding: '2px 8px',
                  border: '2px solid #506880',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    ...pxFont,
                    fontSize: '10px',
                    color: '#f0f0f0',
                    textShadow: '1px 1px 0 #385878',
                    whiteSpace: 'nowrap',
                  }}>
                    {skill}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Dismiss hint ── */}
        <div style={{
          background: '#485868',
          padding: '4px 14px',
          textAlign: 'center',
        }}>
          <span style={{ ...pxFont, fontSize: '10px', color: '#a0b0c0' }}>
            Press SPACE to close
          </span>
        </div>
      </div>
    </div>
  );
}
