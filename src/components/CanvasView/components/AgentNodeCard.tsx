'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderGit2,
  Play,
  Square,
  Sparkles,
  Terminal,
  GripVertical,
  MoreVertical,
  Settings2,
} from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { StatusIndicator } from './StatusIndicator';
import { STATUS_COLORS, CHARACTER_EMOJIS } from '../constants';
import type { AgentNode } from '../types';

interface AgentNodeCardProps {
  node: AgentNode;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (delta: { x: number; y: number }) => void;
  onOpenTerminal: () => void;
  onToggleAgent: () => void;
  onEdit: () => void;
}

export function AgentNodeCard({
  node,
  isSelected,
  onSelect,
  onDrag,
  onOpenTerminal,
  onToggleAgent,
  onEdit,
}: AgentNodeCardProps) {
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

  const isRunning = node.status === 'running' || node.status === 'waiting';

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
      <StatusIndicator status={node.status} />

      <div
        className={`w-72 rounded-none border backdrop-blur-sm transition-all duration-200 ${isSelected
          ? 'bg-zinc-900/95 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
          : node.status === 'waiting'
            ? 'bg-zinc-900/95 border-amber-500/50 shadow-lg shadow-amber-500/20'
            : 'bg-zinc-900/80 border-zinc-700/50 hover:border-zinc-600'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-700/50">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-zinc-600 cursor-grab" />
            <span className="text-xl">{CHARACTER_EMOJIS[node.character] || '🤖'}</span>
            <span className="font-medium text-zinc-200 truncate max-w-[100px]">{node.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[node.status]} ${isRunning ? 'animate-pulse' : ''}`} />
            <span className="text-xs text-zinc-400 capitalize">{node.status}</span>
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
                    className="absolute right-0 top-full mt-1 w-36 bg-zinc-800 border border-zinc-700 rounded-none shadow-xl z-50 overflow-hidden"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onEdit();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                    >
                      <Settings2 className="w-4 h-4 text-cyan-400" />
                      Edit
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <FolderGit2 className="w-3 h-3 text-purple-400" />
            <span className="truncate">{node.projectPath.split('/').pop()}</span>
          </div>

          {node.skills.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Skills</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {node.skills.slice(0, 3).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  >
                    {skill}
                  </span>
                ))}
                {node.skills.length > 3 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-700 text-zinc-400">
                    +{node.skills.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {isRunning ? (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleAgent(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-none bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleAgent(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-none bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-xs"
              >
                <Play className="w-3 h-3" />
                Start
              </button>
            )}
            {(node.status === 'running' || node.status === 'waiting') && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenTerminal(); }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-none bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 transition-colors text-xs"
              >
                <Terminal className="w-3 h-3" />
                Terminal
              </button>
            )}
          </div>
        </div>

        {/* Connection point */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-zinc-800 border border-cyan-500/50" />
      </div>
    </motion.div>
  );
}
