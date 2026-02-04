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
exports.registerAutomationHandlers = registerAutomationHandlers;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
// ============================================
// Automation IPC handlers
// Interacts with the same storage as MCP tools
// ============================================
const AUTOMATIONS_DIR = path.join(os.homedir(), '.claude-manager');
const AUTOMATIONS_FILE = path.join(AUTOMATIONS_DIR, 'automations.json');
const RUNS_FILE = path.join(AUTOMATIONS_DIR, 'automations-runs.json');
function ensureDir() {
    if (!fs.existsSync(AUTOMATIONS_DIR)) {
        fs.mkdirSync(AUTOMATIONS_DIR, { recursive: true });
    }
}
function loadAutomations() {
    ensureDir();
    if (!fs.existsSync(AUTOMATIONS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(AUTOMATIONS_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
function saveAutomations(automations) {
    ensureDir();
    fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2));
}
function loadRuns() {
    ensureDir();
    if (!fs.existsSync(RUNS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(RUNS_FILE, 'utf-8');
        return JSON.parse(data).slice(-1000);
    }
    catch {
        return [];
    }
}
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}
// Convert interval minutes to cron expression
function intervalToCron(minutes) {
    if (minutes < 60) {
        // Every X minutes
        return `*/${minutes} * * * *`;
    }
    else if (minutes === 60) {
        // Every hour
        return '0 * * * *';
    }
    else if (minutes < 1440) {
        // Every X hours
        const hours = Math.floor(minutes / 60);
        return `0 */${hours} * * *`;
    }
    else {
        // Daily or more
        return '0 0 * * *';
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
// Create launchd job for automation (macOS)
async function createAutomationLaunchdJob(automation) {
    const claudePath = await getClaudePath();
    const claudeDir = path.dirname(claudePath);
    // Convert schedule to cron
    let cronSchedule;
    if (automation.schedule.type === 'cron' && automation.schedule.cron) {
        cronSchedule = automation.schedule.cron;
    }
    else {
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
    const scriptContent = `#!/bin/bash
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
    let scheduleXml;
    // For interval-based schedules, use StartInterval (simpler and more reliable for frequent runs)
    if (automation.schedule.type === 'interval' && automation.schedule.intervalMinutes) {
        const intervalSeconds = automation.schedule.intervalMinutes * 60;
        scheduleXml = `  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>`;
    }
    else {
        // For cron-based, use StartCalendarInterval
        const calendarInterval = {};
        if (minute !== '*' && !minute.includes('/'))
            calendarInterval.Minute = parseInt(minute, 10);
        if (hour !== '*' && !hour.includes('/'))
            calendarInterval.Hour = parseInt(hour, 10);
        if (dayOfMonth !== '*')
            calendarInterval.Day = parseInt(dayOfMonth, 10);
        if (dayOfWeek !== '*')
            calendarInterval.Weekday = parseInt(dayOfWeek, 10);
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
    await new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
        proc.on('close', () => resolve());
        proc.on('error', () => resolve());
    });
}
// Remove launchd job for automation (macOS)
async function removeAutomationLaunchdJob(automationId) {
    const label = `com.claude-manager.automation.${automationId}`;
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
    const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `automation-${automationId}.sh`);
    // Unload from launchd
    const uid = process.getuid?.() || 501;
    await new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)('launchctl', ['bootout', `gui/${uid}/${label}`]);
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
function registerAutomationHandlers() {
    // List automations
    electron_1.ipcMain.handle('automation:list', async () => {
        try {
            const automations = loadAutomations();
            return { automations };
        }
        catch (err) {
            console.error('Error listing automations:', err);
            return { automations: [], error: err instanceof Error ? err.message : 'Failed to list automations' };
        }
    });
    // Create automation
    electron_1.ipcMain.handle('automation:create', async (_event, params) => {
        try {
            const automations = loadAutomations();
            // Parse source config
            let sourceConfig = {};
            try {
                sourceConfig = JSON.parse(params.sourceConfig);
            }
            catch {
                return { success: false, error: 'Invalid source config JSON' };
            }
            // Build schedule
            const schedule = params.scheduleCron
                ? { type: 'cron', cron: params.scheduleCron }
                : { type: 'interval', intervalMinutes: params.scheduleMinutes || 60 };
            // Build outputs
            const outputs = [];
            if (params.outputTelegram) {
                outputs.push({ type: 'telegram', enabled: true, template: params.outputTemplate });
            }
            if (params.outputSlack) {
                outputs.push({ type: 'slack', enabled: true, template: params.outputTemplate });
            }
            if (params.outputGitHubComment) {
                outputs.push({ type: 'github_comment', enabled: true, template: params.outputTemplate });
            }
            const newAutomation = {
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
        }
        catch (err) {
            console.error('Error creating automation:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to create automation' };
        }
    });
    // Update automation
    electron_1.ipcMain.handle('automation:update', async (_event, id, params) => {
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
                }
                else {
                    // Remove the launchd job
                    await removeAutomationLaunchdJob(id);
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('Error updating automation:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to update automation' };
        }
    });
    // Delete automation
    electron_1.ipcMain.handle('automation:delete', async (_event, id) => {
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
        }
        catch (err) {
            console.error('Error deleting automation:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to delete automation' };
        }
    });
    // Run automation manually (triggers MCP tool via shell)
    electron_1.ipcMain.handle('automation:run', async (_event, id) => {
        try {
            const automations = loadAutomations();
            const automation = automations.find(a => a.id === id);
            if (!automation) {
                return { success: false, error: 'Automation not found' };
            }
            // Run the script directly
            const scriptPath = path.join(os.homedir(), '.claude-manager', 'scripts', `automation-${id}.sh`);
            if (fs.existsSync(scriptPath)) {
                (0, child_process_1.spawn)('bash', [scriptPath], {
                    detached: true,
                    stdio: 'ignore',
                }).unref();
                return { success: true, message: 'Automation triggered' };
            }
            return { success: false, error: 'Automation script not found' };
        }
        catch (err) {
            console.error('Error running automation:', err);
            return { success: false, error: err instanceof Error ? err.message : 'Failed to run automation' };
        }
    });
    // Get automation logs
    electron_1.ipcMain.handle('automation:getLogs', async (_event, id) => {
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
                    if (logs)
                        logs += '\n\n=== Errors ===\n';
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
        }
        catch (err) {
            console.error('Error getting automation logs:', err);
            return { logs: '', error: err instanceof Error ? err.message : 'Failed to get logs' };
        }
    });
}
//# sourceMappingURL=automation-handlers.js.map