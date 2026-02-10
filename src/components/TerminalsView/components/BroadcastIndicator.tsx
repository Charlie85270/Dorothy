'use client';

import { Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BroadcastIndicatorProps {
  active: boolean;
}

export default function BroadcastIndicator({ active }: BroadcastIndicatorProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm"
        >
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-medium text-cyan-400">
            Broadcast Mode Active — Input is sent to all terminals
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
