import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Check,
  Zap,
  GitBranch,
  GitFork,
  Layers,
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

/** Model definition from provider */
interface ProviderModel {
  id: string;
  name: string;
  description: string;
}

/** Static model definitions per provider */
const PROVIDER_MODELS: Record<string, ProviderModel[]> = {
  claude: [
    { id: 'sonnet', name: 'Sonnet', description: 'Balanced' },
    { id: 'opus', name: 'Opus', description: 'Most capable' },
    { id: 'haiku', name: 'Haiku', description: 'Fastest' },
  ],
  codex: [
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', description: 'Recommended' },
    { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', description: 'Balanced' },
    { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Previous gen' },
    { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', description: 'Fast & efficient' },
  ],
  gemini: [
    { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Most capable' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: 'Fast & capable' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Stable' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced' },
  ],
};

/** Default model per provider */
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  claude: 'sonnet',
  codex: 'gpt-5.2-codex',
  gemini: 'gemini-3-flash',
};

interface StepConfigureProps {
  projectPath: string;
  selectedSkills: string[];
  selectedSecondaryProject: string;
  customSecondaryPath: string;
  model: string;
  onModelChange: (model: string) => void;
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
  installedProviders?: Record<string, boolean>;
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
  installedProviders,
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

      {/* Provider Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Provider</label>
        <div className={`grid gap-3 ${tasmaniaEnabled ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {([
            { id: 'claude' as const, label: 'Claude', icon: '/claude-ai-icon.webp', accent: 'accent-blue' },
            { id: 'codex' as const, label: 'Codex', icon: '/chatgpt-icon.webp', accent: 'accent-green' },
            { id: 'gemini' as const, label: 'Gemini', icon: 'gemini-svg', accent: 'accent-purple' },
          ] as const).map(({ id, label, icon, accent }) => {
            const installed = installedProviders?.[id] !== false;
            return (
              <button
                key={id}
                disabled={!installed}
                onClick={() => {
                  if (!installed) return;
                  onProviderChange(id);
                  onModelChange(PROVIDER_DEFAULT_MODEL[id]);
                }}
                className={`
                  p-3 rounded-none border transition-all text-center flex flex-col items-center justify-center gap-1
                  ${!installed
                    ? 'opacity-40 cursor-not-allowed border-border-primary'
                    : provider === id
                      ? `border-${accent} bg-${accent}/10`
                      : 'border-border-primary hover:border-border-accent'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {icon === 'gemini-svg' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-black">
                      <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12Z" />
                    </svg>
                  ) : (
                    <img src={icon} alt={label} className="w-4 h-4 object-contain" />
                  )}
                  <span className="font-medium text-sm">{label}</span>
                </div>
                {!installed && (
                  <span className="text-[10px] text-text-muted">Not installed</span>
                )}
              </button>
            );
          })}
          {tasmaniaEnabled && (
            <button
              onClick={() => onProviderChange('local')}
              className={`
                p-3 rounded-none border transition-all text-center flex items-center justify-center gap-2
                ${provider === 'local'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-border-primary hover:border-border-accent'
                }
              `}
            >
              <Cpu className={`w-4 h-4 ${provider === 'local' ? 'text-amber-500' : 'text-text-muted'}`} />
              <span className="font-medium text-sm">Local</span>
            </button>
          )}
        </div>
      </div>

      {/* Model Selection — dynamic based on provider */}
      {provider !== 'local' ? (
        <div>
          <label className="block text-sm font-medium mb-2">Model</label>
          <div className={`grid gap-3 ${(PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude).length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {(PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude).map((m) => {
              const accentColor = provider === 'codex' ? 'accent-green' : provider === 'gemini' ? 'accent-purple' : 'accent-blue';
              return (
                <button
                  key={m.id}
                  onClick={() => onModelChange(m.id)}
                  className={`
                    p-3 rounded-none border transition-all text-center
                    ${model === m.id
                      ? `border-${accentColor} bg-${accentColor}/10`
                      : 'border-border-primary hover:border-border-accent'
                    }
                  `}
                >
                  <Zap className={`w-5 h-5 mx-auto mb-1 ${model === m.id ? `text-${accentColor}` : 'text-text-muted'}`} />
                  <span className="font-medium">{m.name}</span>
                  <p className="text-xs text-text-muted mt-0.5">{m.description}</p>
                </button>
              );
            })}
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
              {tasmaniaStatus.modelName && (
                <div className="p-3 border border-accent-green/30 bg-accent-green/5 rounded-none">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                    <span className="text-sm font-medium">{tasmaniaStatus.modelName}</span>
                    <span className="text-xs text-text-muted ml-auto">loaded</span>
                  </div>
                </div>
              )}
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
