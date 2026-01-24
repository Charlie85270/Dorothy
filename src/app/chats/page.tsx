'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useClaude, useSessionMessages } from '@/hooks/useClaude';
import type { ClaudeProject, ClaudeSession } from '@/lib/claude-code';

interface SessionWithProject {
  session: ClaudeSession;
  project: ClaudeProject;
}

export default function ChatsPage() {
  const { data, loading, error } = useClaude();
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionWithProject | null>(null);

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

  // Auto-select first session
  useEffect(() => {
    if (!selectedSession && filteredSessions.length > 0) {
      setSelectedSession(filteredSessions[0]);
    }
  }, [filteredSessions, selectedSession]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-cyan mx-auto mb-4" />
          <p className="text-text-secondary">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-accent-red">
          <p className="mb-2">Failed to load conversations</p>
          <p className="text-sm text-text-muted">{error}</p>
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
    if (diffDays < 7) return `${diffDays} days ago`;
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

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-text-secondary text-sm mt-1">
            Browse your Claude Code conversation history
          </p>
        </div>
        <div className="text-sm text-text-muted">
          {allSessions.length} session{allSessions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Session List */}
        <div className="w-80 flex flex-col rounded-xl border border-border-primary bg-bg-secondary overflow-hidden shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-border-primary">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Session Items */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {filteredSessions.map(({ session, project }, index) => {
                const isSelected = selectedSession?.session.id === session.id;

                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => setSelectedSession({ session, project })}
                    className={`
                      p-4 cursor-pointer transition-all border-b border-border-primary/50
                      ${isSelected ? 'bg-accent-cyan/10' : 'hover:bg-bg-tertiary/50'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center shrink-0">
                        <Terminal className="w-5 h-5 text-accent-purple" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-medium text-sm truncate">{project.name}</h4>
                          <span className="text-xs text-text-muted shrink-0">
                            {formatDate(session.lastActivity)}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 truncate font-mono">
                          {session.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredSessions.length === 0 && (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 mx-auto text-text-muted mb-2" />
                <p className="text-text-muted text-sm">No conversations found</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat View */}
        <div className="flex-1 flex flex-col rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-accent-purple" />
                  </div>
                  <div>
                    <h3 className="font-medium">{selectedSession.project.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <FolderKanban className="w-3 h-3" />
                        {selectedSession.project.path}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-accent-cyan" />
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => (
                      <motion.div
                        key={message.uuid}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          message.type === 'user' ? 'bg-accent-cyan/20' : 'bg-accent-purple/20'
                        }`}>
                          {message.type === 'user' ? (
                            <User className="w-4 h-4 text-accent-cyan" />
                          ) : (
                            <Bot className="w-4 h-4 text-accent-purple" />
                          )}
                        </div>
                        <div className={`max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}>
                          <div className={`inline-block p-3 rounded-xl ${
                            message.type === 'user'
                              ? 'bg-accent-cyan/10 border border-accent-cyan/20'
                              : 'bg-bg-tertiary border border-border-primary'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {getMessageContent(message.content)}
                            </p>
                            {hasToolCalls(message.content) && (
                              <div className="mt-2 pt-2 border-t border-border-primary/50 flex items-center gap-1 text-xs text-accent-amber">
                                <Wrench className="w-3 h-3" />
                                <span>Used tools</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(new Date(message.timestamp))}
                            {message.model && (
                              <span className="ml-2 text-accent-purple">
                                {message.model.includes('opus') ? 'Opus' : 'Sonnet'}
                              </span>
                            )}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center h-full text-text-muted">
                        <p>No messages in this session</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Info Footer */}
              <div className="px-5 py-3 border-t border-border-primary bg-bg-tertiary/30">
                <p className="text-xs text-text-muted text-center">
                  This is a read-only view of your Claude Code conversation history
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-text-muted/30 mb-4" />
                <h3 className="font-medium text-lg mb-2">Select a conversation</h3>
                <p className="text-text-secondary text-sm">
                  Choose a session from the list to view the conversation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
