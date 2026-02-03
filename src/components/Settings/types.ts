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

export interface AppSettings {
  notificationsEnabled: boolean;
  notifyOnWaiting: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  slackEnabled: boolean;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
  slackChannelId: string;
  verboseModeEnabled: boolean;
}

export type SettingsSection = 'general' | 'memory' | 'git' | 'notifications' | 'telegram' | 'slack' | 'permissions' | 'skills' | 'system';
