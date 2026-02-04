import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// ============================================
// Automation IPC handlers
// Interacts with the same storage as MCP tools
// ============================================

const AUTOMATIONS_DIR = path.join(os.homedir(), '.claude-manager');
const AUTOMATIONS_FILE = path.join(AUTOMATIONS_DIR, 'automations.json');
const RUNS_FILE = path.join(AUTOMATIONS_DIR, 'automations-runs.json');

// Types matching MCP tools
interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  schedule: {
    type: 'cron' | 'interval';
    cron?: string;
    intervalMinutes?: number;
  };
  source: {
    type: string;
    config: Record<string, unknown>;
  };
  trigger: {
    eventTypes: string[];
    onNewItem: boolean;
    onUpdatedItem?: boolean;
  };
  agent: {
    enabled: boolean;
    projectPath?: string;
    prompt: string;
    model?: string;
  };
  outputs: Array<{
    type: string;
    enabled: boolean;
    template?: string;
  }>;
}

interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'error';
  itemsFound: number;
  itemsProcessed: number;
  error?: string;
}

function ensureDir(): void {
  if (!fs.existsSync(AUTOMATIONS_DIR)) {
    fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true });
  }
}

function loadAutomations(): Automation[] {
  ensureDir();
  if (!fs.existsSync(AUTOMATIONS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(AUTOMATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveAutomations(automations: Automation[]): void {
  ensureDir();
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2));
}

function loadRuns(): AutomationRun[] {
  ensureDir();
  if (!fs.existsSync(RUNS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(RUNS_FILE, 'utf-8');
    return JSON.parse(data).slice(-1000);
  } catch {
    return [];
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Convert interval minutes to cron expression
function intervalToCron(minutes: number): string {
  if (minutes < 60) {
    // Every X minutes
    return `*/${minutes} * * * *`;
  } else if (minutes === 60) {
    // Every hour
    return '0 * * * *';
  } else if (minutes < 1440) {
    // Every X hours
    const hours = Math.floor(minutes / 60);
    return `0 */${hours} * * *`;
  } else {
    // Daily or more
    return '0 0 * * *';
  }
}

// Get path to claude CLI
async function getClaudePath(): Promise<string> {
  // Try multiple methods to find claude

  // Method 1: Run which with bash to get proper PATH (including nvm, etc.)
  const shellWhich = await new Promise<string | null>((resolve) => {
    const proc = spawn('/bin/bash', ['-l', '-c', 'which claude'], {
      env: { ...process.env, HOME: os.homedir() }
    });
    let output = '';
    proc.stdout.on('data', (data) => { output += data; });
    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });

  if (shellWhich && fs.existsSync(shellWhich)) {
    return shellWhich;
  }

  // Method 2: Check common locations
  const commonPaths = [
    path.join(os.homedir(), '.nvm/versions/node', 'v20.11.1', 'bin', 'claude'),
    path.join(os.homedir(), '.nvm/versions/node', 'v22.0.0', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path.join(os.homedir(), '.local/bin/claude'),
  ];

  // Also check for any nvm node version
  const nvmDir = path.join(os.homedir(), '.nvm/versions/node');
  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir);
      for (const version of versions) {
        const claudePath = path.join(nvmDir, version, 'bin', 'claude');
        if (fs.existsSync(claudePath)) {
          return claudePath;
        }
      }
    } catch {
      // Ignore errors
    }
  }

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback
  return '/usr/local/bin/claude';
}

// Create launchd job for automation (macOS)
async function createAutomationLaunchdJob(automation: Automation): Promise<void> {
  const claudePath = await getClaudePath();
  const claudeDir = path.dirname(claudePath);

  // Convert schedule to cron
  let cronSchedule: string;
  if (automation.schedule.type === 'cron' && automation.schedule.cron) {
    cronSchedule = automation.schedule.cron;
  } else {
    cronSchedule = intervalToCron(automation.schedule.intervalMinutes || 60);
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = cronSchedule.split(' ');

  const logPath = path.join(os.homedir(), '.claude-manager', 'logs', `automation-${automation.id}.log`);
  const errorLogPath = path.join(os.homedir(), '.claude-manager', 'logs', `automation-${automation.id}.error.log`);
  const logsDir = path.dirname(logPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Create script to run
  const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `automation-${automation.id}.sh`);
  const scriptsDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  // The script will call Claude with MCP to run the automation
  const prompt = `Use the run_automation MCP tool to run automation with id "${automation.id}". Report the results briefly.`;
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
  const projectPath = automation.agent.projectPath || os.homedir();
  const homeDir = os.homedir();

  // Script sources bash profile for proper PATH (nvm, etc.)
  const scriptContent = `#!/bin/bash

# Source bash profile for proper PATH (nvm, homebrew, etc.)
export HOME="${homeDir}"

# Source nvm if available
if [ -s "${homeDir}/.nvm/nvm.sh" ]; then
  source "${homeDir}/.nvm/nvm.sh" 2>/dev/null || true
fi

# Source bashrc
if [ -f "${homeDir}/.bashrc" ]; then
  source "${homeDir}/.bashrc" 2>/dev/null || true
elif [ -f "${homeDir}/.bash_profile" ]; then
  source "${homeDir}/.bash_profile" 2>/dev/null || true
fi

# Also add claude directory to PATH as fallback
export PATH="${claudeDir}:$PATH"

cd "${projectPath}"
echo "=== Automation started at $(date) ===" >> "${logPath}"
"${claudePath}" --dangerously-skip-permissions --mcp-config "${mcpConfigPath}" -p '${escapedPrompt}' >> "${logPath}" 2>&1
echo "=== Automation completed at $(date) ===" >> "${logPath}"
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755');

  // Build StartCalendarInterval or StartInterval
  const label = `com.claude-manager.automation.${automation.id}`;
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
  const launchAgentsDir = path.dirname(plistPath);
  if (!fs.existsSync(launchAgentsDir)) {
    fs.mkdirSync(launchAgentsDir, { recursive: true });
  }

  let scheduleXml: string;

  // For interval-based schedules, use StartInterval (simpler and more reliable for frequent runs)
  if (automation.schedule.type === 'interval' && automation.schedule.intervalMinutes) {
    const intervalSeconds = automation.schedule.intervalMinutes * 60;
    scheduleXml = `  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>`;
  } else {
    // For cron-based, use StartCalendarInterval
    const calendarInterval: Record<string, number> = {};
    if (minute !== '*' && !minute.includes('/')) calendarInterval.Minute = parseInt(minute, 10);
    if (hour !== '*' && !hour.includes('/')) calendarInterval.Hour = parseInt(hour, 10);
    if (dayOfMonth !== '*') calendarInterval.Day = parseInt(dayOfMonth, 10);
    if (dayOfWeek !== '*') calendarInterval.Weekday = parseInt(dayOfWeek, 10);

    scheduleXml = `  <key>StartCalendarInterval</key>
  <dict>
${Object.entries(calendarInterval).map(([k, v]) => `    <key>${k}</key>\n    <integer>${v}</integer>`).join('\n')}
  </dict>`;
  }

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${scriptPath}</string>
  </array>
${scheduleXml}
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${errorLogPath}</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>`;

  fs.writeFileSync(plistPath, plistContent);

  // Register with launchd
  const uid = process.getuid?.() || 501;
  await new Promise<void>((resolve) => {
    const proc = spawn('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
}

// Remove launchd job for automation (macOS)
async function removeAutomationLaunchdJob(automationId: string): Promise<void> {
  const label = `com.claude-manager.automation.${automationId}`;
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
  const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `automation-${automationId}.sh`);

  // Unload from launchd
  const uid = process.getuid?.() || 501;
  await new Promise<void>((resolve) => {
    const proc = spawn('launchctl', ['bootout', `gui/${uid}/${label}`]);
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });

  // Remove plist file
  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
  }

  // Remove script file
  if (fs.existsSync(scriptPath)) {
    fs.unlinkSync(scriptPath);
  }
}

/**
 * Register all automation IPC handlers
 */
export function registerAutomationHandlers(): void {
  // List automations
  ipcMain.handle('automation:list', async () => {
    try {
      const automations = loadAutomations();
      return { automations };
    } catch (err) {
      console.error('Error listing automations:', err);
      return { automations: [], error: err instanceof Error ? err.message : 'Failed to list automations' };
    }
  });

  // Create automation
  ipcMain.handle('automation:create', async (_event, params: {
    name: string;
    description?: string;
    sourceType: string;
    sourceConfig: string; // JSON string
    scheduleMinutes?: number;
    scheduleCron?: string;
    eventTypes?: string[];
    onNewItem?: boolean;
    agentEnabled?: boolean;
    agentPrompt?: string;
    agentProjectPath?: string;
    outputTelegram?: boolean;
    outputSlack?: boolean;
    outputGitHubComment?: boolean;
    outputTemplate?: string;
  }) => {
    try {
      const automations = loadAutomations();

      // Parse source config
      let sourceConfig: Record<string, unknown> = {};
      try {
        sourceConfig = JSON.parse(params.sourceConfig);
      } catch {
        return { success: false, error: 'Invalid source config JSON' };
      }

      // Build schedule
      const schedule: Automation['schedule'] = params.scheduleCron
        ? { type: 'cron', cron: params.scheduleCron }
        : { type: 'interval', intervalMinutes: params.scheduleMinutes || 60 };

      // Build outputs
      const outputs: Automation['outputs'] = [];
      if (params.outputTelegram) {
        outputs.push({ type: 'telegram', enabled: true, template: params.outputTemplate });
      }
      if (params.outputSlack) {
        outputs.push({ type: 'slack', enabled: true, template: params.outputTemplate });
      }
      if (params.outputGitHubComment) {
        outputs.push({ type: 'github_comment', enabled: true, template: params.outputTemplate });
      }

      const newAutomation: Automation = {
        id: generateId(),
        name: params.name,
        description: params.description,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schedule,
        source: {
          type: params.sourceType,
          config: sourceConfig,
        },
        trigger: {
          eventTypes: params.eventTypes || [],
          onNewItem: params.onNewItem ?? true,
        },
        agent: {
          enabled: params.agentEnabled ?? false,
          projectPath: params.agentProjectPath,
          prompt: params.agentPrompt || '',
        },
        outputs,
      };

      automations.push(newAutomation);
      saveAutomations(automations);

      // Create launchd job on macOS
      if (os.platform() === 'darwin') {
        await createAutomationLaunchdJob(newAutomation);
      }

      return { success: true, automationId: newAutomation.id };
    } catch (err) {
      console.error('Error creating automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create automation' };
    }
  });

  // Update automation
  ipcMain.handle('automation:update', async (_event, id: string, params: {
    enabled?: boolean;
    name?: string;
  }) => {
    try {
      const automations = loadAutomations();
      const index = automations.findIndex(a => a.id === id);
      if (index === -1) {
        return { success: false, error: 'Automation not found' };
      }

      const wasEnabled = automations[index].enabled;

      if (params.enabled !== undefined) {
        automations[index].enabled = params.enabled;
      }
      if (params.name !== undefined) {
        automations[index].name = params.name;
      }
      automations[index].updatedAt = new Date().toISOString();

      saveAutomations(automations);

      // Handle enable/disable of launchd job
      if (os.platform() === 'darwin' && params.enabled !== undefined && params.enabled !== wasEnabled) {
        if (params.enabled) {
          // Re-create the launchd job
          await createAutomationLaunchdJob(automations[index]);
        } else {
          // Remove the launchd job
          await removeAutomationLaunchdJob(id);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Error updating automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update automation' };
    }
  });

  // Delete automation
  ipcMain.handle('automation:delete', async (_event, id: string) => {
    try {
      const automations = loadAutomations();
      const index = automations.findIndex(a => a.id === id);
      if (index === -1) {
        return { success: false, error: 'Automation not found' };
      }

      automations.splice(index, 1);
      saveAutomations(automations);

      // Remove launchd job on macOS
      if (os.platform() === 'darwin') {
        await removeAutomationLaunchdJob(id);
      }

      return { success: true };
    } catch (err) {
      console.error('Error deleting automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete automation' };
    }
  });

  // Run automation manually (triggers MCP tool via shell)
  ipcMain.handle('automation:run', async (_event, id: string) => {
    try {
      const automations = loadAutomations();
      const automation = automations.find(a => a.id === id);
      if (!automation) {
        return { success: false, error: 'Automation not found' };
      }

      // Run the script directly
      const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `automation-${id}.sh`);
      if (fs.existsSync(scriptPath)) {
        spawn('bash', [scriptPath], {
          detached: true,
          stdio: 'ignore',
        }).unref();
        return { success: true, message: 'Automation triggered' };
      }

      return { success: false, error: 'Automation script not found' };
    } catch (err) {
      console.error('Error running automation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to run automation' };
    }
  });

  // Get automation logs
  ipcMain.handle('automation:getLogs', async (_event, id: string) => {
    try {
      const logPath = path.join(os.homedir(), '.claude-manager', 'logs', `automation-${id}.log`);
      const errorLogPath = path.join(os.homedir(), '.claude-manager', 'logs', `automation-${id}.error.log`);

      let logs = '';
      let hasLogs = false;

      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf-8');
        if (content.trim()) {
          hasLogs = true;
          logs += content;
        }
      }

      if (fs.existsSync(errorLogPath)) {
        const errorContent = fs.readFileSync(errorLogPath, 'utf-8');
        if (errorContent.trim()) {
          hasLogs = true;
          if (logs) logs += '\n\n=== Errors ===\n';
          logs += errorContent;
        }
      }

      if (!hasLogs) {
        return { logs: 'No logs available yet. The automation has not run.' };
      }

      // Return last 500 lines
      const lines = logs.split('\n');
      const lastLines = lines.slice(-500).join('\n');

      return { logs: lastLines };
    } catch (err) {
      console.error('Error getting automation logs:', err);
      return { logs: '', error: err instanceof Error ? err.message : 'Failed to get logs' };
    }
  });
}
