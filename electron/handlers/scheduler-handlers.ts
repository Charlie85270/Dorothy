import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Scheduler IPC handlers (native implementation)
// ============================================

const SCHEDULER_METADATA_PATH = path.join(os.homedir(), '.dorothy', 'scheduler-metadata.json');

interface SchedulerTaskMetadata {
  agentId?: string;
  agentName?: string;
  notifications: {
    telegram: boolean;
    slack: boolean;
  };
  createdAt: string;
}

function loadSchedulerMetadata(): Record<string, SchedulerTaskMetadata> {
  try {
    if (fs.existsSync(SCHEDULER_METADATA_PATH)) {
      return JSON.parse(fs.readFileSync(SCHEDULER_METADATA_PATH, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

function saveSchedulerMetadata(metadata: Record<string, SchedulerTaskMetadata>): void {
  try {
    const dir = path.dirname(SCHEDULER_METADATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCHEDULER_METADATA_PATH, JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error('Error saving scheduler metadata:', err);
  }
}

// Convert cron expression to human-readable format
function cronToHuman(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every minute
  if (minute === '*' && hour === '*') return 'Every minute';

  // Hourly
  if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return minute === '0' ? 'Every hour' : `Every hour at :${minute.padStart(2, '0')}`;
  }

  // Daily
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const h = parseInt(hour, 10);
    const m = minute.padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${displayHour}:${m} ${period}`;
  }

  // Weekdays
  if (dayOfWeek === '1-5' && dayOfMonth === '*' && month === '*') {
    const h = parseInt(hour, 10);
    const m = minute.padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Weekdays at ${displayHour}:${m} ${period}`;
  }

  // Weekly (specific day)
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNum = parseInt(dayOfWeek, 10);
    const dayName = days[dayNum] || dayOfWeek;
    const h = parseInt(hour, 10);
    const m = minute.padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dayName}s at ${displayHour}:${m} ${period}`;
  }

  // Monthly
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const h = parseInt(hour, 10);
    const m = minute.padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const daySuffix = dayOfMonth === '1' ? 'st' : dayOfMonth === '2' ? 'nd' : dayOfMonth === '3' ? 'rd' : 'th';
    return `Monthly on the ${dayOfMonth}${daySuffix} at ${displayHour}:${m} ${period}`;
  }

  return cron;
}

// Calculate next run time from cron expression
function getNextRunTime(cron: string): string | undefined {
  try {
    const parts = cron.split(' ');
    if (parts.length !== 5) return undefined;

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Set the time
    if (hour !== '*') next.setHours(parseInt(hour, 10));
    if (minute !== '*') next.setMinutes(parseInt(minute, 10));
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If the time has passed today, move to tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // Handle day of week
    if (dayOfWeek !== '*') {
      const targetDays = dayOfWeek.split(',').map(d => parseInt(d, 10));
      while (!targetDays.includes(next.getDay())) {
        next.setDate(next.getDate() + 1);
      }
    }

    // Handle day of month
    if (dayOfMonth !== '*') {
      const targetDay = parseInt(dayOfMonth, 10);
      while (next.getDate() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next.toISOString();
  } catch {
    return undefined;
  }
}

// Get path to claude CLI — reads user-configured path from app-settings first
async function getClaudePath(): Promise<string> {
  // Check user-configured path in app-settings.json
  try {
    const settingsFile = path.join(os.homedir(), '.dorothy', 'app-settings.json');
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      if (settings.cliPaths?.claude && fs.existsSync(settings.cliPaths.claude)) {
        return settings.cliPaths.claude;
      }
    }
  } catch {
    // Ignore settings read errors
  }

  // Fallback: try to detect via which
  return new Promise((resolve) => {
    const proc = spawn('/bin/bash', ['-l', '-c', 'which claude'], {
      env: { ...process.env, HOME: os.homedir() }
    });
    let output = '';
    proc.stdout.on('data', (data) => { output += data; });
    proc.on('close', () => {
      const claudePath = output.trim() || '/usr/local/bin/claude';
      resolve(claudePath);
    });
    proc.on('error', () => {
      resolve('/usr/local/bin/claude');
    });
  });
}

// Fix MCP server paths in mcp.json
async function fixMcpServerPaths(): Promise<void> {
  const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
  if (!fs.existsSync(mcpConfigPath)) return;

  try {
    const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
    if (!config.mcpServers) return;

    let modified = false;
    for (const [, server] of Object.entries(config.mcpServers)) {
      const srv = server as { command?: string; args?: string[] };
      // Fix node paths
      if (srv.command === 'node' && srv.args?.[0] && !fs.existsSync(srv.args[0])) {
        // Try to find the correct path
        const baseName = path.basename(srv.args[0]);
        const possiblePaths = [
          path.join(os.homedir(), '.claude', 'plugins', baseName),
          path.join(os.homedir(), '.claude', 'mcp-servers', baseName),
        ];
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            srv.args[0] = p;
            modified = true;
            break;
          }
        }
      }
    }

    if (modified) {
      fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
    }
  } catch {
    // Ignore errors
  }
}

// Create launchd job (macOS)
async function createLaunchdJob(
  taskId: string,
  schedule: string,
  projectPath: string,
  prompt: string,
  autonomous: boolean
): Promise<void> {
  const claudePath = await getClaudePath();
  const claudeDir = path.dirname(claudePath);

  const [minute, hour, dayOfMonth, , dayOfWeek] = schedule.split(' ');

  const logPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.log`);
  const errorLogPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.error.log`);
  const logsDir = path.dirname(logPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Create script to run
  const scriptPath = path.join(os.homedir(), '.dorothy', 'scripts', `${taskId}.sh`);
  const scriptsDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const flags = autonomous ? '--dangerously-skip-permissions' : '';
  const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
  const homeDir = os.homedir();

  const scriptContent = `#!/bin/bash

# Source shell profile for proper PATH (nvm, homebrew, etc.)
export HOME="${homeDir}"

if [ -s "${homeDir}/.nvm/nvm.sh" ]; then
  source "${homeDir}/.nvm/nvm.sh" 2>/dev/null || true
fi

if [ -f "${homeDir}/.bashrc" ]; then
  source "${homeDir}/.bashrc" 2>/dev/null || true
elif [ -f "${homeDir}/.bash_profile" ]; then
  source "${homeDir}/.bash_profile" 2>/dev/null || true
elif [ -f "${homeDir}/.zshrc" ]; then
  source "${homeDir}/.zshrc" 2>/dev/null || true
fi

export PATH="${claudeDir}:$PATH"
cd "${projectPath}"
echo "=== Task started at $(date) ===" >> "${logPath}"
"${claudePath}" ${flags} --mcp-config "${mcpConfigPath}" -p '${escapedPrompt}' >> "${logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${logPath}"
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755');

  // Build StartCalendarInterval
  const calendarInterval: Record<string, number> = {};
  if (minute !== '*') calendarInterval.Minute = parseInt(minute, 10);
  if (hour !== '*') calendarInterval.Hour = parseInt(hour, 10);
  if (dayOfMonth !== '*') calendarInterval.Day = parseInt(dayOfMonth, 10);
  if (dayOfWeek !== '*') calendarInterval.Weekday = parseInt(dayOfWeek, 10);

  const label = `com.dorothy.scheduler.${taskId}`;
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
  const launchAgentsDir = path.dirname(plistPath);
  if (!fs.existsSync(launchAgentsDir)) {
    fs.mkdirSync(launchAgentsDir, { recursive: true });
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
  <key>StartCalendarInterval</key>
  <dict>
${Object.entries(calendarInterval).map(([k, v]) => `    <key>${k}</key>\n    <integer>${v}</integer>`).join('\n')}
  </dict>
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

// Create cron job (Linux)
async function createCronJob(
  taskId: string,
  schedule: string,
  projectPath: string,
  prompt: string,
  autonomous: boolean
): Promise<void> {
  const claudePath = await getClaudePath();
  const claudeDir = path.dirname(claudePath);

  const scriptPath = path.join(os.homedir(), '.dorothy', 'scripts', `${taskId}.sh`);
  const scriptsDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  const logPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.log`);
  const logsDir = path.dirname(logPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const flags = autonomous ? '--dangerously-skip-permissions' : '';
  const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
  const homeDir = os.homedir();

  const scriptContent = `#!/bin/bash

# Source shell profile for proper PATH (nvm, homebrew, etc.)
export HOME="${homeDir}"

if [ -s "${homeDir}/.nvm/nvm.sh" ]; then
  source "${homeDir}/.nvm/nvm.sh" 2>/dev/null || true
fi

if [ -f "${homeDir}/.bashrc" ]; then
  source "${homeDir}/.bashrc" 2>/dev/null || true
elif [ -f "${homeDir}/.bash_profile" ]; then
  source "${homeDir}/.bash_profile" 2>/dev/null || true
elif [ -f "${homeDir}/.zshrc" ]; then
  source "${homeDir}/.zshrc" 2>/dev/null || true
fi

export PATH="${claudeDir}:$PATH"
cd "${projectPath}"
echo "=== Task started at $(date) ===" >> "${logPath}"
"${claudePath}" ${flags} --mcp-config "${mcpConfigPath}" -p '${escapedPrompt}' >> "${logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${logPath}"
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755');

  const cronLine = `${schedule} ${scriptPath} # dorothy-${taskId}`;

  await new Promise<void>((resolve, reject) => {
    const getCron = spawn('crontab', ['-l']);
    let existingCron = '';
    getCron.stdout.on('data', (data) => { existingCron += data; });
    getCron.on('close', () => {
      const newCron = existingCron + '\n' + cronLine + '\n';
      const setCron = spawn('crontab', ['-']);
      setCron.stdin.write(newCron);
      setCron.stdin.end();
      setCron.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`crontab failed with code ${code}`));
      });
      setCron.on('error', reject);
    });
    getCron.on('error', () => {
      const setCron = spawn('crontab', ['-']);
      setCron.stdin.write(cronLine + '\n');
      setCron.stdin.end();
      setCron.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`crontab failed with code ${code}`));
      });
      setCron.on('error', reject);
    });
  });
}

/**
 * Register all scheduler IPC handlers
 */
export function registerSchedulerHandlers(): void {
  // Fix MCP server paths
  ipcMain.handle('scheduler:fixMcpPaths', async () => {
    try {
      await fixMcpServerPaths();
      return { success: true };
    } catch (err) {
      console.error('Error fixing MCP paths:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fix MCP paths' };
    }
  });

  // List scheduled tasks
  ipcMain.handle('scheduler:listTasks', async () => {
    try {
      const tasks: Array<{
        id: string;
        prompt: string;
        schedule: string;
        scheduleHuman: string;
        projectPath: string;
        agentId?: string;
        agentName?: string;
        autonomous: boolean;
        worktree?: { enabled: boolean; branchPrefix?: string };
        notifications: { telegram: boolean; slack: boolean };
        createdAt: string;
        lastRun?: string;
        lastRunStatus?: 'success' | 'error';
        nextRun?: string;
      }> = [];

      const metadata = loadSchedulerMetadata();
      const addedTaskIds = new Set<string>();

      // Read global schedules
      const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
      if (fs.existsSync(globalSchedulesPath)) {
        try {
          const schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
          if (Array.isArray(schedules)) {
            for (const schedule of schedules) {
              const taskMeta = metadata[schedule.id] || {
                notifications: { telegram: false, slack: false },
                createdAt: new Date().toISOString(),
              };

              let lastRun: string | undefined;
              let lastRunStatus: 'success' | 'error' | undefined;
              const logPath = path.join(os.homedir(), '.claude', 'logs', `${schedule.id}.log`);
              if (fs.existsSync(logPath)) {
                const stat = fs.statSync(logPath);
                lastRun = stat.mtime.toISOString();
                try {
                  const logContent = fs.readFileSync(logPath, 'utf-8');
                  lastRunStatus = logContent.includes('error') || logContent.includes('Error') ? 'error' : 'success';
                } catch {
                  lastRunStatus = 'success';
                }
              }

              const taskId = schedule.id || uuidv4();
              addedTaskIds.add(taskId);
              tasks.push({
                id: taskId,
                prompt: schedule.prompt || schedule.task || '',
                schedule: schedule.schedule || schedule.cron || '',
                scheduleHuman: cronToHuman(schedule.schedule || schedule.cron || ''),
                projectPath: schedule.projectPath || schedule.project || os.homedir(),
                agentId: taskMeta.agentId,
                agentName: taskMeta.agentName,
                autonomous: schedule.autonomous ?? true,
                worktree: schedule.worktree,
                notifications: taskMeta.notifications,
                createdAt: taskMeta.createdAt,
                lastRun,
                lastRunStatus,
                nextRun: getNextRunTime(schedule.schedule || schedule.cron || ''),
              });
            }
          }
        } catch (err) {
          console.error('Error reading global schedules:', err);
        }
      }

      // Also check project-level schedules
      const projectsDir = path.join(os.homedir(), '.claude', 'projects');
      if (fs.existsSync(projectsDir)) {
        try {
          const projectDirs = fs.readdirSync(projectsDir);
          for (const projectDir of projectDirs) {
            const projectSchedulesPath = path.join(projectsDir, projectDir, 'schedules.json');
            if (fs.existsSync(projectSchedulesPath)) {
              try {
                const schedules = JSON.parse(fs.readFileSync(projectSchedulesPath, 'utf-8'));
                if (Array.isArray(schedules)) {
                  for (const schedule of schedules) {
                    if (addedTaskIds.has(schedule.id)) continue;

                    const taskMeta = metadata[schedule.id] || {
                      notifications: { telegram: false, slack: false },
                      createdAt: new Date().toISOString(),
                    };

                    let lastRun: string | undefined;
                    let lastRunStatus: 'success' | 'error' | undefined;
                    const logPath = path.join(os.homedir(), '.claude', 'logs', `${schedule.id}.log`);
                    if (fs.existsSync(logPath)) {
                      const stat = fs.statSync(logPath);
                      lastRun = stat.mtime.toISOString();
                      try {
                        const logContent = fs.readFileSync(logPath, 'utf-8');
                        lastRunStatus = logContent.includes('error') || logContent.includes('Error') ? 'error' : 'success';
                      } catch {
                        lastRunStatus = 'success';
                      }
                    }

                    const projectPath = '/' + projectDir.replace(/-/g, '/');
                    const taskId = schedule.id || uuidv4();
                    addedTaskIds.add(taskId);
                    tasks.push({
                      id: taskId,
                      prompt: schedule.prompt || schedule.task || '',
                      schedule: schedule.schedule || schedule.cron || '',
                      scheduleHuman: cronToHuman(schedule.schedule || schedule.cron || ''),
                      projectPath: schedule.projectPath || projectPath,
                      agentId: taskMeta.agentId,
                      agentName: taskMeta.agentName,
                      autonomous: schedule.autonomous ?? true,
                      worktree: schedule.worktree,
                      notifications: taskMeta.notifications,
                      createdAt: taskMeta.createdAt,
                      lastRun,
                      lastRunStatus,
                      nextRun: getNextRunTime(schedule.schedule || schedule.cron || ''),
                    });
                  }
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        } catch {
          // Ignore errors
        }
      }

      // Scan launchd plist files directly (macOS) - catches tasks created by claude-code-scheduler plugin
      if (os.platform() === 'darwin') {
        const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
        if (fs.existsSync(launchAgentsDir)) {
          try {
            const files = fs.readdirSync(launchAgentsDir);
            for (const file of files) {
              if (!file.startsWith('com.claude.schedule.') && !file.startsWith('com.dorothy.scheduler.')) continue;
              if (!file.endsWith('.plist')) continue;

              let taskId: string;
              if (file.startsWith('com.claude.schedule.')) {
                taskId = file.replace('com.claude.schedule.', '').replace('.plist', '');
              } else {
                taskId = file.replace('com.dorothy.scheduler.', '').replace('.plist', '');
              }

              if (addedTaskIds.has(taskId)) continue;

              try {
                const plistPath = path.join(launchAgentsDir, file);
                const plistContent = fs.readFileSync(plistPath, 'utf-8');

                let prompt = '';
                let projectPath = os.homedir();
                let hour = 0;
                let minute = 0;
                let weekday: number | undefined;
                let day: number | undefined;

                // Extract prompt from ProgramArguments
                const argsMatch = plistContent.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/);
                if (argsMatch) {
                  const strings = argsMatch[1].match(/<string>([^<]*)<\/string>/g);
                  if (strings) {
                    for (let i = 0; i < strings.length; i++) {
                      const str = strings[i].replace(/<\/?string>/g, '');
                      if (str === '-p' && strings[i + 1]) {
                        prompt = strings[i + 1].replace(/<\/?string>/g, '');
                        break;
                      }
                    }
                  }
                }

                const workDirMatch = plistContent.match(/<key>WorkingDirectory<\/key>\s*<string>([^<]+)<\/string>/);
                if (workDirMatch) projectPath = workDirMatch[1];

                const calendarMatch = plistContent.match(/<key>StartCalendarInterval<\/key>\s*<dict>([\s\S]*?)<\/dict>/);
                if (calendarMatch) {
                  const cal = calendarMatch[1];
                  const hm = cal.match(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/);
                  const mm = cal.match(/<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/);
                  const wm = cal.match(/<key>Weekday<\/key>\s*<integer>(\d+)<\/integer>/);
                  const dm = cal.match(/<key>Day<\/key>\s*<integer>(\d+)<\/integer>/);
                  if (hm) hour = parseInt(hm[1], 10);
                  if (mm) minute = parseInt(mm[1], 10);
                  if (wm) weekday = parseInt(wm[1], 10);
                  if (dm) day = parseInt(dm[1], 10);
                }

                let cron = `${minute} ${hour} * * *`;
                if (weekday !== undefined) cron = `${minute} ${hour} * * ${weekday}`;
                else if (day !== undefined) cron = `${minute} ${hour} ${day} * *`;

                let lastRun: string | undefined;
                let lastRunStatus: 'success' | 'error' | undefined;
                const logPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.log`);
                if (fs.existsSync(logPath)) {
                  const stat = fs.statSync(logPath);
                  lastRun = stat.mtime.toISOString();
                  try {
                    const logContent = fs.readFileSync(logPath, 'utf-8');
                    lastRunStatus = logContent.includes('error') || logContent.includes('Error') ? 'error' : 'success';
                  } catch {
                    lastRunStatus = 'success';
                  }
                }

                const plistStat = fs.statSync(plistPath);
                const taskMeta = metadata[taskId] || {
                  notifications: { telegram: prompt.toLowerCase().includes('telegram'), slack: prompt.toLowerCase().includes('slack') },
                  createdAt: plistStat.birthtime.toISOString(),
                };

                addedTaskIds.add(taskId);
                tasks.push({
                  id: taskId,
                  prompt,
                  schedule: cron,
                  scheduleHuman: cronToHuman(cron),
                  projectPath,
                  agentId: taskMeta.agentId,
                  agentName: taskMeta.agentName,
                  autonomous: true,
                  worktree: undefined,
                  notifications: taskMeta.notifications,
                  createdAt: taskMeta.createdAt,
                  lastRun,
                  lastRunStatus,
                  nextRun: getNextRunTime(cron),
                });
              } catch (err) {
                console.error(`Error parsing plist ${file}:`, err);
              }
            }
          } catch (err) {
            console.error('Error scanning LaunchAgents:', err);
          }
        }
      }

      return { tasks };
    } catch (err) {
      console.error('Error listing tasks:', err);
      return { tasks: [], error: err instanceof Error ? err.message : 'Failed to list tasks' };
    }
  });

  // Create a new scheduled task
  ipcMain.handle('scheduler:createTask', async (_event, config: {
    prompt: string;
    schedule: string;
    projectPath: string;
    agentId?: string;
    agentName?: string;
    autonomous?: boolean;
    worktree?: { enabled: boolean; branchPrefix?: string };
    notifications?: { telegram: boolean; slack: boolean };
  }) => {
    try {
      const taskId = uuidv4();
      const schedule = config.schedule;
      const autonomous = config.autonomous ?? true;

      // Save to schedules.json
      const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
      let schedules: Array<Record<string, unknown>> = [];
      if (fs.existsSync(globalSchedulesPath)) {
        try {
          schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
          if (!Array.isArray(schedules)) schedules = [];
        } catch {
          schedules = [];
        }
      }

      const newTask = {
        id: taskId,
        prompt: config.prompt,
        schedule: config.schedule,
        projectPath: config.projectPath,
        autonomous,
        worktree: config.worktree,
      };
      schedules.push(newTask);

      const claudeDir = path.join(os.homedir(), '.claude');
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }
      fs.writeFileSync(globalSchedulesPath, JSON.stringify(schedules, null, 2));

      // Save metadata
      const metadata = loadSchedulerMetadata();
      metadata[taskId] = {
        agentId: config.agentId,
        agentName: config.agentName,
        notifications: config.notifications || { telegram: false, slack: false },
        createdAt: new Date().toISOString(),
      };
      saveSchedulerMetadata(metadata);

      // Create platform-specific job
      if (os.platform() === 'darwin') {
        await createLaunchdJob(taskId, schedule, config.projectPath, config.prompt, autonomous);
      } else {
        await createCronJob(taskId, schedule, config.projectPath, config.prompt, autonomous);
      }

      return { success: true, taskId };
    } catch (err) {
      console.error('Error creating task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create task' };
    }
  });

  // Delete a scheduled task
  ipcMain.handle('scheduler:deleteTask', async (_event, taskId: string) => {
    try {
      // Remove from schedules.json
      const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
      if (fs.existsSync(globalSchedulesPath)) {
        let schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
        if (Array.isArray(schedules)) {
          schedules = schedules.filter((s: { id?: string }) => s.id !== taskId);
          fs.writeFileSync(globalSchedulesPath, JSON.stringify(schedules, null, 2));
        }
      }

      // Remove metadata
      const metadata = loadSchedulerMetadata();
      delete metadata[taskId];
      saveSchedulerMetadata(metadata);

      // Remove launchd job (macOS)
      if (os.platform() === 'darwin') {
        const labels = [
          `com.dorothy.scheduler.${taskId}`,
          `com.claude.schedule.${taskId}`,
        ];

        const uid = process.getuid?.() || 501;

        for (const label of labels) {
          const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);

          try {
            await new Promise<void>((resolve) => {
              const proc = spawn('launchctl', ['bootout', `gui/${uid}/${label}`]);
              proc.on('close', () => resolve());
              proc.on('error', () => resolve());
            });
          } catch {
            // Ignore unload errors
          }

          if (fs.existsSync(plistPath)) {
            fs.unlinkSync(plistPath);
          }
        }
      } else {
        // Remove from crontab (Linux)
        await new Promise<void>((resolve) => {
          const getCron = spawn('crontab', ['-l']);
          let existingCron = '';
          getCron.stdout.on('data', (data) => { existingCron += data; });
          getCron.on('close', () => {
            const newCron = existingCron
              .split('\n')
              .filter(line => !line.includes(`dorothy-${taskId}`))
              .join('\n');

            const setCron = spawn('crontab', ['-']);
            setCron.stdin.write(newCron);
            setCron.stdin.end();
            setCron.on('close', () => resolve());
            setCron.on('error', () => resolve());
          });
          getCron.on('error', () => resolve());
        });
      }

      // Remove script file
      const scriptPath = path.join(os.homedir(), '.dorothy', 'scripts', `${taskId}.sh`);
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }

      return { success: true };
    } catch (err) {
      console.error('Error deleting task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete task' };
    }
  });

  // Update a scheduled task
  ipcMain.handle('scheduler:updateTask', async (_event, taskId: string, updates: {
    prompt?: string;
    schedule?: string;
    projectPath?: string;
    autonomous?: boolean;
    notifications?: { telegram: boolean; slack: boolean };
  }) => {
    try {
      // Update schedules.json
      const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
      let found = false;
      let task: Record<string, unknown> | undefined;

      if (fs.existsSync(globalSchedulesPath)) {
        const schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
        if (Array.isArray(schedules)) {
          for (const s of schedules) {
            if (s.id === taskId) {
              if (updates.prompt !== undefined) s.prompt = updates.prompt;
              if (updates.schedule !== undefined) s.schedule = updates.schedule;
              if (updates.projectPath !== undefined) s.projectPath = updates.projectPath;
              if (updates.autonomous !== undefined) s.autonomous = updates.autonomous;
              task = s;
              found = true;
              break;
            }
          }
          if (found) {
            fs.writeFileSync(globalSchedulesPath, JSON.stringify(schedules, null, 2));
          }
        }
      }

      if (!found || !task) {
        return { success: false, error: 'Task not found' };
      }

      // Update metadata (notifications)
      if (updates.notifications) {
        const metadata = loadSchedulerMetadata();
        if (metadata[taskId]) {
          metadata[taskId].notifications = updates.notifications;
          saveSchedulerMetadata(metadata);
        }
      }

      const prompt = (task.prompt as string) || '';
      const schedule = (task.schedule as string) || '';
      const projectPath = (task.projectPath as string) || os.homedir();
      const autonomous = (task.autonomous as boolean) ?? true;
      const scheduleChanged = updates.schedule !== undefined;

      // Always regenerate the shell script
      const claudePath = await getClaudePath();
      const claudeDir = path.dirname(claudePath);
      const logPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.log`);
      const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
      const homeDir = os.homedir();
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      const flags = autonomous ? '--dangerously-skip-permissions' : '';

      const scriptPath = path.join(os.homedir(), '.dorothy', 'scripts', `${taskId}.sh`);
      const scriptsDir = path.dirname(scriptPath);
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      const scriptContent = `#!/bin/bash

# Source shell profile for proper PATH (nvm, homebrew, etc.)
export HOME="${homeDir}"

if [ -s "${homeDir}/.nvm/nvm.sh" ]; then
  source "${homeDir}/.nvm/nvm.sh" 2>/dev/null || true
fi

if [ -f "${homeDir}/.bashrc" ]; then
  source "${homeDir}/.bashrc" 2>/dev/null || true
elif [ -f "${homeDir}/.bash_profile" ]; then
  source "${homeDir}/.bash_profile" 2>/dev/null || true
elif [ -f "${homeDir}/.zshrc" ]; then
  source "${homeDir}/.zshrc" 2>/dev/null || true
fi

export PATH="${claudeDir}:$PATH"
cd "${projectPath}"
echo "=== Task started at $(date) ===" >> "${logPath}"
"${claudePath}" ${flags} --mcp-config "${mcpConfigPath}" -p '${escapedPrompt}' >> "${logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${logPath}"
`;

      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755');

      // If schedule changed, recreate the platform job
      if (scheduleChanged) {
        if (os.platform() === 'darwin') {
          // Remove old launchd job
          const label = `com.dorothy.scheduler.${taskId}`;
          const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
          const uid = process.getuid?.() || 501;

          try {
            await new Promise<void>((resolve) => {
              const proc = spawn('launchctl', ['bootout', `gui/${uid}/${label}`]);
              proc.on('close', () => resolve());
              proc.on('error', () => resolve());
            });
          } catch {
            // Ignore
          }

          if (fs.existsSync(plistPath)) {
            fs.unlinkSync(plistPath);
          }

          // Create new launchd job with updated schedule
          await createLaunchdJob(taskId, schedule, projectPath, prompt, autonomous);
        } else {
          // Remove old cron entry
          await new Promise<void>((resolve) => {
            const getCron = spawn('crontab', ['-l']);
            let existingCron = '';
            getCron.stdout.on('data', (data: Buffer) => { existingCron += data; });
            getCron.on('close', () => {
              const newCron = existingCron
                .split('\n')
                .filter(line => !line.includes(`dorothy-${taskId}`))
                .join('\n');
              const setCron = spawn('crontab', ['-']);
              setCron.stdin.write(newCron);
              setCron.stdin.end();
              setCron.on('close', () => resolve());
              setCron.on('error', () => resolve());
            });
            getCron.on('error', () => resolve());
          });

          // Create new cron job
          await createCronJob(taskId, schedule, projectPath, prompt, autonomous);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Error updating task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update task' };
    }
  });

  // Run a task immediately
  ipcMain.handle('scheduler:runTask', async (_event, taskId: string) => {
    try {
      const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
      let task: { prompt?: string; projectPath?: string; autonomous?: boolean } | undefined;

      if (fs.existsSync(globalSchedulesPath)) {
        const schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
        if (Array.isArray(schedules)) {
          task = schedules.find((s: { id?: string }) => s.id === taskId);
        }
      }

      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      const scriptPath = path.join(os.homedir(), '.dorothy', 'scripts', `${taskId}.sh`);
      if (fs.existsSync(scriptPath)) {
        spawn('bash', [scriptPath], {
          detached: true,
          stdio: 'ignore',
        }).unref();
        return { success: true };
      }

      const logPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.log`);
      const logsDir = path.dirname(logPath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const flags = task.autonomous ? '--dangerously-skip-permissions' : '';
      const proc = spawn('bash', ['-c', `cd "${task.projectPath}" && claude ${flags} -p '${task.prompt?.replace(/'/g, "'\\''")}' >> "${logPath}" 2>&1`], {
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();

      return { success: true };
    } catch (err) {
      console.error('Error running task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to run task' };
    }
  });

  // Get task logs — parsed into individual runs
  ipcMain.handle('scheduler:getLogs', async (_event, taskId: string) => {
    try {
      const logPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.log`);
      const errorLogPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.error.log`);

      const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.claude.schedule.${taskId}.plist`);
      let customLogPath = logPath;
      let customErrorLogPath = errorLogPath;

      if (fs.existsSync(plistPath)) {
        const plistContent = fs.readFileSync(plistPath, 'utf-8');
        const stdOutMatch = plistContent.match(/<key>StandardOutPath<\/key>\s*<string>([^<]+)<\/string>/);
        const stdErrMatch = plistContent.match(/<key>StandardErrorPath<\/key>\s*<string>([^<]+)<\/string>/);
        if (stdOutMatch) customLogPath = stdOutMatch[1];
        if (stdErrMatch) customErrorLogPath = stdErrMatch[1];
      }

      let fullContent = '';
      let hasLogs = false;

      if (fs.existsSync(customLogPath)) {
        const content = fs.readFileSync(customLogPath, 'utf-8');
        if (content.trim()) {
          hasLogs = true;
          fullContent = content;
        }
      }

      // Append error log if present
      let errorContent = '';
      if (fs.existsSync(customErrorLogPath)) {
        const content = fs.readFileSync(customErrorLogPath, 'utf-8');
        if (content.trim()) {
          hasLogs = true;
          errorContent = content;
        }
      }

      if (!hasLogs) {
        return { logs: 'No logs available yet. The task has not run.', runs: [], error: undefined };
      }

      // Parse runs from log content using "=== Task started/completed ===" markers
      const runs: Array<{ startedAt: string; completedAt?: string; content: string }> = [];
      const startRegex = /^=== Task started at (.+?) ===$/gm;
      const completeRegex = /^=== Task completed at (.+?) ===$/gm;

      const starts: Array<{ date: string; index: number }> = [];
      let match: RegExpExecArray | null;
      while ((match = startRegex.exec(fullContent)) !== null) {
        starts.push({ date: match[1], index: match.index + match[0].length });
      }

      const completes: Array<{ date: string; index: number }> = [];
      while ((match = completeRegex.exec(fullContent)) !== null) {
        completes.push({ date: match[1], index: match.index });
      }

      for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        const nextStart = starts[i + 1];
        // Find the matching completion between this start and the next start
        const completion = completes.find(c => c.index > start.index && (!nextStart || c.index < nextStart.index));

        const endIndex = completion ? completion.index : (nextStart ? nextStart.index - (`=== Task started at ${nextStart.date} ===`).length : fullContent.length);
        const runContent = fullContent.substring(start.index, endIndex).trim();

        runs.push({
          startedAt: start.date,
          completedAt: completion?.date,
          content: runContent,
        });
      }

      // If no runs were parsed (old format without markers), return as single run
      if (runs.length === 0 && fullContent.trim()) {
        runs.push({
          startedAt: 'Unknown',
          content: fullContent.trim(),
        });
      }

      // Append error log to the last run if present
      if (errorContent && runs.length > 0) {
        runs[runs.length - 1].content += '\n\n=== Error Log ===\n' + errorContent;
      }

      return { logs: fullContent, runs, error: undefined };
    } catch (err) {
      console.error('Error reading logs:', err);
      return { logs: '', runs: [], error: err instanceof Error ? err.message : 'Failed to read logs' };
    }
  });
}
