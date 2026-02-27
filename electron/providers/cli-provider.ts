import type { AgentProvider, AppSettings } from '../types';

/**
 * Parameters for building an interactive (PTY) agent command.
 */
export interface InteractiveCommandParams {
  binaryPath: string;
  prompt: string;
  model?: string;
  verbose?: boolean;
  skipPermissions?: boolean;
  secondaryProjectPath?: string;
  mcpConfigPath?: string;
  systemPromptFile?: string;
  skills?: string[];
  isSuperAgent?: boolean;
}

/**
 * Parameters for building a scheduled (non-interactive, one-shot) command.
 */
export interface ScheduledCommandParams {
  binaryPath: string;
  prompt: string;
  autonomous: boolean;
  mcpConfigPath?: string;
  outputFormat?: string;
  verbose?: boolean;
}

/**
 * Parameters for building a quick one-shot command (e.g. kanban task generation).
 */
export interface OneShotCommandParams {
  binaryPath: string;
  prompt: string;
  model?: string;
}

/**
 * Model definition for a provider.
 */
export interface ProviderModel {
  id: string;
  name: string;
  description: string;
}

/**
 * Hook configuration for a provider.
 */
export interface HookConfig {
  supportsNativeHooks: boolean;
  configDir: string;
  settingsFile: string;
}

/**
 * Strategy pattern interface for CLI providers.
 * Each provider (Claude, Codex, Gemini) implements this interface
 * to encapsulate all provider-specific behavior.
 */
export interface CLIProvider {
  readonly id: AgentProvider;
  readonly displayName: string;
  readonly binaryName: string;
  readonly configDir: string;

  /** Available models for this provider */
  getModels(): ProviderModel[];

  /** Resolve the binary path from app settings or defaults */
  resolveBinaryPath(appSettings: AppSettings): string;

  /** Build command string for interactive PTY sessions */
  buildInteractiveCommand(params: InteractiveCommandParams): string;

  /** Build command string for scheduled task execution */
  buildScheduledCommand(params: ScheduledCommandParams): string;

  /** Build command string for quick one-shot prompts */
  buildOneShotCommand(params: OneShotCommandParams): string;

  /** Get environment variables to set for PTY sessions */
  getPtyEnvVars(agentId: string, projectPath: string, skills: string[]): Record<string, string>;

  /** Get environment variable names to delete before spawning PTY */
  getEnvVarsToDelete(): string[];

  /** Get hook configuration for this provider */
  getHookConfig(): HookConfig;

  /** Configure hooks in the provider's settings */
  configureHooks(hooksDir: string): Promise<void>;

  /** MCP configuration strategy: 'flag' = pass via CLI flag, 'config-file' = write to config file */
  getMcpConfigStrategy(): 'flag' | 'config-file';

  /** Register an MCP server with this provider's configuration */
  registerMcpServer(name: string, command: string, args: string[]): Promise<void>;

  /** Remove an MCP server from this provider's configuration */
  removeMcpServer(name: string): Promise<void>;

  /** Check if an MCP server is registered with the expected server path */
  isMcpServerRegistered(name: string, expectedServerPath: string): boolean;

  /** Directories where this provider reads skills from */
  getSkillDirectories(): string[];

  /** List installed skill names by scanning skill directories */
  getInstalledSkills(): string[];

  /** Whether this provider supports native skill installation */
  supportsSkills(): boolean;

  /** Base path for project memory directories */
  getMemoryBasePath(): string;

  /** Get the Dorothy --add-dir equivalent flag for this provider */
  getAddDirFlag(): string;

  /** Generate the shell script content for scheduled tasks */
  buildScheduledScript(params: {
    binaryPath: string;
    binaryDir: string;
    projectPath: string;
    prompt: string;
    autonomous: boolean;
    mcpConfigPath: string;
    logPath: string;
    homeDir: string;
  }): string;
}
