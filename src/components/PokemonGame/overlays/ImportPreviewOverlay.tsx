'use client';
import { useEffect, useState } from 'react';
import type { ImportPreview } from '@/types/electron';

interface ImportPreviewOverlayProps {
  preview: ImportPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

const C = {
  borderOuter: '#585858',
  titleBar: '#C06828',
  titleBarLight: '#E09040',
  titleText: '#FFF',
  listBg: '#F8F0C8',
  listBorder: '#B89830',
  textDark: '#484848',
  textMuted: '#908858',
  descBg: '#3878B8',
  descText: '#FFF',
};

const FONT = '"Press Start 2P", "Courier New", monospace';

export default function ImportPreviewOverlay({ preview, onConfirm, onCancel }: ImportPreviewOverlayProps) {
  const [actionIndex, setActionIndex] = useState(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault();
          setActionIndex(0);
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          setActionIndex(1);
          break;
        case 'Enter': case ' ':
          e.preventDefault();
          if (actionIndex === 0) onConfirm();
          else onCancel();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onConfirm, onCancel, actionIndex]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
      <div style={{
        fontFamily: FONT,
        imageRendering: 'pixelated' as const,
        border: `4px solid ${C.borderOuter}`,
        borderRadius: '8px',
        background: C.listBg,
        padding: '4px',
        width: '480px',
      }}>
        <div style={{
          border: `3px solid ${C.listBorder}`,
          borderRadius: '4px',
          padding: '12px',
        }}>
          {/* Title bar */}
          <div style={{
            background: `linear-gradient(180deg, ${C.titleBarLight} 0%, ${C.titleBar} 100%)`,
            border: `2px solid ${C.borderOuter}`,
            borderRadius: '4px',
            padding: '6px 12px',
            marginBottom: '14px',
          }}>
            <span style={{ color: C.titleText, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
              IMPORT WORLD
            </span>
          </div>

          <div className="flex gap-3">
            {/* Screenshot */}
            {preview.screenshot && (
              <div style={{
                flexShrink: 0,
                width: 100,
                height: 100,
                border: `3px solid ${C.listBorder}`,
                borderRadius: '4px',
                overflow: 'hidden',
                background: '#EEE',
              }}>
                <img
                  src={preview.screenshot}
                  alt="Zone preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
                />
              </div>
            )}

            {/* Zone info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: C.textDark,
                letterSpacing: '0.5px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {preview.name}
              </div>
              {preview.description && (
                <div style={{
                  fontSize: '9px',
                  color: C.textMuted,
                  marginTop: '6px',
                  lineHeight: 1.6,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {preview.description}
                </div>
              )}
              <div style={{
                fontSize: '9px',
                color: C.textMuted,
                marginTop: '8px',
                letterSpacing: '0.5px',
                display: 'flex',
                gap: '10px',
              }}>
                <span>{preview.width}&times;{preview.height}</span>
                <span>{preview.npcCount} NPC{preview.npcCount !== 1 ? 's' : ''}</span>
                <span>{preview.buildingCount} bldg{preview.buildingCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Action buttons as Pokemon-style list */}
          <div style={{
            marginTop: '14px',
            border: `2px solid ${C.listBorder}`,
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            {['IMPORT', 'CANCEL'].map((label, i) => (
              <div
                key={label}
                className="flex items-center cursor-pointer"
                style={{
                  padding: '7px 10px',
                  backgroundColor: i === actionIndex ? 'rgba(0,0,0,0.06)' : 'transparent',
                  borderBottom: i === 0 ? `1px dashed ${C.listBorder}` : 'none',
                }}
                onMouseEnter={() => setActionIndex(i)}
                onClick={() => i === 0 ? onConfirm() : onCancel()}
              >
                <span style={{ width: '16px', flexShrink: 0, fontSize: '10px', color: C.textDark }}>
                  {i === actionIndex ? '\u25b6' : ''}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: C.textDark,
                  letterSpacing: '0.5px',
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
