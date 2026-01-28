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
import type { ClaudeProject, ClaudeSession } from '@/lib/claude-code';

interface SessionWithProject {
  session: ClaudeSession;
  project: ClaudeProject;
}

export default function ChatsPage() {
  const { data, loading, error } = useClaude();
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionWithProject | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border-primary">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-bg-tertiary border-none"
          />
        </div>
      </div>

      {/* Session Items */}
      <div className="flex-1 overflow-y-auto">
        <div>
          {filteredSessions.map(({ session, project }) => {
            const isSelected = selectedSession?.session.id === session.id;

            return (
              <div
                key={session.id}
                onClick={() => handleSelectSession({ session, project })}
                className={`
                  p-4 cursor-pointer transition-all border-b border-border-primary/30 active:bg-bg-tertiary
                  ${isSelected ? 'bg-accent-cyan/10 lg:bg-accent-cyan/10' : 'hover:bg-bg-tertiary/50'}
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center shrink-0">
                    <Terminal className="w-5 h-5 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-sm truncate">{project.name}</h4>
                      <span className="text-[11px] text-text-muted shrink-0">
                        {formatDate(session.lastActivity)}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      Session {session.id.slice(0, 8)}
                    </p>
                  </div>

                  {/* Unread indicator (optional visual) */}
                  {index === 0 && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-cyan shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredSessions.length === 0 && (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-text-muted/30 mb-3" />
            <p className="text-text-muted text-sm">No conversations found</p>
          </div>
        )}
      </div>
    </div>
  );

  // Chat View Component
  const ChatView = () => (
    <div className="flex flex-col h-full">
      {selectedSession ? (
        <>
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border-primary flex items-center gap-3 bg-bg-secondary">
            {/* Back button - mobile only */}
            <button
              onClick={handleBackToList}
              className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{selectedSession.project.name}</h3>
              <p className="text-xs text-text-muted truncate">
                {selectedSession.project.path.split('/').slice(-2).join('/')}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-primary">
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
                    transition={{ delay: Math.min(index * 0.01, 0.3) }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] lg:max-w-[70%] ${message.type === 'user' ? 'order-1' : ''}`}>
                      {/* Message bubble */}
                      <div className={`px-4 py-2.5 rounded-2xl ${
                        message.type === 'user'
                          ? 'bg-accent-cyan text-bg-primary rounded-br-md'
                          : 'bg-bg-secondary border border-border-primary rounded-bl-md'
                      }`}>
                        <p className={`text-sm whitespace-pre-wrap break-words ${
                          message.type === 'user' ? 'text-bg-primary' : 'text-text-primary'
                        }`}>
                          {getMessageContent(message.content)}
                        </p>
                        {hasToolCalls(message.content) && (
                          <div className={`mt-2 pt-2 border-t flex items-center gap-1 text-xs ${
                            message.type === 'user'
                              ? 'border-bg-primary/20 text-bg-primary/80'
                              : 'border-border-primary text-accent-amber'
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
                        <span className="text-[10px] text-text-muted">
                          {formatTime(new Date(message.timestamp))}
                        </span>
                        {message.model && message.type !== 'user' && (
                          <span className="text-[10px] text-accent-purple">
                            {message.model.includes('opus') ? 'Opus' : 'Sonnet'}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-text-muted">
                    <p className="text-sm">No messages in this session</p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Info Footer */}
          <div className="px-4 py-2.5 border-t border-border-primary bg-bg-secondary">
            <p className="text-[11px] text-text-muted text-center">
              Read-only view of conversation history
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="text-center p-8">
            <div className="w-20 h-20 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-text-muted/30" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Select a conversation</h3>
            <p className="text-text-muted text-sm">
              Choose a session to view messages
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex flex-col -m-4 lg:m-0">
      {/* Mobile: Show either list or chat */}
      <div className="lg:hidden flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {!mobileShowChat ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col bg-bg-secondary"
            >
              {/* Mobile Header */}
              <div className="px-4 py-3 border-b border-border-primary">
                <h1 className="text-xl font-bold">Conversations</h1>
                <p className="text-xs text-text-muted mt-0.5">
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
              className="flex-1 flex flex-col"
            >
              <ChatView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: Side by side */}
      <div className="hidden lg:flex flex-1 gap-6 p-4 lg:p-0">
        {/* Header */}
        <div className="hidden">
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        </div>

        {/* Session List */}
        <div className="w-80 flex flex-col rounded-xl border border-border-primary bg-bg-secondary overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-border-primary">
            <h2 className="font-semibold">Conversations</h2>
            <p className="text-xs text-text-muted">
              {allSessions.length} session{allSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <SessionList />
        </div>

        {/* Chat View */}
        <div className="flex-1 flex flex-col rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
          <ChatView />
        </div>
      </div>
    </div>
  );
}
