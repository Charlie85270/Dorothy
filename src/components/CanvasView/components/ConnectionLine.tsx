'use client';

import { motion } from 'framer-motion';

interface ConnectionLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  isActive?: boolean;
}

export function ConnectionLine({ from, to, isActive }: ConnectionLineProps) {
  const midY = (from.y + to.y) / 2;
  const path = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 1 }}>
      <defs>
        <linearGradient id={`gradient-${from.x.toFixed(0)}-${to.x.toFixed(0)}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isActive ? '#3D9B94' : '#3f3f46'} />
          <stop offset="100%" stopColor={isActive ? '#a78bfa' : '#27272a'} />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#gradient-${from.x.toFixed(0)}-${to.x.toFixed(0)})`}
        strokeWidth={isActive ? 2.5 : 1.5}
        strokeDasharray={isActive ? '0' : '6,4'}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: isActive ? 1 : 0.5 }}
        transition={{ duration: 0.8 }}
      />
      {isActive && (
        <>
          <circle r="3" fill="#3D9B94">
            <animateMotion dur="2s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="6" fill="#3D9B94" opacity="0.3">
            <animateMotion dur="2s" repeatCount="indefinite" path={path} />
          </circle>
        </>
      )}
    </svg>
  );
}
