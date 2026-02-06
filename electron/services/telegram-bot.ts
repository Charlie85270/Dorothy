import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { app } from 'electron';
import TelegramBot from 'node-telegram-bot-api';
import * as pty from 'node-pty';
import { AgentStatus, AppSettings } from '../types';
import { TG_CHARACTER_FACES, TELEGRAM_DOWNLOADS_DIR } from '../constants';
import { isSuperAgent, formatAgentStatus, getSuperAgentInstructions, getTelegramInstructions } from '../utils';

// ============== Telegram Bot State ==============
let telegramBot: TelegramBot | null = null;
let superAgentTelegramTask = false;
let superAgentOutputBuffer: string[] = [];

// References to external state (will be injected)
let agents: Map<string, AgentStatus>;
let ptyProcesses: Map<string, pty.IPty>;
let appSettings: AppSettings;
let mainWindow: any; // Electron BrowserWindow

// References to external functions (will be injected)
let getSuperAgent: () => AgentStatus | undefined;
let saveAgents: () => void;
let getClaudeStats: () => Promise<any>;
let initAgentPty: (agent: AgentStatus) => Promise<string>;
let saveAppSettings: (settings: AppSettings) => void;

/**
 * Initialize Telegram bot service with external dependencies
 */
export function initTelegramBotService(
  agentsMap: Map<string, AgentStatus>,
  ptyMap: Map<string, pty.IPty>,
  settings: AppSettings,
  window: any,
  getSuperAgentFn: () => AgentStatus | undefined,
  saveAgentsFn: () => void,
  getClaudeStatsFn: () => Promise<any>,
  initAgentPtyFn: (agent: AgentStatus) => Promise<string>,
  saveAppSettingsFn: (settings: AppSettings) => void
) {
  agents = agentsMap;
  ptyProcesses = ptyMap;
  appSettings = settings;
  mainWindow = window;
  getSuperAgent = getSuperAgentFn;
  saveAgents = saveAgentsFn;
  getClaudeStats = getClaudeStatsFn;
  initAgentPty = initAgentPtyFn;
  saveAppSettings = saveAppSettingsFn;
}

/**
 * Send message to Telegram (to all authorized users)
 */
export function sendTelegramMessage(text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
  if (!telegramBot) return;

  // Get all authorized chat IDs, or fall back to legacy chatId
  const chatIds = appSettings.telegramAuthorizedChatIds?.length > 0
    ? appSettings.telegramAuthorizedChatIds
    : (appSettings.telegramChatId ? [appSettings.telegramChatId] : []);

  if (chatIds.length === 0) return;

  // Telegram has a 4096 char limit, truncate if needed
  const maxLen = 4000;
  const truncated = text.length > maxLen ? text.slice(0, maxLen) + '\n\n_(truncated)_' : text;

  // Send to all authorized users
  for (const chatId of chatIds) {
    try {
      telegramBot.sendMessage(chatId, truncated, { parse_mode: parseMode });
    } catch (err) {
      console.error(`Failed to send Telegram message to ${chatId}:`, err);
      // Try without markdown if it fails (in case of formatting issues)
      try {
        telegramBot.sendMessage(chatId, text.replace(/[*_`\[\]]/g, ''));
      } catch {
        // Give up for this user
      }
    }
  }
}

/**
 * Extract meaningful response from Super Agent output and send to Telegram
 */
export function sendSuperAgentResponseToTelegram(agent: AgentStatus) {
  // Use the captured output buffer if available, otherwise use agent output
  const rawOutput = superAgentOutputBuffer.length > 0
    ? superAgentOutputBuffer.join('')
    : agent.output.slice(-100).join('');

  // Remove ANSI escape codes
  const cleanOutput = rawOutput
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\x1b\[\?[0-9]*[hl]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '') // OSC sequences
    .replace(/[\x00-\x09\x0B-\x1F]/g, ''); // Control chars except newline

  const lines = cleanOutput.split('\n');

  // Find the actual response content - it usually comes after tool results
  // Look for text that's NOT:
  // - Tool use indicators (MCP, ⎿, ●, ⏺)
  // - System messages (---, ctrl+, claude-mgr)
  // - Empty lines at the edges

  const responseLines: string[] = [];
  let foundToolResult = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty
    if (!trimmed) continue;

    // Track when we've seen tool results
    if (trimmed.includes('⎿') || trimmed.includes('(MCP)')) {
      foundToolResult = true;
      continue;
    }

    // Skip system indicators
    if (trimmed.startsWith('●') || trimmed.startsWith('⏺') ||
        trimmed.includes('ctrl+') || trimmed.startsWith('---') ||
        trimmed.startsWith('>') || trimmed.startsWith('$') ||
        trimmed.includes('╭') || trimmed.includes('╰') ||
        trimmed.includes('│') && trimmed.length < 5) {
      continue;
    }

    // After tool results, collect the response text
    if (foundToolResult && trimmed.length > 3) {
      responseLines.push(trimmed);
    }
  }

  // If we found response lines, send them
  if (responseLines.length > 0) {
    // Get the most relevant parts (last portion, likely the summary)
    const response = responseLines.slice(-40).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (response.length > 10) {
      sendTelegramMessage(`👑 ${response}`);
      superAgentOutputBuffer = [];
      return;
    }
  }

  // Fallback: just send the last meaningful text we can find
  const fallbackLines = lines
    .map(l => l.trim())
    .filter(l => l.length > 10 &&
      !l.includes('(MCP)') &&
      !l.includes('⎿') &&
      !l.startsWith('●') &&
      !l.startsWith('⏺') &&
      !l.includes('ctrl+'))
    .slice(-20);

  if (fallbackLines.length > 0) {
    sendTelegramMessage(`👑 ${fallbackLines.join('\n')}`);
  } else {
    sendTelegramMessage(`✅ Super Agent completed the task.`);
  }

  superAgentOutputBuffer = [];
}

/**
 * Check if a chat ID is authorized
 */
function isAuthorized(chatId: string): boolean {
  return appSettings.telegramAuthorizedChatIds?.includes(chatId) || false;
}

/**
 * Send unauthorized message
 */
function sendUnauthorizedMessage(chatId: string | number) {
  telegramBot?.sendMessage(chatId,
    `🔒 *Authentication Required*\n\n` +
    `You are not authorized to use this bot.\n\n` +
    `Use \`/auth <token>\` with your secret token to authenticate.\n\n` +
    `_Get the token from Claude Manager Settings → Telegram_`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Ensure telegram downloads directory exists
 */
function ensureDownloadsDir(): void {
  if (!fs.existsSync(TELEGRAM_DOWNLOADS_DIR)) {
    fs.mkdirSync(TELEGRAM_DOWNLOADS_DIR, { recursive: true });
  }
}

/**
 * Download a file from Telegram servers
 */
async function downloadTelegramFile(fileId: string, fileName: string): Promise<string> {
  if (!telegramBot || !appSettings.telegramBotToken) {
    throw new Error('Telegram bot not initialized');
  }

  ensureDownloadsDir();

  // Get file info from Telegram
  const file = await telegramBot.getFile(fileId);
  if (!file.file_path) {
    throw new Error('Could not get file path from Telegram');
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const ext = path.extname(fileName) || path.extname(file.file_path) || '';
  const baseName = path.basename(fileName, ext) || 'file';
  const uniqueFileName = `${timestamp}-${baseName}${ext}`;
  const localPath = path.join(TELEGRAM_DOWNLOADS_DIR, uniqueFileName);

  // Download file from Telegram
  const fileUrl = `https://api.telegram.org/file/bot${appSettings.telegramBotToken}/${file.file_path}`;

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(localPath);
    https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded Telegram file to: ${localPath}`);
        resolve(localPath);
      });
    }).on('error', (err) => {
      fs.unlink(localPath, () => {}); // Clean up partial file
      reject(err);
    });
  });
}

/**
 * Get file type description for the agent
 */
function getFileTypeDescription(mimeType?: string, fileName?: string): string {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'PDF document';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  }
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
    if (['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext)) return 'video';
    if (['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext)) return 'audio';
    if (ext === '.pdf') return 'PDF document';
    if (['.doc', '.docx', '.odt', '.rtf'].includes(ext)) return 'document';
    if (['.xls', '.xlsx', '.csv', '.ods'].includes(ext)) return 'spreadsheet';
    if (['.ppt', '.pptx', '.odp'].includes(ext)) return 'presentation';
    if (['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext)) return 'archive';
    if (['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.rb'].includes(ext)) return 'code file';
    if (['.json', '.xml', '.yaml', '.yml', '.toml'].includes(ext)) return 'data file';
    if (['.md', '.txt', '.log'].includes(ext)) return 'text file';
  }
  return 'file';
}

/**
 * Initialize Telegram bot and set up handlers
 */
export function initTelegramBot() {
  // Stop existing bot if any
  if (telegramBot) {
    telegramBot.stopPolling();
    telegramBot = null;
  }

  if (!appSettings.telegramEnabled || !appSettings.telegramBotToken) {
    console.log('Telegram bot disabled or no bot token');
    return;
  }

  if (!appSettings.telegramAuthToken) {
    console.log('Telegram bot disabled: no auth token configured (security requirement)');
    return;
  }

  try {
    telegramBot = new TelegramBot(appSettings.telegramBotToken, { polling: true });
    console.log('Telegram bot started');

    // Handle /auth command - ALWAYS accessible (for authentication)
    telegramBot.onText(/\/auth\s+(.+)/, (msg, match) => {
      const chatId = msg.chat.id.toString();
      const providedToken = match?.[1]?.trim();

      if (!providedToken) {
        telegramBot?.sendMessage(chatId, '⚠️ Usage: /auth <token>');
        return;
      }

      // Check if auth token is configured
      if (!appSettings.telegramAuthToken) {
        telegramBot?.sendMessage(chatId,
          '⚠️ No authentication token configured.\n\n' +
          '_Generate one in Claude Manager Settings → Telegram_',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Verify the token
      if (providedToken === appSettings.telegramAuthToken) {
        // Add to authorized list if not already there
        if (!appSettings.telegramAuthorizedChatIds) {
          appSettings.telegramAuthorizedChatIds = [];
        }
        if (!appSettings.telegramAuthorizedChatIds.includes(chatId)) {
          appSettings.telegramAuthorizedChatIds.push(chatId);
          // Also update legacy field for backwards compatibility
          appSettings.telegramChatId = chatId;
          saveAppSettings(appSettings);
          mainWindow?.webContents.send('settings:updated', appSettings);
        }

        telegramBot?.sendMessage(chatId,
          `✅ *Authentication Successful!*\n\n` +
          `Your chat ID \`${chatId}\` has been authorized.\n\n` +
          `You can now use all bot commands. Type /help to see available commands.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        telegramBot?.sendMessage(chatId,
          '❌ *Invalid token*\n\n' +
          '_Check your token in Claude Manager Settings → Telegram_',
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Handle /start command
    telegramBot.onText(/\/start$/, (msg) => {
      const chatId = msg.chat.id.toString();

      // Check authorization
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      telegramBot?.sendMessage(chatId,
        `👑 *Claude Manager Bot Connected!*\n\n` +
        `I'll help you manage your agents remotely.\n\n` +
        `*Commands:*\n` +
        `/status - Show all agents status\n` +
        `/agents - List agents with details\n` +
        `/projects - List all projects\n` +
        `/start\\_agent <name> <task> - Start an agent\n` +
        `/stop\\_agent <name> - Stop an agent\n` +
        `/ask <message> - Send to Super Agent\n` +
        `/usage - Show usage & cost stats\n` +
        `/help - Show this help message\n\n` +
        `Or just type a message to talk to the Super Agent!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /help command
    telegramBot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id.toString();

      // Check authorization
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      telegramBot?.sendMessage(msg.chat.id,
        `📖 *Available Commands*\n\n` +
        `/status - Quick overview of all agents\n` +
        `/agents - Detailed list of all agents\n` +
        `/projects - List all projects with their agents\n` +
        `/start\\_agent <name> <task> - Start an agent with a task\n` +
        `/stop\\_agent <name> - Stop a running agent\n` +
        `/ask <message> - Send a message to Super Agent\n` +
        `/usage - Show usage & cost stats\n` +
        `/help - Show this help message\n\n` +
        `💡 *Tips:*\n` +
        `• Just type a message to talk directly to Super Agent\n` +
        `• Super Agent can manage other agents for you\n` +
        `• Use /status to monitor progress`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /projects command
    telegramBot.onText(/\/projects/, (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      const agentList = Array.from(agents.values()).filter(a => !isSuperAgent(a));

      if (agentList.length === 0) {
        telegramBot?.sendMessage(msg.chat.id, '📭 No projects with agents yet.');
        return;
      }

      // Group agents by project path
      const projectsMap = new Map<string, AgentStatus[]>();
      agentList.forEach(agent => {
        const path = agent.projectPath;
        if (!projectsMap.has(path)) {
          projectsMap.set(path, []);
        }
        projectsMap.get(path)!.push(agent);
      });

      let text = `📂 *Projects*\n\n`;

      projectsMap.forEach((projectAgents, path) => {
        const projectName = path.split('/').pop() || 'Unknown';
        text += `📁 *${projectName}*\n`;
        text += `   \`${path}\`\n`;
        text += `   👥 Agents: ${projectAgents.map(a => {
          const emoji = TG_CHARACTER_FACES[a.character || ''] || '🤖';
          const status = a.status === 'running' ? '🟢' : a.status === 'waiting' ? '🟡' : a.status === 'error' ? '🔴' : '⚪';
          return `${emoji}${a.name}${status}`;
        }).join(', ')}\n\n`;
      });

      telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // Handle /status command
    telegramBot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      const agentList = Array.from(agents.values());
      if (agentList.length === 0) {
        telegramBot?.sendMessage(msg.chat.id, '📭 No agents created yet.');
        return;
      }

      // Helper to format agent info
      const formatAgent = (a: AgentStatus) => {
        const isSuper = isSuperAgent(a);
        const emoji = isSuper ? '👑' : (TG_CHARACTER_FACES[a.character || ''] || '🤖');
        const skills = a.skills.length > 0 ? a.skills.slice(0, 2).join(', ') + (a.skills.length > 2 ? '...' : '') : '';
        let line = `  ${emoji} *${a.name}*\n`;
        // Don't show project for Super Agent
        if (!isSuper) {
          const project = a.projectPath.split('/').pop() || 'Unknown';
          line += `      📁 \`${project}\``;
          if (skills) line += ` | 🛠 ${skills}`;
        } else if (skills) {
          line += `      🛠 ${skills}`;
        }
        if (a.currentTask && a.status === 'running') {
          line += `\n      💬 _${a.currentTask.slice(0, 40)}${a.currentTask.length > 40 ? '...' : ''}_`;
        }
        return line;
      };

      // Sort to put Super Agent first
      const sortSuperFirst = (agents: AgentStatus[]) =>
        [...agents].sort((a, b) => (isSuperAgent(b) ? 1 : 0) - (isSuperAgent(a) ? 1 : 0));

      const running = sortSuperFirst(agentList.filter(a => a.status === 'running'));
      const waiting = sortSuperFirst(agentList.filter(a => a.status === 'waiting'));
      const idle = sortSuperFirst(agentList.filter(a => a.status === 'idle' || a.status === 'completed'));
      const error = sortSuperFirst(agentList.filter(a => a.status === 'error'));

      let text = `📊 *Agents Status*\n\n`;
      if (running.length > 0) {
        text += `🟢 *Running (${running.length}):*\n`;
        running.forEach(a => {
          text += formatAgent(a) + '\n';
        });
        text += '\n';
      }
      if (waiting.length > 0) {
        text += `🟡 *Waiting (${waiting.length}):*\n`;
        waiting.forEach(a => {
          text += formatAgent(a) + '\n';
        });
        text += '\n';
      }
      if (error.length > 0) {
        text += `🔴 *Error (${error.length}):*\n`;
        error.forEach(a => {
          text += formatAgent(a) + '\n';
        });
        text += '\n';
      }
      if (idle.length > 0) {
        text += `⚪ *Idle (${idle.length}):*\n`;
        idle.forEach(a => {
          text += formatAgent(a) + '\n';
        });
      }

      telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // Handle /agents command (detailed list)
    telegramBot.onText(/\/agents/, (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      const agentList = Array.from(agents.values());
      if (agentList.length === 0) {
        telegramBot?.sendMessage(msg.chat.id, '📭 No agents created yet.');
        return;
      }

      let text = `🤖 *All Agents*\n\n`;
      agentList.forEach(a => {
        text += formatAgentStatus(a) + '\n\n';
      });

      telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // Handle /start_agent command
    telegramBot.onText(/\/start_agent\s+(.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      if (!match) return;
      const input = match[1].trim();
      const firstSpaceIndex = input.indexOf(' ');

      let agentName: string;
      let task: string;

      if (firstSpaceIndex === -1) {
        telegramBot?.sendMessage(msg.chat.id, '⚠️ Usage: /start\\_agent <agent name> <task>', { parse_mode: 'Markdown' });
        return;
      }

      agentName = input.substring(0, firstSpaceIndex).toLowerCase();
      task = input.substring(firstSpaceIndex + 1).trim();

      const agent = Array.from(agents.values()).find(a =>
        a.name?.toLowerCase().includes(agentName) || a.id === agentName
      );

      if (!agent) {
        telegramBot?.sendMessage(msg.chat.id, `❌ Agent "${agentName}" not found.`);
        return;
      }

      if (agent.status === 'running') {
        telegramBot?.sendMessage(msg.chat.id, `⚠️ ${agent.name} is already running.`);
        return;
      }

      try {
        // Start the agent using the existing IPC mechanism
        const workingPath = (agent.worktreePath || agent.projectPath).replace(/'/g, "'\\''");

        // Initialize PTY if needed
        if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
          const ptyId = await initAgentPty(agent);
          agent.ptyId = ptyId;
        }

        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (!ptyProcess) {
          telegramBot?.sendMessage(msg.chat.id, '❌ Failed to initialize agent terminal.');
          return;
        }

        // Build command
        let command = 'claude';
        if (agent.skipPermissions) command += ' --dangerously-skip-permissions';
        if (agent.secondaryProjectPath) {
          command += ` --add-dir '${agent.secondaryProjectPath.replace(/'/g, "'\\''")}'`;
        }
        command += ` '${task.replace(/'/g, "'\\''")}'`;

        agent.status = 'running';
        agent.currentTask = task.slice(0, 100);
        agent.lastActivity = new Date().toISOString();
        ptyProcess.write(`cd '${workingPath}' && ${command}`);
        ptyProcess.write('\r');
        saveAgents();

        const emoji = isSuperAgent(agent) ? '👑' : (TG_CHARACTER_FACES[agent.character || ''] || '🤖');
        telegramBot?.sendMessage(msg.chat.id,
          `🚀 Started *${agent.name}*\n\n${emoji} Task: ${task}`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('Failed to start agent from Telegram:', err);
        telegramBot?.sendMessage(msg.chat.id, `❌ Failed to start agent: ${err}`);
      }
    });

    // Handle /stop_agent command
    telegramBot.onText(/\/stop_agent\s+(.+)/, (msg, match) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      if (!match) return;
      const agentName = match[1].trim().toLowerCase();

      const agent = Array.from(agents.values()).find(a =>
        a.name?.toLowerCase().includes(agentName) || a.id === agentName
      );

      if (!agent) {
        telegramBot?.sendMessage(msg.chat.id, `❌ Agent "${agentName}" not found.`);
        return;
      }

      if (agent.status !== 'running' && agent.status !== 'waiting') {
        telegramBot?.sendMessage(msg.chat.id, `⚠️ ${agent.name} is not running.`);
        return;
      }

      // Stop the agent
      if (agent.ptyId) {
        const ptyProcess = ptyProcesses.get(agent.ptyId);
        if (ptyProcess) {
          ptyProcess.write('\x03'); // Ctrl+C
        }
      }
      agent.status = 'idle';
      agent.currentTask = undefined;
      saveAgents();

      telegramBot?.sendMessage(msg.chat.id, `🛑 Stopped *${agent.name}*`, { parse_mode: 'Markdown' });
    });

    // Handle /usage command (show usage and cost stats)
    telegramBot.onText(/\/usage/, async (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      try {
        const stats = await getClaudeStats();

        if (!stats) {
          telegramBot?.sendMessage(msg.chat.id, '📊 No usage data available yet.');
          return;
        }

        // Token pricing per million tokens (MTok) - same as frontend
        const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number; cacheHitsPerMTok: number; cache5mWritePerMTok: number }> = {
          'claude-opus-4-5-20251101': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25 },
          'claude-opus-4-5': { inputPerMTok: 5, outputPerMTok: 25, cacheHitsPerMTok: 0.50, cache5mWritePerMTok: 6.25 },
          'claude-opus-4-1-20250501': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-opus-4-1': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-opus-4': { inputPerMTok: 15, outputPerMTok: 75, cacheHitsPerMTok: 1.50, cache5mWritePerMTok: 18.75 },
          'claude-sonnet-4-5-20251022': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-sonnet-4-5': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-sonnet-4': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-3-7-sonnet-20250219': { inputPerMTok: 3, outputPerMTok: 15, cacheHitsPerMTok: 0.30, cache5mWritePerMTok: 3.75 },
          'claude-haiku-4-5-20251022': { inputPerMTok: 1, outputPerMTok: 5, cacheHitsPerMTok: 0.10, cache5mWritePerMTok: 1.25 },
          'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5, cacheHitsPerMTok: 0.10, cache5mWritePerMTok: 1.25 },
          'claude-3-5-haiku-20241022': { inputPerMTok: 0.80, outputPerMTok: 4, cacheHitsPerMTok: 0.08, cache5mWritePerMTok: 1 },
        };

        const getModelPricing = (modelId: string) => {
          if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];
          const lower = modelId.toLowerCase();
          if (lower.includes('opus-4-5') || lower.includes('opus-4.5')) return MODEL_PRICING['claude-opus-4-5'];
          if (lower.includes('opus-4-1') || lower.includes('opus-4.1')) return MODEL_PRICING['claude-opus-4-1'];
          if (lower.includes('opus-4') || lower.includes('opus4')) return MODEL_PRICING['claude-opus-4'];
          if (lower.includes('sonnet-4-5') || lower.includes('sonnet-4.5')) return MODEL_PRICING['claude-sonnet-4-5'];
          if (lower.includes('sonnet-4') || lower.includes('sonnet4')) return MODEL_PRICING['claude-sonnet-4'];
          if (lower.includes('sonnet-3') || lower.includes('sonnet3')) return MODEL_PRICING['claude-3-7-sonnet-20250219'];
          if (lower.includes('haiku-4-5') || lower.includes('haiku-4.5')) return MODEL_PRICING['claude-haiku-4-5'];
          if (lower.includes('haiku-3-5') || lower.includes('haiku-3.5')) return MODEL_PRICING['claude-3-5-haiku-20241022'];
          return MODEL_PRICING['claude-sonnet-4'];
        };

        const getModelDisplayName = (modelId: string): string => {
          const lower = modelId.toLowerCase();
          if (lower.includes('opus-4-5') || lower.includes('opus-4.5')) return 'Opus 4.5';
          if (lower.includes('opus-4-1') || lower.includes('opus-4.1')) return 'Opus 4.1';
          if (lower.includes('opus-4') || lower.includes('opus4')) return 'Opus 4';
          if (lower.includes('sonnet-4-5') || lower.includes('sonnet-4.5')) return 'Sonnet 4.5';
          if (lower.includes('sonnet-4') || lower.includes('sonnet4')) return 'Sonnet 4';
          if (lower.includes('sonnet-3') || lower.includes('sonnet3')) return 'Sonnet 3.7';
          if (lower.includes('haiku-4-5') || lower.includes('haiku-4.5')) return 'Haiku 4.5';
          if (lower.includes('haiku-3-5') || lower.includes('haiku-3.5')) return 'Haiku 3.5';
          return modelId.split('-').slice(0, 3).join(' ');
        };

        const calculateModelCost = (modelId: string, input: number, output: number, cacheRead: number, cacheWrite: number) => {
          const pricing = getModelPricing(modelId);
          return (input / 1_000_000) * pricing.inputPerMTok +
                 (output / 1_000_000) * pricing.outputPerMTok +
                 (cacheRead / 1_000_000) * pricing.cacheHitsPerMTok +
                 (cacheWrite / 1_000_000) * pricing.cache5mWritePerMTok;
        };

        // Calculate totals
        let totalCost = 0;
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        const modelBreakdown: Array<{ name: string; cost: number; tokens: number }> = [];

        if (stats.modelUsage) {
          Object.entries(stats.modelUsage).forEach(([modelId, usage]: [string, any]) => {
            const input = usage.inputTokens || 0;
            const output = usage.outputTokens || 0;
            const cacheRead = usage.cacheReadInputTokens || 0;
            const cacheWrite = usage.cacheCreationInputTokens || 0;

            totalInput += input;
            totalOutput += output;
            totalCacheRead += cacheRead;
            totalCacheWrite += cacheWrite;

            const cost = calculateModelCost(modelId, input, output, cacheRead, cacheWrite);
            totalCost += cost;

            modelBreakdown.push({
              name: getModelDisplayName(modelId),
              cost,
              tokens: input + output,
            });
          });
        }

        // Sort by cost
        modelBreakdown.sort((a, b) => b.cost - a.cost);

        // Format message
        let text = `📊 *Usage & Cost Summary*\n\n`;
        text += `💰 *Total Cost:* $${totalCost.toFixed(2)}\n`;
        text += `🔢 *Total Tokens:* ${((totalInput + totalOutput) / 1_000_000).toFixed(2)}M\n`;
        text += `📥 Input: ${(totalInput / 1_000_000).toFixed(2)}M\n`;
        text += `📤 Output: ${(totalOutput / 1_000_000).toFixed(2)}M\n`;
        text += `💾 Cache: ${(totalCacheRead / 1_000_000).toFixed(2)}M read\n\n`;

        if (modelBreakdown.length > 0) {
          text += `*By Model:*\n`;
          modelBreakdown.slice(0, 5).forEach(m => {
            const emoji = m.name.includes('Opus') ? '🟣' : m.name.includes('Sonnet') ? '🔵' : '🟢';
            text += `${emoji} ${m.name}: $${m.cost.toFixed(2)}\n`;
          });
        }

        if (stats.totalSessions || stats.totalMessages) {
          text += `\n*Activity:*\n`;
          if (stats.totalSessions) text += `📝 ${stats.totalSessions} sessions\n`;
          if (stats.totalMessages) text += `💬 ${stats.totalMessages} messages\n`;
        }

        if (stats.firstSessionDate) {
          text += `\n_Since ${new Date(stats.firstSessionDate).toLocaleDateString()}_`;
        }

        telegramBot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('Error getting usage stats:', err);
        telegramBot?.sendMessage(msg.chat.id, `❌ Error fetching usage data: ${err}`);
      }
    });

    // Handle /ask command (send to Super Agent)
    telegramBot.onText(/\/ask\s+(.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      if (!match) return;
      const message = match[1].trim();
      await sendToSuperAgent(chatId, message);
    });

    // Handle photo messages
    telegramBot.on('photo', async (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      try {
        // Get the largest photo (last in array)
        const photos = msg.photo;
        if (!photos || photos.length === 0) return;
        const photo = photos[photos.length - 1];

        telegramBot?.sendMessage(chatId, '📥 Downloading image...');

        const fileName = `photo_${msg.message_id}.jpg`;
        const localPath = await downloadTelegramFile(photo.file_id, fileName);

        const caption = msg.caption || '';
        const message = caption
          ? `[FILE ATTACHED - ${getFileTypeDescription(undefined, fileName)} saved to: ${localPath}] ${caption}`
          : `[FILE ATTACHED - ${getFileTypeDescription(undefined, fileName)} saved to: ${localPath}] Please analyze or use this image as needed.`;

        await sendToSuperAgent(chatId, message, [localPath]);
      } catch (err) {
        console.error('Failed to download photo:', err);
        telegramBot?.sendMessage(chatId, `❌ Failed to download image: ${err}`);
      }
    });

    // Handle document messages (PDFs, files, etc.)
    telegramBot.on('document', async (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      try {
        const doc = msg.document;
        if (!doc) return;

        telegramBot?.sendMessage(chatId, `📥 Downloading ${doc.file_name || 'document'}...`);

        const fileName = doc.file_name || `document_${msg.message_id}`;
        const localPath = await downloadTelegramFile(doc.file_id, fileName);
        const fileType = getFileTypeDescription(doc.mime_type, fileName);

        const caption = msg.caption || '';
        const message = caption
          ? `[FILE ATTACHED - ${fileType} "${fileName}" saved to: ${localPath}] ${caption}`
          : `[FILE ATTACHED - ${fileType} "${fileName}" saved to: ${localPath}] Please analyze or use this file as needed.`;

        await sendToSuperAgent(chatId, message, [localPath]);
      } catch (err) {
        console.error('Failed to download document:', err);
        telegramBot?.sendMessage(chatId, `❌ Failed to download document: ${err}`);
      }
    });

    // Handle video messages
    telegramBot.on('video', async (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      try {
        const video = msg.video;
        if (!video) return;

        telegramBot?.sendMessage(chatId, '📥 Downloading video...');

        const fileName = (video as any).file_name || `video_${msg.message_id}.mp4`;
        const localPath = await downloadTelegramFile(video.file_id, fileName);

        const caption = msg.caption || '';
        const message = caption
          ? `[FILE ATTACHED - video "${fileName}" saved to: ${localPath}] ${caption}`
          : `[FILE ATTACHED - video "${fileName}" saved to: ${localPath}] A video file has been downloaded for reference.`;

        await sendToSuperAgent(chatId, message, [localPath]);
      } catch (err) {
        console.error('Failed to download video:', err);
        telegramBot?.sendMessage(chatId, `❌ Failed to download video: ${err}`);
      }
    });

    // Handle audio/voice messages
    telegramBot.on('audio', async (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      try {
        const audio = msg.audio;
        if (!audio) return;

        telegramBot?.sendMessage(chatId, '📥 Downloading audio...');

        const fileName = (audio as any).file_name || `audio_${msg.message_id}.mp3`;
        const localPath = await downloadTelegramFile(audio.file_id, fileName);

        const caption = msg.caption || '';
        const message = caption
          ? `[FILE ATTACHED - audio "${fileName}" saved to: ${localPath}] ${caption}`
          : `[FILE ATTACHED - audio "${fileName}" saved to: ${localPath}] An audio file has been downloaded for reference.`;

        await sendToSuperAgent(chatId, message, [localPath]);
      } catch (err) {
        console.error('Failed to download audio:', err);
        telegramBot?.sendMessage(chatId, `❌ Failed to download audio: ${err}`);
      }
    });

    // Handle voice messages
    telegramBot.on('voice', async (msg) => {
      const chatId = msg.chat.id.toString();
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      try {
        const voice = msg.voice;
        if (!voice) return;

        telegramBot?.sendMessage(chatId, '📥 Downloading voice message...');

        const fileName = `voice_${msg.message_id}.ogg`;
        const localPath = await downloadTelegramFile(voice.file_id, fileName);

        const message = `[FILE ATTACHED - voice message saved to: ${localPath}] A voice message has been downloaded. Note: You may need to transcribe this audio file to understand its content.`;

        await sendToSuperAgent(chatId, message, [localPath]);
      } catch (err) {
        console.error('Failed to download voice:', err);
        telegramBot?.sendMessage(chatId, `❌ Failed to download voice message: ${err}`);
      }
    });

    // Handle regular text messages (forward to Super Agent)
    telegramBot.on('message', async (msg) => {
      // Ignore commands
      if (msg.text?.startsWith('/')) return;
      // Ignore messages already handled by specific handlers (photo, document, video, audio, voice)
      if (msg.photo || msg.document || msg.video || msg.audio || msg.voice) return;
      if (!msg.text) return;

      const chatId = msg.chat.id.toString();

      // Check authorization
      if (!isAuthorized(chatId)) {
        sendUnauthorizedMessage(chatId);
        return;
      }

      await sendToSuperAgent(chatId, msg.text);
    });

    // Handle polling errors
    telegramBot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
    });

  } catch (err) {
    console.error('Failed to initialize Telegram bot:', err);
  }
}

/**
 * Send message to Super Agent
 * @param chatId - Telegram chat ID
 * @param message - Message text
 * @param attachedFiles - Optional array of local file paths that were downloaded
 */
export async function sendToSuperAgent(chatId: string, message: string, attachedFiles?: string[]) {
  const superAgent = getSuperAgent();

  if (!superAgent) {
    telegramBot?.sendMessage(chatId,
      '👑 No Super Agent found.\n\nCreate one in Claude Manager first, or use /start\\_agent to start a specific agent.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Build message with file information if files are attached
  let fullMessage = message;
  if (attachedFiles && attachedFiles.length > 0) {
    const filesList = attachedFiles.map(f => `  - ${f}`).join('\n');
    fullMessage += `\n\nDownloaded files available at:\n${filesList}\n\nYou can read/analyze these files using your tools.`;
  }

  // Sanitize message - replace newlines with spaces for terminal compatibility
  const sanitizedMessage = fullMessage.replace(/\r?\n/g, ' ').trim();

  try {
    // Initialize PTY if needed
    if (!superAgent.ptyId || !ptyProcesses.has(superAgent.ptyId)) {
      const ptyId = await initAgentPty(superAgent);
      superAgent.ptyId = ptyId;
    }

    const ptyProcess = ptyProcesses.get(superAgent.ptyId);
    if (!ptyProcess) {
      telegramBot?.sendMessage(chatId, '❌ Failed to connect to Super Agent terminal.');
      return;
    }

    // If agent is running or waiting, send message to the existing Claude session
    if (superAgent.status === 'running' || superAgent.status === 'waiting') {
      // Track that this input came from Telegram
      superAgentTelegramTask = true;
      superAgentOutputBuffer = [];

      superAgent.currentTask = sanitizedMessage.slice(0, 100);
      superAgent.lastActivity = new Date().toISOString();
      saveAgents();

      // Include Telegram context in the message
      const telegramMessage = `[FROM TELEGRAM - Use send_telegram MCP tool to respond!] ${sanitizedMessage}`;

      // Write the message first, then send Enter separately
      ptyProcess.write(telegramMessage);
      ptyProcess.write('\r');

      telegramBot?.sendMessage(chatId, `👑 Super Agent is processing...`);
    } else if (superAgent.status === 'idle' || superAgent.status === 'completed' || superAgent.status === 'error') {
      // No active session, start a new one
      const workingPath = (superAgent.worktreePath || superAgent.projectPath).replace(/'/g, "'\\''");

      // Build command with instructions file
      let command = 'claude';

      // Add MCP config
      const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        command += ` --mcp-config '${mcpConfigPath}'`;
      }

      // Add system prompt from instructions (read via Node.js, not cat - asar compatibility)
      const superAgentInstructions = getSuperAgentInstructions();
      if (superAgentInstructions) {
        // Escape for shell - replace single quotes and double quotes
        const escapedInstructions = superAgentInstructions.replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/\n/g, ' ');
        command += ` --append-system-prompt "${escapedInstructions}"`;
      }

      // Add Telegram-specific instructions
      const telegramInstructions = getTelegramInstructions();
      if (telegramInstructions) {
        const escapedTelegram = telegramInstructions.replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/\n/g, ' ');
        command += ` --append-system-prompt "${escapedTelegram}"`;
      }

      if (superAgent.skipPermissions) command += ' --dangerously-skip-permissions';

      // Simple prompt with Telegram context - the detailed instructions come from the file
      const userPrompt = `[FROM TELEGRAM - Use send_telegram MCP tool to respond!] ${sanitizedMessage}`;
      command += ` '${userPrompt.replace(/'/g, "'\\''")}'`;

      superAgent.status = 'running';
      superAgent.currentTask = sanitizedMessage.slice(0, 100);
      superAgent.lastActivity = new Date().toISOString();

      // Track that this task came from Telegram
      superAgentTelegramTask = true;
      superAgentOutputBuffer = [];

      // Start new Claude session
      ptyProcess.write(`cd '${workingPath}' && ${command}`);
      ptyProcess.write('\r');
      saveAgents();

      telegramBot?.sendMessage(chatId, `👑 Super Agent is processing your request...`);
    } else {
      telegramBot?.sendMessage(chatId,
        `👑 Super Agent is in ${superAgent.status} state. Try again in a moment.`
      );
    }
  } catch (err) {
    console.error('Failed to send to Super Agent:', err);
    telegramBot?.sendMessage(chatId, `❌ Error: ${err}`);
  }
}

/**
 * Stop Telegram bot
 */
export function stopTelegramBot() {
  if (telegramBot) {
    telegramBot.stopPolling();
    telegramBot = null;
    console.log('Telegram bot stopped');
  }
}

/**
 * Get Telegram bot instance
 */
export function getTelegramBot(): TelegramBot | null {
  return telegramBot;
}

/**
 * Get super agent Telegram task flag
 */
export function isSuperAgentTelegramTask(): boolean {
  return superAgentTelegramTask;
}

/**
 * Set super agent Telegram task flag
 */
export function setSuperAgentTelegramTask(value: boolean) {
  superAgentTelegramTask = value;
}

/**
 * Get super agent output buffer
 */
export function getSuperAgentOutputBuffer(): string[] {
  return superAgentOutputBuffer;
}

/**
 * Append to super agent output buffer
 */
export function appendSuperAgentOutputBuffer(text: string) {
  superAgentOutputBuffer.push(text);
}

/**
 * Clear super agent output buffer
 */
export function clearSuperAgentOutputBuffer() {
  superAgentOutputBuffer = [];
}
