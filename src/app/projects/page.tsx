'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  MessageSquare,
  X,
  Loader2,
  ExternalLink,
  Terminal,
  FolderOpen,
  Folder,
  Star,
  Layers,
  Bot,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  FolderPlus,
  ChevronDown,
  GitBranch,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useClaude, useSessionMessages } from '@/hooks/useClaude';
import { useElectronAgents, useElectronFS, useElectronSkills, isElectron } from '@/hooks/useElectron';
import type { ClaudeProject } from '@/lib/claude-code';
import type { AgentStatus, AgentCharacter } from '@/types/electron';
import NewChatModal from '@/components/NewChatModal';

// Generate consistent colors for projects based on name
const getProjectColor = (name: string) => {
  const colors = [
    { main: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },   // blue
    { main: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)' },   // purple
    { main: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)' },     // green
    { main: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },   // amber
    { main: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },     // red
    { main: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },     // cyan
    { main: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' },   // pink
    { main: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' },   // orange
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Storage keys
const FAVORITES_KEY = 'claude-manager-favorite-projects';
const CUSTOM_PROJECTS_KEY = 'claude-manager-custom-projects';

interface CustomProject {
  path: string;
  name: string;
  addedAt: string;
}

// Character emoji mapping for displaying agents
const CHARACTER_EMOJIS: Record<string, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🛡️',
};

// Agent status colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  running: { bg: 'bg-green-500/20', text: 'text-green-400' },
  waiting: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  idle: { bg: 'bg-white/10', text: 'text-white/60' },
  completed: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

// Strip ANSI codes from git output
const stripAnsi = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
};

export default function ProjectsPage() {
  const { data, loading, error } = useClaude();
  const { agents, createAgent, startAgent, isElectron: hasElectron } = useElectronAgents();
  const { projects: electronProjects, openFolderDialog } = useElectronFS();
  const { installedSkills, refresh: refreshSkills } = useElectronSkills();
  const [selectedProject, setSelectedProject] = useState<ClaudeProject | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customProjects, setCustomProjects] = useState<CustomProject[]>([]);
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Agent dialog state
  const [showAgentDialog, setShowAgentDialog] = useState(false);

  // Load git branch for selected project
  const loadGitBranch = useCallback(async (projectPath: string) => {
    if (!projectPath || typeof window === 'undefined' || !window.electronAPI?.shell?.exec) {
      setGitBranch(null);
      return;
    }

    setGitLoading(true);
    try {
      const result = await window.electronAPI.shell.exec({
        command: 'git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null',
        cwd: projectPath,
      });

      if (result.success && result.output) {
        const branch = stripAnsi(result.output).replace(/\r/g, '').trim();
        setGitBranch(branch || null);
      } else {
        setGitBranch(null);
      }
    } catch (err) {
      console.error('Failed to get git branch:', err);
      setGitBranch(null);
    } finally {
      setGitLoading(false);
    }
  }, []);

  // Load git branch when project is selected
  useEffect(() => {
    if (selectedProject) {
      loadGitBranch(selectedProject.path);
    } else {
      setGitBranch(null);
    }
  }, [selectedProject, loadGitBranch]);

  // Load custom projects from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_PROJECTS_KEY);
      if (stored) {
        setCustomProjects(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load custom projects:', err);
    }
  }, []);

  // Save custom projects
  const saveCustomProjects = (projects: CustomProject[]) => {
    setCustomProjects(projects);
    try {
      localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(projects));
    } catch (err) {
      console.error('Failed to save custom projects:', err);
    }
  };

  // Add a new project
  const handleAddProject = async () => {
    if (!openFolderDialog) return;
    try {
      const selectedPath = await openFolderDialog();
      if (selectedPath) {
        const normalizedPath = selectedPath.replace(/\/+$/, '');
        const existsInCustom = customProjects.some(p => p.path.replace(/\/+$/, '').toLowerCase() === normalizedPath.toLowerCase());
        if (!existsInCustom) {
          const name = selectedPath.split('/').pop() || 'Unknown Project';
          saveCustomProjects([...customProjects, { path: normalizedPath, name, addedAt: new Date().toISOString() }]);
        }
      }
    } catch (err) {
      console.error('Failed to add project:', err);
    }
  };

  // Remove a custom project
  const handleRemoveProject = (projectPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveCustomProjects(customProjects.filter(p => p.path !== projectPath));
    if (selectedProject?.path === projectPath) {
      setSelectedProject(null);
    }
  };

  // Check if a project is custom
  const isCustomProject = (projectPath: string) => {
    return customProjects.some(p => p.path === projectPath);
  };

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  }, []);

  // Save favorites
  const saveFavorites = (newFavorites: string[]) => {
    setFavorites(newFavorites);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  };

  // Toggle favorite
  const toggleFavorite = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(projectId)) {
      saveFavorites(favorites.filter(id => id !== projectId));
    } else {
      saveFavorites([...favorites, projectId]);
    }
  };

  const isFavorite = (projectId: string) => favorites.includes(projectId);

  // Normalize path for comparison
  const normalizePath = (path: string) => {
    return path.replace(/\/+$/, '').toLowerCase();
  };

  // Flexible path matching
  const pathsMatch = (path1: string, path2: string) => {
    const norm1 = normalizePath(path1);
    const norm2 = normalizePath(path2);
    if (norm1 === norm2) return true;
    if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) return true;
    const name1 = norm1.split('/').pop();
    const name2 = norm2.split('/').pop();
    if (name1 && name2 && name1 === name2) {
      const parts1 = norm1.split('/').filter(Boolean);
      const parts2 = norm2.split('/').filter(Boolean);
      if (parts1.length >= 2 && parts2.length >= 2) {
        if (parts1.slice(-2).join('/') === parts2.slice(-2).join('/')) return true;
      }
    }
    return false;
  };

  // Get agents for the selected project
  const projectAgents = selectedProject
    ? agents.filter(a => pathsMatch(a.projectPath, selectedProject.path))
    : [];

  // Handle creating a new agent
  const handleCreateAgent = async (
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
      const agent = await createAgent({
        projectPath,
        skills,
        worktree,
        character,
        name,
        secondaryProjectPath,
        skipPermissions,
      });

      if (prompt) {
        setTimeout(async () => {
          await startAgent(agent.id, prompt, { model });
        }, 600);
      }

      setShowAgentDialog(false);
    } catch (err) {
      console.error('Failed to create agent:', err);
    }
  };

  // Handle restarting an agent
  const handleRestartAgent = async (agent: AgentStatus, resume: boolean = false) => {
    const prompt = resume ? '/resume' : 'Continue working on the previous task';
    try {
      await startAgent(agent.id, prompt, { resume });
    } catch (err) {
      console.error('Failed to restart agent:', err);
    }
  };

  const { messages, loading: messagesLoading } = useSessionMessages(
    selectedProject?.id || null,
    selectedSession
  );

  // Merge Claude Code projects with custom projects
  const claudeProjects = data?.projects || [];
  const allProjects = useMemo(() => {
    const merged: ClaudeProject[] = [...claudeProjects];
    customProjects.forEach(cp => {
      const exists = claudeProjects.some(p => pathsMatch(p.path, cp.path));
      if (!exists) {
        merged.push({
          id: `custom-${cp.path}`,
          name: cp.name,
          path: cp.path,
          sessions: [],
          lastActivity: new Date(cp.addedAt),
        });
      }
    });
    return merged;
  }, [claudeProjects, customProjects]);

  // Filter projects based on active tab and search query
  const projects = useMemo(() => {
    let filtered = activeTab === 'favorites'
      ? allProjects.filter(p => favorites.includes(p.id))
      : allProjects;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allProjects, activeTab, favorites, searchQuery]);

  const favoritesCount = allProjects.filter(p => favorites.includes(p.id)).length;

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMessagePreview = (content: string | unknown[]): string => {
    if (typeof content === 'string') {
      return content.slice(0, 100) + (content.length > 100 ? '...' : '');
    }
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          if (obj.type === 'text' && typeof obj.text === 'string') {
            const text = obj.text;
            return text.slice(0, 100) + (text.length > 100 ? '...' : '');
          }
        }
      }
    }
    return 'Message content';
  };

  // Get short path for display
  const getShortPath = (path: string) => {
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return '~/' + parts.slice(-2).join('/');
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-red-400">
          <p className="mb-2">Failed to load projects</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {allProjects.length} project{allProjects.length !== 1 ? 's' : ''}
            </p>
          </div>
          {hasElectron && (
            <button
              onClick={handleAddProject}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Add Project
            </button>
          )}
        </div>

        {/* Tabs and Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all
                ${activeTab === 'all'
                  ? 'bg-white text-black'
                  : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
                }
              `}
            >
              <Layers className="w-4 h-4" />
              All
              <span className={`px-1.5 py-0.5 text-xs ${
                activeTab === 'all' ? 'bg-black/10' : 'bg-white/10'
              }`}>
                {allProjects.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all
                ${activeTab === 'favorites'
                  ? 'bg-white text-black'
                  : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
                }
              `}
            >
              <Star className="w-4 h-4" />
              Favorites
              <span className={`px-1.5 py-0.5 text-xs ${
                activeTab === 'favorites' ? 'bg-black/10' : 'bg-white/10'
              }`}>
                {favoritesCount}
              </span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-64 pl-9 pr-3 py-2 bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:border-white/50 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {projects.map((project) => {
          const isSelected = selectedProject?.id === project.id;
          const linkedAgents = agents.filter(a => pathsMatch(a.projectPath, project.path));
          const color = getProjectColor(project.name);

          return (
            <motion.div
              key={project.id}
              layoutId={project.id}
              onClick={() => setSelectedProject(isSelected ? null : project)}
              className="group relative cursor-pointer"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Folder Card */}
              <div
                className={`
                  relative bg-card border p-4 transition-all h-full
                  ${isSelected
                    ? 'border-white shadow-lg shadow-white/10'
                    : 'border-border hover:border-white/30'
                  }
                `}
                style={{
                  borderBottomColor: isSelected ? color.main : undefined,
                  borderBottomWidth: isSelected ? '2px' : undefined,
                }}
              >
                {/* Folder Icon with Color */}
                <div className="flex items-center justify-center mb-3 pt-1">
                  <div
                    className="relative w-14 h-11 flex items-center justify-center rounded-sm"
                    style={{ backgroundColor: color.bg }}
                  >
                    {isSelected ? (
                      <FolderOpen className="w-8 h-8" style={{ color: color.main }} />
                    ) : (
                      <Folder
                        className="w-8 h-8 transition-colors"
                        style={{ color: color.main }}
                      />
                    )}
                    {/* Agent badge */}
                    {linkedAgents.length > 0 && (
                      <div
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[9px] font-bold flex items-center justify-center text-white"
                        style={{ backgroundColor: color.main }}
                      >
                        {linkedAgents.length}
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Info */}
                <div className="text-center space-y-1">
                  <h3 className="font-medium text-sm truncate" title={project.name}>
                    {project.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-mono truncate" title={project.path}>
                    {getShortPath(project.path)}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                    <span>{project.sessions.length} sessions</span>
                    <span>·</span>
                    <span>{formatDate(project.lastActivity)}</span>
                  </div>
                </div>

                {/* Favorite Star */}
                <button
                  onClick={(e) => toggleFavorite(project.id, e)}
                  className={`
                    absolute top-2 right-2 p-1.5 transition-all
                    ${isFavorite(project.id)
                      ? 'opacity-100 text-yellow-400'
                      : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400'
                    }
                  `}
                >
                  <Star className={`w-4 h-4 ${isFavorite(project.id) ? 'fill-current' : ''}`} />
                </button>

                {/* Custom badge */}
                {isCustomProject(project.path) && (
                  <div className="absolute top-2 left-2">
                    <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400">
                      Custom
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Add Project Card */}
        {hasElectron && (
          <motion.div
            onClick={handleAddProject}
            className="cursor-pointer"
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative bg-card border border-dashed border-border p-4 hover:border-white/30 transition-all h-full min-h-[140px] flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-11 flex items-center justify-center rounded-sm bg-white/5">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">Add Project</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <FolderKanban className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-lg mb-2">
            {activeTab === 'favorites' ? 'No favorite projects' : 'No projects found'}
          </h3>
          <p className="text-muted-foreground text-sm">
            {activeTab === 'favorites'
              ? 'Click the star icon to add favorites'
              : 'Start using Claude Code to see projects here'}
          </p>
        </div>
      )}

      {/* Project Detail Panel (Slide-out) */}
      <AnimatePresence>
        {selectedProject && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProject(null)}
              className="fixed inset-0 bg-black/60 z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-background border-l border-border z-50 overflow-y-auto"
            >
              {/* Header with color accent */}
              <div
                className="sticky top-0 bg-card border-b border-border z-10"
                style={{ borderBottomColor: getProjectColor(selectedProject.name).main, borderBottomWidth: '2px' }}
              >
                <div className="p-4 flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-12 h-12 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: getProjectColor(selectedProject.name).bg }}
                    >
                      <FolderOpen className="w-7 h-7" style={{ color: getProjectColor(selectedProject.name).main }} />
                    </div>
                    <div className="min-w-0 pt-1">
                      <h2 className="font-semibold text-lg truncate">{selectedProject.name}</h2>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        {selectedProject.path}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="p-2 hover:bg-secondary transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Git Branch */}
                {hasElectron && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-orange-400" />
                    {gitLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : gitBranch ? (
                      <span className="text-sm px-2 py-0.5 bg-orange-500/15 text-orange-400 font-mono">
                        {gitBranch}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not a git repository</span>
                    )}
                    <button
                      onClick={() => loadGitBranch(selectedProject.path)}
                      className="p-1 hover:bg-secondary rounded transition-colors ml-auto"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${gitLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Quick Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(`cursor://file${selectedProject.path}`, '_blank')}
                    className="flex-1 px-4 py-2.5 border border-border bg-secondary text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Cursor
                  </button>
                  {hasElectron && (
                    <button
                      onClick={() => setShowAgentDialog(true)}
                      className="flex-1 px-4 py-2.5 bg-white text-black text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Launch Agent
                    </button>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-card border border-border p-3 text-center">
                    <p className="text-2xl font-bold">{selectedProject.sessions.length}</p>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                  </div>
                  <div className="bg-card border border-border p-3 text-center">
                    <p className="text-2xl font-bold">{projectAgents.length}</p>
                    <p className="text-xs text-muted-foreground">Agents</p>
                  </div>
                  <div className="bg-card border border-border p-3 text-center">
                    <p className="text-sm font-medium">{formatDate(selectedProject.lastActivity)}</p>
                    <p className="text-xs text-muted-foreground">Last Active</p>
                  </div>
                </div>

                {/* Project Agents */}
                {hasElectron && projectAgents.length > 0 && (
                  <div className="border border-border bg-card p-4">
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Bot className="w-4 h-4" />
                      Agents ({projectAgents.length})
                    </h3>

                    <div className="space-y-2">
                      {projectAgents.map((agent) => {
                        const statusColor = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;
                        const charEmoji = CHARACTER_EMOJIS[agent.character || 'robot'] || '🤖';
                        const isIdle = agent.status === 'idle' || agent.status === 'completed';

                        return (
                          <div
                            key={agent.id}
                            className="p-3 bg-secondary border border-border"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-lg">{charEmoji}</span>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {agent.name || `Agent ${agent.id.slice(0, 6)}`}
                                  </p>
                                  <span className={`text-[10px] px-1.5 py-0.5 ${statusColor.bg} ${statusColor.text}`}>
                                    {agent.status}
                                  </span>
                                </div>
                              </div>

                              {isIdle && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleRestartAgent(agent, true)}
                                    className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                                    title="Resume"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRestartAgent(agent, false)}
                                    className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                                    title="Start"
                                  >
                                    <Play className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sessions */}
                <div className="border border-border bg-card p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Terminal className="w-4 h-4" />
                    Sessions ({selectedProject.sessions.length})
                  </h3>

                  {selectedProject.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedProject.sessions.slice(0, 5).map((session) => (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                          className={`
                            w-full text-left p-3 transition-all border
                            ${selectedSession === session.id
                              ? 'bg-white/10 border-white/30'
                              : 'bg-secondary border-border hover:border-white/20'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-mono text-muted-foreground truncate">
                              {session.id.slice(0, 12)}...
                            </p>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${
                              selectedSession === session.id ? 'rotate-180' : ''
                            }`} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(session.lastActivity)}
                          </p>
                        </button>
                      ))}
                      {selectedProject.sessions.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{selectedProject.sessions.length - 5} more sessions
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Session Messages */}
                <AnimatePresence>
                  {selectedSession && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border border-border bg-card p-4 overflow-hidden"
                    >
                      <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4" />
                        Messages
                      </h3>

                      {messagesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {messages.slice(0, 10).map((message) => (
                            <div
                              key={message.uuid}
                              className={`p-3 ${
                                message.type === 'user'
                                  ? 'bg-white/10 border-l-2 border-white'
                                  : 'bg-secondary'
                              }`}
                            >
                              <p className="text-[10px] text-muted-foreground mb-1">
                                {message.type === 'user' ? 'You' : 'Claude'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getMessagePreview(message.content)}
                              </p>
                            </div>
                          ))}
                          {messages.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No messages found
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Project Path */}
                <div className="border border-border bg-card p-4">
                  <h3 className="text-sm font-medium mb-2">Full Path</h3>
                  <p className="font-mono text-xs text-muted-foreground break-all select-all">
                    {selectedProject.path}
                  </p>
                </div>

                {/* Delete Custom Project */}
                {isCustomProject(selectedProject.path) && (
                  <button
                    onClick={(e) => handleRemoveProject(selectedProject.path, e)}
                    className="w-full px-4 py-2.5 border border-red-500/30 text-red-400 text-sm flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Project
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Launch Agent Modal */}
      <NewChatModal
        open={showAgentDialog}
        onClose={() => setShowAgentDialog(false)}
        onSubmit={handleCreateAgent}
        projects={electronProjects.map(p => ({ path: p.path, name: p.name }))}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        installedSkills={installedSkills}
        onRefreshSkills={refreshSkills}
        initialProjectPath={selectedProject?.path}
        initialStep={2}
      />
    </div>
  );
}
