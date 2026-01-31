import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

export interface ClaudeSettings {
  enabledPlugins: Record<string, boolean>;
  env: Record<string, string>;
  hooks: Record<string, unknown>;
  includeCoAuthoredBy: boolean;
  permissions: {
    allow: string[];
    deny: string[];
  };
}

export interface ClaudeStats {
  version: number;
  lastComputedDate: string;
  dailyActivity: Array<{
    date: string;
    messageCount: number;
    sessionCount: number;
    toolCallCount: number;
  }>;
  dailyModelTokens: Array<{
    date: string;
    tokensByModel: Record<string, number>;
  }>;
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    webSearchRequests: number;
    costUSD: number;
    contextWindow: number;
    maxOutputTokens: number;
  }>;
  totalSessions: number;
  totalMessages: number;
  longestSession: {
    sessionId: string;
    duration: number;
    messageCount: number;
    timestamp: string;
  };
  firstSessionDate: string;
  hourCounts: Record<string, number>;
}

export interface ClaudeProject {
  id: string;
  name: string;
  path: string;
  sessions: ClaudeSession[];
  lastActivity: Date;
}

export interface ClaudeSession {
  id: string;
  projectPath: string;
  messages: ClaudeMessage[];
  startTime: Date;
  lastActivity: Date;
  model?: string;
  version?: string;
}

export interface ClaudeMessage {
  uuid: string;
  parentUuid: string | null;
  type: 'user' | 'assistant';
  timestamp: string;
  content: string | MessageContent[];
  model?: string;
  toolCalls?: ToolCall[];
}

interface MessageContent {
  type: string;
  text?: string;
  thinking?: string;
  tool_use_id?: string;
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudePlugin {
  name: string;
  marketplace: string;
  fullName: string;
  enabled: boolean;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
}

export interface ClaudeSkill {
  name: string;
  source: 'project' | 'user' | 'plugin';
  path: string;
  description?: string;
  projectName?: string;
}

export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId?: string;
  pastedContents?: Record<string, unknown>;
}

// Read Claude Code settings
export async function getSettings(): Promise<ClaudeSettings | null> {
  try {
    const content = await fs.readFile(path.join(CLAUDE_DIR, 'settings.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Read Claude Code stats
export async function getStats(): Promise<ClaudeStats | null> {
  try {
    const content = await fs.readFile(path.join(CLAUDE_DIR, 'stats-cache.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Get all projects with their sessions
export async function getProjects(): Promise<ClaudeProject[]> {
  try {
    const projectsDir = path.join(CLAUDE_DIR, 'projects');
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });

    const projects: ClaudeProject[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.' && entry.name !== '..') {
        // Convert directory name back to path
        const projectPath = '/' + entry.name.replace(/-/g, '/');
        const projectDir = path.join(projectsDir, entry.name);

        // Get session files
        const sessionFiles = await fs.readdir(projectDir);
        const sessions: ClaudeSession[] = [];
        let lastActivity = new Date(0);

        for (const sessionFile of sessionFiles) {
          if (sessionFile.endsWith('.jsonl')) {
            const sessionId = sessionFile.replace('.jsonl', '');
            const sessionPath = path.join(projectDir, sessionFile);
            const stat = await fs.stat(sessionPath);

            if (stat.mtime > lastActivity) {
              lastActivity = stat.mtime;
            }

            sessions.push({
              id: sessionId,
              projectPath,
              messages: [],
              startTime: stat.birthtime,
              lastActivity: stat.mtime,
            });
          }
        }

        // Extract project name from path
        const projectName = projectPath.split('/').pop() || entry.name;

        projects.push({
          id: entry.name,
          name: projectName,
          path: projectPath,
          sessions,
          lastActivity,
        });
      }
    }

    // Sort by last activity
    projects.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    return projects;
  } catch {
    return [];
  }
}

// Get session messages
export async function getSessionMessages(projectId: string, sessionId: string): Promise<ClaudeMessage[]> {
  try {
    const sessionPath = path.join(CLAUDE_DIR, 'projects', projectId, `${sessionId}.jsonl`);
    const content = await fs.readFile(sessionPath, 'utf-8');
    const lines = content.trim().split('\n');

    const messages: ClaudeMessage[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.type === 'user' || entry.type === 'assistant') {
          const msg: ClaudeMessage = {
            uuid: entry.uuid,
            parentUuid: entry.parentUuid,
            type: entry.type,
            timestamp: entry.timestamp,
            content: '',
            model: entry.message?.model,
          };

          // Extract content
          if (entry.message?.content) {
            if (typeof entry.message.content === 'string') {
              msg.content = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
              msg.content = entry.message.content;

              // Extract tool calls
              const toolUses = entry.message.content.filter(
                (c: MessageContent) => c.type === 'tool_use'
              );
              if (toolUses.length > 0) {
                msg.toolCalls = toolUses.map((t: MessageContent) => ({
                  id: t.tool_use_id || '',
                  name: t.name || '',
                  input: t.input || {},
                }));
              }
            }
          }

          messages.push(msg);
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return messages;
  } catch {
    return [];
  }
}

// Get installed plugins/skills
export async function getPlugins(): Promise<ClaudePlugin[]> {
  try {
    const content = await fs.readFile(
      path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'),
      'utf-8'
    );
    const data = JSON.parse(content);
    const settings = await getSettings();

    const plugins: ClaudePlugin[] = [];

    for (const [fullName, installations] of Object.entries(data.plugins || {})) {
      const [name, marketplace] = fullName.split('@');
      const install = (installations as Array<{
        installPath: string;
        version: string;
        installedAt: string;
        lastUpdated: string;
      }>)[0];

      if (install) {
        plugins.push({
          name,
          marketplace,
          fullName,
          enabled: settings?.enabledPlugins?.[fullName] ?? false,
          installPath: install.installPath,
          version: install.version,
          installedAt: install.installedAt,
          lastUpdated: install.lastUpdated,
        });
      }
    }

    return plugins;
  } catch {
    return [];
  }
}

// Helper to read skill metadata from .claude-plugin/plugin.json
async function readSkillMetadata(skillPath: string): Promise<{ name: string; description?: string } | null> {
  try {
    // Resolve symlink if needed
    const realPath = await fs.realpath(skillPath);
    const pluginJsonPath = path.join(realPath, '.claude-plugin', 'plugin.json');
    const content = await fs.readFile(pluginJsonPath, 'utf-8');
    const data = JSON.parse(content);
    return {
      name: data.name || path.basename(skillPath),
      description: data.description,
    };
  } catch {
    // Try without .claude-plugin folder
    try {
      const realPath = await fs.realpath(skillPath);
      const pluginJsonPath = path.join(realPath, 'plugin.json');
      const content = await fs.readFile(pluginJsonPath, 'utf-8');
      const data = JSON.parse(content);
      return {
        name: data.name || path.basename(skillPath),
        description: data.description,
      };
    } catch {
      return null;
    }
  }
}

// Get installed skills from ~/.claude/skills, ~/.agents/skills, project .claude/skills, and plugins
export async function getSkills(): Promise<ClaudeSkill[]> {
  const skills: ClaudeSkill[] = [];

  // Read project skills from current working directory's .claude/skills FIRST
  // (to match Claude Code's ordering: project, user, plugin)
  try {
    const cwd = process.cwd();
    const projectSkillsDir = path.join(cwd, '.claude', 'skills');
    const skillEntries = await fs.readdir(projectSkillsDir, { withFileTypes: true });
    const projectName = path.basename(cwd);

    for (const entry of skillEntries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const skillPath = path.join(projectSkillsDir, entry.name);
        const metadata = await readSkillMetadata(skillPath);

        skills.push({
          name: metadata?.name || entry.name,
          source: 'project',
          path: skillPath,
          description: metadata?.description,
          projectName,
        });
      }
    }
  } catch {
    // Current project doesn't have a .claude/skills folder
  }

  // Read user skills from ~/.claude/skills
  try {
    const userSkillsDir = path.join(CLAUDE_DIR, 'skills');
    const entries = await fs.readdir(userSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skills can be directories or symlinks
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const skillPath = path.join(userSkillsDir, entry.name);
        const metadata = await readSkillMetadata(skillPath);

        skills.push({
          name: metadata?.name || entry.name,
          source: 'user',
          path: skillPath,
          description: metadata?.description,
        });
      }
    }
  } catch {
    // No user skills directory
  }

  // Read user skills from ~/.agents/skills (alternative location)
  try {
    const agentsSkillsDir = path.join(os.homedir(), '.agents', 'skills');
    const entries = await fs.readdir(agentsSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skills can be directories or symlinks
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const skillPath = path.join(agentsSkillsDir, entry.name);
        const metadata = await readSkillMetadata(skillPath);

        // Check if skill with same name already exists (avoid duplicates)
        const existingSkill = skills.find(s => s.name === (metadata?.name || entry.name));
        if (!existingSkill) {
          skills.push({
            name: metadata?.name || entry.name,
            source: 'user',
            path: skillPath,
            description: metadata?.description,
          });
        }
      }
    }
  } catch {
    // No ~/.agents/skills directory
  }

  // Check for plugin skills from installed_plugins.json
  try {
    const plugins = await getPlugins();
    for (const plugin of plugins) {
      skills.push({
        name: plugin.name,
        source: 'plugin',
        path: plugin.installPath,
        description: `Plugin from ${plugin.marketplace}`,
      });
    }
  } catch {
    // No plugins
  }

  return skills;
}

// Get recent history
export async function getHistory(limit = 100): Promise<HistoryEntry[]> {
  try {
    const content = await fs.readFile(path.join(CLAUDE_DIR, 'history.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');

    const entries: HistoryEntry[] = [];

    // Get last N entries
    const startIndex = Math.max(0, lines.length - limit);

    for (let i = startIndex; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        entries.push({
          display: entry.display,
          timestamp: entry.timestamp,
          project: entry.project,
          sessionId: entry.sessionId,
          pastedContents: entry.pastedContents,
        });
      } catch {
        // Skip invalid lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

// Get active sessions
export async function getActiveSessions(): Promise<string[]> {
  try {
    const sessionEnvDir = path.join(CLAUDE_DIR, 'session-env');
    const entries = await fs.readdir(sessionEnvDir, { withFileTypes: true });

    return entries
      .filter(e => e.isDirectory() && e.name !== '.' && e.name !== '..')
      .map(e => e.name);
  } catch {
    return [];
  }
}

// Get all data in one call
export async function getAllClaudeData() {
  const [settings, stats, projects, plugins, skills, history, activeSessions] = await Promise.all([
    getSettings(),
    getStats(),
    getProjects(),
    getPlugins(),
    getSkills(),
    getHistory(50),
    getActiveSessions(),
  ]);

  return {
    settings,
    stats,
    projects,
    plugins,
    skills,
    history,
    activeSessions,
  };
}
