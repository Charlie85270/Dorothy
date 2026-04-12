/**
 * Frontend provider registry — single source of truth for all AI providers.
 *
 * Adding a new provider: add one entry here. NewChatModal and Settings
 * Default Provider both import from this file.
 */

import type { AgentProvider } from '@/types/electron';

export type ProviderIconDef =
  | { type: 'image'; src: string }
  | { type: 'svg-gemini' }
  | { type: 'svg-openrouter' }
  | { type: 'svg-deepseek' }
  | { type: 'svg-moonshot' }
  | { type: 'svg-mimo' }
  | { type: 'svg-qwen' }
  | { type: 'svg-zai' }
  | { type: 'text'; content: string }
  | { type: 'cpu' };

export interface ProviderModel {
  id: string;
  name: string;
  description: string;
}

export interface ProviderDef {
  id: AgentProvider;
  label: string;
  icon: ProviderIconDef;
  /** Tailwind color fragment, e.g. 'accent-blue', 'amber-500' */
  accent: string;
  /**
   * Full Tailwind class string for a small badge (bg + text).
   * Used wherever a coloured pill badge shows the provider name.
   */
  badgeClass: string;
  /**
   * True for providers that ship as a CLI binary and can be "not installed".
   * Checked via cliPaths.detect() for claude/codex/gemini; others default to available.
   */
  requiresCli?: boolean;
  models: ProviderModel[];
  defaultModel: string;
}

export const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    id: 'claude',
    label: 'Claude',
    icon: { type: 'image', src: '/claude-ai-icon.webp' },
    accent: 'accent-blue',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    requiresCli: true,
    models: [
      { id: 'default', name: 'Default', description: 'Recommended' },
      { id: 'sonnet', name: 'Sonnet', description: 'Daily coding' },
      { id: 'opus', name: 'Opus', description: 'Complex reasoning' },
      { id: 'haiku', name: 'Haiku', description: 'Fast & efficient' },
      { id: 'sonnet[1m]', name: 'Sonnet 1M', description: '1M context window' },
      { id: 'opusplan', name: 'Opus Plan', description: 'Extended thinking' },
    ],
    defaultModel: 'default',
  },
  {
    id: 'codex',
    label: 'Codex',
    icon: { type: 'image', src: '/chatgpt-icon.webp' },
    accent: 'accent-green',
    badgeClass: 'bg-green-500/15 text-green-600 dark:text-green-400',
    requiresCli: true,
    models: [
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', description: 'Recommended' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', description: 'Balanced' },
      { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Previous gen' },
      { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', description: 'Fast & efficient' },
    ],
    defaultModel: 'gpt-5.2-codex',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    icon: { type: 'svg-gemini' },
    accent: 'accent-purple',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    requiresCli: true,
    models: [
      { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Most capable' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: 'Fast & capable' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Stable' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced' },
    ],
    defaultModel: 'gemini-3-flash',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    icon: { type: 'text', content: 'OC' },
    accent: 'accent-cyan',
    badgeClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
    requiresCli: true,
    models: [
      { id: 'default', name: 'Default', description: 'Use configured default' },
    ],
    defaultModel: 'default',
  },
  {
    id: 'pi',
    label: 'Pi',
    icon: { type: 'cpu' },
    accent: 'accent-cyan',
    badgeClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
    requiresCli: true,
    models: [
      { id: 'default', name: 'Default', description: 'Use configured model' },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet', description: 'Anthropic' },
      { id: 'anthropic/claude-opus-4-20250514', name: 'Claude Opus', description: 'Anthropic' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Google' },
    ],
    defaultModel: 'default',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    icon: { type: 'svg-openrouter' },
    accent: 'amber-500',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    models: [
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning' },
      { id: 'moonshotai/kimi-k2', name: 'Kimi K2', description: 'Agentic' },
      { id: 'xiaomi/mimo-v2-pro', name: 'MiMo V2 Pro', description: 'Code' },
      { id: 'qwen/qwq-32b', name: 'QwQ 32B', description: 'Math & code' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', description: 'OpenAI' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Google' },
    ],
    defaultModel: 'deepseek/deepseek-r1',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: { type: 'svg-deepseek' },
    accent: 'sky-500',
    badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    models: [
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: 'Flagship chat' },
      { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'R1 Distill 70B', description: 'Fast' },
    ],
    defaultModel: 'deepseek/deepseek-r1',
  },
  {
    id: 'moonshot',
    label: 'Moonshot',
    icon: { type: 'svg-moonshot' },
    accent: 'violet-500',
    badgeClass: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    models: [
      { id: 'moonshotai/kimi-k2', name: 'Kimi K2', description: 'Agentic flagship' },
      { id: 'moonshotai/moonlight-16k', name: 'Moonlight 16K', description: 'Fast' },
      { id: 'moonshotai/kimi-vl-a3b-thinking', name: 'Kimi VL', description: 'Vision' },
    ],
    defaultModel: 'moonshotai/kimi-k2',
  },
  {
    id: 'mimo',
    label: 'MiMo',
    icon: { type: 'svg-mimo' },
    accent: 'orange-500',
    badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    models: [
      { id: 'xiaomi/mimo-v2-pro', name: 'MiMo V2 Pro', description: 'Flagship' },
      { id: 'xiaomi/mimo-v2-flash', name: 'MiMo V2 Flash', description: 'Fast' },
      { id: 'xiaomi/mimo-v2-omni', name: 'MiMo V2 Omni', description: 'Multimodal' },
    ],
    defaultModel: 'xiaomi/mimo-v2-pro',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    icon: { type: 'svg-qwen' },
    accent: 'blue-500',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    models: [
      { id: 'qwen/qwq-32b', name: 'QwQ 32B', description: 'Reasoning' },
      { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', description: 'Flagship' },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Balanced' },
      { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen Coder', description: 'Code' },
    ],
    defaultModel: 'qwen/qwq-32b',
  },
  {
    id: 'zhipu',
    label: 'Zai',
    icon: { type: 'svg-zai' },
    accent: 'indigo-500',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    models: [
      { id: 'zhipuai/glm-4.6', name: 'GLM-4.6', description: 'Flagship' },
      { id: 'zhipuai/glm-4.5', name: 'GLM-4.5', description: 'Stable' },
      { id: 'zhipuai/glm-4-plus', name: 'GLM-4 Plus', description: 'Balanced' },
      { id: 'zhipuai/glm-4-air', name: 'GLM-4 Air', description: 'Fast' },
      { id: 'zhipuai/glm-4-flash', name: 'GLM-4 Flash', description: 'Economy' },
    ],
    defaultModel: 'zhipuai/glm-4.6',
  },
];

/** Look up a provider definition by ID. */
export function getProviderDef(id: string): ProviderDef | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}
