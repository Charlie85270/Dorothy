import { app, Notification, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AgentStatus } from '../types';
import { TG_CHARACTER_FACES, SLACK_CHARACTER_FACES, DATA_DIR, OLD_DATA_DIR } from '../constants';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window;
}

export function getAppBasePath(): string {
  let appPath = app.getAppPath();
  if (appPath.includes('app.asar')) {
    appPath = appPath.replace('app.asar', 'app.asar.unpacked');
  }
  return path.join(appPath, 'out');
}

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Write Dorothy's CLAUDE.md to ~/.dorothy/CLAUDE.md so all agents spawned from
 * Dorothy can load it via --add-dir ~/.dorothy with
 * CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1.
 *
 * First tries to read the live CLAUDE.md from the app source directory.
 * Falls back to a bundled minimal version if the source file is unavailable
 * (e.g. in a packaged .asar build without unpacked assets).
 */
export function ensureDorothyClaudeMd(): void {
  try {
    ensureDataDir();
    const dest = path.join(DATA_DIR, 'CLAUDE.md');

    // Try to read from app source (works in dev and when app.asar is unpacked)
    let content: string | null = null;
    const appPath = app.getAppPath().replace(/app\.asar$/, '').replace(/app\.asar\.unpacked$/, '');
    const candidates = [
      path.join(appPath, 'CLAUDE.md'),
      path.join(appPath, '..', 'CLAUDE.md'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        content = fs.readFileSync(candidate, 'utf-8');
        break;
      }
    }

    // Fallback: write essential agent instructions
    if (!content) {
      content = `# Dorothy Agent Instructions

## Memory

Use auto memory (\`~/.claude/projects/.../memory/\`) actively on every project:
- Save architectural decisions, key file locations, and debugging insights to \`MEMORY.md\`
- Create topic files (e.g. \`patterns.md\`, \`debugging.md\`) for detailed notes — keep \`MEMORY.md\` under 200 lines
- At session start, review \`MEMORY.md\` for relevant context before diving in
- After any correction or new discovery, update memory so the next session benefits

## Workflow

- Enter plan mode for non-trivial tasks (3+ steps or architectural decisions)
- After any correction from the user: update \`tasks/lessons.md\` with the pattern
- Never mark a task complete without proving it works
- When given a bug report: just fix it — point at logs, errors, failing tests and resolve them

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what is necessary.
`;
    }

    fs.writeFileSync(dest, content, 'utf-8');
  } catch (err) {
    console.warn('Failed to write Dorothy CLAUDE.md:', err);
  }
}

/**
 * Migrate data from ~/.claude-manager to ~/.dorothy on first launch after rebrand.
 * Only copies files that don't already exist in the new location to avoid overwriting newer data.
 * Removes the old directory after successful migration.
 */
export function migrateFromClaudeManager() {
  if (!fs.existsSync(OLD_DATA_DIR)) return;

  console.log('Migrating data from ~/.claude-manager to ~/.dorothy...');

  const items = [
    'agents.json',
    'agents.backup.json',
    'app-settings.json',
    'kanban-tasks.json',
    'scheduler-metadata.json',
    'telegram-downloads',
    'scripts',
  ];

  for (const item of items) {
    const src = path.join(OLD_DATA_DIR, item);
    const dest = path.join(DATA_DIR, item);

    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dest)) {
      console.log(`  Skipping ${item} (already exists in ~/.dorothy)`);
      continue;
    }

    try {
      fs.cpSync(src, dest, { recursive: true });
      console.log(`  Migrated ${item}`);
    } catch (err) {
      console.error(`  Failed to migrate ${item}:`, err);
    }
  }

  try {
    fs.rmSync(OLD_DATA_DIR, { recursive: true, force: true });
    console.log('Removed ~/.claude-manager');
  } catch (err) {
    console.error('Failed to remove ~/.claude-manager:', err);
  }
}

export function sendNotification(
  title: string,
  body: string,
  agentId?: string,
  appSettings?: { notificationsEnabled: boolean }
) {
  if (!appSettings?.notificationsEnabled) return;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (agentId) {
        mainWindow.webContents.send('agent:focus', { agentId });
      }
    }
  });

  notification.show();
}

export function isSuperAgent(agent: AgentStatus): boolean {
  const name = agent.name?.toLowerCase() || '';
  return name.includes('super agent') || name.includes('orchestrator');
}

export function getSuperAgent(agents: Map<string, AgentStatus>): AgentStatus | undefined {
  return Array.from(agents.values()).find(a => isSuperAgent(a));
}

export function formatAgentStatus(agent: AgentStatus): string {
  const isSuper = isSuperAgent(agent);
  const emoji = isSuper ? '👑' : (TG_CHARACTER_FACES[agent.character || ''] || '🤖');
  const statusEmoji = {
    idle: '⚪', running: '🟢', completed: '✅', error: '🔴', waiting: '🟡'
  }[agent.status] || '⚪';

  let text = `${emoji} *${agent.name || 'Unnamed'}* ${statusEmoji}\n`;
  text += `   Status: ${agent.status}\n`;
  if (agent.currentTask) {
    text += `   Task: ${agent.currentTask.slice(0, 50)}${agent.currentTask.length > 50 ? '...' : ''}\n`;
  }
  if (!isSuper) {
    text += `   Project: \`${agent.projectPath.split('/').pop()}\``;
  }
  return text;
}

export function formatSlackAgentStatus(a: AgentStatus): string {
  const isSuper = isSuperAgent(a);
  const emoji = isSuper ? ':crown:' : (SLACK_CHARACTER_FACES[a.character || ''] || ':robot_face:');
  const statusEmoji = a.status === 'running' ? ':large_green_circle:' :
                      a.status === 'waiting' ? ':large_yellow_circle:' :
                      a.status === 'error' ? ':red_circle:' : ':white_circle:';

  let text = `${emoji} *${a.name}* ${statusEmoji}\n`;
  if (!isSuper) {
    const project = a.projectPath.split('/').pop() || 'Unknown';
    text += `    :file_folder: \`${project}\`\n`;
  }
  if (a.skills.length > 0) {
    text += `    :wrench: ${a.skills.slice(0, 3).join(', ')}${a.skills.length > 3 ? '...' : ''}\n`;
  }
  if (a.currentTask && a.status === 'running') {
    text += `    :speech_balloon: _${a.currentTask.slice(0, 40)}${a.currentTask.length > 40 ? '...' : ''}_\n`;
  }
  return text;
}

/**
 * Get the real filesystem path for asar-unpacked resources.
 * External processes (like claude CLI) can't read inside .asar archives,
 * so these files are unpacked to app.asar.unpacked/ on disk.
 */
function getResourcePath(filename: string): string {
  const appPath = app.getAppPath();
  const resourcePath = path.join(appPath, 'electron', 'resources', filename);
  // In production, replace app.asar with app.asar.unpacked for external process access
  return resourcePath.replace('app.asar', 'app.asar.unpacked');
}

/**
 * Get the path to the super agent instructions file
 */
export function getSuperAgentInstructionsPath(): string {
  return getResourcePath('super-agent-instructions.md');
}

/**
 * Get the path to the local agent runner script
 */
export function getLocalAgentRunnerPath(): string {
  return getResourcePath('local-agent-runner.js');
}

/**
 * Get the path to the Telegram-specific instructions file
 */
export function getTelegramInstructionsPath(): string {
  return getResourcePath('telegram-instructions.md');
}

/**
 * Read super agent instructions from file
 */
export function getSuperAgentInstructions(): string {
  const instructionsPath = getSuperAgentInstructionsPath();
  try {
    if (fs.existsSync(instructionsPath)) {
      return fs.readFileSync(instructionsPath, 'utf-8');
    }
  } catch (err) {
    console.error('Failed to read super agent instructions:', err);
  }
  // Fallback instructions
  return 'You are the Super Agent - an orchestrator that manages other Claude agents using MCP tools. Use list_agents, start_agent, get_agent_output, send_telegram, and send_slack tools.';
}

/**
 * Read Telegram-specific instructions from file
 */
export function getTelegramInstructions(): string {
  const instructionsPath = getTelegramInstructionsPath();
  try {
    if (fs.existsSync(instructionsPath)) {
      return fs.readFileSync(instructionsPath, 'utf-8');
    }
  } catch (err) {
    console.error('Failed to read telegram instructions:', err);
  }
  return '';
}

