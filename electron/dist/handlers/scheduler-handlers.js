"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSchedulerHandlers = registerSchedulerHandlers;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const uuid_1 = require("uuid");
// ============================================
// Scheduler IPC handlers (native implementation)
// ============================================
const SCHEDULER_METADATA_PATH = path.join(os.homedir(), '.claude-manager', 'scheduler-metadata.json');
function loadSchedulerMetadata() {
    try {
        if (fs.existsSync(SCHEDULER_METADATA_PATH)) {
            return JSON.parse(fs.readFileSync(SCHEDULER_METADATA_PATH, 'utf-8'));
        }
    }
    catch {
        // Ignore errors
    }
    return {};
}
function saveSchedulerMetadata(metadata) {
    try {
        const dir = path.dirname(SCHEDULER_METADATA_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(SCHEDULER_METADATA_PATH, JSON.stringify(metadata, null, 2));
    }
    catch (err) {
        console.error('Error saving scheduler metadata:', err);
    }
}
// Convert cron expression to human-readable format
function cronToHuman(cron) {
    const parts = cron.split(' ');
    if (parts.length !== 5)
        return cron;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    // Every minute
    if (minute === '*' && hour === '*')
        return 'Every minute';
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
function getNextRunTime(cron) {
    try {
        const parts = cron.split(' ');
        if (parts.length !== 5)
            return undefined;
        const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
        const now = new Date();
        const next = new Date(now);
        // Set the time
        if (hour !== '*')
            next.setHours(parseInt(hour, 10));
        if (minute !== '*')
            next.setMinutes(parseInt(minute, 10));
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
    }
    catch {
        return undefined;
    }
}
// Get path to claude CLI
async function getClaudePath() {
    return new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)('which', ['claude']);
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
async function fixMcpServerPaths() {
    const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
    if (!fs.existsSync(mcpConfigPath))
        return;
    try {
        const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
        if (!config.mcpServers)
            return;
        let modified = false;
        for (const [, server] of Object.entries(config.mcpServers)) {
            const srv = server;
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
    }
    catch {
        // Ignore errors
    }
}
// Create launchd job (macOS)
async function createLaunchdJob(taskId, schedule, projectPath, prompt, autonomous) {
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
    const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `${taskId}.sh`);
    const scriptsDir = path.dirname(scriptPath);
    if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
    }
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const flags = autonomous ? '--dangerously-skip-permissions' : '';
    const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
    const scriptContent = `#!/bin/bash
export PATH="${claudeDir}:$PATH"
cd "${projectPath}"
echo "=== Task started at $(date) ===" >> "${logPath}"
"${claudePath}" ${flags} --mcp-config "${mcpConfigPath}" -p '${escapedPrompt}' >> "${logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${logPath}"
`;
    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, '755');
    // Build StartCalendarInterval
    const calendarInterval = {};
    if (minute !== '*')
        calendarInterval.Minute = parseInt(minute, 10);
    if (hour !== '*')
        calendarInterval.Hour = parseInt(hour, 10);
    if (dayOfMonth !== '*')
        calendarInterval.Day = parseInt(dayOfMonth, 10);
    if (dayOfWeek !== '*')
        calendarInterval.Weekday = parseInt(dayOfWeek, 10);
    const label = `com.claude-manager.scheduler.${taskId}`;
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
    await new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
        proc.on('close', () => resolve());
        proc.on('error', () => resolve());
    });
}
// Create cron job (Linux)
async function createCronJob(taskId, schedule, projectPath, prompt, autonomous) {
    const claudePath = await getClaudePath();
    const claudeDir = path.dirname(claudePath);
    const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `${taskId}.sh`);
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
    const scriptContent = `#!/bin/bash
export PATH="${claudeDir}:$PATH"
cd "${projectPath}"
echo "=== Task started at $(date) ===" >> "${logPath}"
"${claudePath}" ${flags} --mcp-config "${mcpConfigPath}" -p '${escapedPrompt}' >> "${logPath}" 2>&1
echo "=== Task completed at $(date) ===" >> "${logPath}"
`;
    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, '755');
    const cronLine = `${schedule} ${scriptPath} # claude-manager-${taskId}`;
    await new Promise((resolve, reject) => {
        const getCron = (0, child_process_1.spawn)('crontab', ['-l']);
        let existingCron = '';
        getCron.stdout.on('data', (data) => { existingCron += data; });
        getCron.on('close', () => {
            const newCron = existingCron + '\n' + cronLine + '\n';
            const setCron = (0, child_process_1.spawn)('crontab', ['-']);
            setCron.stdin.write(newCron);
            setCron.stdin.end();
            setCron.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`crontab failed with code ${code}`));
            });
            setCron.on('error', reject);
        });
        getCron.on('error', () => {
            const setCron = (0, child_process_1.spawn)('crontab', ['-']);
            setCron.stdin.write(cronLine + '\n');
            setCron.stdin.end();
            setCron.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`crontab failed with code ${code}`));
            });
            setCron.on('error', reject);
        });
    });
}
/**
 * Register all scheduler IPC handlers
 */
function registerSchedulerHandlers() {
    // Fix MCP server paths
    electron_1.ipcMain.handle('scheduler:fixMcpPaths', async () => {
        try {
            await fixMcpServerPaths();
            return { success: true };
        }
        catch (err) {
            console.error('Error fixing MCP paths:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to fix MCP paths' };
        }
    });
    // List scheduled tasks
    electron_1.ipcMain.handle('scheduler:listTasks', async () => {
        try {
            const tasks = [];
            const metadata = loadSchedulerMetadata();
            const addedTaskIds = new Set();
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
                            let lastRun;
                            let lastRunStatus;
                            const logPath = path.join(os.homedir(), '.claude', 'logs', `${schedule.id}.log`);
                            if (fs.existsSync(logPath)) {
                                const stat = fs.statSync(logPath);
                                lastRun = stat.mtime.toISOString();
                                try {
                                    const logContent = fs.readFileSync(logPath, 'utf-8');
                                    lastRunStatus = logContent.includes('error') || logContent.includes('Error') ? 'error' : 'success';
                                }
                                catch {
                                    lastRunStatus = 'success';
                                }
                            }
                            const taskId = schedule.id || (0, uuid_1.v4)();
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
                }
                catch (err) {
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
                                        if (addedTaskIds.has(schedule.id))
                                            continue;
                                        const taskMeta = metadata[schedule.id] || {
                                            notifications: { telegram: false, slack: false },
                                            createdAt: new Date().toISOString(),
                                        };
                                        let lastRun;
                                        let lastRunStatus;
                                        const logPath = path.join(os.homedir(), '.claude', 'logs', `${schedule.id}.log`);
                                        if (fs.existsSync(logPath)) {
                                            const stat = fs.statSync(logPath);
                                            lastRun = stat.mtime.toISOString();
                                            try {
                                                const logContent = fs.readFileSync(logPath, 'utf-8');
                                                lastRunStatus = logContent.includes('error') || logContent.includes('Error') ? 'error' : 'success';
                                            }
                                            catch {
                                                lastRunStatus = 'success';
                                            }
                                        }
                                        const projectPath = '/' + projectDir.replace(/-/g, '/');
                                        const taskId = schedule.id || (0, uuid_1.v4)();
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
                            }
                            catch {
                                // Ignore parse errors
                            }
                        }
                    }
                }
                catch {
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
                            if (!file.startsWith('com.claude.schedule.') && !file.startsWith('com.claude-manager.scheduler.'))
                                continue;
                            if (!file.endsWith('.plist'))
                                continue;
                            let taskId;
                            if (file.startsWith('com.claude.schedule.')) {
                                taskId = file.replace('com.claude.schedule.', '').replace('.plist', '');
                            }
                            else {
                                taskId = file.replace('com.claude-manager.scheduler.', '').replace('.plist', '');
                            }
                            if (addedTaskIds.has(taskId))
                                continue;
                            try {
                                const plistPath = path.join(launchAgentsDir, file);
                                const plistContent = fs.readFileSync(plistPath, 'utf-8');
                                let prompt = '';
                                let projectPath = os.homedir();
                                let hour = 0;
                                let minute = 0;
                                let weekday;
                                let day;
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
                                if (workDirMatch)
                                    projectPath = workDirMatch[1];
                                const calendarMatch = plistContent.match(/<key>StartCalendarInterval<\/key>\s*<dict>([\s\S]*?)<\/dict>/);
                                if (calendarMatch) {
                                    const cal = calendarMatch[1];
                                    const hm = cal.match(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/);
                                    const mm = cal.match(/<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/);
                                    const wm = cal.match(/<key>Weekday<\/key>\s*<integer>(\d+)<\/integer>/);
                                    const dm = cal.match(/<key>Day<\/key>\s*<integer>(\d+)<\/integer>/);
                                    if (hm)
                                        hour = parseInt(hm[1], 10);
                                    if (mm)
                                        minute = parseInt(mm[1], 10);
                                    if (wm)
                                        weekday = parseInt(wm[1], 10);
                                    if (dm)
                                        day = parseInt(dm[1], 10);
                                }
                                let cron = `${minute} ${hour} * * *`;
                                if (weekday !== undefined)
                                    cron = `${minute} ${hour} * * ${weekday}`;
                                else if (day !== undefined)
                                    cron = `${minute} ${hour} ${day} * *`;
                                let lastRun;
                                let lastRunStatus;
                                const logPath = path.join(os.homedir(), '.claude', 'logs', `${taskId}.log`);
                                if (fs.existsSync(logPath)) {
                                    const stat = fs.statSync(logPath);
                                    lastRun = stat.mtime.toISOString();
                                    try {
                                        const logContent = fs.readFileSync(logPath, 'utf-8');
                                        lastRunStatus = logContent.includes('error') || logContent.includes('Error') ? 'error' : 'success';
                                    }
                                    catch {
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
                            }
                            catch (err) {
                                console.error(`Error parsing plist ${file}:`, err);
                            }
                        }
                    }
                    catch (err) {
                        console.error('Error scanning LaunchAgents:', err);
                    }
                }
            }
            return { tasks };
        }
        catch (err) {
            console.error('Error listing tasks:', err);
            return { tasks: [], error: err instanceof Error ? err.message : 'Failed to list tasks' };
        }
    });
    // Create a new scheduled task
    electron_1.ipcMain.handle('scheduler:createTask', async (_event, config) => {
        try {
            const taskId = (0, uuid_1.v4)();
            const schedule = config.schedule;
            const autonomous = config.autonomous ?? true;
            // Save to schedules.json
            const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
            let schedules = [];
            if (fs.existsSync(globalSchedulesPath)) {
                try {
                    schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
                    if (!Array.isArray(schedules))
                        schedules = [];
                }
                catch {
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
            }
            else {
                await createCronJob(taskId, schedule, config.projectPath, config.prompt, autonomous);
            }
            return { success: true, taskId };
        }
        catch (err) {
            console.error('Error creating task:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to create task' };
        }
    });
    // Delete a scheduled task
    electron_1.ipcMain.handle('scheduler:deleteTask', async (_event, taskId) => {
        try {
            // Remove from schedules.json
            const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
            if (fs.existsSync(globalSchedulesPath)) {
                let schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
                if (Array.isArray(schedules)) {
                    schedules = schedules.filter((s) => s.id !== taskId);
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
                    `com.claude-manager.scheduler.${taskId}`,
                    `com.claude.schedule.${taskId}`,
                ];
                const uid = process.getuid?.() || 501;
                for (const label of labels) {
                    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
                    try {
                        await new Promise((resolve) => {
                            const proc = (0, child_process_1.spawn)('launchctl', ['bootout', `gui/${uid}/${label}`]);
                            proc.on('close', () => resolve());
                            proc.on('error', () => resolve());
                        });
                    }
                    catch {
                        // Ignore unload errors
                    }
                    if (fs.existsSync(plistPath)) {
                        fs.unlinkSync(plistPath);
                    }
                }
            }
            else {
                // Remove from crontab (Linux)
                await new Promise((resolve) => {
                    const getCron = (0, child_process_1.spawn)('crontab', ['-l']);
                    let existingCron = '';
                    getCron.stdout.on('data', (data) => { existingCron += data; });
                    getCron.on('close', () => {
                        const newCron = existingCron
                            .split('\n')
                            .filter(line => !line.includes(`claude-manager-${taskId}`))
                            .join('\n');
                        const setCron = (0, child_process_1.spawn)('crontab', ['-']);
                        setCron.stdin.write(newCron);
                        setCron.stdin.end();
                        setCron.on('close', () => resolve());
                        setCron.on('error', () => resolve());
                    });
                    getCron.on('error', () => resolve());
                });
            }
            // Remove script file
            const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `${taskId}.sh`);
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
            return { success: true };
        }
        catch (err) {
            console.error('Error deleting task:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to delete task' };
        }
    });
    // Run a task immediately
    electron_1.ipcMain.handle('scheduler:runTask', async (_event, taskId) => {
        try {
            const globalSchedulesPath = path.join(os.homedir(), '.claude', 'schedules.json');
            let task;
            if (fs.existsSync(globalSchedulesPath)) {
                const schedules = JSON.parse(fs.readFileSync(globalSchedulesPath, 'utf-8'));
                if (Array.isArray(schedules)) {
                    task = schedules.find((s) => s.id === taskId);
                }
            }
            if (!task) {
                return { success: false, error: 'Task not found' };
            }
            const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `${taskId}.sh`);
            if (fs.existsSync(scriptPath)) {
                (0, child_process_1.spawn)('bash', [scriptPath], {
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
            const proc = (0, child_process_1.spawn)('bash', ['-c', `cd "${task.projectPath}" && claude ${flags} -p '${task.prompt?.replace(/'/g, "'\\''")}' >> "${logPath}" 2>&1`], {
                detached: true,
                stdio: 'ignore',
            });
            proc.unref();
            return { success: true };
        }
        catch (err) {
            console.error('Error running task:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to run task' };
        }
    });
    // Get task logs
    electron_1.ipcMain.handle('scheduler:getLogs', async (_event, taskId) => {
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
                if (stdOutMatch)
                    customLogPath = stdOutMatch[1];
                if (stdErrMatch)
                    customErrorLogPath = stdErrMatch[1];
            }
            let logs = '';
            let hasLogs = false;
            if (fs.existsSync(customLogPath)) {
                const stat = fs.statSync(customLogPath);
                const content = fs.readFileSync(customLogPath, 'utf-8');
                if (content.trim()) {
                    hasLogs = true;
                    logs += `=== Output Log (${stat.mtime.toLocaleString()}) ===\n`;
                    logs += content;
                }
            }
            if (fs.existsSync(customErrorLogPath)) {
                const stat = fs.statSync(customErrorLogPath);
                const errorContent = fs.readFileSync(customErrorLogPath, 'utf-8');
                if (errorContent.trim()) {
                    hasLogs = true;
                    if (logs)
                        logs += '\n\n';
                    logs += `=== Error Log (${stat.mtime.toLocaleString()}) ===\n`;
                    logs += errorContent;
                }
            }
            if (!hasLogs) {
                return { logs: 'No logs available yet. The task has not run.', error: undefined };
            }
            return { logs, error: undefined };
        }
        catch (err) {
            console.error('Error reading logs:', err);
            return { logs: '', error: err instanceof Error ? err.message : 'Failed to read logs' };
        }
    });
}
//# sourceMappingURL=scheduler-handlers.js.map