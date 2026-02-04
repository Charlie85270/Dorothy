export interface WorktreeConfig {
  enabled: boolean;
  branchName: string;
}

export type AgentCharacter = 'robot' | 'ninja' | 'wizard' | 'astronaut' | 'knight' | 'pirate' | 'alien' | 'viking';

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
}

export interface CLIPaths {
  claude: string;
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
  telegramChatId: string;
  slackEnabled: boolean;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
  slackChannelId: string;
  verboseModeEnabled: boolean;
  cliPaths: CLIPaths;
}
