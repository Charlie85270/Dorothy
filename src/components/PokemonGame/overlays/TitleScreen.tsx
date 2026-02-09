'use client';
import { useEffect, useState } from 'react';

interface TitleScreenProps {
  titleImage: HTMLImageElement | null;
  onStart: () => void;
}

export default function TitleScreen({ titleImage, onStart }: TitleScreenProps) {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setBlink(v => !v), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-black z-30 cursor-pointer"
      onClick={onStart}
    >
      {/* Title Logo */}
      <div className="mb-16">
        <img
          src="/pokemon/claudemon.png"
          alt="Claudemon"
          className="w-[480px] max-w-[90vw] h-auto"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Press Start */}
      <p
        className="text-xl text-white tracking-wider"
        style={{
          fontFamily: 'monospace',
          opacity: blink ? 1 : 0.3,
          transition: 'opacity 0.2s',
        }}
      >
        PRESS ENTER TO START
      </p>

      {/* Version */}
      <p className="absolute bottom-8 text-sm text-gray-600" style={{ fontFamily: 'monospace' }}>
        v1.0.0
      </p>
    </div>
  );
}
