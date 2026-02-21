export interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

export type AgentCharacter = 'robot' | 'ninja' | 'wizard' | 'astronaut' | 'knight' | 'pirate' | 'alien' | 'viking';

export type AgentProvider = 'claude' | 'local' | 'codex';

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
  skipPermissions?: boolean;
  currentSessionId?: string;
  kanbanTaskId?: string;  // For kanban task completion tracking
  provider?: AgentProvider;   // 'claude' (default), 'local' (Tasmania), or 'codex' (OpenAI Codex)
  localModel?: string;        // Tasmania model name when provider is 'local'
  codexModel?: string;        // Codex model name when provider is 'codex'
}

export interface CLIPaths {
  claude: string;
  codex: string;
  gh: string;
  node: string;
  additionalPaths: string[];
}

export interface AppSettings {
  notificationsEnabled: boolean;
  notifyOnWaiting: boolean;
  notifyOnComplete: boolean;
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
  codexEnabled: boolean;
  codexApiKey: string;
  codexDefaultModel: string;
  codexSandboxMode: 'read-only' | 'workspace-write' | 'full-auto';
  verboseModeEnabled: boolean;
  autoCheckUpdates: boolean;
  cliPaths: CLIPaths;
}
