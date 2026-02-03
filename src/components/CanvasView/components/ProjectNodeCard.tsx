'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderGit2,
  GitBranch,
  GripVertical,
  MoreVertical,
  Plus,
} from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import type { ProjectNode } from '../types';

interface ProjectNodeCardProps {
  node: ProjectNode;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (delta: { x: number; y: number }) => void;
  onAddAgent: () => void;
}

export function ProjectNodeCard({
  node,
  isSelected,
  onSelect,
  onDrag,
  onAddAgent,
}: ProjectNodeCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { isDragging, handleMouseDown, handleTouchStart, handleTouchMove, handleTouchEnd } = useDraggable(onDrag, onSelect);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const agentCount = node.agentIds.length;

  return (
    <motion.div
      className={`node-card absolute select-none touch-none ${isDragging ? 'z-50 cursor-grabbing' : 'z-10 cursor-pointer'}`}
      style={{ left: node.position.x, top: node.position.y }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: isDragging ? 1 : 1.02 }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`w-56 rounded-none border backdrop-blur-sm transition-all duration-200 ${isSelected
          ? 'bg-zinc-900/95 border-purple-500/50 shadow-lg shadow-purple-500/20'
          : 'bg-zinc-900/80 border-zinc-700/50 hover:border-zinc-600'
          }`}
      >
        {/* Connection point */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-zinc-800 border border-purple-500/50" />

        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-zinc-700/50">
          <GripVertical className="w-4 h-4 text-zinc-600 cursor-grab" />
          <FolderGit2 className="w-4 h-4 text-purple-400" />
          <span className="font-medium text-zinc-200 truncate text-sm flex-1">{node.name}</span>
          {agentCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-cyan-500/20 text-cyan-400">
              {agentCount} agent{agentCount > 1 ? 's' : ''}
            </span>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 hover:bg-zinc-700/50 rounded transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-zinc-400" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-none shadow-xl z-50 overflow-hidden"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onAddAgent();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-cyan-400" />
                    Add agent
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <div className="text-xs text-zinc-500 truncate">{node.path}</div>
          {node.branch && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <GitBranch className="w-3 h-3" />
              <span className="truncate">{node.branch}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
