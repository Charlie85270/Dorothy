'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Bot,
  FolderGit2,
  Play,
  Square,
  Sparkles,
  GitBranch,
  Clock,
  Filter,
  Search,
  Terminal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GripVertical,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Bell,
  Loader2,
  MessageSquare,
  Plus,
  MoreVertical,
  Pencil,
  Settings2,
  Crown,
} from 'lucide-react';
import { useElectronAgents, useElectronFS, useElectronSkills, isElectron } from '@/hooks/useElectron';
import { useClaude } from '@/hooks/useClaude';
import AgentTerminalDialog from '@/components/AgentWorld/AgentTerminalDialog';
import NewChatModal from '@/components/NewChatModal';
import type { AgentCharacter } from '@/types/electron';

// Storage key for canvas state
const CANVAS_STATE_KEY = 'canvas-board-state';

// Types
interface AgentNode {
  id: string;
  type: 'agent';
  name: string;
  character: string;
  status: 'running' | 'idle' | 'stopped' | 'waiting' | 'error' | 'completed';
  skills: string[];
  projectPath: string;
  position: { x: number; y: number };
}

interface ProjectNode {
  id: string;
  type: 'project';
  name: string;
  path: string;
  branch?: string;
  position: { x: number; y: number };
  agentIds: string[];
}

// Dot Grid Background
function DotGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dotPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,0.08)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotPattern)" />
      </svg>
      {/* Animated floating dots */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-500/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -15, 15, 0],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Connection Line between nodes
function ConnectionLine({
  from,
  to,
  isActive,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  isActive?: boolean;
}) {
  // Simple curved line
  const midY = (from.y + to.y) / 2;
  const path = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 1 }}>
      <defs>
        <linearGradient id={`gradient-${from.x.toFixed(0)}-${to.x.toFixed(0)}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isActive ? '#22d3ee' : '#3f3f46'} />
          <stop offset="100%" stopColor={isActive ? '#a78bfa' : '#27272a'} />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#gradient-${from.x.toFixed(0)}-${to.x.toFixed(0)})`}
        strokeWidth={isActive ? 2.5 : 1.5}
        strokeDasharray={isActive ? '0' : '6,4'}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: isActive ? 1 : 0.5 }}
        transition={{ duration: 0.8 }}
      />
      {isActive && (
        <>
          {/* Animated dot along the path */}
          <circle r="3" fill="#22d3ee">
            <animateMotion dur="2s" repeatCount="indefinite" path={path} />
          </circle>
          {/* Glow effect */}
          <circle r="6" fill="#22d3ee" opacity="0.3">
            <animateMotion dur="2s" repeatCount="indefinite" path={path} />
          </circle>
        </>
      )}
    </svg>
  );
}

// Status Indicator Badge
function StatusIndicator({ status }: { status: string }) {
  if (status === 'waiting') {
    return (
      <motion.div
        className="absolute -top-3 -right-3 z-20"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        <motion.div
          className="relative flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <AlertCircle className="w-5 h-5 text-white" />
          {/* Ping animation */}
          <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
        </motion.div>
      </motion.div>
    );
  }

  if (status === 'running') {
    return (
      <motion.div
        className="absolute -top-3 -right-3 z-20"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-cyan-500 shadow-lg shadow-cyan-500/30">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-4 h-4 text-cyan-400" />
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (status === 'completed') {
    return (
      <motion.div
        className="absolute -top-3 -right-3 z-20"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 shadow-lg shadow-green-500/50">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
      </motion.div>
    );
  }

  if (status === 'error') {
    return (
      <motion.div
        className="absolute -top-3 -right-3 z-20"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 shadow-lg shadow-red-500/50">
          <XCircle className="w-5 h-5 text-white" />
        </div>
      </motion.div>
    );
  }

  return null;
}

// Agent Node Component
function AgentNodeCard({
  node,
  isSelected,
  onSelect,
  onDrag,
  onOpenTerminal,
  onToggleAgent,
  onEdit,
}: {
  node: AgentNode;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (delta: { x: number; y: number }) => void;
  onOpenTerminal: () => void;
  onToggleAgent: () => void;
  onEdit: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, hasMoved: false });
  const DRAG_THRESHOLD = 5;

  // Close menu when clicking outside
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking buttons

    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, hasMoved: false };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      // Only start dragging after threshold
      if (!dragRef.current.hasMoved && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
        dragRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragRef.current.hasMoved) {
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        onDrag({ x: deltaX, y: deltaY });
      }
    };

    const handleMouseUp = () => {
      if (!dragRef.current.hasMoved) {
        onSelect();
      }
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Touch support for mobile dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.stopPropagation();
    const touch = e.touches[0];
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, hasMoved: false };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - dragRef.current.startX;
    const deltaY = touch.clientY - dragRef.current.startY;

    if (!dragRef.current.hasMoved && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      dragRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.startX = touch.clientX;
      dragRef.current.startY = touch.clientY;
      onDrag({ x: deltaX, y: deltaY });
    }
  };

  const handleTouchEnd = () => {
    if (!dragRef.current.hasMoved) {
      onSelect();
    }
    setIsDragging(false);
  };

  const statusColors: Record<string, string> = {
    running: 'bg-green-500',
    waiting: 'bg-amber-500',
    idle: 'bg-zinc-500',
    stopped: 'bg-zinc-600',
    error: 'bg-red-500',
    completed: 'bg-cyan-500',
  };

  const characterEmojis: Record<string, string> = {
    robot: '🤖',
    ninja: '🥷',
    wizard: '🧙',
    astronaut: '👨‍🚀',
    alien: '👽',
    cat: '🐱',
    dog: '🐕',
    frog: '🐸',
    knight: '⚔️',
    pirate: '🏴‍☠️',
    viking: '🛡️',
  };

  const isRunning = node.status === 'running' || node.status === 'waiting';

  return (
    <motion.div
      className={`node-card absolute select-none touch-none ${isDragging ? 'z-50 cursor-grabbing' : 'z-10 cursor-pointer'}`}
      style={{ left: node.position.x, top: node.position.y }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
      }}
      whileHover={{ scale: isDragging ? 1 : 1.02 }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Status Indicator Badge */}
      <StatusIndicator status={node.status} />

      <div
        className={`w-72 rounded-xl border backdrop-blur-sm transition-all duration-200 ${isSelected
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
            <span className="text-xl">{characterEmojis[node.character] || '🤖'}</span>
            <span className="font-medium text-zinc-200 truncate max-w-[100px]">{node.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColors[node.status]} ${isRunning ? 'animate-pulse' : ''}`} />
            <span className="text-xs text-zinc-400 capitalize">{node.status}</span>
            {/* Menu button */}
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
              {/* Dropdown menu */}
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 top-full mt-1 w-36 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
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
          {/* Project */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <FolderGit2 className="w-3 h-3 text-purple-400" />
            <span className="truncate">{node.projectPath.split('/').pop()}</span>
          </div>

          {/* Skills */}
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
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleAgent(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-xs"
              >
                <Play className="w-3 h-3" />
                Start
              </button>
            )}
            {/* Only show terminal button when agent is running or waiting */}
            {(node.status === 'running' || node.status === 'waiting') && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenTerminal(); }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 transition-colors text-xs"
              >
                <Terminal className="w-3 h-3" />
                Terminal
              </button>
            )}
          </div>
        </div>

        {/* Connection point */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-zinc-800 border-2 border-cyan-500/50" />
      </div>
    </motion.div>
  );
}

// Project Node Component
function ProjectNodeCard({
  node,
  isSelected,
  onSelect,
  onDrag,
  onAddAgent,
}: {
  node: ProjectNode;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (delta: { x: number; y: number }) => void;
  onAddAgent: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, hasMoved: false });
  const DRAG_THRESHOLD = 5;

  // Close menu when clicking outside
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking buttons

    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, hasMoved: false };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      if (!dragRef.current.hasMoved && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
        dragRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragRef.current.hasMoved) {
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        onDrag({ x: deltaX, y: deltaY });
      }
    };

    const handleMouseUp = () => {
      if (!dragRef.current.hasMoved) {
        onSelect();
      }
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Touch support for mobile dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.stopPropagation();
    const touch = e.touches[0];
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, hasMoved: false };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - dragRef.current.startX;
    const deltaY = touch.clientY - dragRef.current.startY;

    if (!dragRef.current.hasMoved && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      dragRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.startX = touch.clientX;
      dragRef.current.startY = touch.clientY;
      onDrag({ x: deltaX, y: deltaY });
    }
  };

  const handleTouchEnd = () => {
    if (!dragRef.current.hasMoved) {
      onSelect();
    }
    setIsDragging(false);
  };

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
        className={`w-56 rounded-xl border backdrop-blur-sm transition-all duration-200 ${isSelected
            ? 'bg-zinc-900/95 border-purple-500/50 shadow-lg shadow-purple-500/20'
            : 'bg-zinc-900/80 border-zinc-700/50 hover:border-zinc-600'
          }`}
      >
        {/* Connection point */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-zinc-800 border-2 border-purple-500/50" />

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
          {/* Menu button */}
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
            {/* Dropdown menu */}
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
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

// Toolbar
function CanvasToolbar({
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  projectFilter,
  setProjectFilter,
  projects,
  onResetView,
  zoom,
  setZoom,
  superAgent,
  isCreatingSuperAgent,
  onSuperAgentClick,
  showSuperAgentButton,
}: {
  filter: 'all' | 'running' | 'idle' | 'stopped';
  setFilter: (filter: 'all' | 'running' | 'idle' | 'stopped') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  projectFilter: string;
  setProjectFilter: (project: string) => void;
  projects: { path: string; name: string }[];
  onResetView: () => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  superAgent: { id: string; status: string } | null;
  isCreatingSuperAgent: boolean;
  onSuperAgentClick: () => void;
  showSuperAgentButton: boolean;
}) {
  return (
    <div className="absolute top-3 left-3 right-3 lg:top-4 lg:left-4 lg:right-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 z-40">
      {/* Left side - Search & Filter */}
      <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto">
        {/* Search - hidden on mobile */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-zinc-900/90 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50 w-40"
          />
        </div>

        {/* Project filter dropdown - compact on mobile */}
        <div className="relative">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="pl-3 pr-8 py-2 rounded-lg bg-zinc-900/90 border border-zinc-700 text-xs lg:text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[100px] lg:min-w-[140px]"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.path} value={p.path}>
                {p.name}
              </option>
            ))}
          </select>
          <FolderGit2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>

        {/* Status filter - compact on mobile */}
        <div className="flex items-center gap-0.5 lg:gap-1 p-1 rounded-lg bg-zinc-900/90 border border-zinc-700">
          <Filter className="w-4 h-4 text-zinc-500 ml-1 lg:ml-2 hidden sm:block" />
          {(['all', 'running', 'idle', 'stopped'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 lg:px-3 py-1.5 rounded-md text-[10px] lg:text-xs font-medium transition-all ${filter === f
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              {f === 'all' ? 'All' : f === 'running' ? 'Run' : f === 'idle' ? 'Idle' : 'Stop'}
            </button>
          ))}
        </div>
      </div>

      {/* Right side - View controls */}
      <div className="flex items-center gap-2 justify-end">
        {/* Super Agent Button */}
        {showSuperAgentButton && (
          <SuperAgentButton
            superAgent={superAgent}
            isCreating={isCreatingSuperAgent}
            onClick={onSuperAgentClick}
          />
        )}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/90 border border-zinc-700">
          <button
            onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-1.5 lg:px-2 text-[10px] lg:text-xs text-zinc-400 min-w-[2.5rem] lg:min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onResetView}
          className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Super Agent status colors
const SUPER_AGENT_STATUS_COLORS: Record<string, { dot: string; pulse: boolean }> = {
  running: { dot: 'bg-green-400', pulse: true },
  waiting: { dot: 'bg-amber-400', pulse: true },
  idle: { dot: 'bg-zinc-500', pulse: false },
  completed: { dot: 'bg-cyan-400', pulse: false },
  error: { dot: 'bg-red-400', pulse: false },
};

// Super Agent Button Component
function SuperAgentButton({
  superAgent,
  isCreating,
  onClick,
}: {
  superAgent: { id: string; status: string } | null;
  isCreating: boolean;
  onClick: () => void;
}) {
  const statusColor = superAgent ? SUPER_AGENT_STATUS_COLORS[superAgent.status] || SUPER_AGENT_STATUS_COLORS.idle : null;

  return (
    <motion.button
      onClick={onClick}
      disabled={isCreating}
      className={`
        flex items-center gap-2 px-3 py-2
        rounded-lg border backdrop-blur-sm
        transition-all duration-200
        ${superAgent
          ? superAgent.status === 'running' || superAgent.status === 'waiting'
            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 hover:bg-purple-500/30 shadow-lg shadow-purple-500/20'
            : 'bg-zinc-900/90 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50'
          : 'bg-zinc-900/90 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-purple-500/50'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      title={superAgent ? `Super Agent (${superAgent.status})` : 'Create Super Agent'}
    >
      {isCreating ? (
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
      ) : (
        <div className="relative">
          <Crown className={`w-4 h-4 ${superAgent ? 'text-amber-400' : 'text-zinc-400'}`} />
          {superAgent && statusColor && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${statusColor.dot} ${statusColor.pulse ? 'animate-pulse' : ''} border border-zinc-900`} />
          )}
        </div>
      )}
      <span className="text-xs font-medium hidden sm:inline">
        {isCreating ? 'Creating...' : 'Super Agent'}
      </span>
    </motion.button>
  );
}

// Status bar
function CanvasStatusBar({ agentCount, runningCount, projectCount, waitingCount }: { agentCount: number; runningCount: number; projectCount: number; waitingCount: number }) {
  return (
    <div className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4 flex items-center gap-3 lg:gap-6 px-3 lg:px-4 py-2 rounded-lg bg-zinc-900/90 border border-zinc-700 text-[10px] lg:text-xs text-zinc-400 z-40">
      <div className="flex items-center gap-1.5 lg:gap-2">
        <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-cyan-400" />
        <span>{agentCount}</span>
        {runningCount > 0 && <span className="text-green-400 hidden sm:inline">({runningCount} run)</span>}
        {waitingCount > 0 && <span className="text-amber-400">({waitingCount} wait)</span>}
      </div>
      <div className="flex items-center gap-1.5 lg:gap-2 hidden sm:flex">
        <FolderGit2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-purple-400" />
        <span>{projectCount}</span>
      </div>
    </div>
  );
}

// Notification Panel
function NotificationPanel({
  agents,
  isCollapsed,
  onToggle,
  onOpenTerminal,
}: {
  agents: AgentNode[];
  isCollapsed: boolean;
  onToggle: () => void;
  onOpenTerminal: (agentId: string) => void;
}) {
  const waitingAgents = agents.filter(a => a.status === 'waiting');
  const runningAgents = agents.filter(a => a.status === 'running');
  const completedAgents = agents.filter(a => a.status === 'completed');
  const errorAgents = agents.filter(a => a.status === 'error');

  const characterEmojis: Record<string, string> = {
    robot: '🤖',
    ninja: '🥷',
    wizard: '🧙',
    astronaut: '👨‍🚀',
    alien: '👽',
    cat: '🐱',
    dog: '🐕',
    frog: '🐸',
    knight: '⚔️',
    pirate: '🏴‍☠️',
    viking: '🛡️',
  };

  const AgentItem = ({ agent, showAction = false }: { agent: AgentNode; showAction?: boolean }) => (
    <motion.div
      layoutId={`notification-agent-${agent.id}`}
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-zinc-800/50 ${agent.status === 'waiting'
          ? 'bg-amber-500/5 border-amber-500/30'
          : agent.status === 'running'
            ? 'bg-cyan-500/5 border-cyan-500/20'
            : agent.status === 'completed'
              ? 'bg-green-500/5 border-green-500/20'
              : agent.status === 'error'
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-zinc-800/30 border-zinc-700/50'
        }`}
      onClick={() => onOpenTerminal(agent.id)}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{characterEmojis[agent.character] || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-zinc-200 truncate">{agent.name}</span>
            {agent.status === 'waiting' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400">
                <AlertCircle className="w-3 h-3" />
                Input needed
              </span>
            )}
            {agent.status === 'running' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-cyan-500/20 text-cyan-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Working
              </span>
            )}
            {agent.status === 'completed' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Done
              </span>
            )}
            {agent.status === 'error' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-400">
                <XCircle className="w-3 h-3" />
                Error
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5">
            {agent.projectPath.split('/').pop()}
          </p>
          {showAction && agent.status === 'waiting' && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenTerminal(agent.id); }}
              className="mt-2 flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              Respond
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="absolute top-4 bottom-4 right-4 z-50 flex"
      initial={false}
      animate={{ width: isCollapsed ? 48 : 320 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-8 h-12 my-auto -mr-1 rounded-l-lg bg-zinc-900/95 border border-r-0 border-zinc-700 hover:bg-zinc-800 transition-colors z-10"
      >
        {isCollapsed ? (
          <div className="relative">
            <ChevronLeft className="w-4 h-4 text-zinc-400" />
            {waitingAgents.length > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {waitingAgents.length}
              </span>
            )}
          </div>
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Panel content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 bg-zinc-900/95 border border-zinc-700 rounded-xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/30">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span className="font-medium text-sm text-zinc-200">Activity</span>
                {waitingAgents.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500 text-white font-bold">
                    {waitingAgents.length}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <LayoutGroup>
                {/* Waiting agents - priority section */}
                {waitingAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                        Needs Attention
                      </span>
                    </div>
                    <div className="space-y-2">
                      {waitingAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} showAction />
                      ))}
                    </div>
                  </div>
                )}

                {/* Running agents */}
                {runningAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                      <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
                        Working
                      </span>
                    </div>
                    <div className="space-y-2">
                      {runningAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed agents */}
                {completedAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
                        Completed
                      </span>
                    </div>
                    <div className="space-y-2">
                      {completedAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Error agents */}
                {errorAgents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                        Errors
                      </span>
                    </div>
                    <div className="space-y-2">
                      {errorAgents.map(agent => (
                        <AgentItem key={agent.id} agent={agent} />
                      ))}
                    </div>
                  </div>
                )}
              </LayoutGroup>

              {/* Empty state */}
              {agents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bot className="w-10 h-10 text-zinc-600 mb-3" />
                  <p className="text-sm text-zinc-500">No agents yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Create an agent to see activity</p>
                </div>
              )}

              {/* All idle state */}
              {agents.length > 0 && waitingAgents.length === 0 && runningAgents.length === 0 && completedAgents.length === 0 && errorAgents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                    <Bot className="w-5 h-5 text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-500">All agents idle</p>
                  <p className="text-xs text-zinc-600 mt-1">Start an agent to see activity</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Main Canvas View Component
export default function CanvasView() {
  const router = useRouter();
  const { agents: electronAgents, stopAgent, sendInput, startAgent, createAgent, refresh: refreshAgents } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const { installedSkills, refresh: refreshSkills } = useElectronSkills();
  const { data: claudeData } = useClaude();

  // Load saved state from localStorage
  const loadSavedState = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(CANVAS_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load canvas state:', e);
    }
    return null;
  }, []);

  const savedState = useMemo(() => loadSavedState(), [loadSavedState]);

  // Node positions state - initialized from localStorage
  const [agentPositions, setAgentPositions] = useState<Record<string, { x: number; y: number }>>(
    savedState?.agentPositions || {}
  );
  const [projectPositions, setProjectPositions] = useState<Record<string, { x: number; y: number }>>(
    savedState?.projectPositions || {}
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'running' | 'idle' | 'stopped'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(savedState?.zoom || 1);

  // Canvas panning state - initialized from localStorage
  const [panOffset, setPanOffset] = useState(savedState?.panOffset || { x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef({ startX: 0, startY: 0 });

  // Touch gesture state
  const touchRef = useRef<{
    lastTouchDistance: number | null;
    lastTouchCenter: { x: number; y: number } | null;
    isPinching: boolean;
  }>({ lastTouchDistance: null, lastTouchCenter: null, isPinching: false });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Terminal dialog state
  const [terminalAgentId, setTerminalAgentId] = useState<string | null>(null);
  const [terminalInitialPanel, setTerminalInitialPanel] = useState<'settings' | undefined>(undefined);

  // Create agent modal state
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [createAgentProjectPath, setCreateAgentProjectPath] = useState<string | null>(null);

  // Super Agent state
  const [isCreatingSuperAgent, setIsCreatingSuperAgent] = useState(false);

  // Notification panel state
  const [notificationPanelCollapsed, setNotificationPanelCollapsed] = useState(
    savedState?.notificationPanelCollapsed ?? false
  );

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stateToSave = {
      agentPositions,
      projectPositions,
      panOffset,
      zoom,
      notificationPanelCollapsed,
    };
    try {
      localStorage.setItem(CANVAS_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save canvas state:', e);
    }
  }, [agentPositions, projectPositions, panOffset, zoom, notificationPanelCollapsed]);

  // Helper to check if an agent is a super agent
  const isSuperAgent = (agent: { name?: string }) => {
    const name = agent.name?.toLowerCase() || '';
    return name.includes('super agent') || name.includes('orchestrator');
  };

  // Build agent nodes from real data (excluding super agent)
  const agentNodes: AgentNode[] = useMemo(() => {
    return electronAgents
      .filter(agent => !isSuperAgent(agent))
      .map((agent, index) => {
        const defaultPos = { x: 100 + (index % 3) * 320, y: 80 + Math.floor(index / 3) * 200 };
        const pos = agentPositions[agent.id] || defaultPos;

        return {
          id: agent.id,
          type: 'agent' as const,
          name: agent.name || `Agent ${agent.id.slice(0, 6)}`,
          character: agent.character || 'robot',
          status: agent.status as AgentNode['status'],
          skills: agent.skills || [],
          projectPath: agent.projectPath,
          position: pos,
        };
      });
  }, [electronAgents, agentPositions]);

  // Build project nodes from agents' projects only (projects with agents, excluding super agent)
  const projectNodes: ProjectNode[] = useMemo(() => {
    const projectMap = new Map<string, ProjectNode>();

    // Only add projects that have agents (excluding super agent)
    electronAgents
      .filter(agent => !isSuperAgent(agent))
      .forEach((agent) => {
        const projectPath = agent.projectPath;
        const projectName = projectPath.split('/').pop() || projectPath;

        if (!projectMap.has(projectPath)) {
          projectMap.set(projectPath, {
            id: projectPath,
            type: 'project',
            name: projectName,
            path: projectPath,
            branch: agent.branchName || undefined,
            position: projectPositions[projectPath] || { x: 0, y: 0 },
            agentIds: [],
          });
        }
        projectMap.get(projectPath)!.agentIds.push(agent.id);
      });

    // Assign default positions to projects
    const projects = Array.from(projectMap.values());
    projects.forEach((project, index) => {
      if (project.position.x === 0 && project.position.y === 0) {
        project.position = projectPositions[project.id] || {
          x: 150 + (index % 4) * 280,
          y: 420 + Math.floor(index / 4) * 150
        };
      }
    });

    return projects;
  }, [electronAgents, projectPositions]);

  // Filter agents
  // Get unique projects for filter dropdown
  const uniqueProjects = useMemo(() => {
    const projectMap = new Map<string, { path: string; name: string }>();
    electronAgents.forEach((agent) => {
      if (!projectMap.has(agent.projectPath)) {
        projectMap.set(agent.projectPath, {
          path: agent.projectPath,
          name: agent.projectPath.split('/').pop() || agent.projectPath,
        });
      }
    });
    return Array.from(projectMap.values());
  }, [electronAgents]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agentNodes.filter((agent) => {
      const statusMatch = filter === 'all' ||
        (filter === 'running' && (agent.status === 'running' || agent.status === 'waiting')) ||
        (filter === 'idle' && agent.status === 'idle') ||
        (filter === 'stopped' && (agent.status === 'stopped' || agent.status === 'completed' || agent.status === 'error'));
      const searchMatch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.projectPath.toLowerCase().includes(searchQuery.toLowerCase());
      const projectMatch = projectFilter === 'all' || agent.projectPath === projectFilter;
      return statusMatch && searchMatch && projectMatch;
    });
  }, [agentNodes, filter, searchQuery, projectFilter]);

  // Filter projects based on project filter
  const filteredProjects = useMemo(() => {
    if (projectFilter === 'all') {
      return projectNodes;
    }
    return projectNodes.filter((project) => project.path === projectFilter);
  }, [projectNodes, projectFilter]);

  // Handle agent drag
  const handleAgentDrag = useCallback((id: string, delta: { x: number; y: number }) => {
    setAgentPositions((prev) => {
      const current = prev[id] || agentNodes.find(a => a.id === id)?.position || { x: 0, y: 0 };
      return {
        ...prev,
        [id]: { x: current.x + delta.x, y: current.y + delta.y },
      };
    });
  }, [agentNodes]);

  // Handle project drag
  const handleProjectDrag = useCallback((id: string, delta: { x: number; y: number }) => {
    setProjectPositions((prev) => {
      const current = prev[id] || projectNodes.find(p => p.id === id)?.position || { x: 0, y: 0 };
      return {
        ...prev,
        [id]: { x: current.x + delta.x, y: current.y + delta.y },
      };
    });
  }, [projectNodes]);

  // Open terminal for agent (show inline modal)
  const handleOpenTerminal = useCallback((agentId: string) => {
    setTerminalAgentId(agentId);
    setTerminalInitialPanel(undefined);
  }, []);

  // Open edit settings for agent
  const handleEditAgent = useCallback((agentId: string) => {
    setTerminalAgentId(agentId);
    setTerminalInitialPanel('settings');
  }, []);

  // Toggle agent (start/stop)
  const handleToggleAgent = useCallback(async (agentId: string, isRunning: boolean) => {
    if (isRunning) {
      stopAgent(agentId);
    } else {
      // Start agent with "Hello" and show terminal
      try {
        await startAgent(agentId, 'Hello');
        setTerminalAgentId(agentId);
      } catch (error) {
        console.error('Failed to start agent:', error);
      }
    }
  }, [stopAgent, startAgent]);

  // Handle start from terminal dialog
  const handleStartAgent = useCallback(async (agentId: string, prompt: string) => {
    try {
      await startAgent(agentId, prompt);
    } catch (error) {
      console.error('Failed to start agent:', error);
    }
  }, [startAgent]);

  // Handle stop from terminal dialog
  const handleStopAgent = useCallback((agentId: string) => {
    stopAgent(agentId);
  }, [stopAgent]);

  // Handle add agent to project from dropdown menu
  const handleAddAgentToProject = useCallback((projectPath: string) => {
    setCreateAgentProjectPath(projectPath);
    setShowCreateAgentModal(true);
  }, []);

  // Handle create agent from modal
  const handleCreateAgent = useCallback(async (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: { enabled: boolean; branchName: string },
    character?: AgentCharacter,
    name?: string,
    secondaryProjectPath?: string,
    skipPermissions?: boolean
  ) => {
    try {
      const agent = await createAgent({ projectPath, skills, worktree, character, name, secondaryProjectPath, skipPermissions });
      setShowCreateAgentModal(false);
      setCreateAgentProjectPath(null);

      // If prompt provided, start immediately and open terminal
      if (prompt) {
        setTimeout(async () => {
          await startAgent(agent.id, prompt, { model });
          setTerminalAgentId(agent.id);
        }, 600);
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  }, [createAgent, startAgent]);

  // Find existing super agent (identified by name containing "Super Agent" or "Orchestrator")
  const superAgent = useMemo(() => {
    return electronAgents.find(a =>
      a.name?.toLowerCase().includes('super agent') ||
      a.name?.toLowerCase().includes('orchestrator')
    ) || null;
  }, [electronAgents]);

  // Orchestrator prompt for Super Agent
  const orchestratorPrompt = `You are the Super Agent - an orchestrator that ONLY manages other agents using MCP tools.

IMPORTANT: You have MCP tools from "claude-mgr-orchestrator" server. Use ONLY these tools:
- list_agents: List all agents
- get_agent: Get agent details by ID
- get_agent_output: Get agent terminal output
- create_agent: Create a new agent (params: projectPath, name, skills[], character)
- start_agent: Start an agent with a task (params: id, prompt)
- stop_agent: Stop a running agent (params: id)
- send_message: Send input to an agent (params: id, message)
- remove_agent: Delete an agent (params: id)
- wait_for_agent: Wait for agent completion (params: id)

RULES:
1. NEVER explore codebases or read files - you are ONLY an agent manager
2. ALWAYS use the MCP tools above to manage agents
3. When asked to create an agent, use create_agent with the specified project path
4. Start by listing existing agents with list_agents

Say hello and list the current agents.`;

  // Handle Super Agent button click
  const handleSuperAgentClick = useCallback(async () => {
    // If super agent exists
    if (superAgent) {
      // If idle, restart it with the orchestrator prompt
      if (superAgent.status === 'idle' || superAgent.status === 'completed' || superAgent.status === 'error') {
        await startAgent(superAgent.id, orchestratorPrompt);
      }
      setTerminalAgentId(superAgent.id);
      return;
    }

    // Check if orchestrator is configured
    if (!window.electronAPI?.orchestrator?.getStatus) {
      console.error('Orchestrator API not available');
      return;
    }

    const status = await window.electronAPI.orchestrator.getStatus();

    // If not configured, set it up first
    if (!status.configured && window.electronAPI?.orchestrator?.setup) {
      const setupResult = await window.electronAPI.orchestrator.setup();
      if (!setupResult.success) {
        console.error('Failed to setup orchestrator:', setupResult.error);
        return;
      }
    }

    // Create a new super agent
    setIsCreatingSuperAgent(true);
    try {
      // Use the first project path or a default
      const projectPath = projects[0]?.path || process.cwd?.() || '/tmp';

      const agent = await createAgent({
        projectPath,
        skills: [],
        character: 'wizard',
        name: 'Super Agent (Orchestrator)',
        skipPermissions: true,
      });

      // Start with orchestrator instructions
      await startAgent(agent.id, orchestratorPrompt);
      setTerminalAgentId(agent.id);
    } catch (error) {
      console.error('Failed to create super agent:', error);
    } finally {
      setIsCreatingSuperAgent(false);
    }
  }, [superAgent, projects, createAgent, startAgent]);

  // Reset view (reset zoom and pan, keep node positions)
  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNodeId(null);
  }, []);

  // Full reset (also reset node positions)
  const fullReset = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setAgentPositions({});
    setProjectPositions({});
    setSelectedNodeId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CANVAS_STATE_KEY);
    }
  }, []);

  // Canvas panning handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking on the background (not on a node)
    if ((e.target as HTMLElement).closest('.canvas-content') &&
      !(e.target as HTMLElement).closest('.node-card')) {
      setIsPanning(true);
      panRef.current = { startX: e.clientX - panOffset.x, startY: e.clientY - panOffset.y };
    }
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panRef.current.startX,
        y: e.clientY - panRef.current.startY,
      });
    }
  }, [isPanning]);

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleCanvasMouseLeave = () => {
    setIsPanning(false);
  };

  // Touch event handlers for mobile
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't interfere with node interactions
    if ((e.target as HTMLElement).closest('.node-card')) return;

    if (e.touches.length === 2) {
      // Pinch gesture start
      e.preventDefault();
      touchRef.current.isPinching = true;
      touchRef.current.lastTouchDistance = getTouchDistance(e.touches);
      touchRef.current.lastTouchCenter = getTouchCenter(e.touches);
    } else if (e.touches.length === 1) {
      // Single finger pan
      setIsPanning(true);
      panRef.current = {
        startX: e.touches[0].clientX - panOffset.x,
        startY: e.touches[0].clientY - panOffset.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.node-card')) return;

    if (e.touches.length === 2 && touchRef.current.isPinching) {
      // Pinch to zoom
      e.preventDefault();
      const newDistance = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);

      if (newDistance && touchRef.current.lastTouchDistance) {
        const scale = newDistance / touchRef.current.lastTouchDistance;
        const newZoom = Math.min(2, Math.max(0.3, zoom * scale));
        setZoom(newZoom);
      }

      // Also pan while pinching
      if (touchRef.current.lastTouchCenter && newCenter) {
        const dx = newCenter.x - touchRef.current.lastTouchCenter.x;
        const dy = newCenter.y - touchRef.current.lastTouchCenter.y;
        setPanOffset((prev: { x: number; y: number }) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }

      touchRef.current.lastTouchDistance = newDistance;
      touchRef.current.lastTouchCenter = newCenter;
    } else if (e.touches.length === 1 && isPanning && !touchRef.current.isPinching) {
      // Single finger pan
      setPanOffset({
        x: e.touches[0].clientX - panRef.current.startX,
        y: e.touches[0].clientY - panRef.current.startY,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchRef.current.isPinching = false;
      touchRef.current.lastTouchDistance = null;
      touchRef.current.lastTouchCenter = null;
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
      if (e.key === 'f' && e.metaKey) {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetView]);

  // Get connection lines
  const connections = useMemo(() => {
    const lines: { from: { x: number; y: number }; to: { x: number; y: number }; isActive: boolean }[] = [];

    filteredAgents.forEach((agent) => {
      const project = filteredProjects.find((p) => p.id === agent.projectPath);
      if (project) {
        lines.push({
          from: { x: agent.position.x + 144, y: agent.position.y + 170 }, // Bottom center of agent card
          to: { x: project.position.x + 112, y: project.position.y }, // Top center of project card
          isActive: agent.status === 'running' || agent.status === 'waiting',
        });
      }
    });

    return lines;
  }, [filteredAgents, filteredProjects]);

  const runningCount = filteredAgents.filter(a => a.status === 'running').length;
  const waitingCount = filteredAgents.filter(a => a.status === 'waiting').length;

  // Get terminal agent for dialog
  const terminalAgent = useMemo(() => {
    if (!terminalAgentId) return null;
    return electronAgents.find(a => a.id === terminalAgentId) || null;
  }, [terminalAgentId, electronAgents]);

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-full bg-[#0a0a0f] overflow-hidden touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.node-card')) {
          setSelectedNodeId(null);
        }
      }}
    >
      {/* Dot Grid Background */}
      <DotGrid />

      {/* Toolbar */}
      <CanvasToolbar
        filter={filter}
        setFilter={setFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        projects={uniqueProjects}
        onResetView={resetView}
        zoom={zoom}
        setZoom={setZoom}
        superAgent={superAgent}
        isCreatingSuperAgent={isCreatingSuperAgent}
        onSuperAgentClick={handleSuperAgentClick}
        showSuperAgentButton={isElectron()}
      />

      {/* Canvas Content */}
      <div
        className="canvas-content absolute inset-0 pt-16"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Connection Lines */}
        {connections.map((conn, i) => (
          <ConnectionLine key={i} from={conn.from} to={conn.to} isActive={conn.isActive} />
        ))}

        {/* Agent Nodes */}
        <AnimatePresence>
          {filteredAgents.map((agent) => (
            <AgentNodeCard
              key={agent.id}
              node={agent}
              isSelected={selectedNodeId === agent.id}
              onSelect={() => setSelectedNodeId(agent.id)}
              onDrag={(delta) => handleAgentDrag(agent.id, delta)}
              onOpenTerminal={() => handleOpenTerminal(agent.id)}
              onToggleAgent={() => handleToggleAgent(agent.id, agent.status === 'running' || agent.status === 'waiting')}
              onEdit={() => handleEditAgent(agent.id)}
            />
          ))}
        </AnimatePresence>

        {/* Project Nodes */}
        <AnimatePresence>
          {filteredProjects.map((project) => (
            <ProjectNodeCard
              key={project.id}
              node={project}
              isSelected={selectedNodeId === project.id}
              onSelect={() => setSelectedNodeId(project.id)}
              onDrag={(delta) => handleProjectDrag(project.id, delta)}
              onAddAgent={() => handleAddAgentToProject(project.path)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <CanvasStatusBar
        agentCount={filteredAgents.length}
        runningCount={runningCount}
        waitingCount={waitingCount}
        projectCount={filteredProjects.length}
      />

      {/* Notification Panel - hidden on mobile */}
      <div className="hidden lg:block">
        <NotificationPanel
          agents={agentNodes}
          isCollapsed={notificationPanelCollapsed}
          onToggle={() => setNotificationPanelCollapsed(!notificationPanelCollapsed)}
          onOpenTerminal={handleOpenTerminal}
        />
      </div>

      {/* Empty state */}
      {agentNodes.length === 0 && projectNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-30 p-4">
          <div className="text-center p-4 lg:p-8 rounded-xl bg-zinc-900/80 border border-zinc-700 max-w-[280px] lg:max-w-md">
            <Bot className="w-8 h-8 lg:w-12 lg:h-12 text-zinc-600 mx-auto mb-3 lg:mb-4" />
            <h3 className="text-base lg:text-lg font-medium text-zinc-300 mb-1.5 lg:mb-2">No agents yet</h3>
            <p className="text-xs lg:text-sm text-zinc-500 mb-3 lg:mb-4">
              Create an agent from the Agents page to see them here.
            </p>
            <button
              onClick={() => router.push('/agents')}
              className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-xs lg:text-sm"
            >
              Go to Agents
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="absolute bottom-20 left-4 z-40 pointer-events-none">
        <h2 className="text-xl font-mono text-zinc-700 italic">Agent Board</h2>
      </div>

      {/* Agent Terminal Dialog */}
      <AgentTerminalDialog
        agent={terminalAgent}
        open={!!terminalAgentId}
        onClose={() => {
          setTerminalAgentId(null);
          setTerminalInitialPanel(undefined);
        }}
        onStart={handleStartAgent}
        onStop={handleStopAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        agents={electronAgents}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        onAgentUpdated={refreshAgents}
        initialPanel={terminalInitialPanel}
      />

      {/* New Agent Modal */}
      <NewChatModal
        open={showCreateAgentModal}
        onClose={() => {
          setShowCreateAgentModal(false);
          setCreateAgentProjectPath(null);
        }}
        onSubmit={handleCreateAgent}
        projects={projects.map(p => ({ path: p.path, name: p.name }))}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        installedSkills={installedSkills}
        allInstalledSkills={claudeData?.skills || []}
        onRefreshSkills={refreshSkills}
        initialProjectPath={createAgentProjectPath || undefined}
        initialStep={createAgentProjectPath ? 2 : 1}
      />
    </div>
  );
}
