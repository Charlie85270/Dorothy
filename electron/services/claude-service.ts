import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Type definitions for Claude data structures
export interface ClaudeSettings {
  [key: string]: unknown;
}

export interface ClaudeStats {
  [key: string]: unknown;
}

export interface ClaudeProject {
  id: string;
  path: string;
  name: string;
  sessions: Array<{ id: string; timestamp: number }>;
  lastAccessed: number;
}

export interface ClaudePlugin {
  [key: string]: unknown;
}

export interface SkillMetadata {
  name: string;
  description?: string;
}

export interface ClaudeSkill {
  name: string;
  source: 'project' | 'user' | 'plugin';
  path: string;
  description?: string;
  projectName?: string;
}

export interface ClaudeHistoryEntry {
  display: string;
  timestamp: number;
  project?: string;
}

export interface ClaudeData {
  settings: ClaudeSettings | null;
  stats: ClaudeStats | null;
  projects: ClaudeProject[];
  plugins: ClaudePlugin[];
  skills: ClaudeSkill[];
  history: ClaudeHistoryEntry[];
  activeSessions: unknown[];
}

/**
 * Read Claude Code settings from ~/.claude/settings.json
 */
export async function getClaudeSettings(): Promise<ClaudeSettings | null> {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) return null;
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read Claude Code stats from stats-cache.json or statsig_user_metadata.json
 */
export async function getClaudeStats(): Promise<ClaudeStats | null> {
  try {
    // Primary stats are in stats-cache.json
    const statsCachePath = path.join(os.homedir(), '.claude', 'stats-cache.json');
    if (fs.existsSync(statsCachePath)) {
      const statsCache = JSON.parse(fs.readFileSync(statsCachePath, 'utf-8'));
      return statsCache;
    }

    // Fallback to statsig_user_metadata.json if it exists
    const statsPath = path.join(os.homedir(), '.claude', 'statsig_user_metadata.json');
    if (fs.existsSync(statsPath)) {
      return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Smart path decoder for Claude project paths
 * Claude encodes paths by replacing / with -, but folder names can contain -,
 * so we need to find the actual path by trying all combinations
 */
function decodeClaudePath(encoded: string): string {
  const parts = encoded.split('-').filter(Boolean);

  // Recursive function to try all combinations
  const tryDecode = (index: number, currentPath: string): string | null => {
    if (index >= parts.length) {
      return fs.existsSync(currentPath) ? currentPath : null;
    }

    // Try adding with slash first (new directory)
    const withSlash = currentPath + '/' + parts[index];
    if (fs.existsSync(withSlash)) {
      const result = tryDecode(index + 1, withSlash);
      if (result) return result;
    }

    // Try combining remaining parts with dashes
    // This handles cases like "frontend-lite" being split into ["frontend", "lite"]
    for (let end = index + 1; end <= parts.length; end++) {
      const combined = parts.slice(index, end).join('-');
      const withCombined = currentPath + '/' + combined;

      if (fs.existsSync(withCombined)) {
        if (end === parts.length) {
          return withCombined;
        }
        const result = tryDecode(end, withCombined);
        if (result) return result;
      }
    }

    return null;
  };

  // Start with empty path (will add leading /)
  const result = tryDecode(0, '');

  if (result) return result;

  // Fallback to simple decode if nothing found
  let decoded = '/' + parts.join('/');
  return decoded;
}

/**
 * Read Claude Code projects from ~/.claude/projects
 */
export async function getClaudeProjects(): Promise<ClaudeProject[]> {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) return [];

    const projects: ClaudeProject[] = [];

    const dirs = fs.readdirSync(projectsDir);
    for (const dir of dirs) {
      const fullPath = path.join(projectsDir, dir);
      const stat = fs.statSync(fullPath);
      if (!stat.isDirectory()) continue;

      // Decode project path smartly
      const decodedPath = decodeClaudePath(dir);

      // Get sessions
      const sessions: Array<{ id: string; timestamp: number }> = [];
      const files = fs.readdirSync(fullPath);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const sessionId = file.replace('.jsonl', '');
          const fileStat = fs.statSync(path.join(fullPath, file));
          sessions.push({ id: sessionId, timestamp: fileStat.mtimeMs });
        }
      }

      projects.push({
        id: dir,
        path: decodedPath,
        name: path.basename(decodedPath),
        sessions: sessions.sort((a, b) => b.timestamp - a.timestamp),
        lastAccessed: stat.mtimeMs,
      });
    }

    return projects.sort((a, b) => b.lastAccessed - a.lastAccessed);
  } catch {
    return [];
  }
}

/**
 * Read Claude Code plugins from ~/.claude/plugins/installed_plugins.json
 */
export async function getClaudePlugins(): Promise<ClaudePlugin[]> {
  try {
    const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(pluginsPath)) return [];
    const data = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Read skill metadata from a skill path
 */
export function readSkillMetadata(skillPath: string): SkillMetadata | null {
  try {
    const metadataPath = path.join(skillPath, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      return { name: metadata.name || path.basename(skillPath), description: metadata.description };
    }
    return { name: path.basename(skillPath) };
  } catch {
    return { name: path.basename(skillPath) };
  }
}

/**
 * Read Claude Code skills from ~/.claude/skills and ~/.agents/skills
 * Also reads plugin skills from installed_plugins.json
 */
export async function getClaudeSkills(): Promise<ClaudeSkill[]> {
  const skills: ClaudeSkill[] = [];

  // User skills from ~/.claude/skills
  const userSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  if (fs.existsSync(userSkillsDir)) {
    const entries = fs.readdirSync(userSkillsDir);
    for (const entry of entries) {
      const entryPath = path.join(userSkillsDir, entry);
      try {
        const realPath = fs.realpathSync(entryPath);
        const metadata = readSkillMetadata(realPath);
        if (metadata) {
          skills.push({
            name: metadata.name,
            source: 'user',
            path: realPath,
            description: metadata.description,
          });
        }
      } catch {
        // Skip broken symlinks
      }
    }
  }

  // User skills from ~/.agents/skills (alternative location)
  const agentsSkillsDir = path.join(os.homedir(), '.agents', 'skills');
  if (fs.existsSync(agentsSkillsDir)) {
    const entries = fs.readdirSync(agentsSkillsDir);
    for (const entry of entries) {
      const entryPath = path.join(agentsSkillsDir, entry);
      try {
        const realPath = fs.realpathSync(entryPath);
        const metadata = readSkillMetadata(realPath);
        if (metadata) {
          // Check if skill with same name already exists (avoid duplicates)
          const existingSkill = skills.find(s => s.name === metadata.name);
          if (!existingSkill) {
            skills.push({
              name: metadata.name,
              source: 'user',
              path: realPath,
              description: metadata.description,
            });
          }
        }
      } catch {
        // Skip broken symlinks
      }
    }
  }

  // Plugin skills from installed_plugins.json
  const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (fs.existsSync(pluginsPath)) {
    try {
      const plugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
      if (Array.isArray(plugins)) {
        for (const plugin of plugins) {
          skills.push({
            name: plugin.name || 'Unknown Plugin',
            source: 'plugin',
            path: plugin.path || '',
            description: plugin.description,
          });
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return skills;
}

/**
 * Read Claude Code history from ~/.claude/.history
 */
export async function getClaudeHistory(limit = 50): Promise<ClaudeHistoryEntry[]> {
  try {
    const historyPath = path.join(os.homedir(), '.claude', '.history');
    if (!fs.existsSync(historyPath)) return [];

    const content = fs.readFileSync(historyPath, 'utf-8');
    const entries = content.trim().split('\n').filter(Boolean);

    return entries.slice(-limit).reverse().map((line) => {
      const [display, timestampStr, project] = line.split('\t');
      return {
        display: display || '',
        timestamp: parseInt(timestampStr || '0', 10),
        project: project || undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get all Claude data (settings, stats, projects, plugins, skills, history)
 */
export async function getAllClaudeData(historyLimit = 50): Promise<ClaudeData> {
  try {
    const [settings, stats, projects, plugins, skills, history] = await Promise.all([
      getClaudeSettings(),
      getClaudeStats(),
      getClaudeProjects(),
      getClaudePlugins(),
      getClaudeSkills(),
      getClaudeHistory(historyLimit),
    ]);

    return {
      settings,
      stats,
      projects,
      plugins,
      skills,
      history,
      activeSessions: [],
    };
  } catch (err) {
    console.error('Failed to get Claude data:', err);
    return {
      settings: null,
      stats: null,
      projects: [],
      plugins: [],
      skills: [],
      history: [],
      activeSessions: [],
    };
  }
}
