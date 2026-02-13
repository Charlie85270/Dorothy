/**
 * Scheduler utilities for creating and managing scheduled tasks
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Get the path to the claude CLI — reads user-configured path from app-settings first
 */
export async function getClaudePath(): Promise<string> {
  // Check user-configured path in app-settings.json
  try {
    const settingsFile = path.join(os.homedir(), ".dorothy", "app-settings.json");
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
      if (settings.cliPaths?.claude && fs.existsSync(settings.cliPaths.claude)) {
        return settings.cliPaths.claude;
      }
    }
  } catch {
    // Ignore settings read errors
  }

  // Fallback: try to detect via which
  return new Promise((resolve) => {
    const proc = spawn("/bin/bash", ["-l", "-c", "which claude"], {
      env: { ...process.env, HOME: os.homedir() },
    });
    let output = "";
    proc.stdout.on("data", (data) => {
      output += data;
    });
    proc.on("close", () => {
      const claudePath = output.trim() || "/usr/local/bin/claude";
      resolve(claudePath);
    });
    proc.on("error", () => {
      resolve("/usr/local/bin/claude");
    });
  });
}

/**
 * Convert cron expression to human-readable format
 */
export function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute === "*" && hour === "*") return "Every minute";

  if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return minute === "0" ? "Every hour" : `Every hour at :${minute.padStart(2, "0")}`;
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const h = parseInt(hour, 10);
    const m = minute.padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${displayHour}:${m} ${period}`;
  }

  if (dayOfWeek === "1-5" && dayOfMonth === "*" && month === "*") {
    const h = parseInt(hour, 10);
    const m = minute.padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Weekdays at ${displayHour}:${m} ${period}`;
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayNum = parseInt(dayOfWeek, 10);
    const dayName = days[dayNum] || dayOfWeek;
    const h = parseInt(hour, 10);
    const m = minute.padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dayName}s at ${displayHour}:${m} ${period}`;
  }

  return cron;
}

/**
 * Calculate next run time from cron expression
 */
export function getNextRunTime(cron: string): string | undefined {
  try {
    const parts = cron.split(" ");
    if (parts.length !== 5) return undefined;

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    if (hour !== "*") next.setHours(parseInt(hour, 10));
    if (minute !== "*") next.setMinutes(parseInt(minute, 10));
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    if (dayOfWeek !== "*") {
      const targetDays = dayOfWeek.split(",").map((d) => parseInt(d, 10));
      while (!targetDays.includes(next.getDay())) {
        next.setDate(next.getDate() + 1);
      }
    }

    if (dayOfMonth !== "*") {
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

/**
 * Create a launchd job for macOS
 */
export async function createLaunchdJob(
  taskId: string,
  schedule: string,
  projectPath: string,
  prompt: string,
  autonomous: boolean
): Promise<void> {
  const claudePath = await getClaudePath();
  const claudeDir = path.dirname(claudePath);

  const [minute, hour, dayOfMonth, , dayOfWeek] = schedule.split(" ");

  const logPath = path.join(os.homedir(), ".claude", "logs", `${taskId}.log`);
  const errorLogPath = path.join(os.homedir(), ".claude", "logs", `${taskId}.error.log`);
  const logsDir = path.dirname(logPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const scriptPath = path.join(os.homedir(), ".dorothy", "scripts", `${taskId}.sh`);
  const scriptsDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const flags = autonomous ? "--dangerously-skip-permissions" : "";
  const mcpConfigPath = path.join(os.homedir(), ".claude", "mcp.json");
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
  fs.chmodSync(scriptPath, "755");

  const calendarInterval: Record<string, number> = {};
  if (minute !== "*") calendarInterval.Minute = parseInt(minute, 10);
  if (hour !== "*") calendarInterval.Hour = parseInt(hour, 10);
  if (dayOfMonth !== "*") calendarInterval.Day = parseInt(dayOfMonth, 10);
  if (dayOfWeek !== "*") calendarInterval.Weekday = parseInt(dayOfWeek, 10);

  const label = `com.dorothy.scheduler.${taskId}`;
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
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
${Object.entries(calendarInterval)
  .map(([k, v]) => `    <key>${k}</key>\n    <integer>${v}</integer>`)
  .join("\n")}
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

  const uid = process.getuid?.() || 501;
  await new Promise<void>((resolve) => {
    const proc = spawn("launchctl", ["bootstrap", `gui/${uid}`, plistPath]);
    proc.on("close", () => resolve());
    proc.on("error", () => resolve());
  });
}

/**
 * Create a cron job for Linux
 */
export async function createCronJob(
  taskId: string,
  schedule: string,
  projectPath: string,
  prompt: string,
  autonomous: boolean
): Promise<void> {
  const claudePath = await getClaudePath();
  const claudeDir = path.dirname(claudePath);

  const scriptPath = path.join(os.homedir(), ".dorothy", "scripts", `${taskId}.sh`);
  const scriptsDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  const logPath = path.join(os.homedir(), ".claude", "logs", `${taskId}.log`);
  const logsDir = path.dirname(logPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const flags = autonomous ? "--dangerously-skip-permissions" : "";
  const mcpConfigPath = path.join(os.homedir(), ".claude", "mcp.json");
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
  fs.chmodSync(scriptPath, "755");

  const cronLine = `${schedule} ${scriptPath} # dorothy-${taskId}`;

  await new Promise<void>((resolve, reject) => {
    const getCron = spawn("crontab", ["-l"]);
    let existingCron = "";
    getCron.stdout.on("data", (data) => {
      existingCron += data;
    });
    getCron.on("close", () => {
      const newCron = existingCron + "\n" + cronLine + "\n";
      const setCron = spawn("crontab", ["-"]);
      setCron.stdin.write(newCron);
      setCron.stdin.end();
      setCron.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`crontab failed with code ${code}`));
      });
      setCron.on("error", reject);
    });
    getCron.on("error", () => {
      const setCron = spawn("crontab", ["-"]);
      setCron.stdin.write(cronLine + "\n");
      setCron.stdin.end();
      setCron.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`crontab failed with code ${code}`));
      });
      setCron.on("error", reject);
    });
  });
}

/**
 * Delete a launchd job (macOS)
 */
export async function deleteLaunchdJob(taskId: string): Promise<void> {
  const label = `com.dorothy.scheduler.${taskId}`;
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
  const uid = process.getuid?.() || 501;

  try {
    await new Promise<void>((resolve) => {
      const proc = spawn("launchctl", ["bootout", `gui/${uid}/${label}`]);
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  } catch {
    // Ignore unload errors
  }

  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
  }
}

/**
 * Delete a cron job (Linux)
 */
export async function deleteCronJob(taskId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const getCron = spawn("crontab", ["-l"]);
    let existingCron = "";
    getCron.stdout.on("data", (data) => {
      existingCron += data;
    });
    getCron.on("close", () => {
      const newCron = existingCron
        .split("\n")
        .filter((line) => !line.includes(`dorothy-${taskId}`))
        .join("\n");

      const setCron = spawn("crontab", ["-"]);
      setCron.stdin.write(newCron);
      setCron.stdin.end();
      setCron.on("close", () => resolve());
      setCron.on("error", () => resolve());
    });
    getCron.on("error", () => resolve());
  });
}
