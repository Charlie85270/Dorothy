'use client';
import { useState, useMemo, useCallback } from 'react';
import { InteriorContentProps, PokemonMenuItem } from '../types';
import { useSettings } from '@/hooks/useSettings';
import PokemonMenu from '../overlays/PokemonMenu';

// ── Section definitions ──────────────────────────────────────────────────────
interface SettingsSection {
  id: string;
  name: string;
  description: string;
}

const SECTIONS: SettingsSection[] = [
  { id: 'general', name: 'General', description: 'Version and system information.' },
  { id: 'memory', name: 'Memory', description: 'Claude memory and context settings.' },
  { id: 'git', name: 'Git', description: 'Git integration and co-authoring.' },
  { id: 'notifications', name: 'Notifications', description: 'Desktop notification preferences.' },
  { id: 'telegram', name: 'Telegram', description: 'Telegram bot integration.' },
  { id: 'slack', name: 'Slack', description: 'Slack bot integration.' },
  { id: 'jira', name: 'JIRA', description: 'JIRA project tracking integration.' },
  { id: 'permissions', name: 'Permissions', description: 'Tool permission allow/deny lists.' },
  { id: 'skills', name: 'Skills', description: 'Installed skills and plugins.' },
  { id: 'cli', name: 'CLI Paths', description: 'Paths to CLI tools.' },
  { id: 'system', name: 'System', description: 'System and environment info.' },
];

export default function SettingsContent({ onExit }: InteriorContentProps) {
  const {
    settings,
    appSettings,
    info,
    skills,
    handleSave,
    handleSaveAppSettings,
    updateSettings,
  } = useSettings();

  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ── Badge for each top-level section ────────────────────────────────────────
  const getSectionBadge = useCallback((sectionId: string): { badge: string | null; badgeColor?: string } => {
    switch (sectionId) {
      case 'general':
        return { badge: info?.claudeVersion || '...', badgeColor: '#888' };
      case 'memory':
        return { badge: settings ? 'VIEW' : null, badgeColor: '#888' };
      case 'git':
        return { badge: settings?.includeCoAuthoredBy ? 'ON' : 'OFF' };
      case 'notifications':
        return { badge: appSettings.notificationsEnabled ? 'ON' : 'OFF' };
      case 'telegram':
        return { badge: appSettings.telegramEnabled ? 'ON' : 'OFF' };
      case 'slack':
        return { badge: appSettings.slackEnabled ? 'ON' : 'OFF' };
      case 'jira':
        return { badge: appSettings.jiraEnabled ? 'ON' : 'OFF' };
      case 'permissions': {
        const count = (settings?.permissions?.allow?.length || 0) + (settings?.permissions?.deny?.length || 0);
        return { badge: `${count}`, badgeColor: '#888' };
      }
      case 'skills':
        return { badge: `${skills.length}`, badgeColor: '#888' };
      case 'cli':
        return { badge: 'VIEW', badgeColor: '#888' };
      case 'system':
        return { badge: 'VIEW', badgeColor: '#888' };
      default:
        return { badge: null };
    }
  }, [settings, appSettings, info, skills]);

  // ── Section list items ──────────────────────────────────────────────────────
  const sectionItems: PokemonMenuItem[] = useMemo(() => {
    return SECTIONS.map(s => {
      const { badge, badgeColor } = getSectionBadge(s.id);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        badge,
        badgeColor,
      };
    });
  }, [getSectionBadge]);

  // ── Detail items for each section ───────────────────────────────────────────
  const getDetailItems = useCallback((sectionId: string): PokemonMenuItem[] => {
    switch (sectionId) {
      case 'general':
        return [
          { id: 'version', name: 'Version', description: `Claude version: ${info?.claudeVersion || 'Unknown'}`, badge: info?.claudeVersion || '?', badgeColor: '#888' },
          { id: 'platform', name: 'Platform', description: `${info?.platform || '?'} / ${info?.arch || '?'}`, badge: info?.platform || '?', badgeColor: '#888' },
          { id: 'electron', name: 'Electron', description: `Electron version: ${info?.electronVersion || '?'}`, badge: info?.electronVersion || '?', badgeColor: '#888' },
          { id: 'node', name: 'Node', description: `Node version: ${info?.nodeVersion || '?'}`, badge: info?.nodeVersion || '?', badgeColor: '#888' },
        ];
      case 'memory':
        return [
          { id: 'config-path', name: 'Config Path', description: info?.configPath || 'Unknown', badge: 'INFO', badgeColor: '#888' },
          { id: 'settings-path', name: 'Settings Path', description: info?.settingsPath || 'Unknown', badge: 'INFO', badgeColor: '#888' },
        ];
      case 'git':
        return [
          { id: 'coauthor', name: 'Co-Author Tag', description: 'Include co-authored-by in git commits.', badge: settings?.includeCoAuthoredBy ? 'ON' : 'OFF' },
        ];
      case 'notifications':
        return [
          { id: 'notif-enabled', name: 'Enabled', description: 'Enable desktop notifications.', badge: appSettings.notificationsEnabled ? 'ON' : 'OFF' },
          { id: 'notif-waiting', name: 'On Waiting', description: 'Notify when agent is waiting for input.', badge: appSettings.notifyOnWaiting ? 'ON' : 'OFF' },
          { id: 'notif-complete', name: 'On Complete', description: 'Notify when a task completes.', badge: appSettings.notifyOnComplete ? 'ON' : 'OFF' },
          { id: 'notif-error', name: 'On Error', description: 'Notify when an error occurs.', badge: appSettings.notifyOnError ? 'ON' : 'OFF' },
        ];
      case 'telegram':
        return [
          { id: 'tg-enabled', name: 'Enabled', description: 'Enable Telegram bot integration.', badge: appSettings.telegramEnabled ? 'ON' : 'OFF' },
          { id: 'tg-token', name: 'Bot Token', description: appSettings.telegramBotToken ? 'Token configured' : 'Not set', badge: appSettings.telegramBotToken ? 'SET' : '---', badgeColor: appSettings.telegramBotToken ? '#38A858' : '#888' },
          { id: 'tg-mention', name: 'Require @mention', description: 'Only respond when mentioned in groups.', badge: appSettings.telegramRequireMention ? 'ON' : 'OFF' },
          { id: 'tg-chats', name: 'Auth Chat IDs', description: `${appSettings.telegramAuthorizedChatIds?.length || 0} authorized chat(s)`, badge: `${appSettings.telegramAuthorizedChatIds?.length || 0}`, badgeColor: '#888' },
        ];
      case 'slack':
        return [
          { id: 'slack-enabled', name: 'Enabled', description: 'Enable Slack bot integration.', badge: appSettings.slackEnabled ? 'ON' : 'OFF' },
          { id: 'slack-bot', name: 'Bot Token', description: appSettings.slackBotToken ? 'Token configured' : 'Not set', badge: appSettings.slackBotToken ? 'SET' : '---', badgeColor: appSettings.slackBotToken ? '#38A858' : '#888' },
          { id: 'slack-app', name: 'App Token', description: appSettings.slackAppToken ? 'Token configured' : 'Not set', badge: appSettings.slackAppToken ? 'SET' : '---', badgeColor: appSettings.slackAppToken ? '#38A858' : '#888' },
          { id: 'slack-channel', name: 'Channel', description: appSettings.slackChannelId || 'Not set', badge: appSettings.slackChannelId ? 'SET' : '---', badgeColor: appSettings.slackChannelId ? '#38A858' : '#888' },
        ];
      case 'jira':
        return [
          { id: 'jira-enabled', name: 'Enabled', description: 'Enable JIRA integration.', badge: appSettings.jiraEnabled ? 'ON' : 'OFF' },
          { id: 'jira-domain', name: 'Domain', description: appSettings.jiraDomain || 'Not set', badge: appSettings.jiraDomain ? 'SET' : '---', badgeColor: appSettings.jiraDomain ? '#38A858' : '#888' },
          { id: 'jira-email', name: 'Email', description: appSettings.jiraEmail || 'Not set', badge: appSettings.jiraEmail ? 'SET' : '---', badgeColor: appSettings.jiraEmail ? '#38A858' : '#888' },
          { id: 'jira-token', name: 'API Token', description: appSettings.jiraApiToken ? 'Token configured' : 'Not set', badge: appSettings.jiraApiToken ? 'SET' : '---', badgeColor: appSettings.jiraApiToken ? '#38A858' : '#888' },
        ];
      case 'permissions': {
        const items: PokemonMenuItem[] = [];
        const allow = settings?.permissions?.allow || [];
        const deny = settings?.permissions?.deny || [];
        if (allow.length > 0) {
          allow.forEach((rule, i) => {
            items.push({ id: `allow-${i}`, name: `Allow: ${rule}`, description: `Allowed tool pattern: ${rule}`, badge: 'ALLOW', badgeColor: '#38A858' });
          });
        }
        if (deny.length > 0) {
          deny.forEach((rule, i) => {
            items.push({ id: `deny-${i}`, name: `Deny: ${rule}`, description: `Denied tool pattern: ${rule}`, badge: 'DENY', badgeColor: '#C05050' });
          });
        }
        if (items.length === 0) {
          items.push({ id: 'no-rules', name: 'No Rules', description: 'No permission rules configured.', badge: '---', badgeColor: '#888' });
        }
        return items;
      }
      case 'skills':
        if (skills.length === 0) {
          return [{ id: 'no-skills', name: 'No Skills', description: 'No skills installed yet.', badge: '---', badgeColor: '#888' }];
        }
        return skills.map((s, i) => ({
          id: `skill-${i}`,
          name: s.name,
          description: `Source: ${s.source}${s.projectName ? ` (${s.projectName})` : ''}`,
          badge: s.source.toUpperCase(),
          badgeColor: s.source === 'plugin' ? '#6868C8' : s.source === 'user' ? '#38A858' : '#888',
        }));
      case 'cli':
        return [
          { id: 'cli-claude', name: 'Claude Path', description: appSettings.cliPaths?.claude || 'Auto-detect', badge: appSettings.cliPaths?.claude ? 'SET' : 'AUTO', badgeColor: '#888' },
          { id: 'cli-gh', name: 'GitHub CLI', description: appSettings.cliPaths?.gh || 'Auto-detect', badge: appSettings.cliPaths?.gh ? 'SET' : 'AUTO', badgeColor: '#888' },
          { id: 'cli-node', name: 'Node Path', description: appSettings.cliPaths?.node || 'Auto-detect', badge: appSettings.cliPaths?.node ? 'SET' : 'AUTO', badgeColor: '#888' },
        ];
      case 'system':
        return [
          { id: 'verbose', name: 'Verbose Mode', description: 'Enable verbose logging output.', badge: appSettings.verboseModeEnabled ? 'ON' : 'OFF' },
          { id: 'sys-platform', name: 'Platform', description: `${info?.platform || '?'} ${info?.arch || ''}`, badge: info?.platform || '?', badgeColor: '#888' },
          { id: 'sys-node', name: 'Node Version', description: info?.nodeVersion || 'Unknown', badge: info?.nodeVersion || '?', badgeColor: '#888' },
        ];
      default:
        return [];
    }
  }, [settings, appSettings, info, skills]);

  // ── Toggle handlers ─────────────────────────────────────────────────────────
  const handleToggle = useCallback((itemId: string) => {
    // AppSettings toggles (immediate save)
    const appToggles: Record<string, keyof typeof appSettings> = {
      'notif-enabled': 'notificationsEnabled',
      'notif-waiting': 'notifyOnWaiting',
      'notif-complete': 'notifyOnComplete',
      'notif-error': 'notifyOnError',
      'tg-enabled': 'telegramEnabled',
      'tg-mention': 'telegramRequireMention',
      'slack-enabled': 'slackEnabled',
      'jira-enabled': 'jiraEnabled',
      'verbose': 'verboseModeEnabled',
    };

    const appKey = appToggles[itemId];
    if (appKey) {
      const current = appSettings[appKey];
      if (typeof current === 'boolean') {
        handleSaveAppSettings({ [appKey]: !current });
      }
      return;
    }

    // ClaudeSettings toggles (update + save)
    if (itemId === 'coauthor' && settings) {
      updateSettings({ includeCoAuthoredBy: !settings.includeCoAuthoredBy });
      handleSave();
    }
  }, [appSettings, settings, handleSaveAppSettings, updateSettings, handleSave]);

  // ── Determine which items are toggleable ────────────────────────────────────
  const toggleableIds = new Set([
    'coauthor',
    'notif-enabled', 'notif-waiting', 'notif-complete', 'notif-error',
    'tg-enabled', 'tg-mention',
    'slack-enabled',
    'jira-enabled',
    'verbose',
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Level 1: Section List
  // ═══════════════════════════════════════════════════════════════════════════
  if (!activeSection) {
    const sectionActions = [
      { id: 'view', label: 'VIEW' },
      { id: 'leave', label: 'LEAVE' },
    ];

    const handleSectionAction = (actionId: string, item: PokemonMenuItem) => {
      if (actionId === 'view') {
        setActiveSection(item.id);
      } else if (actionId === 'leave') {
        onExit();
      }
    };

    const leftPanel = (
      <div className="text-center px-2">
        <div style={{
          fontSize: '32px',
          lineHeight: 1,
          marginBottom: '8px',
        }}>
          {'\u2699\uFE0F'}
        </div>
        <div style={{
          fontSize: '10px',
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        }}>
          Settings PC
        </div>
      </div>
    );

    return (
      <PokemonMenu
        items={sectionItems}
        actions={sectionActions}
        onAction={handleSectionAction}
        onBack={onExit}
        leftPanelContent={leftPanel}
        title="SETTINGS"
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Level 2: Section Detail
  // ═══════════════════════════════════════════════════════════════════════════
  const detailItems = getDetailItems(activeSection);
  const sectionDef = SECTIONS.find(s => s.id === activeSection);

  const detailActions = detailItems.some(i => toggleableIds.has(i.id))
    ? [
        { id: 'toggle', label: 'TOGGLE' },
        { id: 'back', label: 'BACK' },
      ]
    : [
        { id: 'back', label: 'BACK' },
      ];

  const handleDetailAction = (actionId: string, item: PokemonMenuItem) => {
    if (actionId === 'toggle') {
      handleToggle(item.id);
    } else if (actionId === 'back') {
      setActiveSection(null);
    }
  };

  const detailLeftPanel = (
    <div className="text-center px-2">
      <div style={{
        fontSize: '28px',
        lineHeight: 1,
        marginBottom: '8px',
      }}>
        {'\u2699\uFE0F'}
      </div>
      <div style={{
        fontSize: '10px',
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        textTransform: 'uppercase',
      }}>
        {sectionDef?.name || activeSection}
      </div>
    </div>
  );

  return (
    <PokemonMenu
      items={detailItems}
      actions={detailActions}
      onAction={handleDetailAction}
      onBack={() => setActiveSection(null)}
      leftPanelContent={detailLeftPanel}
      title={sectionDef?.name?.toUpperCase() || 'SETTINGS'}
    />
  );
}
