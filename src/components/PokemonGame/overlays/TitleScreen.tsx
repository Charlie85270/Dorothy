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
      <div className="mb-12">
        {titleImage ? (
          <img
            src={titleImage.src}
            alt="Pokemon"
            className="w-[400px] h-auto pixelated"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <h1 className="text-6xl font-bold text-yellow-400" style={{ fontFamily: 'monospace', textShadow: '4px 4px 0 #1a1a8a' }}>
            PALLET TOWN
          </h1>
        )}
      </div>

      {/* Subtitle */}
      <h2 className="text-2xl text-white mb-16 tracking-widest" style={{ fontFamily: 'monospace' }}>
        CLAUDE MANAGER
      </h2>

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
