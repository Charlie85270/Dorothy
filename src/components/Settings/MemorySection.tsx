import { AlertCircle, Brain, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { Toggle } from './Toggle';
import type { ClaudeSettings } from './types';

interface MemorySectionProps {
  settings: ClaudeSettings | null;
  hasChanges: boolean;
  onToggleClaudeMem: () => void;
  onInstallClaudeMem: () => void;
}

export const MemorySection = ({ settings, hasChanges, onToggleClaudeMem, onInstallClaudeMem }: MemorySectionProps) => {
  const isClaudeMemInstalled = settings?.enabledPlugins?.['claude-mem@thedotmack'] === true;
  const isClaudeMemDisabled = settings?.enabledPlugins?.['claude-mem@thedotmack'] === false;
  const isClaudeMemKnown = 'claude-mem@thedotmack' in (settings?.enabledPlugins || {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Memory</h2>
        <p className="text-sm text-muted-foreground">Persistent memory for Claude Code agents</p>
      </div>

      {/* Restart Notice */}
      {hasChanges && isClaudeMemKnown && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Restart Required</p>
              <p className="text-yellow-400/80">
                Save changes and restart Claude Manager and all running Claude Code instances for this change to take effect.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 flex items-center justify-center shrink-0 ${isClaudeMemInstalled ? 'bg-green-500/20' : isClaudeMemDisabled ? 'bg-red-500/20' : 'bg-secondary'}`}>
            <Brain className={`w-6 h-6 ${isClaudeMemInstalled ? 'text-green-400' : isClaudeMemDisabled ? 'text-red-400' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h3 className="font-medium">Claude-Mem</h3>
                {isClaudeMemInstalled ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Enabled
                  </span>
                ) : isClaudeMemDisabled ? (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium">
                    Disabled
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs font-medium">
                    Not Installed
                  </span>
                )}
              </div>
              {isClaudeMemKnown && (
                <Toggle
                  enabled={isClaudeMemInstalled}
                  onChange={onToggleClaudeMem}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Claude-Mem seamlessly preserves context across sessions by automatically capturing tool usage observations,
              generating semantic summaries, and making them available to future sessions. This enables Claude to maintain
              continuity of knowledge about projects even after sessions end or reconnect.
            </p>
          </div>
        </div>

        {!isClaudeMemKnown && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="bg-secondary/50 border border-border p-4 mb-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="mb-3">Click the button below to open Claude Code and install the memory plugin. This will run:</p>
                  <div className="space-y-1.5">
                    <code className="block bg-black/50 px-3 py-1.5 font-mono text-xs text-foreground">
                      /plugin marketplace add thedotmack/claude-mem
                    </code>
                    <code className="block bg-black/50 px-3 py-1.5 font-mono text-xs text-foreground">
                      /plugin install claude-mem
                    </code>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onInstallClaudeMem}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-white/90 transition-colors text-sm font-medium"
              >
                <Brain className="w-4 h-4" />
                Activate Memory
              </button>
              <a
                href="https://github.com/thedotmack/claude-mem"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm"
              >
                Learn More
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {isClaudeMemKnown && (
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-sm font-medium mb-3">How It Works</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                <span>Automatically captures observations when Claude uses tools</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                <span>Generates semantic summaries at the end of each session</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                <span>Injects relevant context at the start of new sessions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isClaudeMemInstalled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                <span>Stores memories locally in ~/.claude-mem</span>
              </li>
            </ul>
            <a
              href="https://github.com/thedotmack/claude-mem"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Learn More
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Requirements Tip */}
      <div className="border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">Requirement: uv package manager</p>
            <p className="text-muted-foreground mb-3">
              The memory plugin requires <code className="text-foreground bg-secondary px-1.5 py-0.5 font-mono text-xs">uv</code> to be installed for running the Chroma vector database.
            </p>
            <div className="bg-secondary border border-border p-3">
              <p className="text-xs text-muted-foreground mb-2">Install with Homebrew:</p>
              <code className="block font-mono text-xs text-foreground">brew install uv</code>
              <p className="text-xs text-muted-foreground mt-3 mb-2">Or with curl:</p>
              <code className="block font-mono text-xs text-foreground">curl -LsSf https://astral.sh/uv/install.sh | sh</code>
            </div>

            {/* Troubleshooting */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="font-medium text-foreground mb-2">Troubleshooting: PATH error</p>
              <p className="text-muted-foreground mb-3">
                If you encounter <code className="text-foreground bg-secondary px-1.5 py-0.5 font-mono text-xs">uvx executable is not in the PM2 worker&apos;s PATH</code>, restart the worker with the correct PATH:
              </p>
              <div className="bg-secondary border border-border p-3 space-y-1">
                <code className="block font-mono text-xs text-foreground">cd ~/.claude/plugins/marketplaces/thedotmack</code>
                <code className="block font-mono text-xs text-foreground">npm run worker:stop</code>
                <code className="block font-mono text-xs text-foreground">PATH=&quot;$HOME/.local/bin:$PATH&quot; npm run worker:start</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
