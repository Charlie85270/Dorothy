'use client';

import { useState } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface AIProvidersSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

interface ProviderCardProps {
  title: string;
  description: string;
  docsUrl: string;
  enabled: boolean;
  onToggle: () => void;
  apiKey: string;
  apiKeyPlaceholder: string;
  onApiKeyChange: (val: string) => void;
  onApiKeyBlur: () => void;
  badge?: string;
  badgeColor?: string;
  models: string[];
  routingNote?: string;
}

function ProviderCard({
  title, description, docsUrl, enabled, onToggle,
  apiKey, apiKeyPlaceholder, onApiKeyChange, onApiKeyBlur,
  badge, badgeColor = 'bg-zinc-700 text-zinc-300', models, routingNote,
}: ProviderCardProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium">{title}</span>
            {badge && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${badgeColor}`}>{badge}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Get API key"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <Toggle enabled={enabled} onChange={onToggle} />
        </div>
      </div>

      {/* API Key Input */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wide">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            onBlur={onApiKeyBlur}
            placeholder={apiKeyPlaceholder}
            className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Models */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Available Models</p>
        <div className="flex flex-wrap gap-1.5">
          {models.map((m) => (
            <code key={m} className="text-xs bg-secondary px-2 py-0.5 border border-border text-muted-foreground font-mono">
              {m}
            </code>
          ))}
        </div>
      </div>

      {/* Routing note */}
      {routingNote && (
        <p className="text-xs text-muted-foreground bg-secondary/50 border border-border px-3 py-2">
          {routingNote}
        </p>
      )}
    </div>
  );
}

export const AIProvidersSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: AIProvidersSectionProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">External AI Providers</h2>
        <p className="text-sm text-muted-foreground">
          Configure API keys to use models from other providers. All providers route through
          the Claude CLI using the <code className="bg-secondary px-1 text-xs">ANTHROPIC_BASE_URL</code> override.
        </p>
      </div>

      {/* OpenRouter */}
      <ProviderCard
        title="OpenRouter"
        description="Universal gateway — one API key to access 300+ models from all providers."
        docsUrl="https://openrouter.ai/keys"
        badge="Recommended"
        badgeColor="bg-green-700/20 text-green-400 border border-green-700/30"
        enabled={!!appSettings.openRouterEnabled}
        onToggle={() => onSaveAppSettings({ openRouterEnabled: !appSettings.openRouterEnabled })}
        apiKey={appSettings.openRouterApiKey || ''}
        apiKeyPlaceholder="sk-or-v1-..."
        onApiKeyChange={(v) => onUpdateLocalSettings({ openRouterApiKey: v })}
        onApiKeyBlur={() => onSaveAppSettings({ openRouterApiKey: appSettings.openRouterApiKey })}
        models={['deepseek/deepseek-r1', 'moonshotai/kimi-k2', 'xiaomi/mimo-v2-pro', 'qwen/qwq-32b', 'openai/gpt-4.1', 'google/gemini-2.5-pro', '300+ more…']}
        routingNote="Provider: openrouter — uses Claude CLI with ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1"
      />

      {/* DeepSeek */}
      <ProviderCard
        title="DeepSeek"
        description="DeepSeek R1 reasoning model and V3 flagship chat. Competitive pricing."
        docsUrl="https://platform.deepseek.com/api_keys"
        enabled={!!appSettings.deepSeekEnabled}
        onToggle={() => onSaveAppSettings({ deepSeekEnabled: !appSettings.deepSeekEnabled })}
        apiKey={appSettings.deepSeekApiKey || ''}
        apiKeyPlaceholder="sk-..."
        onApiKeyChange={(v) => onUpdateLocalSettings({ deepSeekApiKey: v })}
        onApiKeyBlur={() => onSaveAppSettings({ deepSeekApiKey: appSettings.deepSeekApiKey })}
        models={['deepseek/deepseek-r1', 'deepseek/deepseek-chat', 'deepseek/deepseek-r1-distill-llama-70b']}
        routingNote="Provider: deepseek — direct via https://api.deepseek.com/v1. Falls back to OpenRouter key if no DeepSeek key set."
      />

      {/* Moonshot / Kimi */}
      <ProviderCard
        title="MoonshotAI (Kimi)"
        description="Kimi K2 — long-context agentic model optimized for real-world tasks."
        docsUrl="https://platform.moonshot.cn/console/api-keys"
        enabled={!!appSettings.moonshotEnabled}
        onToggle={() => onSaveAppSettings({ moonshotEnabled: !appSettings.moonshotEnabled })}
        apiKey={appSettings.moonshotApiKey || ''}
        apiKeyPlaceholder="sk-..."
        onApiKeyChange={(v) => onUpdateLocalSettings({ moonshotApiKey: v })}
        onApiKeyBlur={() => onSaveAppSettings({ moonshotApiKey: appSettings.moonshotApiKey })}
        models={['moonshotai/kimi-k2', 'moonshotai/moonlight-16k', 'moonshotai/kimi-vl-a3b-thinking']}
        routingNote="Provider: moonshot — direct via https://api.moonshot.cn/v1. Falls back to OpenRouter key if no Moonshot key set."
      />

      {/* Xiaomi MiMo */}
      <ProviderCard
        title="MiMo (Xiaomi)"
        description="MiMo V2 Pro — Xiaomi's flagship agentic model at $1/M input tokens."
        docsUrl="https://platform.xiaomimimo.com"
        badge="New Mar 2026"
        badgeColor="bg-blue-700/20 text-blue-400 border border-blue-700/30"
        enabled={!!appSettings.mimoEnabled}
        onToggle={() => onSaveAppSettings({ mimoEnabled: !appSettings.mimoEnabled })}
        apiKey={appSettings.mimoApiKey || ''}
        apiKeyPlaceholder="sk-..."
        onApiKeyChange={(v) => onUpdateLocalSettings({ mimoApiKey: v })}
        onApiKeyBlur={() => onSaveAppSettings({ mimoApiKey: appSettings.mimoApiKey })}
        models={['xiaomi/mimo-v2-pro', 'xiaomi/mimo-v2-flash', 'xiaomi/mimo-v2-omni']}
        routingNote="Provider: mimo — direct via https://api.mimo.com/v1. Falls back to OpenRouter key if no MiMo key set."
      />

      {/* Alibaba Qwen */}
      <ProviderCard
        title="Qwen (Alibaba)"
        description="QwQ reasoning model and Qwen 2.5/3 series. Strong math & coding."
        docsUrl="https://dashscope.console.aliyun.com/apiKey"
        enabled={!!appSettings.qwenEnabled}
        onToggle={() => onSaveAppSettings({ qwenEnabled: !appSettings.qwenEnabled })}
        apiKey={appSettings.qwenApiKey || ''}
        apiKeyPlaceholder="sk-..."
        onApiKeyChange={(v) => onUpdateLocalSettings({ qwenApiKey: v })}
        onApiKeyBlur={() => onSaveAppSettings({ qwenApiKey: appSettings.qwenApiKey })}
        models={['qwen/qwq-32b', 'qwen/qwen-2.5-72b-instruct', 'qwen/qwen-2.5-coder-32b-instruct', 'qwen/qwen3-235b-a22b']}
        routingNote="Provider: qwen — direct via https://dashscope.aliyuncs.com/compatible-mode/v1. Falls back to OpenRouter key if no Qwen key set."
      />

      {/* ZhipuAI GLM */}
      <ProviderCard
        title="ZhipuAI (GLM)"
        description="GLM-4.6 flagship and GLM-4 Plus/Air/Flash. Strong Chinese + English performance."
        docsUrl="https://open.bigmodel.cn/usercenter/apikeys"
        enabled={!!appSettings.zhipuEnabled}
        onToggle={() => onSaveAppSettings({ zhipuEnabled: !appSettings.zhipuEnabled })}
        apiKey={appSettings.zhipuApiKey || ''}
        apiKeyPlaceholder="..."
        onApiKeyChange={(v) => onUpdateLocalSettings({ zhipuApiKey: v })}
        onApiKeyBlur={() => onSaveAppSettings({ zhipuApiKey: appSettings.zhipuApiKey })}
        models={['zhipuai/glm-4.6', 'zhipuai/glm-4.5', 'zhipuai/glm-4-plus', 'zhipuai/glm-4-air', 'zhipuai/glm-4-flash']}
        routingNote="Provider: zhipu — direct via https://open.bigmodel.cn/api/paas/v4/. Falls back to OpenRouter key if no Zhipu key set."
      />

      {/* Routing note */}
      <div className="border border-border bg-card p-5 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">How routing works</p>
        <p>
          All providers use Claude CLI with <code className="bg-secondary px-1 text-xs">ANTHROPIC_BASE_URL</code> pointing to OpenRouter&apos;s
          Anthropic-compatible endpoint. Your API key is injected via <code className="bg-secondary px-1 text-xs">ANTHROPIC_API_KEY</code>.
        </p>
        <p>
          When creating an agent, select the provider in the &quot;Model&quot; dropdown —
          each provider shows its own model list. If a provider-specific key is set, it is used;
          otherwise the OpenRouter key is used as fallback.
        </p>
        <p>
          Direct API routing (bypassing OpenRouter) is planned for a future release.
        </p>
      </div>
    </div>
  );
};
