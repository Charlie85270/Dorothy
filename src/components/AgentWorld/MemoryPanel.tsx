'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, Search, Clock, FileEdit, Terminal, Lightbulb, MessageSquare, Loader2, RefreshCw, ChevronDown, ChevronRight, X, Bug, CheckCircle, Eye, Sparkles } from 'lucide-react';

interface MemoryObservation {
  id: string;
  type: string; // More flexible to handle claude-mem types
  content: string;
  created_at: number;
  agent_id: string;
  project_path: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}

interface MemoryPanelProps {
  agentId: string;
  projectPath: string;
  className?: string;
}

const TYPE_ICONS: Record<string, typeof Brain> = {
  file_edit: FileEdit,
  command: Terminal,
  decision: Lightbulb,
  learning: Brain,
  preference: MessageSquare,
  tool_use: Terminal,
  context: Brain,
  message: MessageSquare,
  // Claude-mem types
  observation: Eye,
  bugfix: Bug,
  completed: CheckCircle,
  investigated: Eye,
  learned: Sparkles,
  next_steps: Lightbulb,
};

const TYPE_COLORS: Record<string, string> = {
  file_edit: 'text-purple-400 bg-purple-500/20',
  command: 'text-cyan-400 bg-cyan-500/20',
  decision: 'text-amber-400 bg-amber-500/20',
  learning: 'text-pink-400 bg-pink-500/20',
  preference: 'text-green-400 bg-green-500/20',
  tool_use: 'text-blue-400 bg-blue-500/20',
  context: 'text-orange-400 bg-orange-500/20',
  message: 'text-zinc-400 bg-zinc-500/20',
  // Claude-mem types
  observation: 'text-blue-400 bg-blue-500/20',
  bugfix: 'text-red-400 bg-red-500/20',
  completed: 'text-green-400 bg-green-500/20',
  investigated: 'text-yellow-400 bg-yellow-500/20',
  learned: 'text-pink-400 bg-pink-500/20',
  next_steps: 'text-cyan-400 bg-cyan-500/20',
};

export default function MemoryPanel({ agentId, projectPath, className = '' }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryObservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<{ totalObservations: number; source?: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemoryObservation | null>(null);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch memories from the API
      const searchUrl = searchQuery
        ? `http://127.0.0.1:31415/api/memory/search?q=${encodeURIComponent(searchQuery)}&agent_id=${agentId}&limit=100`
        : `http://127.0.0.1:31415/api/memory/search?q=&agent_id=${agentId}&limit=100`;

      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch memories');
      }

      const data = await response.json();
      // Filter out noise memories
      const filtered = (data.results || []).filter((m: MemoryObservation) => {
        const content = m.content.toLowerCase();
        // Filter out memory search queries and claude install commands
        if (content.includes('search: memories:') || content.includes('search_memory')) return false;
        if (content.includes('bash_command: claude install')) return false;
        if (content.includes('command: claude install')) return false;
        return true;
      });
      setMemories(filtered);

      // Also fetch stats
      const statsResponse = await fetch('http://127.0.0.1:31415/api/memory/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching memories:', err);
      setError('Could not load memories. Make sure the app is running.');
    } finally {
      setIsLoading(false);
    }
  }, [agentId, searchQuery]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatFullDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTypeLabel = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search */}
      <div className="p-2 border-b border-border-primary">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-7 pr-8 py-1.5 text-xs bg-bg-primary border border-border-primary rounded focus:outline-none focus:border-pink-500"
          />
          <button
            onClick={fetchMemories}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 hover:bg-bg-tertiary rounded"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 text-text-muted ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-3 py-1.5 text-[10px] text-text-muted border-b border-border-primary flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {memories.length} memories
            {stats.source === 'claude-mem' && (
              <span className="px-1 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[9px]">claude-mem</span>
            )}
          </span>
          <span>{stats.totalObservations || memories.length} total</span>
        </div>
      )}

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-xs text-text-muted">{error}</p>
            <button
              onClick={fetchMemories}
              className="mt-2 text-xs text-pink-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : memories.length === 0 ? (
          <div className="p-4 text-center">
            <Brain className="w-8 h-8 mx-auto text-text-muted/30 mb-2" />
            <p className="text-xs text-text-muted">
              {searchQuery ? 'No memories match your search' : 'No memories yet'}
            </p>
            <p className="text-[10px] text-text-muted/60 mt-1">
              Memories are captured from agent activity
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-primary/50">
            {memories.map((memory) => {
              const Icon = TYPE_ICONS[memory.type] || Brain;
              const colorClass = TYPE_COLORS[memory.type] || 'text-zinc-400 bg-zinc-500/20';
              const isExpanded = expandedId === memory.id;

              return (
                <div
                  key={memory.id}
                  className="hover:bg-bg-tertiary/30 transition-colors"
                >
                  {/* Memory Header - Clickable */}
                  <button
                    onClick={() => toggleExpand(memory.id)}
                    className="w-full px-3 py-2 text-left flex items-start gap-2"
                  >
                    <div className={`p-1 rounded ${colorClass.split(' ')[1]} mt-0.5`}>
                      <Icon className={`w-3 h-3 ${colorClass.split(' ')[0]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${colorClass}`}>
                          {getTypeLabel(memory.type)}
                        </span>
                        <span className="text-[10px] text-text-muted flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDate(memory.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs text-text-secondary ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {memory.content}
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 ml-7 border-l-2 border-pink-500/30 mx-3 mb-2">
                      {/* Full Content */}
                      <div className="mb-3">
                        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Full Memory Content</p>
                        <div className="p-3 bg-bg-primary rounded text-xs text-text-primary font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto border border-border-primary">
                          {memory.content}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-text-muted">Time:</span>
                          <span className="ml-1 text-text-secondary">{formatFullDate(memory.created_at)}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">Type:</span>
                          <span className="ml-1 text-text-secondary">{memory.type}</span>
                        </div>
                        {memory.session_id && (
                          <div className="col-span-2">
                            <span className="text-text-muted">Session:</span>
                            <span className="ml-1 text-text-secondary font-mono truncate">{memory.session_id.slice(0, 20)}...</span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-text-muted">ID:</span>
                          <span className="ml-1 text-text-secondary font-mono">{memory.id}</span>
                        </div>
                      </div>

                      {/* Metadata JSON if present */}
                      {memory.metadata && Object.keys(memory.metadata).length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Metadata</p>
                          <pre className="p-2 bg-bg-primary rounded text-[10px] text-text-secondary font-mono overflow-x-auto">
                            {JSON.stringify(memory.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
