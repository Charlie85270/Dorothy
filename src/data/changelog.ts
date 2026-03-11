export interface Release {
  id: number;
  version: string;
  date: string;
  updates: string[];
}

export const CHANGELOG: Release[] = [
  {
    id: 8,
    version: '1.2.5',
    date: '2026-03-12',
    updates: [
      'Manage all your external MCP servers (outside of Dorothy) from the settings page',
      'Added macOS menu bar tray with live agent status panel',
      'Status tabs in tray: Working, Waiting for inputs, Ready to work, Idle',
      'Live task preview next to agent name when working or waiting',
      'Full-color Dorothy logo in the macOS menu bar',
      'Revamped agents page with improved layout and filtering',
      'Add new Status line option (in settings) to display model, context usage, git branch, session time, and token stats in live on your Claude Code terminal',
      'Custom MP3/audio file support per notification type',
      'New "Response Finished" notification toggle (Stop hook)',
      'Dedicated PermissionRequest and TaskCompleted hook events',
      'Fixed agent status lifecycle: idle on start, working only after user prompt',
      'Added pinned and favorites projects to the project page, quickly select your default project on create agent and kanban task',
    ],
  },
  {
    id: 7,
    version: '1.2.4',
    date: '2026-02-26',
    updates: [
      'Multi-provider support: Claude, Codex, and Gemini agents',
      'Provider selector in agent creation flow',
      'Memory page now shows projects across all providers',
      'Custom MCP server configuration per provider',
      'CLI Paths settings for all provider binaries',
    ],
  },
  {
    id: 6,
    version: '1.2.3',
    date: '2026-02-19',
    updates: [
      'React app preview tab in agent detail panel',
      'Live preview of react-app code blocks from agent output',
      'File watcher for .dorothy-preview/ directory',
      'Window drag regions for macOS',
      'Modular API routes for better maintainability',
    ],
  },
  {
    id: 5,
    version: '1.2.2',
    date: '2026-02-10',
    updates: [
      'Skills marketplace with community skill browser',
      'Skill installation progress terminal',
      'Link skills to specific providers',
      'Improved agent world (ClaudeMon) with NPC zones',
    ],
  },
  {
    id: 4,
    version: '1.2.1',
    date: '2026-01-28',
    updates: [
      'Vault — shared document storage for agents and users',
      'Folder organization and full-text search in Vault',
      'Kanban board with agent task assignment',
      'Auto-spawn agents from Kanban card moves',
      'Scheduler improvements with cron expressions',
    ],
  },
  {
    id: 3,
    version: '1.2.0',
    date: '2026-01-10',
    updates: [
      'Telegram bot integration for remote agent control',
      'Slack bot support with channel notifications',
      'JIRA integration for issue tracking',
      'Automations engine for event-driven workflows',
      'Super Agent / Orchestrator mode',
    ],
  },
  {
    id: 2,
    version: '1.0.1',
    date: '2025-12-20',
    updates: [
      'Desktop notifications for agent events',
      'Memory browser for Claude project memory files',
      'Obsidian vault integration',
      'Dark mode support',
      'Worktree support for isolated git branches',
    ],
  },
  {
    id: 1,
    version: '1.0.0',
    date: '2025-12-01',
    updates: [
      'Initial release of Dorothy',
      'Multi-agent management with persistent PTY sessions',
      'Agent creation with project path, skills, and character',
      'Terminal view with live output streaming',
      'Dashboard with agent status overview',
      'Scheduled tasks with cron support',
    ],
  },
];

export const LATEST_RELEASE = CHANGELOG[0];
export const WHATS_NEW_STORAGE_KEY = 'dorothy_whats_new_last_seen';
