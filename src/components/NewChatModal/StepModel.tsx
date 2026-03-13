import React, { useState, useEffect } from 'react';
import {
  Zap,
  Cpu,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { AgentPersonaValues } from './types';
import type { AgentProvider } from '@/types/electron';
import AgentPersonaEditor from './AgentPersonaEditor';

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
    { id: 'default', name: 'Default', description: 'Recommended' },
    { id: 'sonnet', name: 'Sonnet', description: 'Daily coding' },
    { id: 'opus', name: 'Opus', description: 'Complex reasoning' },
    { id: 'haiku', name: 'Haiku', description: 'Fast & efficient' },
    { id: 'sonnet[1m]', name: 'Sonnet 1M', description: '1M context window' },
    { id: 'opusplan', name: 'Opus Plan', description: 'Extended thinking' },
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
  opencode: [
    { id: 'default', name: 'Default', description: 'Use configured default' },
  ],
  pi: [
    { id: 'default', name: 'Default', description: 'Use configured model' },
    { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet', description: 'Anthropic' },
    { id: 'anthropic/claude-opus-4-20250514', name: 'Claude Opus', description: 'Anthropic' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Google' },
  ],
};

/** Default model per provider */
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  claude: 'default',
  codex: 'gpt-5.2-codex',
  gemini: 'gemini-3-flash',
  opencode: 'default',
  pi: 'default',
};

interface StepModelProps {
  provider: AgentProvider;
  onProviderChange: (provider: AgentProvider) => void;
  model: string;
  onModelChange: (model: string) => void;
  localModel: string;
  onLocalModelChange: (model: string) => void;
  tasmaniaEnabled: boolean;
  installedProviders?: Record<string, boolean>;
  agentPersonaRef: React.MutableRefObject<AgentPersonaValues>;
  projectPath: string;
}

const StepModel = React.memo(function StepModel({
  provider,
  onProviderChange,
  model,
  onModelChange,
  localModel,
  onLocalModelChange,
  tasmaniaEnabled,
  installedProviders,
  agentPersonaRef,
  projectPath,
}: StepModelProps) {
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
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-blue" />
          Choose Model
        </h3>
        <p className="text-text-secondary text-sm">
          Choose the AI provider and model for your agent
        </p>
      </div>

      {/* Provider Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Provider</label>
        <div className={`grid gap-3 ${tasmaniaEnabled ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {([
            { id: 'claude' as const, label: 'Claude', icon: '/claude-ai-icon.webp', accent: 'accent-blue' },
            { id: 'codex' as const, label: 'Codex', icon: '/chatgpt-icon.webp', accent: 'accent-green' },
            { id: 'gemini' as const, label: 'Gemini', icon: 'gemini-svg', accent: 'accent-purple' },
            { id: 'opencode' as const, label: 'OpenCode', icon: 'opencode-text', accent: 'accent-cyan' },
            { id: 'pi' as const, label: 'Pi', icon: 'pi-icon', accent: 'accent-cyan' },
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
                  p-3 rounded-lg border transition-all text-center flex flex-col items-center justify-center gap-1
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
                  ) : icon === 'opencode-text' ? (
                    <span className="text-cyan-500 font-bold text-xs">OC</span>
                  ) : icon === 'pi-icon' ? (
                    <Cpu className="w-4 h-4 text-cyan-500" />
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
                p-3 rounded-lg border transition-all text-center flex items-center justify-center gap-2
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
          <div className={`grid gap-3 ${(PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude).length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {(PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude).map((m) => {
              const accentColor = provider === 'codex' ? 'accent-green' : provider === 'gemini' ? 'accent-purple' : provider === 'pi' ? 'cyan-500' : 'accent-blue';
              return (
                <button
                  key={m.id}
                  onClick={() => onModelChange(m.id)}
                  className={`
                    p-3 rounded-lg border transition-all text-center
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
            <div className="p-4 border border-border-primary rounded-lg flex items-center gap-2 text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Connecting to Tasmania...</span>
            </div>
          ) : tasmaniaStatus?.status !== 'running' ? (
            <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg">
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
                <div className="p-3 border border-accent-green/30 bg-accent-green/5 rounded-lg">
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
                    className="w-full px-3 py-2 rounded-lg text-sm bg-bg-primary border border-border-primary focus:border-accent-green focus:outline-none"
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

      {/* Agent Persona */}
      <AgentPersonaEditor
        projectPath={projectPath}
        onChange={(v) => { agentPersonaRef.current = v; }}
        initialCharacter={agentPersonaRef.current.character}
        initialName={agentPersonaRef.current.name}
      />
    </div>
  );
});

export default StepModel;
