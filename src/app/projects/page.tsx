'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  MessageSquare,
  Clock,
  ChevronRight,
  Loader2,
  ExternalLink,
  Terminal,
  FolderOpen,
  Star,
  Layers,
  Bot,
  Play,
  RotateCcw,
  Plus,
  GitBranch,
  Trash2,
  FolderPlus,
} from 'lucide-react';
import { useClaude, useSessionMessages } from '@/hooks/useClaude';
import { useElectronAgents, useElectronFS, useElectronSkills, isElectron } from '@/hooks/useElectron';
import type { ClaudeProject } from '@/lib/claude-code';
import type { AgentStatus, AgentCharacter } from '@/types/electron';
import NewChatModal from '@/components/NewChatModal';

// Generate consistent colors for projects based on name
const getProjectColor = (name: string) => {
  const colors = [
    '#22d3ee', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#60a5fa', '#f472b6', '#34d399',
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
  running: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  waiting: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  idle: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  completed: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400' },
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

  // Agent dialog state
  const [showAgentDialog, setShowAgentDialog] = useState(false);

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

  // Add a new project (defined after allProjects - see below)
  const handleAddProject = async () => {
    if (!openFolderDialog) return;
    try {
      const selectedPath = await openFolderDialog();
      if (selectedPath) {
        // Check if already exists in custom projects
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

  // Check if a project is custom (can be removed)
  const isCustomProject = (projectPath: string) => {
    return customProjects.some(p => p.path === projectPath);
  };

  // Load favorites from localStorage on mount
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

  // Save favorites to localStorage when changed
  const saveFavorites = (newFavorites: string[]) => {
    setFavorites(newFavorites);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  };

  // Toggle favorite status
  const toggleFavorite = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent project selection
    if (favorites.includes(projectId)) {
      saveFavorites(favorites.filter(id => id !== projectId));
    } else {
      saveFavorites([...favorites, projectId]);
    }
  };

  const isFavorite = (projectId: string) => favorites.includes(projectId);

  // Normalize path for comparison (remove trailing slashes, resolve symlinks conceptually)
  const normalizePath = (path: string) => {
    // Remove trailing slashes and lowercase for comparison
    return path.replace(/\/+$/, '').toLowerCase();
  };

  // More flexible path matching - check if paths refer to the same directory
  const pathsMatch = (path1: string, path2: string) => {
    const norm1 = normalizePath(path1);
    const norm2 = normalizePath(path2);
    // Exact match
    if (norm1 === norm2) return true;
    // One ends with the other (handle relative vs absolute)
    if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) return true;
    // Match by directory name (last component)
    const name1 = norm1.split('/').pop();
    const name2 = norm2.split('/').pop();
    if (name1 && name2 && name1 === name2) {
      // Additional check: if names match, verify they have similar structure
      const parts1 = norm1.split('/').filter(Boolean);
      const parts2 = norm2.split('/').filter(Boolean);
      // If the last 2 components match, consider it a match
      if (parts1.length >= 2 && parts2.length >= 2) {
        if (parts1.slice(-2).join('/') === parts2.slice(-2).join('/')) return true;
      }
    }
    return false;
  };

  // Get agents for the selected project (use flexible path matching)
  const projectAgents = selectedProject
    ? agents.filter(a => pathsMatch(a.projectPath, selectedProject.path))
    : [];

  // Debug: Log agent paths when project changes (remove in production)
  useEffect(() => {
    if (selectedProject && agents.length > 0) {
      console.log('=== Agent Path Matching Debug ===');
      console.log('Selected project:', selectedProject.name, selectedProject.path);
      const matched = agents.filter(a => pathsMatch(a.projectPath, selectedProject.path));
      agents.forEach(a => {
        const matches = pathsMatch(a.projectPath, selectedProject.path);
        console.log(`Agent "${a.name}": ${a.projectPath} -> ${matches ? '✓ MATCH' : '✗ no match'}`);
      });
      console.log('Matched agents:', matched.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.path, agents.length]);

  // Handle creating a new agent via NewChatModal
  const handleCreateAgent = async (
    projectPath: string,
    skills: string[],
    prompt: string,
    model?: string,
    worktree?: { enabled: boolean; branchName: string },
    character?: AgentCharacter,
    name?: string,
    secondaryProjectPath?: string
  ) => {
    try {
      const agent = await createAgent({
        projectPath,
        skills,
        worktree,
        character,
        name,
        secondaryProjectPath,
      });

      // Start the agent with the prompt
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

  // Handle restarting/resuming an agent
  const handleRestartAgent = async (agent: AgentStatus, resume: boolean = false) => {
    const prompt = resume
      ? '/resume' // Special command to resume conversation
      : 'Continue working on the previous task';

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

  // Merge Claude Code projects with custom projects - MUST be before early returns
  const claudeProjects = data?.projects || [];
  const allProjects = useMemo(() => {
    const merged: ClaudeProject[] = [...claudeProjects];

    // Add custom projects that aren't already in Claude projects
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

  // Filter projects based on active tab
  const projects = activeTab === 'favorites'
    ? allProjects.filter(p => favorites.includes(p.id))
    : allProjects;

  const favoritesCount = allProjects.filter(p => favorites.includes(p.id)).length;

  // Early returns for loading/error states - AFTER all hooks
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-cyan mx-auto mb-4" />
          <p className="text-text-secondary">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-accent-red">
          <p className="mb-2">Failed to load projects</p>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-text-secondary text-sm mt-1">
            Browse your Claude Code projects and conversations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-muted">
            {allProjects.length} project{allProjects.length !== 1 ? 's' : ''}
          </span>
          {hasElectron && (
            <button
              onClick={handleAddProject}
              className="flex items-center gap-2 px-4 py-2 bg-accent-cyan/20 text-accent-cyan rounded-lg hover:bg-accent-cyan/30 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Add Project
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${activeTab === 'all'
              ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
              : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-transparent'
            }
          `}
        >
          <Layers className="w-4 h-4" />
          All Projects
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'all' ? 'bg-accent-cyan/20' : 'bg-bg-secondary'
          }`}>
            {allProjects.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${activeTab === 'favorites'
              ? 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30'
              : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-transparent'
            }
          `}
        >
          <Star className="w-4 h-4" />
          Favorites
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'favorites' ? 'bg-accent-amber/20' : 'bg-bg-secondary'
          }`}>
            {favoritesCount}
          </span>
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project List */}
        <div className="lg:col-span-2 space-y-3">
          <AnimatePresence mode="popLayout">
            {projects.map((project, index) => {
              const color = getProjectColor(project.name);
              const isSelected = selectedProject?.id === project.id;

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => {
                    setSelectedProject(project);
                    setSelectedSession(null);
                  }}
                  className={`
                    relative rounded-xl border bg-bg-secondary p-5 cursor-pointer transition-all overflow-hidden
                    ${isSelected ? 'border-accent-cyan shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'border-border-primary hover:border-border-accent'}
                  `}
                >
                  {/* Color bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: color }}
                  />

                  <div className="pl-4 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5" style={{ color }} />
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                        {isFavorite(project.id) && (
                          <Star className="w-4 h-4 text-accent-amber fill-accent-amber" />
                        )}
                        {isCustomProject(project.path) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-2 font-mono truncate">
                        {project.path}
                      </p>

                      {/* Stats - include agent count */}
                      {(() => {
                        const linkedAgents = agents.filter(a => pathsMatch(a.projectPath, project.path));
                        return linkedAgents.length > 0 ? (
                          <div className="flex items-center gap-1 mt-1">
                            <Bot className="w-3.5 h-3.5 text-accent-cyan" />
                            <span className="text-xs text-accent-cyan">
                              {linkedAgents.length} agent{linkedAgents.length !== 1 ? 's' : ''} linked
                            </span>
                          </div>
                        ) : null;
                      })()}

                      {/* Stats */}
                      <div className="flex items-center gap-6 mt-3 text-xs text-text-muted">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{project.sessions.length} sessions</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Last active: {formatDate(project.lastActivity)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => toggleFavorite(project.id, e)}
                        className={`p-2 rounded-lg transition-all ${
                          isFavorite(project.id)
                            ? 'text-accent-amber hover:bg-accent-amber/20'
                            : 'text-text-muted hover:text-accent-amber hover:bg-bg-tertiary'
                        }`}
                        title={isFavorite(project.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star className={`w-5 h-5 ${isFavorite(project.id) ? 'fill-current' : ''}`} />
                      </button>
                      {isCustomProject(project.path) && (
                        <button
                          onClick={(e) => handleRemoveProject(project.path, e)}
                          className="p-2 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
                          title="Remove from list"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronRight className={`w-5 h-5 text-text-muted transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {projects.length === 0 && (
            <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
              {activeTab === 'favorites' ? (
                <>
                  <Star className="w-12 h-12 mx-auto text-text-muted mb-4" />
                  <h3 className="font-medium text-lg mb-2">No favorite projects</h3>
                  <p className="text-text-secondary text-sm">
                    Click the star icon on a project to add it to your favorites
                  </p>
                  <button
                    onClick={() => setActiveTab('all')}
                    className="mt-4 text-accent-cyan hover:underline text-sm"
                  >
                    View all projects
                  </button>
                </>
              ) : (
                <>
                  <FolderKanban className="w-12 h-12 mx-auto text-text-muted mb-4" />
                  <h3 className="font-medium text-lg mb-2">No projects found</h3>
                  <p className="text-text-secondary text-sm mb-4">
                    Start using Claude Code in a project directory to see it here
                  </p>
                  {hasElectron && (
                    <button
                      onClick={handleAddProject}
                      className="flex items-center gap-2 px-4 py-2 mx-auto bg-accent-cyan/20 text-accent-cyan rounded-lg hover:bg-accent-cyan/30 transition-colors"
                    >
                      <FolderPlus className="w-4 h-4" />
                      Add a Project
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Project Details Panel */}
        <div className="space-y-4">
          {selectedProject ? (
            <>
              {/* Project Info */}
              <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
                  <FolderOpen className="w-4 h-4" style={{ color: getProjectColor(selectedProject.name) }} />
                  {selectedProject.name}
                </h3>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-text-muted">Path:</span>
                    <p className="font-mono text-xs mt-1 text-text-secondary break-all">
                      {selectedProject.path}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Sessions:</span>
                    <span>{selectedProject.sessions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Last Active:</span>
                    <span>{formatDate(selectedProject.lastActivity)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      // Open in Cursor
                      window.open(`cursor://file${selectedProject.path}`, '_blank');
                    }}
                    className="flex-1 px-4 py-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Cursor
                  </button>
                  {hasElectron && (
                    <button
                      onClick={() => setShowAgentDialog(true)}
                      className="flex-1 px-4 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Launch Agent
                    </button>
                  )}
                </div>
              </div>

              {/* Project Agents */}
              {hasElectron && (
                <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
                    <Bot className="w-4 h-4 text-accent-cyan" />
                    Agents ({projectAgents.length})
                  </h3>

                  {projectAgents.length === 0 ? (
                    <div className="text-center py-6">
                      <Bot className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
                      <p className="text-xs text-text-muted">No agents for this project</p>
                      <button
                        onClick={() => setShowAgentDialog(true)}
                        className="mt-3 text-xs text-accent-cyan hover:underline"
                      >
                        Launch your first agent
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {projectAgents.map((agent) => {
                        const statusColor = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;
                        const charEmoji = CHARACTER_EMOJIS[agent.character || 'robot'] || '🤖';
                        const isIdle = agent.status === 'idle' || agent.status === 'completed';

                        return (
                          <div
                            key={agent.id}
                            className="p-3 rounded-lg bg-bg-tertiary/50 border border-border-primary"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-lg">{charEmoji}</span>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {agent.name || `Agent ${agent.id.slice(0, 6)}`}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
                                      {agent.status}
                                    </span>
                                    {agent.branchName && (
                                      <span className="text-[10px] text-accent-purple">
                                        {agent.branchName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isIdle && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleRestartAgent(agent, true)}
                                    className="p-1.5 rounded-lg text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
                                    title="Resume (restore context)"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRestartAgent(agent, false)}
                                    className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                    title="Restart"
                                  >
                                    <Play className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              {agent.status === 'running' && (
                                <span className="flex items-center gap-1 text-xs text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Working
                                </span>
                              )}

                              {agent.status === 'waiting' && (
                                <span className="flex items-center gap-1 text-xs text-amber-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Waiting
                                </span>
                              )}
                            </div>

                            {agent.currentTask && (
                              <p className="text-xs text-text-muted mt-2 truncate">
                                {agent.currentTask}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sessions */}
              <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
                  <Terminal className="w-4 h-4 text-text-muted" />
                  Sessions
                </h3>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedProject.sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session.id)}
                      className={`
                        w-full text-left p-3 rounded-lg transition-all
                        ${selectedSession === session.id
                          ? 'bg-accent-cyan/10 border border-accent-cyan/30'
                          : 'bg-bg-tertiary/50 border border-transparent hover:border-border-accent'
                        }
                      `}
                    >
                      <p className="text-xs font-mono text-text-muted truncate">
                        {session.id.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {formatDate(session.lastActivity)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Messages */}
              {selectedSession && (
                <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
                    <MessageSquare className="w-4 h-4 text-text-muted" />
                    Messages
                  </h3>

                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-accent-cyan" />
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {messages.slice(0, 20).map((message) => (
                        <div
                          key={message.uuid}
                          className={`p-3 rounded-lg ${
                            message.type === 'user'
                              ? 'bg-accent-cyan/10 border border-accent-cyan/20'
                              : 'bg-bg-tertiary border border-border-primary'
                          }`}
                        >
                          <p className="text-xs text-text-muted mb-1">
                            {message.type === 'user' ? 'You' : 'Claude'}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {getMessagePreview(message.content)}
                          </p>
                        </div>
                      ))}
                      {messages.length === 0 && (
                        <p className="text-sm text-text-muted text-center py-4">
                          No messages found
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-border-primary bg-bg-secondary p-8 text-center">
              <FolderKanban className="w-10 h-10 mx-auto text-text-muted mb-3" />
              <p className="text-text-secondary text-sm">Select a project to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Launch Agent Modal - uses same dialog as Create Agent */}
      <NewChatModal
        open={showAgentDialog}
        onClose={() => setShowAgentDialog(false)}
        onSubmit={handleCreateAgent}
        projects={electronProjects.map(p => ({ path: p.path, name: p.name }))}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        installedSkills={installedSkills}
        onRefreshSkills={refreshSkills}
        initialProjectPath={selectedProject?.path}
        initialStep={2} // Skip project selection, go to skills
      />
    </div>
  );
}
