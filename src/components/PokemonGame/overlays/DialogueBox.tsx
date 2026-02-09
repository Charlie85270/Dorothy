'use client';
import { useEffect, useState, useRef } from 'react';

interface DialogueBoxProps {
  text: string;
  speakerName?: string;
  onAdvance: () => void;
}

export default function DialogueBox({ text, speakerName, onAdvance }: DialogueBoxProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [blink, setBlink] = useState(true);
  const indexRef = useRef(0);
  const textRef = useRef(text);

  // Reset when text changes
  useEffect(() => {
    textRef.current = text;
    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);
  }, [text]);

  // Typewriter effect
  useEffect(() => {
    if (isComplete) return;

    const interval = setInterval(() => {
      if (indexRef.current < textRef.current.length) {
        indexRef.current++;
        setDisplayedText(textRef.current.slice(0, indexRef.current));
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [text, isComplete]);

  // Blink cursor
  useEffect(() => {
    if (!isComplete) return;
    const interval = setInterval(() => setBlink(v => !v), 400);
    return () => clearInterval(interval);
  }, [isComplete]);

  // Handle input
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isComplete) {
          // Skip to end
          indexRef.current = textRef.current.length;
          setDisplayedText(textRef.current);
          setIsComplete(true);
        } else {
          onAdvance();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isComplete, onAdvance]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
      <div
        className="mx-auto max-w-2xl border-4 border-gray-800 rounded-lg bg-white p-4"
        style={{
          fontFamily: 'monospace',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
        }}
      >
        {speakerName && (
          <div className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
            {speakerName}
          </div>
        )}
        <p className="text-lg text-black leading-relaxed min-h-[3em]">
          {displayedText}
          {isComplete && (
            <span
              className="inline-block ml-1"
              style={{ opacity: blink ? 1 : 0 }}
            >
              ▼
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
