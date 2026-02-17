'use client';

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import { Video, Settings, Send, Bot, Mic } from 'lucide-react';
import Link from 'next/link';
import SimliElevenlabs, { type TranscriptEntry } from '@/components/NPC/SimliElevenlabs';
import AgentContextProvider from '@/components/NPC/AgentContextProvider';
import NPCTranscript from '@/components/NPC/NPCTranscript';
import { useSettings } from '@/hooks/useSettings';

type NPCStatus = 'idle' | 'connecting' | 'connected' | 'error';

type AgentEntry = { id: string; name?: string; status: string; currentTask?: string; projectPath: string; error?: string; lastActivity: string };

export default function NPCPage() {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<NPCStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [textInput, setTextInput] = useState('');
  const [interimText, setInterimText] = useState('');
  const sendContextualUpdateRef = useRef<((text: string) => void) | null>(null);
  const sendTextMessageRef = useRef<((text: string) => void) | null>(null);
  const [agents, setAgents] = useState<{ id: string; name?: string; status: string }[]>([]);
  const { appSettings } = useSettings();

  // Fetch agents via Electron IPC (secure, no CORS needed)
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        if (!window.electronAPI?.agent?.list) return;
        const agentList = await window.electronAPI.agent.list();
        setAgents(agentList || []);
      } catch { /* Electron API not available */ }
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  const hasConfig = !!(
    appSettings.elevenlabsApiKey &&
    appSettings.elevenlabsAgentId &&
    appSettings.simliApiKey &&
    appSettings.simliFaceId
  );

  const getSignedUrl = useCallback(async () => {
    const res = await fetch('/api/npc/signed-url');
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to get signed URL');
    }
    const data = await res.json();
    return data.signed_url;
  }, []);

  const handleTranscriptUpdate = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev.slice(-100), entry]);
  }, []);

  const handleStart = useCallback(() => setIsActive(true), []);
  const handleStop = useCallback(() => { setIsActive(false); setStatus('idle'); }, []);

  const handleSendText = useCallback((e: FormEvent) => {
    e.preventDefault();
    const msg = textInput.trim();
    if (!msg || !isActive || !sendTextMessageRef.current) return;
    sendTextMessageRef.current(msg);
    setTextInput('');
  }, [textInput, isActive]);

  const fetchAllAgentsFull = async (): Promise<AgentEntry[]> => {
    if (!window.electronAPI?.agent?.list) return [];
    return (await window.electronAPI.agent.list()) as AgentEntry[];
  };

  const fetchAllAgents = async () => {
    const allAgents = await fetchAllAgentsFull();
    return JSON.stringify(allAgents.map((a) => ({
      id: a.id, name: a.name, status: a.status, currentTask: a.currentTask,
      projectPath: a.projectPath, error: a.error, lastActivity: a.lastActivity,
    })));
  };

  // Resolve an agentId param that might be a name, partial name, or actual ID
  const resolveAgentId = async (identifier: string): Promise<string | null> => {
    if (!window.electronAPI?.agent) return null;
    // First try direct ID lookup
    try {
      const agent = await window.electronAPI.agent.get(identifier);
      if (agent) return identifier;
    } catch { /* not found by ID */ }

    // Search by name
    const allAgents = await fetchAllAgentsFull();
    const lower = identifier.toLowerCase();
    const match = allAgents.find(
      (a) =>
        a.name?.toLowerCase() === lower ||
        a.name?.toLowerCase().includes(lower) ||
        a.id.toLowerCase().startsWith(lower)
    );
    return match?.id || null;
  };

  const clientTools = useRef({
    getAllAgents: fetchAllAgents,
    getRunningAgents: fetchAllAgents,
    getAgentByName: async (params: Record<string, unknown>) => {
      const name = (params.name || params.agentName || params.agentId || '') as string;
      if (!name) return JSON.stringify({ error: 'No agent name provided' });
      const allAgents = await fetchAllAgentsFull();
      const lower = name.toLowerCase();
      const match = allAgents.find(
        (a) =>
          a.name?.toLowerCase() === lower ||
          a.name?.toLowerCase().includes(lower) ||
          a.id.toLowerCase().startsWith(lower)
      );
      if (!match) return JSON.stringify({ error: `No agent found matching "${name}". Available agents: ${allAgents.map((a) => a.name || a.id).join(', ')}` });
      const agent = await window.electronAPI.agent.get(match.id);
      return JSON.stringify({ agent });
    },
    getAgentDetails: async (params: Record<string, unknown>) => {
      const identifier = (params.agentId || params.name || params.agentName || '') as string;
      if (!identifier) return JSON.stringify({ error: 'No agent identifier provided' });
      const resolvedId = await resolveAgentId(identifier);
      if (!resolvedId) {
        const allAgents = await fetchAllAgentsFull();
        return JSON.stringify({ error: `Agent "${identifier}" not found. Available agents: ${allAgents.map((a) => a.name || a.id).join(', ')}` });
      }
      const agent = await window.electronAPI.agent.get(resolvedId);
      return JSON.stringify({ agent });
    },
    getRecentOutput: async (params: Record<string, unknown>) => {
      const identifier = (params.agentId || params.name || params.agentName || '') as string;
      if (!identifier) return JSON.stringify({ error: 'No agent identifier provided' });
      const resolvedId = await resolveAgentId(identifier);
      if (!resolvedId) {
        const allAgents = await fetchAllAgentsFull();
        return JSON.stringify({ error: `Agent "${identifier}" not found. Available agents: ${allAgents.map((a) => a.name || a.id).join(', ')}` });
      }
      const agent = await window.electronAPI.agent.get(resolvedId);
      const lines = (params.lines as number) || 50;
      return JSON.stringify(agent?.output?.slice(-lines) || []);
    },
  }).current;

  const runningCount = agents.filter((a) => a.status === 'running').length;
  const activeAgentCount = agents.filter((a) => a.status === 'running' || a.status === 'waiting').length;

  // Not configured
  if (!hasConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)]">
        <div className="text-center max-w-md px-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-neutral-900 flex items-center justify-center">
            <Video className="w-10 h-10 text-neutral-500" />
          </div>
          <h2 className="text-xl font-semibold mb-3">NPC Avatar Not Configured</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Set up your ElevenLabs and Simli API keys to enable the live video NPC assistant.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm rounded-full"
          >
            <Settings className="w-4 h-4" />
            Open Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] gap-0 overflow-hidden">
      {/* ═══════ LEFT: Video Area ═══════ */}
      <div className="flex-1 relative bg-neutral-950 rounded-l-xl overflow-hidden min-w-0">
        {/* SimliElevenlabs renders absolutely inside this container */}
        <SimliElevenlabs
          simliApiKey={appSettings.simliApiKey}
          simliFaceId={appSettings.simliFaceId}
          onTranscriptUpdate={handleTranscriptUpdate}
          onInterimTranscript={setInterimText}
          onStatusChange={setStatus}
          isActive={isActive}
          onStart={handleStart}
          onStop={handleStop}
          getSignedUrl={getSignedUrl}
          sendContextualUpdateRef={sendContextualUpdateRef}
          sendTextMessageRef={sendTextMessageRef}
          clientTools={clientTools}
        />

        {/* Top-left: Live badge */}
        {isActive && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-white/90 text-xs font-medium tracking-wide">LIVE</span>
            </div>
          </div>
        )}

        {/* Top-right: Agent count */}
        {isActive && agents.length > 0 && (
          <div className="absolute top-4 right-4 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <Bot className="w-3.5 h-3.5 text-white/60" />
              <span className="text-white/80 text-xs">
                {activeAgentCount > 0 ? `${runningCount} running` : `${agents.length} idle`}
              </span>
            </div>
          </div>
        )}

        {/* Bottom center: End call button */}
        {isActive && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
            <button
              onClick={handleStop}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30"
              title="End call"
            >
              <svg className="w-6 h-6 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ═══════ RIGHT: Chat Panel ═══════ */}
      <div className="w-96 shrink-0 bg-neutral-900 border-l border-white/5 flex flex-col rounded-r-xl overflow-hidden">
        {/* Chat header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white/90 text-sm font-medium">Dorothy NPC</h3>
              <p className="text-xs text-white/40">
                {status === 'connected' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    Online
                  </span>
                ) : status === 'connecting' ? (
                  'Connecting...'
                ) : (
                  'Offline'
                )}
              </p>
            </div>
          </div>
          {isActive && (
            <div className="flex items-center gap-1">
              <Mic className="w-4 h-4 text-green-400/60" />
            </div>
          )}
        </div>

        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {!isActive && transcript.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-white/30 text-sm mb-1">No messages yet</p>
              <p className="text-white/15 text-xs">Start a call to begin chatting</p>
            </div>
          ) : (
            <NPCTranscript entries={transcript} interimText={interimText} dark />
          )}
        </div>

        {/* Chat input area */}
        <div className="p-3 border-t border-white/5">
          <form onSubmit={handleSendText} className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText(e);
                  }
                }}
                placeholder={isActive ? 'Type a message...' : 'Start a call to chat'}
                disabled={!isActive}
                rows={1}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed resize-none leading-5 max-h-[120px]"
              />
            </div>
            <button
              type="submit"
              disabled={!isActive || !textInput.trim()}
              className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-400 disabled:bg-white/5 disabled:text-white/15 text-white flex items-center justify-center transition-all shrink-0 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Agent Context Provider (invisible) */}
      <AgentContextProvider
        isActive={isActive}
        sendContextualUpdateRef={sendContextualUpdateRef}
      />
    </div>
  );
}
