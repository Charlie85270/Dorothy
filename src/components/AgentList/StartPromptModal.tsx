'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';

interface StartPromptModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  value: string;
  onChange: (value: string) => void;
}

export function StartPromptModal({
  open,
  onClose,
  onSubmit,
  value,
  onChange,
}: StartPromptModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      onChange('');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-bg-secondary border border-border-primary rounded-none p-6 w-full max-w-lg mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-accent-green" />
              Start Agent Task
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              Enter the task you want the agent to perform:
            </p>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && value.trim()) {
                  handleSubmit();
                  onClose();
                }
                if (e.key === 'Escape') {
                  onClose();
                }
              }}
              placeholder="e.g., Fix the bug in login.tsx..."
              className="w-full px-4 py-3 bg-bg-primary border border-border-primary rounded-none text-sm focus:outline-none focus:border-accent-cyan mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSubmit();
                  onClose();
                }}
                disabled={!value.trim()}
                className="px-4 py-2 text-sm bg-accent-green/20 text-accent-green rounded-none hover:bg-accent-green/30 transition-colors disabled:opacity-50"
              >
                Start Agent
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
