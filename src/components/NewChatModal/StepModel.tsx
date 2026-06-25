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
  grok: [
    { id: 'grok-composer-2.5-fast', name: 'Grok Composer 2.5 Fast', description: 'Recommended (default)' },
    { id: 'grok-build', name: 'Grok Build', description: 'Agentic coding' },
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
  grok: 'grok-composer-2.5-fast',
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
        <div className="grid gap-3 grid-cols-3">
          {([
            { id: 'claude' as const, label: 'Claude', icon: '/claude-ai-icon.webp', accent: 'accent-blue' },
            { id: 'codex' as const, label: 'Codex', icon: '/chatgpt-icon.webp', accent: 'accent-green' },
            { id: 'gemini' as const, label: 'Gemini', icon: 'gemini-svg', accent: 'accent-purple' },
            { id: 'grok' as const, label: 'Grok', icon: 'grok-svg', accent: 'foreground' },
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
                  ) : icon === 'grok-svg' ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 512 509.641"
                      fillRule="evenodd"
                      clipRule="evenodd"
                      className="w-4 h-4"
                    >
                      <path d="M115.612 0h280.776C459.975 0 512 52.026 512 115.612v278.416c0 63.587-52.025 115.613-115.612 115.613H115.612C52.026 509.641 0 457.615 0 394.028V115.612C0 52.026 52.026 0 115.612 0z" />
                      <path fill="#fff" d="M213.235 306.019l178.976-180.002v.169l51.695-51.763c-.924 1.32-1.86 2.605-2.785 3.89-39.281 54.164-58.46 80.649-43.07 146.922l-.09-.101c10.61 45.11-.744 95.137-37.398 131.836-46.216 46.306-120.167 56.611-181.063 14.928l42.462-19.675c38.863 15.278 81.392 8.57 111.947-22.03 30.566-30.6 37.432-75.159 22.065-112.252-2.92-7.025-11.67-8.795-17.792-4.263l-124.947 92.341zm-25.786 22.437l-.033.034L68.094 435.217c7.565-10.429 16.957-20.294 26.327-30.149 26.428-27.803 52.653-55.359 36.654-94.302-21.422-52.112-8.952-113.177 30.724-152.898 41.243-41.254 101.98-51.661 152.706-30.758 11.23 4.172 21.016 10.114 28.638 15.639l-42.359 19.584c-39.44-16.563-84.629-5.299-112.207 22.313-37.298 37.308-44.84 102.003-1.128 143.81z" />
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
              const accentColor = provider === 'codex' ? 'accent-green' : provider === 'gemini' ? 'accent-purple' : provider === 'grok' ? 'foreground' : provider === 'pi' ? 'cyan-500' : 'accent-blue';
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
