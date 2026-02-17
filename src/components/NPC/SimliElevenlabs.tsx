'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SimliClient } from 'simli-client';

// ElevenLabs WebSocket event types
interface ElevenLabsAudioEvent {
  audio_base_64: string;
  event_id: number;
  alignment?: {
    chars: string[];
    char_durations_ms: number[];
    char_start_times_ms: number[];
  };
}

interface ElevenLabsMessage {
  type: string;
  audio_event?: ElevenLabsAudioEvent;
  user_transcription_event?: { user_transcript: string; is_final?: boolean };
  agent_response_event?: { agent_response: string };
  ping_event?: { event_id: number };
  conversation_initiation_metadata_event?: {
    conversation_id: string;
  };
}

export interface TranscriptEntry {
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

interface SimliElevenlabsProps {
  simliApiKey: string;
  simliFaceId: string;
  onTranscriptUpdate?: (entry: TranscriptEntry) => void;
  onInterimTranscript?: (text: string) => void;
  onStatusChange?: (status: 'idle' | 'connecting' | 'connected' | 'error') => void;
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  getSignedUrl: () => Promise<string>;
  sendContextualUpdateRef?: React.MutableRefObject<((text: string) => void) | null>;
  sendTextMessageRef?: React.MutableRefObject<((text: string) => void) | null>;
  clientTools?: Record<string, (params: Record<string, unknown>) => Promise<string>>;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function float32ToBase64PCM(float32Array: Float32Array): string {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function SimliElevenlabs({
  simliApiKey,
  simliFaceId,
  onTranscriptUpdate,
  onInterimTranscript,
  onStatusChange,
  isActive,
  onStart,
  onStop,
  getSignedUrl,
  sendContextualUpdateRef,
  sendTextMessageRef,
  clientTools,
}: SimliElevenlabsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliClientRef = useRef<SimliClient | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const sendContextualUpdate = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'contextual_update', text }));
    }
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'user_message', text }));
      onTranscriptUpdate?.({ role: 'user', text, timestamp: new Date().toISOString() });
    }
  }, [onTranscriptUpdate]);

  useEffect(() => {
    if (sendContextualUpdateRef) sendContextualUpdateRef.current = sendContextualUpdate;
    return () => { if (sendContextualUpdateRef) sendContextualUpdateRef.current = null; };
  }, [sendContextualUpdate, sendContextualUpdateRef]);

  useEffect(() => {
    if (sendTextMessageRef) sendTextMessageRef.current = sendTextMessage;
    return () => { if (sendTextMessageRef) sendTextMessageRef.current = null; };
  }, [sendTextMessage, sendTextMessageRef]);

  const initSimliClient = useCallback(() => {
    if (!videoRef.current || !audioRef.current) return null;
    const client = new SimliClient();
    client.Initialize({
      apiKey: simliApiKey, faceID: simliFaceId, handleSilence: true,
      maxSessionLength: 3600, maxIdleTime: 600,
      videoRef: videoRef.current, audioRef: audioRef.current,
      session_token: '', SimliURL: '', maxRetryAttempts: 100,
      retryDelay_ms: 2000, videoReceivedTimeout: 15000, enableSFU: true, model: '',
    });
    return client;
  }, [simliApiKey, simliFaceId]);

  const setupVoiceStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;
    source.connect(processor);
    processor.connect(audioContext.destination);
    return { processor, audioContext };
  }, []);

  const connectToElevenLabs = useCallback(async (signedUrl: string) => {
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error('WebSocket connection failed'));
      ws.onclose = () => { if (isActive) onStatusChange?.('idle'); };

      ws.onmessage = (event) => {
        try {
          const message: ElevenLabsMessage = JSON.parse(event.data);
          switch (message.type) {
            case 'ping':
              if (message.ping_event) {
                ws.send(JSON.stringify({ type: 'pong', event_id: message.ping_event.event_id }));
              }
              break;
            case 'audio':
              if (message.audio_event?.audio_base_64) {
                simliClientRef.current?.sendAudioData(base64ToUint8Array(message.audio_event.audio_base_64));
              }
              break;
            case 'user_transcript':
              if (message.user_transcription_event?.user_transcript) {
                const text = message.user_transcription_event.user_transcript;
                if (message.user_transcription_event.is_final === false) {
                  onInterimTranscript?.(text);
                } else {
                  onInterimTranscript?.('');
                  onTranscriptUpdate?.({ role: 'user', text, timestamp: new Date().toISOString() });
                }
              }
              break;
            case 'agent_response':
              if (message.agent_response_event?.agent_response) {
                onTranscriptUpdate?.({
                  role: 'agent', text: message.agent_response_event.agent_response,
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            case 'client_tool_call': {
              // ElevenLabs sends tool_call_id, tool_name, parameters at the top level
              // OR nested under client_tool_call -- handle both formats
              const raw = message as unknown as Record<string, unknown>;
              const nested = raw.client_tool_call as Record<string, unknown> | undefined;
              const toolCallId = (nested?.tool_call_id ?? raw.tool_call_id) as string | undefined;
              const toolName = (nested?.tool_name ?? raw.tool_name) as string | undefined;
              let toolParams = (nested?.parameters ?? raw.parameters) as Record<string, unknown> | string | undefined;

              // Parameters can come as a JSON string
              if (typeof toolParams === 'string') {
                try { toolParams = JSON.parse(toolParams); } catch { toolParams = {}; }
              }

              if (toolCallId && toolName && clientTools) {
                const toolFn = clientTools[toolName];
                if (toolFn) {
                  console.log('[NPC] Tool call:', toolName, toolParams);
                  toolFn((toolParams as Record<string, unknown>) || {})
                    .then((result) => {
                      console.log('[NPC] Tool result:', toolName, result.slice(0, 200));
                      ws.send(JSON.stringify({ type: 'client_tool_result', tool_call_id: toolCallId, result, is_error: false }));
                    })
                    .catch((err) => {
                      console.error('[NPC] Tool error:', toolName, err);
                      ws.send(JSON.stringify({ type: 'client_tool_result', tool_call_id: toolCallId, result: String(err), is_error: true }));
                    });
                } else {
                  console.warn('[NPC] Unknown tool:', toolName);
                  ws.send(JSON.stringify({ type: 'client_tool_result', tool_call_id: toolCallId, result: `Unknown tool: ${toolName}`, is_error: true }));
                }
              }
              break;
            }
          }
        } catch { /* ignore */ }
      };
    });
  }, [isActive, onStatusChange, onTranscriptUpdate, onInterimTranscript, clientTools]);

  const handleStart = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    onStatusChange?.('connecting');
    try {
      const signedUrl = await getSignedUrl();
      const simliClient = initSimliClient();
      if (!simliClient) throw new Error('Failed to initialize avatar');
      simliClientRef.current = simliClient;
      await simliClient.start();
      const ws = await connectToElevenLabs(signedUrl);
      const { processor } = await setupVoiceStream();
      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          let maxAmp = 0;
          for (let i = 0; i < inputData.length; i++) {
            const abs = Math.abs(inputData[i]);
            if (abs > maxAmp) maxAmp = abs;
          }
          if (maxAmp > 0.01) {
            ws.send(JSON.stringify({ user_audio_chunk: float32ToBase64PCM(inputData) }));
          }
        }
      };
      setIsLoading(false);
      onStatusChange?.('connected');
      onStart();
    } catch (err) {
      setError(String(err));
      setIsLoading(false);
      onStatusChange?.('error');
    }
  }, [getSignedUrl, initSimliClient, connectToElevenLabs, setupVoiceStream, onStart, onStatusChange]);

  const handleStop = useCallback(() => {
    // 1. Stop mic input immediately
    if (processorRef.current) { processorRef.current.onaudioprocess = null; processorRef.current.disconnect(); processorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }

    // 2. Clear Simli audio buffer and close (stops any ongoing speech)
    if (simliClientRef.current) {
      try { simliClientRef.current.ClearBuffer(); } catch {}
      simliClientRef.current.close();
      simliClientRef.current = null;
    }

    // 3. Close ElevenLabs WebSocket
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    // 4. Mute any lingering audio/video elements
    if (videoRef.current) { videoRef.current.srcObject = null; }
    if (audioRef.current) { audioRef.current.srcObject = null; }

    onStatusChange?.('idle');
    onStop();
  }, [onStop, onStatusChange]);

  useEffect(() => {
    return () => {
      if (processorRef.current) { processorRef.current.onaudioprocess = null; processorRef.current.disconnect(); }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (simliClientRef.current) { try { simliClientRef.current.ClearBuffer(); } catch {} simliClientRef.current.close(); }
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <>
      {/* Full-bleed video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isActive ? 'block' : 'none' }}
      />
      <audio ref={audioRef} autoPlay />

      {/* Pre-call state */}
      {!isActive && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-900 to-neutral-950">
          <div className="w-32 h-32 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center mb-8">
            <svg className="w-14 h-14 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-white/90 text-xl font-medium mb-2">Dorothy NPC</h2>
          <p className="text-white/40 text-sm mb-8 max-w-xs text-center">
            Your AI companion that monitors agents and talks to you in real time
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-green-500 hover:bg-green-400 text-white rounded-full font-medium text-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2.5 shadow-lg shadow-green-500/25"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.657 14.828a2 2 0 010-2.828l1.414-1.414a2 2 0 012.828 0l.708.708a2 2 0 010 2.828l-1.414 1.414a2 2 0 01-2.828 0l-.708-.708zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
            </svg>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Start Call
          </button>
        </div>
      )}

      {/* Connecting state */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-900 to-neutral-950">
          <div className="w-32 h-32 rounded-full bg-white/5 border-2 border-green-500/30 flex items-center justify-center mb-8 animate-pulse">
            <div className="w-12 h-12 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-white/60 text-sm">Connecting...</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/90 text-white text-sm rounded-lg shadow-lg max-w-sm text-center backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* In-call bottom controls */}
      {isActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
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
    </>
  );
}
