'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GenerativeZone } from '@/types/world';

interface WorldBuilderPromptProps {
  zones: GenerativeZone[];
  onSelectZone: (zoneId: string) => void;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  onExportZone?: (zoneId: string) => void;
  onImportZone?: () => void;
  onDeleteZone?: (zoneId: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Pokemon Emerald style palette (matching PokemonMenu.tsx) ──
const C = {
  borderOuter: '#585858',
  borderInner: '#D8B030',
  titleBar: '#C06828',
  titleBarLight: '#E09040',
  titleText: '#FFF',
  listBg: '#F8F0C8',
  listBorder: '#B89830',
  listRowHover: '#E8E0B0',
  cursor: '#484848',
  separator: '#C8B870',
  descBg: '#3878B8',
  descText: '#FFF',
  textDark: '#484848',
  textMuted: '#908858',
  danger: '#C05050',
  dangerBg: '#F8D8D0',
  dangerBorder: '#D06060',
};

const VISIBLE_ROWS = 10;
const FONT = '"Press Start 2P", "Courier New", monospace';

export default function WorldBuilderPrompt({ zones, onSelectZone, onSubmit, onCancel, onExportZone, onImportZone, onDeleteZone }: WorldBuilderPromptProps) {
  const [mode, setMode] = useState<'menu' | 'input' | 'actions'>('menu');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionIndex, setActionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sorted zones: most recent first
  const sortedZones = [...zones].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // All entries: zones + Build New + Import + Cancel
  const hasImport = !!onImportZone;
  const entries = [
    ...sortedZones.map(z => ({ type: 'zone' as const, zone: z })),
    { type: 'build' as const, zone: null },
    ...(hasImport ? [{ type: 'import' as const, zone: null }] : []),
    { type: 'cancel' as const, zone: null },
  ];

  // Actions for the sub-menu when selecting a zone
  const zoneActions = [
    { id: 'enter', label: 'ENTER' },
    ...(onExportZone ? [{ id: 'export', label: 'EXPORT' }] : []),
    ...(onDeleteZone ? [{ id: 'delete', label: 'DELETE' }] : []),
    { id: 'cancel', label: 'CANCEL' },
  ];

  // Keep selection in view
  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + VISIBLE_ROWS) {
      setScrollOffset(selectedIndex - VISIBLE_ROWS + 1);
    }
  }, [selectedIndex, scrollOffset]);

  // Focus input
  useEffect(() => {
    if (mode === 'input') {
      inputRef.current?.focus();
    }
  }, [mode]);

  // Handle key events
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.stopPropagation();

      // Delete confirmation
      if (confirmDelete) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setConfirmDelete(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onDeleteZone?.(confirmDelete);
          setConfirmDelete(null);
        }
        return;
      }

      // Action sub-menu
      if (mode === 'actions') {
        switch (e.key) {
          case 'ArrowUp': case 'w': case 'W':
            e.preventDefault();
            setActionIndex(i => Math.max(0, i - 1));
            break;
          case 'ArrowDown': case 's': case 'S':
            e.preventDefault();
            setActionIndex(i => Math.min(zoneActions.length - 1, i + 1));
            break;
          case 'Enter': case ' ':
            e.preventDefault();
            handleZoneAction(zoneActions[actionIndex].id);
            break;
          case 'Escape':
            e.preventDefault();
            setMode('menu');
            break;
        }
        return;
      }

      // Input mode
      if (mode === 'input') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setMode('menu');
        }
        return;
      }

      // Main menu
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault();
          setSelectedIndex(i => Math.max(0, i - 1));
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          setSelectedIndex(i => Math.min(entries.length - 1, i + 1));
          break;
        case 'Enter': case ' ':
          e.preventDefault();
          handleSelect();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [mode, selectedIndex, entries.length, confirmDelete, actionIndex, zoneActions.length]);

  const handleSelect = useCallback(() => {
    const entry = entries[selectedIndex];
    if (!entry) return;
    if (entry.type === 'zone') {
      setActionIndex(0);
      setMode('actions');
    } else if (entry.type === 'build') {
      setMode('input');
    } else if (entry.type === 'import') {
      onImportZone?.();
    } else if (entry.type === 'cancel') {
      onCancel();
    }
  }, [selectedIndex, entries, onImportZone, onCancel]);

  const handleZoneAction = useCallback((actionId: string) => {
    const entry = entries[selectedIndex];
    if (!entry || entry.type !== 'zone' || !entry.zone) return;
    setMode('menu');
    if (actionId === 'enter') {
      onSelectZone(entry.zone.id);
    } else if (actionId === 'export') {
      onExportZone?.(entry.zone.id);
    } else if (actionId === 'delete') {
      setConfirmDelete(entry.zone.id);
    }
    // cancel just closes action menu
  }, [selectedIndex, entries, onSelectZone, onExportZone]);

  const handleInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) onSubmit(trimmed);
  }, [inputValue, onSubmit]);

  const visibleEntries = entries.slice(scrollOffset, scrollOffset + VISIBLE_ROWS);
  const emptySlots = Math.max(0, VISIBLE_ROWS - visibleEntries.length);
  const selectedEntry = entries[selectedIndex];

  // Description text for the selected entry
  const descriptionText = (() => {
    if (!selectedEntry) return '';
    if (selectedEntry.type === 'zone' && selectedEntry.zone) {
      return selectedEntry.zone.description || `A generated world zone.`;
    }
    if (selectedEntry.type === 'build') return 'Create a new world from a text prompt. An agent will build it for you.';
    if (selectedEntry.type === 'import') return 'Import a .dorothy-world file shared by someone else.';
    if (selectedEntry.type === 'cancel') return 'Close the world list.';
    return '';
  })();

  // Delete confirmation
  if (confirmDelete) {
    const zone = sortedZones.find(z => z.id === confirmDelete);
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <div style={{
          fontFamily: FONT,
          imageRendering: 'pixelated' as const,
          border: `4px solid ${C.danger}`,
          borderRadius: '8px',
          background: C.dangerBg,
          padding: '4px',
          width: '400px',
        }}>
          <div style={{
            border: `3px solid ${C.dangerBorder}`,
            borderRadius: '4px',
            padding: '16px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.danger, marginBottom: '12px', letterSpacing: '1px' }}>
              DELETE WORLD
            </div>
            <div style={{ fontSize: '11px', color: C.textDark, lineHeight: 1.8, marginBottom: '4px' }}>
              Are you sure?
            </div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.textDark, marginBottom: '16px' }}>
              {zone?.name || 'Unknown'}
            </div>
            <div style={{ fontSize: '9px', color: C.textMuted, marginBottom: '16px' }}>
              This cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1, fontFamily: FONT, fontSize: '10px', fontWeight: 'bold',
                  padding: '8px', border: `3px solid ${C.borderOuter}`, borderRadius: '4px',
                  background: C.listBg, color: C.textDark, cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => { onDeleteZone?.(confirmDelete); setConfirmDelete(null); }}
                style={{
                  flex: 1, fontFamily: FONT, fontSize: '10px', fontWeight: 'bold',
                  padding: '8px', border: `3px solid ${C.danger}`, borderRadius: '4px',
                  background: C.danger, color: '#FFF', cursor: 'pointer',
                }}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Input mode
  if (mode === 'input') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <div style={{
          fontFamily: FONT,
          imageRendering: 'pixelated' as const,
          border: `4px solid ${C.borderOuter}`,
          borderRadius: '8px',
          background: C.listBg,
          padding: '4px',
          width: '520px',
        }}>
          <div style={{
            border: `3px solid ${C.listBorder}`,
            borderRadius: '4px',
            padding: '16px',
          }}>
            {/* Title bar */}
            <div style={{
              background: `linear-gradient(180deg, ${C.titleBarLight} 0%, ${C.titleBar} 100%)`,
              border: `2px solid ${C.borderOuter}`,
              borderRadius: '4px',
              padding: '6px 12px',
              marginBottom: '12px',
            }}>
              <span style={{ color: C.titleText, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
                NEW WORLD
              </span>
            </div>
            <div style={{ fontSize: '10px', color: C.textDark, lineHeight: 1.8, marginBottom: '10px' }}>
              Describe the world to create:
            </div>
            <form onSubmit={handleInputSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. AI hype town, crypto graveyard..."
                style={{
                  fontFamily: FONT,
                  fontSize: '11px',
                  width: '100%',
                  padding: '10px 12px',
                  border: `3px solid ${C.listBorder}`,
                  borderRadius: '4px',
                  background: '#FFF',
                  color: C.textDark,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div className="flex justify-between" style={{ marginTop: '10px', fontSize: '9px', color: C.textMuted }}>
                <span>ESC back</span>
                <span>ENTER create</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
      <div className="flex flex-col w-full relative"
        style={{ fontFamily: FONT, imageRendering: 'pixelated' as const, maxWidth: '720px' }}>

        {/* ═══ Main List Panel ═══ */}
        <div style={{
          border: `4px solid ${C.borderOuter}`,
          borderRadius: '8px',
          background: C.listBg,
          overflow: 'hidden',
        }}>
          {/* Title bar */}
          <div style={{
            margin: '6px 6px 0',
            background: `linear-gradient(180deg, ${C.titleBarLight} 0%, ${C.titleBar} 100%)`,
            border: `2px solid ${C.borderOuter}`,
            borderRadius: '4px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              color: C.titleText,
              fontSize: '12px',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
            }}>
              WORLD ARCHITECT
            </span>
            <span style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '9px',
              fontWeight: 'bold',
            }}>
              {sortedZones.length} WORLD{sortedZones.length !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Inner list border */}
          <div style={{
            margin: '6px',
            border: `3px solid ${C.listBorder}`,
            borderRadius: '4px',
            background: C.listBg,
            overflow: 'hidden',
          }}>
            {/* Rows */}
            {visibleEntries.map((entry, vi) => {
              const actualIndex = scrollOffset + vi;
              const isSelected = actualIndex === selectedIndex;
              const isSpecial = entry.type !== 'zone';

              return (
                <div
                  key={entry.type === 'zone' ? entry.zone!.id : entry.type}
                  className="flex items-center cursor-pointer"
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    backgroundColor: isSelected ? 'rgba(0,0,0,0.07)' : 'transparent',
                    borderBottom: `1px dashed ${C.separator}`,
                  }}
                  onMouseEnter={() => setSelectedIndex(actualIndex)}
                  onClick={() => { setSelectedIndex(actualIndex); handleSelect(); }}
                >
                  {/* Cursor */}
                  <span style={{ width: '16px', flexShrink: 0, fontSize: '10px', color: C.cursor }}>
                    {isSelected ? '\u25b6' : ''}
                  </span>

                  {entry.type === 'zone' && entry.zone && (
                    <>
                      <span style={{
                        flex: 1,
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: C.textDark,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.5px',
                      }}>
                        {entry.zone.name}
                      </span>
                      <span style={{
                        flexShrink: 0,
                        fontSize: '8px',
                        color: C.textMuted,
                        marginLeft: '8px',
                        letterSpacing: '0.5px',
                      }}>
                        {entry.zone.width}&times;{entry.zone.height}
                        {' \u00b7 '}
                        {entry.zone.npcs?.length || 0} NPC
                        {' \u00b7 '}
                        {timeAgo(entry.zone.updatedAt)}
                      </span>
                    </>
                  )}

                  {entry.type === 'build' && (
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 'bold', color: C.titleBar, letterSpacing: '0.5px' }}>
                      + NEW WORLD
                    </span>
                  )}

                  {entry.type === 'import' && (
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 'bold', color: C.titleBar, letterSpacing: '0.5px' }}>
                      IMPORT WORLD
                    </span>
                  )}

                  {entry.type === 'cancel' && (
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 'bold', color: C.textDark, letterSpacing: '0.5px' }}>
                      CANCEL
                    </span>
                  )}
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} style={{
                height: '32px',
                borderBottom: `1px dashed ${C.separator}`,
              }} />
            ))}

            {/* Scroll indicators */}
            {entries.length > VISIBLE_ROWS && (
              <div className="flex justify-center gap-2 py-1" style={{ fontSize: '9px', color: C.textDark, opacity: 0.5 }}>
                {scrollOffset > 0 && <span>{'\u25b2'}</span>}
                {scrollOffset + VISIBLE_ROWS < entries.length && <span>{'\u25bc'}</span>}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Bottom Description Panel ═══ */}
        <div style={{
          marginTop: '4px',
          border: `4px solid ${C.borderOuter}`,
          borderRadius: '8px',
          background: C.descBg,
          padding: '10px 14px',
          height: '70px',
          overflow: 'hidden',
        }}>
          <span style={{
            color: C.descText,
            fontSize: '10px',
            fontWeight: 'bold',
            lineHeight: 1.7,
            textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
          }}>
            {descriptionText}
          </span>
        </div>

        {/* ═══ Action Sub-menu Popup ═══ */}
        {mode === 'actions' && selectedEntry?.type === 'zone' && (
          <div className="absolute z-40"
            style={{
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: `4px solid ${C.borderOuter}`,
              borderRadius: '8px',
              background: C.listBg,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}>
            <div style={{
              margin: '3px',
              border: `3px solid ${C.listBorder}`,
              borderRadius: '4px',
              padding: '4px',
              minWidth: '150px',
            }}>
              {zoneActions.map((action, i) => (
                <div
                  key={action.id}
                  className="flex items-center cursor-pointer"
                  style={{
                    padding: '6px 10px',
                    backgroundColor: i === actionIndex ? 'rgba(0,0,0,0.06)' : 'transparent',
                    borderRadius: '2px',
                  }}
                  onMouseEnter={() => setActionIndex(i)}
                  onClick={() => handleZoneAction(action.id)}
                >
                  <span style={{ width: '16px', flexShrink: 0, fontSize: '10px', color: C.cursor }}>
                    {i === actionIndex ? '\u25b6' : ''}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: action.id === 'delete' ? C.danger : C.textDark,
                    letterSpacing: '0.5px',
                  }}>
                    {action.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
