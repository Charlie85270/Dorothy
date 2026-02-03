'use client';

import { Bot } from 'lucide-react';

interface EmptyAgentStateProps {
  onCreateAgent: () => void;
}

export function EmptyAgentState({ onCreateAgent }: EmptyAgentStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Bot className="w-16 h-16 mx-auto text-text-muted/30 mb-4" />
        <h3 className="font-medium text-lg mb-2">Select an Agent</h3>
        <p className="text-text-secondary text-sm mb-4">
          Choose an agent from the list or create a new one
        </p>
        <button
          onClick={onCreateAgent}
          className="text-accent-blue hover:underline"
        >
          Create new agent
        </button>
      </div>
    </div>
  );
}
