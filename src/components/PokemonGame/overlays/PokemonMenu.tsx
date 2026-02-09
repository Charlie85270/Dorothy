'use client';
import { useEffect, useState, useCallback } from 'react';
import { PokemonMenuItem } from '../types';

interface PokemonMenuAction {
  id: string;
  label: string;
}

interface PokemonMenuProps {
  items: PokemonMenuItem[];
  actions: PokemonMenuAction[];
  onAction: (actionId: string, item: PokemonMenuItem) => void;
  onBack: () => void;
  leftPanelContent?: React.ReactNode;
  title?: string;
}

// ── Pokemon Emerald Bag-style colors ────────────────────────────────────────
const COLORS = {
  borderOuter: '#585858',
  borderInner: '#D8B030',
  titleBar: '#C06828',
  titleBarLight: '#E09040',
  titleText: '#FFF',
  leftPanelBg: '#68B8A0',
  leftPanelStripe: '#58A890',
  listBg: '#F8F0C8',
  listBorder: '#B89830',
  listRowHover: '#E8E0B0',
  cursorColor: '#484848',
  separator: '#C8B870',
  descBg: '#3878B8',
  descBorder: '#2060A0',
  descText: '#FFF',
  badgeInstalled: '#38A858',
  badgeText: '#FFF',
  textDark: '#484848',
};

const VISIBLE_ROWS = 8;

export default function PokemonMenu({
  items,
  actions,
  onAction,
  onBack,
  leftPanelContent,
  title,
}: PokemonMenuProps) {
  // Add CANCEL as the last item in the list
  const allEntries = [...items, { id: '__cancel__', name: 'CANCEL' } as PokemonMenuItem];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionIndex, setActionIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const selectedItem = allEntries[selectedIndex] || null;
  const isCancel = selectedItem?.id === '__cancel__';

  // Keep selection in view
  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + VISIBLE_ROWS) {
      setScrollOffset(selectedIndex - VISIBLE_ROWS + 1);
    }
  }, [selectedIndex, scrollOffset]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    e.preventDefault();

    if (showActionMenu) {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          setActionIndex(i => Math.max(0, i - 1));
          break;
        case 'ArrowDown': case 's': case 'S':
          setActionIndex(i => Math.min(actions.length - 1, i + 1));
          break;
        case 'Enter': case ' ':
          if (selectedItem) onAction(actions[actionIndex].id, selectedItem);
          setShowActionMenu(false);
          break;
        case 'Escape':
          setShowActionMenu(false);
          break;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        setSelectedIndex(i => Math.max(0, i - 1));
        break;
      case 'ArrowDown': case 's': case 'S':
        setSelectedIndex(i => Math.min(allEntries.length - 1, i + 1));
        break;
      case 'Enter': case ' ':
        if (isCancel) {
          onBack();
        } else {
          setActionIndex(0);
          setShowActionMenu(true);
        }
        break;
      case 'Escape':
        onBack();
        break;
    }
  }, [showActionMenu, actions, actionIndex, selectedItem, allEntries.length, onAction, onBack, isCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Visible rows for the list
  const visibleEntries = allEntries.slice(scrollOffset, scrollOffset + VISIBLE_ROWS);
  // Fill remaining slots with empty rows
  const emptySlots = Math.max(0, VISIBLE_ROWS - visibleEntries.length);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
      <div className="flex flex-col w-full max-w-3xl relative"
        style={{ fontFamily: '"Press Start 2P", "Courier New", monospace', imageRendering: 'pixelated' as const }}>

        {/* ═══ Top Section: Left Panel + Right List ═══ */}
        <div className="flex" style={{ height: '340px' }}>

          {/* ── Left Panel (teal striped with Chen) ── */}
          <div className="w-[38%] relative overflow-hidden"
            style={{
              border: `4px solid ${COLORS.borderOuter}`,
              borderRight: 'none',
              borderRadius: '8px 0 0 8px',
              background: COLORS.leftPanelBg,
            }}>
            {/* Vertical stripes */}
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 3px, ${COLORS.leftPanelStripe} 3px, ${COLORS.leftPanelStripe} 5px)`,
              opacity: 0.5,
            }} />

            {/* Title bar */}
            <div className="relative z-10 mx-2 mt-2" style={{
              background: `linear-gradient(180deg, ${COLORS.titleBarLight} 0%, ${COLORS.titleBar} 100%)`,
              border: `2px solid ${COLORS.borderOuter}`,
              borderRadius: '4px',
              padding: '4px 12px',
            }}>
              <span style={{
                color: COLORS.titleText,
                fontSize: '13px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
              }}>
                {title || 'ITEMS'}
              </span>
            </div>

            {/* Chen image area */}
            <div className="relative z-10 flex items-center justify-center" style={{ height: 'calc(100% - 50px)' }}>
              {leftPanelContent}
            </div>
          </div>

          {/* ── Right Panel (item list) ── */}
          <div className="w-[62%] flex flex-col overflow-hidden"
            style={{
              border: `4px solid ${COLORS.borderOuter}`,
              borderRadius: '0 8px 8px 0',
              background: COLORS.listBg,
            }}>
            {/* Inner border effect */}
            <div className="flex-1 m-1 flex flex-col overflow-hidden" style={{
              border: `3px solid ${COLORS.listBorder}`,
              borderRadius: '4px',
              background: COLORS.listBg,
            }}>
              {/* List rows */}
              <div className="flex-1 flex flex-col">
                {visibleEntries.map((entry, vi) => {
                  const actualIndex = scrollOffset + vi;
                  const isSelected = actualIndex === selectedIndex;
                  const isCancelEntry = entry.id === '__cancel__';

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center cursor-pointer"
                      style={{
                        height: `${100 / VISIBLE_ROWS}%`,
                        padding: '0 10px',
                        backgroundColor: isSelected ? 'rgba(0,0,0,0.06)' : 'transparent',
                        borderBottom: `1px dashed ${COLORS.separator}`,
                      }}
                      onClick={() => {
                        setSelectedIndex(actualIndex);
                        if (isCancelEntry) {
                          onBack();
                        } else {
                          setActionIndex(0);
                          setShowActionMenu(true);
                        }
                      }}
                    >
                      {/* Cursor triangle */}
                      <span style={{
                        width: '18px',
                        flexShrink: 0,
                        color: COLORS.cursorColor,
                        fontSize: '11px',
                      }}>
                        {isSelected ? '\u25b6' : ''}
                      </span>

                      {/* Item name */}
                      <span style={{
                        flex: 1,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: COLORS.textDark,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {entry.name}
                      </span>

                      {/* Badge (right side) */}
                      {!isCancelEntry && entry.badge && (
                        <span style={{
                          flexShrink: 0,
                          fontSize: '9px',
                          fontWeight: 'bold',
                          color: COLORS.badgeText,
                          backgroundColor: entry.badgeColor
                            || (entry.badge === 'ON' || entry.badge === 'INSTALLED' || entry.badge === 'installed'
                              ? COLORS.badgeInstalled
                              : entry.badge === 'OFF'
                                ? '#C05050'
                                : '#888'),
                          padding: '2px 6px',
                          borderRadius: '3px',
                          letterSpacing: '0.5px',
                          marginLeft: '4px',
                        }}>
                          {entry.badge.toUpperCase()}
                        </span>
                      )}

                      {/* Install count (like "x 14") */}
                      {!isCancelEntry && entry.installs && (
                        <span style={{
                          flexShrink: 0,
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: COLORS.textDark,
                          marginLeft: '8px',
                          opacity: 0.6,
                        }}>
                          {entry.installs}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Empty rows to fill the grid */}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} style={{
                    height: `${100 / VISIBLE_ROWS}%`,
                    borderBottom: `1px dashed ${COLORS.separator}`,
                  }} />
                ))}
              </div>

              {/* Scroll indicators */}
              {allEntries.length > VISIBLE_ROWS && (
                <div className="flex justify-center gap-2 py-1" style={{ fontSize: '10px', color: COLORS.textDark, opacity: 0.5 }}>
                  {scrollOffset > 0 && <span>\u25b2</span>}
                  {scrollOffset + VISIBLE_ROWS < allEntries.length && <span>\u25bc</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Bottom Description Panel ═══ */}
        <div style={{
          marginTop: '4px',
          border: `4px solid ${COLORS.borderOuter}`,
          borderRadius: '8px',
          background: COLORS.descBg,
          minHeight: '80px',
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          gap: '12px',
        }}>


          {/* Description text */}
          <div style={{ flex: 1 }}>
            {isCancel ? (
              <span style={{
                color: COLORS.descText,
                fontSize: '12px',
                fontWeight: 'bold',
                lineHeight: 1.6,
                textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
              }}>
                Close the skill list.
              </span>
            ) : selectedItem ? (
              <span style={{
                color: COLORS.descText,
                fontSize: '12px',
                fontWeight: 'bold',
                lineHeight: 1.6,
                textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
              }}>
                {selectedItem.description || `A ${selectedItem.category || 'useful'} skill from ${selectedItem.repo || 'the community'}.`}
              </span>
            ) : (
              <span style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>
                Select a skill to see details.
              </span>
            )}
          </div>
        </div>

        {/* ═══ Action Sub-menu Popup ═══ */}
        {showActionMenu && selectedItem && !isCancel && (
          <div className="absolute z-40"
            style={{
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: `4px solid ${COLORS.borderOuter}`,
              borderRadius: '8px',
              background: COLORS.listBg,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            }}>
            <div style={{
              margin: '3px',
              border: `3px solid ${COLORS.listBorder}`,
              borderRadius: '4px',
              padding: '4px',
              minWidth: '140px',
            }}>
              {actions.map((action, i) => (
                <div
                  key={action.id}
                  className="flex items-center cursor-pointer"
                  style={{
                    padding: '6px 10px',
                    backgroundColor: i === actionIndex ? 'rgba(0,0,0,0.06)' : 'transparent',
                    borderRadius: '2px',
                  }}
                  onClick={() => {
                    onAction(action.id, selectedItem);
                    setShowActionMenu(false);
                  }}
                >
                  <span style={{
                    width: '18px',
                    flexShrink: 0,
                    fontSize: '11px',
                    color: COLORS.cursorColor,
                  }}>
                    {i === actionIndex ? '\u25b6' : ''}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: COLORS.textDark,
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
