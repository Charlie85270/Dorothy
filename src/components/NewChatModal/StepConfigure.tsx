import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Check,
  Zap,
  GitBranch,
  GitFork,
  Layers,
  Cloud,
  Cpu,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { AgentPersonaValues } from './types';
import type { AgentProvider } from '@/types/electron';
import AgentPersonaEditor from './AgentPersonaEditor';
import OrchestratorModeToggle from './OrchestratorModeToggle';

interface TasmaniaModel {
  name: string;
  filename: string;
  path: string;
  sizeBytes: number;
  repo: string | null;
  quantization: string | null;
  parameters: string | null;
  architecture: string | null;
}

interface StepConfigureProps {
  projectPath: string;
  selectedSkills: string[];
  selectedSecondaryProject: string;
  customSecondaryPath: string;
  model: 'sonnet' | 'opus' | 'haiku';
  onModelChange: (model: 'sonnet' | 'opus' | 'haiku') => void;
  useWorktree: boolean;
  onToggleWorktree: () => void;
  branchName: string;
  onBranchNameChange: (name: string) => void;
  skipPermissions: boolean;
  onToggleSkipPermissions: () => void;
  isOrchestrator: boolean;
  onOrchestratorToggle: (enabled: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  agentPersonaRef: React.MutableRefObject<AgentPersonaValues>;
  provider: AgentProvider;
  onProviderChange: (provider: AgentProvider) => void;
  localModel: string;
  onLocalModelChange: (model: string) => void;
  tasmaniaEnabled: boolean;
}

const StepConfigure = React.memo(function StepConfigure({
  projectPath,
  selectedSkills,
  selectedSecondaryProject,
  customSecondaryPath,
  model,
  onModelChange,
  useWorktree,
  onToggleWorktree,
  branchName,
  onBranchNameChange,
  skipPermissions,
  onToggleSkipPermissions,
  isOrchestrator,
  onOrchestratorToggle,
  prompt,
  onPromptChange,
  agentPersonaRef,
  provider,
  onProviderChange,
  localModel,
  onLocalModelChange,
  tasmaniaEnabled,
}: StepConfigureProps) {
  // Tasmania state for local provider
  const [tasmaniaStatus, setTasmaniaStatus] = useState<{
    status: string; modelName: string | null; endpoint: string | null;
  } | null>(null);
  const [tasmaniaModels, setTasmaniaModels] = useState<TasmaniaModel[]>([]);
  const [loadingTasmania, setLoadingTasmania] = useState(false);

  // Fetch Tasmania status when switching to local provider
  useEffect(() => {
    if (provider !== 'local' || !tasmaniaEnabled) return;
    let cancelled = false;
    setLoadingTasmania(true);

    Promise.all([
      window.electronAPI?.tasmania?.getStatus(),
      window.electronAPI?.tasmania?.getModels(),
    ]).then(([status, modelsResult]) => {
      if (cancelled) return;
      if (status) setTasmaniaStatus(status);
      if (modelsResult?.models) {
        setTasmaniaModels(modelsResult.models);
        // Auto-select loaded model if none selected
        if (!localModel && status?.modelName) {
          onLocalModelChange(status.modelName);
        }
      }
    }).finally(() => {
      if (!cancelled) setLoadingTasmania(false);
    });

    return () => { cancelled = true; };
  }, [provider, tasmaniaEnabled]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
          <Play className="w-5 h-5 text-accent-green" />
          Start Your Agent
        </h3>
        <p className="text-text-secondary text-sm">
          Enter your task and choose the model
        </p>
      </div>

      {/* Summary */}
      <div className="p-4 rounded-none bg-bg-tertiary/50 border border-border-primary space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Project:</span>
          <span className="font-mono text-sm truncate max-w-xs">{projectPath}</span>
        </div>
        {(selectedSecondaryProject || customSecondaryPath) && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Secondary:
            </span>
            <span className="font-mono text-sm truncate max-w-xs text-accent-purple">
              {(selectedSecondaryProject || customSecondaryPath).split('/').pop()}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Skills:</span>
          <span className="text-sm">
            {selectedSkills.length > 0 ? `${selectedSkills.length} selected` : 'None'}
          </span>
        </div>
        {useWorktree && branchName && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" />
              Branch:
            </span>
            <span className="text-sm font-mono text-accent-purple">{branchName}</span>
          </div>
        )}
      </div>

      {/* Agent Character & Name */}
      <AgentPersonaEditor
        projectPath={projectPath}
        onChange={(v) => { agentPersonaRef.current = v; }}
        initialCharacter={agentPersonaRef.current.character}
      />

      {/* Provider Toggle — only shown when Tasmania is enabled */}
      {tasmaniaEnabled && (
        <div>
          <label className="block text-sm font-medium mb-2">Provider</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onProviderChange('claude')}
              className={`
                p-3 rounded-none border transition-all text-center flex items-center justify-center gap-2
                ${provider === 'claude'
                  ? 'border-accent-blue bg-accent-blue/10'
                  : 'border-border-primary hover:border-border-accent'
                }
              `}
            >
              <Cloud className={`w-4 h-4 ${provider === 'claude' ? 'text-accent-blue' : 'text-text-muted'}`} />
              <span className="font-medium">Claude Code</span>
            </button>
            <button
              onClick={() => onProviderChange('local')}
              className={`
                p-3 rounded-none border transition-all text-center flex items-center justify-center gap-2
                ${provider === 'local'
                  ? 'border-accent-green bg-accent-green/10'
                  : 'border-border-primary hover:border-border-accent'
                }
              `}
            >
              <Cpu className={`w-4 h-4 ${provider === 'local' ? 'text-accent-green' : 'text-text-muted'}`} />
              <span className="font-medium">Local LLM</span>
            </button>
          </div>
        </div>
      )}

      {/* Model Selection — Claude models or Tasmania models */}
      {provider === 'claude' ? (
        <div>
          <label className="block text-sm font-medium mb-2">Model</label>
          <div className="grid grid-cols-3 gap-3">
            {(['sonnet', 'opus', 'haiku'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onModelChange(m)}
                className={`
                  p-3 rounded-none border transition-all text-center
                  ${model === m
                    ? 'border-accent-blue bg-accent-blue/10'
                    : 'border-border-primary hover:border-border-accent'
                  }
                `}
              >
                <Zap className={`w-5 h-5 mx-auto mb-1 ${model === m ? 'text-accent-blue' : 'text-text-muted'}`} />
                <span className="font-medium capitalize">{m}</span>
                <p className="text-xs text-text-muted mt-0.5">
                  {m === 'opus' ? 'Most capable' : m === 'sonnet' ? 'Balanced' : 'Fastest'}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-2">Local Model</label>
          {loadingTasmania ? (
            <div className="p-4 border border-border-primary rounded-none flex items-center gap-2 text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Connecting to Tasmania...</span>
            </div>
          ) : tasmaniaStatus?.status !== 'running' ? (
            <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-none">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-500">Tasmania not running</p>
                  <p className="text-xs text-text-muted mt-1">
                    Start Tasmania and load a model first. Go to Settings &gt; Tasmania to configure.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Currently loaded model */}
              {tasmaniaStatus.modelName && (
                <div className="p-3 border border-accent-green/30 bg-accent-green/5 rounded-none">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                    <span className="text-sm font-medium">{tasmaniaStatus.modelName}</span>
                    <span className="text-xs text-text-muted ml-auto">loaded</span>
                  </div>
                </div>
              )}

              {/* Available models dropdown */}
              {tasmaniaModels.length > 0 && (
                <div>
                  <select
                    value={localModel}
                    onChange={(e) => onLocalModelChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-none text-sm bg-bg-primary border border-border-primary focus:border-accent-green focus:outline-none"
                  >
                    {tasmaniaModels.map((m) => (
                      <option key={m.path} value={m.name}>
                        {m.name}{m.quantization ? ` (${m.quantization})` : ''}{m.parameters ? ` - ${m.parameters}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-muted mt-1.5">
                    Select the model to use. The currently loaded model will be used if available.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Git Worktree Option */}
      <div className="p-4 rounded-none border border-border-primary bg-bg-tertiary/30">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggleWorktree}
            className={`
              mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
              ${useWorktree
                ? 'bg-accent-purple border-accent-purple'
                : 'border-border-primary hover:border-accent-purple'
              }
            `}
          >
            {useWorktree && <Check className="w-3 h-3 text-white" />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-accent-purple" />
              <span className="font-medium text-sm">Use Git Worktree</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Create an isolated branch for this agent. Perfect for running multiple agents on the same project without conflicts.
            </p>

            <AnimatePresence>
              {useWorktree && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-border-primary">
                    <label className="block text-xs font-medium mb-2 flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-accent-blue" />
                      Branch Name
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => onBranchNameChange(e.target.value.replace(/\s+/g, '-'))}
                      placeholder="feature/my-task"
                      className="w-full px-3 py-2 rounded-none text-sm font-mono bg-bg-primary border border-border-primary focus:border-accent-blue focus:outline-none"
                    />
                    <p className="text-xs text-text-muted mt-1.5">
                      The agent will work in a separate worktree on this branch
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Skip Permissions Option */}
      <div className="p-4 rounded-none border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggleSkipPermissions}
            className={`
              mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
              ${skipPermissions
                ? 'bg-amber-500 border-amber-500'
                : 'border-amber-500/50 hover:border-amber-500'
              }
            `}
          >
            {skipPermissions && <Check className="w-3 h-3 text-white" />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-sm">Skip Permission Prompts</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Run without asking for permission on each action. Use with caution - the agent will have full autonomy.
            </p>
          </div>
        </div>
      </div>

      {/* Orchestrator Mode */}
      <OrchestratorModeToggle
        isOrchestrator={isOrchestrator}
        onToggle={onOrchestratorToggle}
      />

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Task / Prompt {selectedSkills.length > 0 && <span className="text-text-muted font-normal">(optional with skills)</span>}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={selectedSkills.length > 0
            ? "Optional: Add specific instructions or leave empty to use skills"
            : "What would you like Claude to help you with?"
          }
          rows={4}
          className="w-full px-4 py-3 rounded-none text-sm resize-none"
        />
        {selectedSkills.length > 0 && !prompt && (
          <p className="text-xs text-accent-purple mt-2">
            Agent will start with selected skills: {selectedSkills.slice(0, 3).join(', ')}{selectedSkills.length > 3 ? ` +${selectedSkills.length - 3} more` : ''}
          </p>
        )}
      </div>
    </div>
  );
});

export default StepConfigure;
