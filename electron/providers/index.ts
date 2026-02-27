import type { AgentProvider } from '../types';
import type { CLIProvider } from './cli-provider';
import { ClaudeProvider } from './claude-provider';
import { CodexProvider } from './codex-provider';
import { GeminiProvider } from './gemini-provider';

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
