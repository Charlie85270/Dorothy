import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import TelegramBot from 'node-telegram-bot-api';
import * as pty from 'node-pty';
import { AgentStatus, AppSettings } from '../types';
import { TG_CHARACTER_FACES } from '../constants';
import { isSuperAgent, formatAgentStatus, getSuperAgentInstructionsPath, getTelegramInstructionsPath } from '../utils';

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

    // Handle regular messages (forward to Super Agent)
    telegramBot.on('message', async (msg) => {
      // Ignore commands
      if (msg.text?.startsWith('/')) return;
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
 */
export async function sendToSuperAgent(chatId: string, message: string) {
  const superAgent = getSuperAgent();

  if (!superAgent) {
    telegramBot?.sendMessage(chatId,
      '👑 No Super Agent found.\n\nCreate one in Claude Manager first, or use /start\\_agent to start a specific agent.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Sanitize message - replace newlines with spaces for terminal compatibility
  const sanitizedMessage = message.replace(/\r?\n/g, ' ').trim();

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

      // Add system prompt from instructions files
      const instructionsPath = getSuperAgentInstructionsPath();
      if (fs.existsSync(instructionsPath)) {
        command += ` --append-system-prompt "$(cat '${instructionsPath}')"`;
      }

      // Add Telegram-specific instructions
      const telegramInstructionsPath = getTelegramInstructionsPath();
      if (fs.existsSync(telegramInstructionsPath)) {
        command += ` --append-system-prompt "$(cat '${telegramInstructionsPath}')"`;
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
