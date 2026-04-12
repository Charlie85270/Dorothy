import React, { useState, useEffect } from 'react';
import {
  Cpu,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { AgentPersonaValues } from './types';
import type { AgentProvider } from '@/types/electron';
import { PROVIDER_REGISTRY, type ProviderIconDef } from '@/lib/providers';
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

/** Model definitions per provider — derived from shared registry */
const PROVIDER_MODELS: Record<string, ProviderModel[]> = Object.fromEntries(
  PROVIDER_REGISTRY.map((p) => [p.id, p.models]),
);

/** Default model per provider — derived from shared registry */
const PROVIDER_DEFAULT_MODEL: Record<string, string> = Object.fromEntries(
  PROVIDER_REGISTRY.map((p) => [p.id, p.defaultModel]),
);

/** Render a typed provider icon */
function ProviderIcon({ icon, selected, accent }: { icon: ProviderIconDef; selected: boolean; accent: string }) {
  const colorClass = selected ? `text-${accent}` : 'text-text-muted';
  if (icon.type === 'svg-gemini') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-black">
        <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12Z" />
      </svg>
    );
  }
  if (icon.type === 'svg-openrouter') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M4 12h4l2-4 4 8 2-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colorClass} />
      </svg>
    );
  }
  if (icon.type === 'svg-deepseek') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${colorClass}`}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-2.09c-1.67-.44-3-1.7-3.5-3.41h2.09c.43 1.08 1.46 1.8 2.66 1.8 1.58 0 2.87-1.29 2.87-2.87S13.83 7.06 12.25 7.06c-1.2 0-2.23.72-2.66 1.8H7.5c.5-1.71 1.83-2.97 3.5-3.41V3.5h2v1.95c2.47.49 4.25 2.68 4.25 5.3 0 2.61-1.78 4.81-4.25 5.3v2.45h-2z" />
      </svg>
    );
  }
  if (icon.type === 'svg-moonshot') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${colorClass}`}>
        <path d="M12 2a9.94 9.94 0 0 0-6.38 2.31C8.07 3.47 11.18 4.64 13.5 7c2.37 2.37 3.53 5.49 2.69 7.93A9.94 9.94 0 0 0 22 12c0-5.52-4.48-10-10-10zM2 12c0 5.52 4.48 10 10 10a9.94 9.94 0 0 0 6.38-2.31c-2.45.84-5.56-.33-7.88-2.69C8.13 14.63 6.97 11.51 7.81 9.07A9.94 9.94 0 0 0 2 12z" />
      </svg>
    );
  }
  if (icon.type === 'svg-mimo') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${colorClass}`}>
        <path d="M3 6h4v12H3V6zm7 0h4v12h-4V6zm7 0h4v12h-4V6z" opacity="0.8" />
        <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H5z" />
      </svg>
    );
  }
  if (icon.type === 'svg-qwen') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${colorClass}`}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon.type === 'svg-zai') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${colorClass}`}>
        <path d="M4 6h16v2H7.5l10 8H4v-2h12.5l-10-8H4V6z" />
      </svg>
    );
  }
  if (icon.type === 'cpu') {
    return <Cpu className={`w-4 h-4 ${colorClass}`} />;
  }
  if (icon.type === 'text') {
    return <span className={`font-bold text-xs ${colorClass}`}>{icon.content}</span>;
  }
  // image
  return <img src={icon.src} alt="" className="w-4 h-4 object-contain" />;
}

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
        <div className="grid gap-2 grid-cols-4">
          {PROVIDER_REGISTRY.map(({ id, label, icon, accent, requiresCli }) => {
            const installed = installedProviders?.[id] !== false;
            const disabledReason = !installed
              ? requiresCli ? 'Not installed' : 'Add API key in Settings'
              : null;
            return (
              <button
                key={id}
                disabled={!installed}
                onClick={() => {
                  if (!installed) return;
                  onProviderChange(id);
                  onModelChange(PROVIDER_DEFAULT_MODEL[id]);
                }}
                title={disabledReason || undefined}
                className={`
                  p-2.5 rounded-lg border transition-all text-center flex flex-col items-center justify-center gap-1
                  ${!installed
                    ? 'opacity-40 cursor-not-allowed border-border-primary'
                    : provider === id
                      ? `border-${accent} bg-${accent}/10`
                      : 'border-border-primary hover:border-border-accent'
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  <ProviderIcon icon={icon} selected={provider === id} accent={accent} />
                  <span className="font-medium text-sm">{label}</span>
                </div>
                {disabledReason && (
                  <span className="text-[10px] text-text-muted">{disabledReason}</span>
                )}
              </button>
            );
          })}
          {tasmaniaEnabled && (
            <button
              onClick={() => onProviderChange('local')}
              className={`
                p-2.5 rounded-lg border transition-all text-center flex items-center justify-center gap-2
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

      {/* Model Selection — dynamic dropdown based on provider */}
      {provider !== 'local' ? (
        <div>
          <label className="block text-sm font-medium mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-bg-primary border border-border-primary focus:border-accent-blue focus:outline-none"
          >
            {(PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.description}
              </option>
            ))}
          </select>
          {model && (
            <p className="text-xs text-text-muted mt-1.5">
              {(PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude).find(m => m.id === model)?.description}
            </p>
          )}
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
