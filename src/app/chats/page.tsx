'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Bot,
  User,
  Search,
  Loader2,
  FolderKanban,
  Clock,
  Terminal,
  Wrench,
  ChevronLeft,
} from 'lucide-react';
import { useClaude, useSessionMessages } from '@/hooks/useClaude';
import { useElectronAgents } from '@/hooks/useElectron';
import type { ClaudeProject, ClaudeSession } from '@/lib/claude-code';

interface SessionWithProject {
  session: ClaudeSession;
  project: ClaudeProject;
}

// Character emoji mapping
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

export default function ChatsPage() {
  const { data, loading, error } = useClaude();
  const { agents } = useElectronAgents();
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionWithProject | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to match paths flexibly
  const pathsMatch = (path1: string, path2: string) => {
    const norm1 = path1.replace(/\/+$/, '').toLowerCase();
    const norm2 = path2.replace(/\/+$/, '').toLowerCase();
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

  // Get agents for a project
  const getProjectAgents = (projectPath: string) => {
    return agents.filter(a => pathsMatch(a.projectPath, projectPath));
  };

  const { messages, loading: messagesLoading } = useSessionMessages(
    selectedSession?.project.id || null,
    selectedSession?.session.id || null
  );

  // Build list of all sessions across projects
  const allSessions: SessionWithProject[] = [];
  for (const project of data?.projects || []) {
    for (const session of project.sessions) {
      allSessions.push({ session, project });
    }
  }

  // Sort by last activity
  allSessions.sort((a, b) =>
    new Date(b.session.lastActivity).getTime() - new Date(a.session.lastActivity).getTime()
  );

  // Filter by search
  const filteredSessions = allSessions.filter(({ project }) =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.path.toLowerCase().includes(search.toLowerCase())
  );

  // Auto-select first session on desktop
  useEffect(() => {
    if (!selectedSession && filteredSessions.length > 0 && window.innerWidth >= 1024) {
      setSelectedSession(filteredSessions[0]);
    }
  }, [filteredSessions, selectedSession]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle session selection
  const handleSelectSession = (session: SessionWithProject) => {
    setSelectedSession(session);
    setMobileShowChat(true);
  };

  // Handle back button on mobile
  const handleBackToList = () => {
    setMobileShowChat(false);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-red-400">
          <p className="mb-2">Failed to load conversations</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

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

  const getMessageContent = (content: string | unknown[]): string => {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'object' && item !== null) {
          const obj = item as { type?: string; text?: string; content?: string; thinking?: string };
          if (obj.type === 'text' && obj.text) {
            return obj.text;
          }
          if (obj.type === 'tool_result' && obj.content) {
            return `Tool result: ${obj.content.slice(0, 100)}...`;
          }
          if (obj.type === 'thinking' && obj.thinking) {
            return `[Thinking] ${obj.thinking.slice(0, 100)}...`;
          }
        }
      }
    }
    return 'Message content';
  };

  const getMessagePreview = (content: string | unknown[]): string => {
    const text = getMessageContent(content);
    return text.length > 50 ? text.slice(0, 50) + '...' : text;
  };

  const hasToolCalls = (content: string | unknown[]): boolean => {
    if (Array.isArray(content)) {
      return content.some((item) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as { type?: string };
          return obj.type === 'tool_use';
        }
        return false;
      });
    }
    return false;
  };

  // Session List Component
  const SessionList = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-secondary border border-border focus:border-white/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Session Items */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div>
          {filteredSessions.map(({ session, project }, index) => {
            const isSelected = selectedSession?.session.id === session.id;
            const linkedAgents = getProjectAgents(project.path);

            return (
              <div
                key={session.id}
                onClick={() => handleSelectSession({ session, project })}
                className={`
                  p-4 cursor-pointer transition-all border-b border-border/50
                  ${isSelected ? 'bg-white/10' : 'hover:bg-secondary'}
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-secondary border border-border flex items-center justify-center shrink-0">
                    <Terminal className="w-4 h-4 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm truncate">{project.name}</h4>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(session.lastActivity)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                      {session.id.slice(0, 8)}...
                    </p>
                    {/* Linked Agents */}
                    {linkedAgents.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {linkedAgents.slice(0, 3).map((agent) => (
                          <div
                            key={agent.id}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 border border-border text-[10px]"
                            title={agent.name || `Agent ${agent.id.slice(0, 6)}`}
                          >
                            <span>{CHARACTER_EMOJIS[agent.character || 'robot'] || '🤖'}</span>
                            <span className="text-muted-foreground truncate max-w-[60px]">
                              {agent.name || agent.id.slice(0, 6)}
                            </span>
                          </div>
                        ))}
                        {linkedAgents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{linkedAgents.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Unread indicator (optional visual) */}
                  {index === 0 && (
                    <div className="w-2 h-2 bg-white shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredSessions.length === 0 && (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No conversations found</p>
          </div>
        )}
      </div>
    </div>
  );

  // Chat View Component
  const ChatView = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {selectedSession ? (
        <>
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card shrink-0">
            {/* Back button - mobile only */}
            <button
              onClick={handleBackToList}
              className="lg:hidden p-1.5 -ml-1.5 hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Avatar */}
            <div className="w-10 h-10 bg-white flex items-center justify-center">
              <Bot className="w-5 h-5 text-black" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{selectedSession.project.name}</h3>
              <p className="text-xs text-muted-foreground truncate font-mono">
                {selectedSession.project.path.split('/').slice(-2).join('/')}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background min-h-0">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.uuid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.01, 0.3) }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] lg:max-w-[70%] ${message.type === 'user' ? 'order-1' : ''}`}>
                      {/* Message bubble */}
                      <div className={`px-4 py-2.5 ${
                        message.type === 'user'
                          ? 'bg-white text-black'
                          : 'bg-card border border-border'
                      }`}>
                        <p className={`text-sm whitespace-pre-wrap break-words ${
                          message.type === 'user' ? 'text-black' : 'text-foreground'
                        }`}>
                          {getMessageContent(message.content)}
                        </p>
                        {hasToolCalls(message.content) && (
                          <div className={`mt-2 pt-2 border-t flex items-center gap-1 text-xs ${
                            message.type === 'user'
                              ? 'border-black/20 text-black/70'
                              : 'border-border text-muted-foreground'
                          }`}>
                            <Wrench className="w-3 h-3" />
                            <span>Used tools</span>
                          </div>
                        )}
                      </div>

                      {/* Time and model */}
                      <div className={`flex items-center gap-2 mt-1 px-1 ${
                        message.type === 'user' ? 'justify-end' : 'justify-start'
                      }`}>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(new Date(message.timestamp))}
                        </span>
                        {message.model && message.type !== 'user' && (
                          <span className="text-[10px] text-muted-foreground">
                            {message.model.includes('opus') ? 'Opus' : 'Sonnet'}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">No messages in this session</p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Info Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-card shrink-0">
            <p className="text-[11px] text-muted-foreground text-center">
              Read-only view of conversation history
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center p-8">
            <div className="w-20 h-20 bg-card border border-border flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Select a conversation</h3>
            <p className="text-muted-foreground text-sm">
              Choose a session to view messages
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex flex-col -m-4 lg:m-0 overflow-hidden">
      {/* Mobile: Show either list or chat */}
      <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {!mobileShowChat ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col bg-card overflow-hidden"
            >
              {/* Mobile Header */}
              <div className="px-4 py-3 border-b border-border shrink-0">
                <h1 className="text-xl font-bold">Conversations</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {allSessions.length} session{allSessions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <SessionList />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <ChatView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: Side by side */}
      <div className="hidden lg:flex flex-1 gap-6 pt-6 overflow-hidden">
        {/* Session List */}
        <div className="w-80 flex flex-col border border-border bg-card overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h2 className="font-semibold">Conversations</h2>
            <p className="text-xs text-muted-foreground">
              {allSessions.length} session{allSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <SessionList />
          </div>
        </div>

        {/* Chat View */}
        <div className="flex-1 flex flex-col border border-border bg-card overflow-hidden min-h-0">
          <ChatView />
        </div>
      </div>
    </div>
  );
}
