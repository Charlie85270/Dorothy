'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import type { CustomTab, ActiveTab } from '../types';

interface CustomTabBarProps {
  tabs: CustomTab[];
  activeTab: ActiveTab;
  canCreateTab: boolean;
  onSelectTab: (tabId: string) => void;
  onCreateTab: (name: string) => void;
  onDeleteTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onReorderTabs: (fromIndex: number, toIndex: number) => void;
}

export default function CustomTabBar({
  tabs,
  activeTab,
  canCreateTab,
  onSelectTab,
  onCreateTab,
  onDeleteTab,
  onRenameTab,
  onReorderTabs,
}: CustomTabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const createDialogRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Focus create input when dialog opens
  useEffect(() => {
    if (showCreateDialog && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreateDialog]);

  // Close create dialog on click outside
  useEffect(() => {
    if (!showCreateDialog) return;
    const handler = (e: MouseEvent) => {
      if (createDialogRef.current && !createDialogRef.current.contains(e.target as Node)) {
        setShowCreateDialog(false);
        setCreateName('');
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showCreateDialog]);

  const startEditing = useCallback((tab: CustomTab) => {
    setEditingId(tab.id);
    setEditValue(tab.name);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRenameTab(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onRenameTab]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') cancelEdit();
  }, [commitEdit, cancelEdit]);

  const handleCreateSubmit = useCallback(() => {
    const name = createName.trim();
    if (name) {
      onCreateTab(name);
    }
    setShowCreateDialog(false);
    setCreateName('');
  }, [createName, onCreateTab]);

  const handleCreateKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateSubmit();
    else if (e.key === 'Escape') {
      setShowCreateDialog(false);
      setCreateName('');
    }
  }, [handleCreateSubmit]);

  // Drag handlers for reorder
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== toIdx) {
      onReorderTabs(dragIdx, toIdx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, onReorderTabs]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  const isActive = (tabId: string) =>
    activeTab.type === 'custom' && activeTab.tabId === tabId;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 bg-[#0e0e1a] border-b border-white/10">
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            draggable={editingId !== tab.id}
            onDragStart={e => handleDragStart(e, idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={e => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`
              flex items-center gap-1.5 px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer group
              ${isActive(tab.id)
                ? 'bg-white/10 text-foreground border-b-2 border-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }
              ${dragOverIdx === idx && dragIdx !== idx ? 'border-l-2 border-l-blue-400' : ''}
            `}
            onClick={() => onSelectTab(tab.id)}
            onDoubleClick={e => { e.stopPropagation(); startEditing(tab); }}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
                className="bg-transparent text-xs text-foreground outline-none border-b border-white/30 w-[80px]"
                maxLength={20}
              />
            ) : (
              <span>{tab.name}</span>
            )}

            {/* Agent count badge */}
            <span className="text-[10px] opacity-50">{tab.agentIds.length}</span>

            {/* Delete button */}
            <button
              onClick={e => { e.stopPropagation(); onDeleteTab(tab.id); }}
              className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-muted-foreground hover:text-red-400"
              title="Delete board"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Create tab button + dialog */}
      {canCreateTab && (
        <div className="relative ml-1 shrink-0">
          <button
            onClick={() => { setShowCreateDialog(true); setCreateName(''); }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title="Create new board (max 5)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {showCreateDialog && (
            <div
              ref={createDialogRef}
              className="absolute top-full right-0 mt-1 bg-card border border-border shadow-xl z-50 p-3 min-w-[220px]"
            >
              <p className="text-xs text-muted-foreground mb-2">Board name</p>
              <input
                ref={createInputRef}
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="e.g. Frontend, Backend..."
                className="w-full px-2 py-1.5 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-white/30 mb-2"
                maxLength={20}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowCreateDialog(false); setCreateName(''); }}
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSubmit}
                  disabled={!createName.trim()}
                  className="px-2.5 py-1 text-xs bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
