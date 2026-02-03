import {
  Settings,
  GitCommit,
  Bell,
  Send,
  Shield,
  Sparkles,
  Monitor,
  Brain,
} from 'lucide-react';
import { SlackIcon } from './SlackIcon';
import type { SettingsSection } from './types';

export const SECTIONS: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'git', label: 'Git', icon: GitCommit },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'slack', label: 'Slack', icon: SlackIcon },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'skills', label: 'Skills & Plugins', icon: Sparkles },
  { id: 'system', label: 'System', icon: Monitor },
];

export const DEFAULT_APP_SETTINGS = {
  notificationsEnabled: true,
  notifyOnWaiting: true,
  notifyOnComplete: true,
  notifyOnError: true,
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  slackEnabled: false,
  slackBotToken: '',
  slackAppToken: '',
  slackSigningSecret: '',
  slackChannelId: '',
  verboseModeEnabled: false,
};
