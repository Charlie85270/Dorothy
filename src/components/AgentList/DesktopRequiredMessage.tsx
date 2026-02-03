'use client';

import { MonitorDown } from 'lucide-react';

export function DesktopRequiredMessage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-none bg-accent-purple/20 flex items-center justify-center mx-auto mb-6">
          <MonitorDown className="w-10 h-10 text-accent-purple" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Desktop App Required</h2>
        <p className="text-text-secondary mb-6">
          The Agent Control Center requires the desktop application to run terminal commands and manage Claude Code agents directly on your machine.
        </p>
        <div className="space-y-3">
          <div className="p-4 rounded-none bg-bg-tertiary border border-border-primary">
            <p className="text-sm font-medium mb-2">To run the desktop app:</p>
            <code className="block p-2 rounded bg-[#0d0e12] text-accent-blue text-xs font-mono">
              npm run electron:dev
            </code>
          </div>
          <p className="text-xs text-text-muted">
            Or build the Mac app with: <code className="text-accent-purple">npm run electron:build</code>
          </p>
        </div>
      </div>
    </div>
  );
}
