export interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

export type AgentCharacter = 'robot' | 'ninja' | 'wizard' | 'astronaut' | 'knight' | 'pirate' | 'alien' | 'viking';

export type AgentProvider = 'claude' | 'codex' | 'gemini' | 'opencode' | 'pi' | 'local';

/** Permission mode for agent tool use:
 * - normal: Claude asks for confirmation on each tool use
 * - auto: agent runs fully autonomously (--dangerously-skip-permissions)
 * - bypass: same as auto, explicit intent to bypass all checks
 */
export type AgentPermissionMode = 'normal' | 'auto' | 'bypass';

/** Effort level for agent reasoning:
 * - low: fast, minimal thinking
 * - medium: default balanced mode
 * - high: extended thinking (--think flag)
 */
export type AgentEffort = 'low' | 'medium' | 'high';

export interface AgentStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'waiting';
  projectPath: string;
  secondaryProjectPath?: string;
  worktreePath?: string;
  branchName?: string;
  skills: string[];
  currentTask?: string;
  output: string[];
  lastActivity: string;
  error?: string;
  ptyId?: string;
  character?: AgentCharacter;
  name?: string;
  pathMissing?: boolean;
  /** @deprecated use permissionMode instead */
  skipPermissions?: boolean;
  permissionMode?: AgentPermissionMode;
  effort?: AgentEffort;
  currentSessionId?: string;
  kanbanTaskId?: string;  // For kanban task completion tracking
  statusLine?: string;       // ANSI-stripped last meaningful output line
  lastCleanOutput?: string;  // Clean text output captured from transcript by hooks
  provider?: AgentProvider;   // 'claude' (default) or 'local' (Tasmania)
  model?: string;              // Model name (e.g. 'sonnet', 'opus', 'haiku') — persisted across restarts
  localModel?: string;        // Tasmania model name when provider is 'local'
  savedPrompt?: string;       // Saved task/prompt for re-launching the agent
  obsidianVaultPaths?: string[]; // Obsidian vault paths to mount via --add-dir (read-only)
}

export interface CLIPaths {
  claude: string;
  codex: string;
  gemini: string;
  opencode: string;
  pi: string;
  gws: string;
  gcloud: string;
  gh: string;
  node: string;
  additionalPaths: string[];
}

export interface AppSettings {
  notificationsEnabled: boolean;
  notifyOnWaiting: boolean;
  notifyOnComplete: boolean;
  notifyOnStop: boolean;
  notifyOnError: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string; // Legacy - kept for backwards compatibility
  telegramAuthToken: string; // Secret token for authentication
  telegramAuthorizedChatIds: string[]; // List of authorized chat IDs
  telegramRequireMention: boolean; // Only respond when bot is @mentioned in groups
  slackEnabled: boolean;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
  slackChannelId: string;
  jiraEnabled: boolean;
  jiraDomain: string;
  jiraEmail: string;
  jiraApiToken: string;
  socialDataEnabled: boolean;
  socialDataApiKey: string;
  xPostingEnabled: boolean;
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  tasmaniaEnabled: boolean;
  tasmaniaServerPath: string;
  gwsEnabled: boolean;
  gwsSkillsInstalled: boolean;
  verboseModeEnabled: boolean;
  chromeEnabled: boolean;
  autoCheckUpdates: boolean;
  cliPaths: CLIPaths;
  opencodeEnabled: boolean;
  opencodeDefaultModel: string;
  defaultProvider?: AgentProvider;
  obsidianVaultPaths?: string[];
  notificationSounds?: {
    waiting?: string;
    complete?: string;
    stop?: string;
    error?: string;
  };
  terminalFontSize?: number;
  terminalTheme?: 'dark' | 'light';
  statusLineEnabled?: boolean;
  favoriteProjects?: string[];
  hiddenProjects?: string[];
  defaultProjectPath?: string;
}
