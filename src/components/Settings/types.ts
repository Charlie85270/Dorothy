export interface ClaudeSettings {
  enabledPlugins: Record<string, boolean>;
  env: Record<string, string>;
  hooks: Record<string, unknown>;
  includeCoAuthoredBy: boolean;
  permissions: { allow: string[]; deny: string[] };
}

export interface ClaudeInfo {
  claudeVersion: string;
  configPath: string;
  settingsPath: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
}

export interface Skill {
  name: string;
  source: 'project' | 'user' | 'plugin';
  path: string;
  description?: string;
  projectName?: string;
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
  autoCheckUpdates: boolean;
  cliPaths: CLIPaths;
  defaultProvider?: string;
  obsidianVaultPaths?: string[];
  opencodeEnabled: boolean;
  opencodeDefaultModel: string;
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

export type SettingsSection = 'general' | 'terminal' | 'git' | 'notifications' | 'telegram' | 'slack' | 'jira' | 'socialdata' | 'tasmania' | 'opencode' | 'pi' | 'google-workspace' | 'obsidian' | 'permissions' | 'skills' | 'mcp' | 'cli' | 'system';
