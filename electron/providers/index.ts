import type { AgentProvider } from '../types';
import type { CLIProvider } from './cli-provider';
import { ClaudeProvider } from './claude-provider';
import { CodexProvider } from './codex-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenCodeProvider } from './opencode-provider';
import { PiProvider } from './pi-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { MiMoProvider } from './mimo-provider';
import { MoonshotProvider } from './moonshot-provider';
import { QwenProvider } from './qwen-provider';
import { ZhipuProvider } from './zhipu-provider';

export type { CLIProvider } from './cli-provider';
export type {
  InteractiveCommandParams,
  ScheduledCommandParams,
  OneShotCommandParams,
  ProviderModel,
  HookConfig,
} from './cli-provider';

const providers: Record<string, CLIProvider> = {
  claude: new ClaudeProvider(),
  codex: new CodexProvider(),
  gemini: new GeminiProvider(),
  opencode: new OpenCodeProvider(),
  pi: new PiProvider(),
  openrouter: new OpenRouterProvider(),
  deepseek: new DeepSeekProvider(),
  mimo: new MiMoProvider(),
  moonshot: new MoonshotProvider(),
  qwen: new QwenProvider(),
  zhipu: new ZhipuProvider(),
};

/**
 * Get a CLI provider by its ID.
 * Falls back to Claude for unknown providers (including 'local' which is a Claude sub-mode).
 */
export function getProvider(id?: AgentProvider): CLIProvider {
  if (!id || id === 'local') {
    return providers.claude;
  }
  return providers[id] || providers.claude;
}

/**
 * Get all registered providers (excluding 'local' which is a Claude sub-mode).
 */
export function getAllProviders(): CLIProvider[] {
  return Object.values(providers);
}

/**
 * Check if a provider ID is valid.
 */
export function isValidProvider(id: string): id is AgentProvider {
  return id === 'local' || id in providers;
}
