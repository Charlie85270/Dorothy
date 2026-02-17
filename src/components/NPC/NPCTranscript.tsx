'use client';

import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from './SimliElevenlabs';

interface NPCTranscriptProps {
  entries: TranscriptEntry[];
  interimText?: string;
  dark?: boolean;
}

export default function NPCTranscript({ entries, interimText, dark }: NPCTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, interimText]);

  if (entries.length === 0 && !interimText) {
    return (
      <div className={`flex-1 flex items-center justify-center text-sm ${dark ? 'text-white/30' : 'text-muted-foreground'}`}>
        Conversation will appear here
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1">
      {entries.map((entry, i) => (
        <div key={i} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] px-3 py-2 text-sm rounded-lg ${
              dark
                ? entry.role === 'user'
                  ? 'bg-white/10 text-white/90'
                  : 'bg-white/5 text-white/70'
                : entry.role === 'user'
                ? 'bg-primary/20 text-foreground'
                : 'bg-secondary text-foreground'
            }`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-medium ${dark ? 'text-white/40' : 'text-muted-foreground'}`}>
                {entry.role === 'user' ? 'You' : 'NPC'}
              </span>
              <span className={`text-[10px] ${dark ? 'text-white/20' : 'text-muted-foreground/60'}`}>
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="leading-relaxed">{entry.text}</p>
          </div>
        </div>
      ))}

      {interimText && (
        <div className="flex justify-end">
          <div className={`max-w-[85%] px-3 py-2 text-sm rounded-lg border border-dashed ${
            dark
              ? 'bg-white/5 text-white/50 border-white/10'
              : 'bg-primary/10 text-foreground/70 border-primary/20'
          }`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-medium ${dark ? 'text-white/40' : 'text-muted-foreground'}`}>You</span>
              <span className={`text-[10px] animate-pulse ${dark ? 'text-green-400/60' : 'text-primary/60'}`}>listening...</span>
            </div>
            <p className="italic leading-relaxed">{interimText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
