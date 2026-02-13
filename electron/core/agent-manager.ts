import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow, Notification } from 'electron';
import { AgentStatus, AppSettings } from '../types';
import { AGENTS_FILE, DATA_DIR } from '../constants';
import { ensureDataDir, isSuperAgent } from '../utils';
import { ptyProcesses } from './pty-manager';
import { buildFullPath } from '../utils/path-builder';

export const agents: Map<string, AgentStatus> = new Map();

export let agentsLoaded = false;
export let superAgentTelegramTask = false;
export let superAgentOutputBuffer: string[] = [];

export function setSuperAgentTelegramTask(value: boolean) {
  superAgentTelegramTask = value;
}

export function getSuperAgentOutputBuffer(): string[] {
  return superAgentOutputBuffer;
}

export function clearSuperAgentOutputBuffer() {
  superAgentOutputBuffer = [];
}

const previousAgentStatus: Map<string, string> = new Map();

const pendingStatusChanges: Map<string, {
  newStatus: string;
  scheduledAt: number;
  timeoutId: NodeJS.Timeout;
}> = new Map();

export function handleStatusChangeNotification(
  agent: AgentStatus,
  newStatus: string,
  appSettings: AppSettings,
  sendNotification: (title: string, body: string, agentId?: string, settings?: { notificationsEnabled: boolean }) => void,
  sendTelegramMessage?: (text: string) => void,
  sendSuperAgentResponseToTelegram?: (agent: AgentStatus) => void
) {
  const prevStatus = previousAgentStatus.get(agent.id);

  if (!prevStatus) {
    previousAgentStatus.set(agent.id, newStatus);
    return;
  }

  if (prevStatus === newStatus) {
    return;
  }

  if (newStatus === 'running') {
    const pending = pendingStatusChanges.get(agent.id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingStatusChanges.delete(agent.id);
    }
    previousAgentStatus.set(agent.id, newStatus);
    return;
  }

  const pending = pendingStatusChanges.get(agent.id);

  if (pending && pending.newStatus === newStatus) {
    return;
  }

  if (pending) {
    clearTimeout(pending.timeoutId);
  }

  const timeoutId = setTimeout(() => {
    pendingStatusChanges.delete(agent.id);

    const currentAgent = agents.get(agent.id);
    if (!currentAgent || currentAgent.status !== newStatus) {
      return;
    }

    previousAgentStatus.set(agent.id, newStatus);

    const agentName = currentAgent.name || `Agent ${currentAgent.id.slice(0, 6)}`;
    const isSuper = isSuperAgent(currentAgent);

    if (newStatus === 'waiting') {
      if (!isSuper && appSettings.notifyOnWaiting) {
        sendNotification(
          `${agentName} needs your attention`,
          'The agent is waiting for your input.',
          currentAgent.id,
          appSettings
        );
      }
      if (isSuper && superAgentTelegramTask && sendSuperAgentResponseToTelegram) {
        sendSuperAgentResponseToTelegram(currentAgent);
        superAgentTelegramTask = false;
      }
    } else if (newStatus === 'completed' && appSettings.notifyOnComplete) {
      if (!isSuper) {
        sendNotification(
          `${agentName} completed`,
          currentAgent.currentTask ? `Finished: ${currentAgent.currentTask.slice(0, 50)}...` : 'Task completed successfully.',
          currentAgent.id,
          appSettings
        );
      }
      if (isSuper && superAgentTelegramTask && sendSuperAgentResponseToTelegram) {
        sendSuperAgentResponseToTelegram(currentAgent);
        superAgentTelegramTask = false;
      }
    } else if (newStatus === 'error' && appSettings.notifyOnError) {
      if (!isSuper) {
        sendNotification(
          `${agentName} encountered an error`,
          currentAgent.error || 'An error occurred while running.',
          currentAgent.id,
          appSettings
        );
      }
      if (isSuper && superAgentTelegramTask && sendTelegramMessage) {
        sendTelegramMessage(`🔴 Super Agent error: ${currentAgent.error || 'An error occurred.'}`);
        superAgentTelegramTask = false;
      }
    }
  }, 5000);

  pendingStatusChanges.set(agent.id, {
    newStatus,
    scheduledAt: Date.now(),
    timeoutId,
  });
}

export function saveAgents() {
  try {
    if (!agentsLoaded) {
      console.log('Skipping save - agents not loaded yet');
      return;
    }

    ensureDataDir();
    const agentsArray = Array.from(agents.values()).map(agent => ({
      ...agent,
      ptyId: undefined,
      pathMissing: undefined,
      output: agent.output.slice(-100),
      status: agent.status === 'running' ? 'idle' : agent.status,
    }));

    if (fs.existsSync(AGENTS_FILE)) {
      const existingContent = fs.readFileSync(AGENTS_FILE, 'utf-8');
      if (existingContent.trim().length > 2) {
        const backupFile = path.join(DATA_DIR, 'agents.backup.json');
        fs.writeFileSync(backupFile, existingContent);
      }
    }

    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agentsArray, null, 2));
    console.log(`Saved ${agentsArray.length} agents to disk`);
  } catch (err) {
    console.error('Failed to save agents:', err);
  }
}

export function loadAgents() {
  try {
    if (!fs.existsSync(AGENTS_FILE)) {
      console.log('No agents file found, starting fresh');
      agentsLoaded = true;
      return;
    }

    const data = fs.readFileSync(AGENTS_FILE, 'utf-8');

    if (!data.trim() || data.trim() === '[]') {
      console.log('Agents file is empty, checking for backup...');
      const backupFile = path.join(DATA_DIR, 'agents.backup.json');
      if (fs.existsSync(backupFile)) {
        const backupData = fs.readFileSync(backupFile, 'utf-8');
        if (backupData.trim() && backupData.trim() !== '[]') {
          console.log('Restoring agents from backup...');
          fs.writeFileSync(AGENTS_FILE, backupData);
          loadAgents();
          return;
        }
      }
      agentsLoaded = true;
      return;
    }

    const agentsArray = JSON.parse(data) as AgentStatus[];

    for (const agent of agentsArray) {
      const workingPath = agent.worktreePath || agent.projectPath;
      if (!fs.existsSync(workingPath)) {
        console.warn(`Agent ${agent.id} has missing path: ${workingPath} - marking as pathMissing`);
        agent.pathMissing = true;
      } else {
        agent.pathMissing = false;
      }

      agent.status = 'idle';
      agent.ptyId = undefined;

      agents.set(agent.id, agent);
    }

    console.log(`Loaded ${agents.size} agents from disk`);
    agentsLoaded = true;
  } catch (err) {
    console.error('Failed to load agents:', err);
    agentsLoaded = true;
  }
}

export async function initAgentPty(
  agent: AgentStatus,
  mainWindow: BrowserWindow | null,
  handleStatusChangeNotificationCallback: (agent: AgentStatus, newStatus: string) => void,
  saveAgentsCallback: () => void
): Promise<string> {
  const shell = '/bin/bash';
  let cwd = agent.worktreePath || agent.projectPath;

  if (!fs.existsSync(cwd)) {
    console.warn(`Agent ${agent.id} cwd does not exist: ${cwd} — falling back to home directory`);
    cwd = os.homedir();
  }

  console.log(`Initializing PTY for restored agent ${agent.id} in ${cwd}`);

  // Build PATH that includes user-configured paths, nvm, and other common locations for claude
  const cliExtraPaths: string[] = [];
  try {
    const settingsFile = path.join(os.homedir(), '.dorothy', 'app-settings.json');
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      if (settings.cliPaths) {
        if (settings.cliPaths.claude) {
          cliExtraPaths.push(path.dirname(settings.cliPaths.claude));
        }
        if (settings.cliPaths.gh) {
          cliExtraPaths.push(path.dirname(settings.cliPaths.gh));
        }
        if (settings.cliPaths.node) {
          cliExtraPaths.push(path.dirname(settings.cliPaths.node));
        }
        if (settings.cliPaths.additionalPaths) {
          cliExtraPaths.push(...settings.cliPaths.additionalPaths.filter(Boolean));
        }
      }
    }
  } catch {
    // Ignore settings load errors
  }
  const fullPath = buildFullPath(cliExtraPaths);

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: {
      ...process.env as { [key: string]: string },
      PATH: fullPath,
      CLAUDE_SKILLS: agent.skills.join(','),
      CLAUDE_AGENT_ID: agent.id,
      CLAUDE_PROJECT_PATH: agent.projectPath,
    },
  });

  const ptyId = uuidv4();
  ptyProcesses.set(ptyId, ptyProcess);

  ptyProcess.onData((data) => {
    const agentData = agents.get(agent.id);
    if (agentData) {
      agentData.output.push(data);
      agentData.lastActivity = new Date().toISOString();

      if (superAgentTelegramTask && isSuperAgent(agentData)) {
        superAgentOutputBuffer.push(data);
        if (superAgentOutputBuffer.length > 200) {
          superAgentOutputBuffer = superAgentOutputBuffer.slice(-100);
        }
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:output', {
        type: 'output',
        agentId: agent.id,
        ptyId,
        data,
        timestamp: new Date().toISOString(),
      });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`Agent ${agent.id} PTY exited with code ${exitCode}`);
    const agentData = agents.get(agent.id);
    if (agentData) {
      const newStatus = exitCode === 0 ? 'completed' : 'error';
      agentData.status = newStatus;
      agentData.lastActivity = new Date().toISOString();
      handleStatusChangeNotificationCallback(agentData, newStatus);
      saveAgentsCallback();
    }
    ptyProcesses.delete(ptyId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:complete', {
        type: 'complete',
        agentId: agent.id,
        ptyId,
        exitCode,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return ptyId;
}
