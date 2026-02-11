import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get the path to the bundled hooks directory
 * @returns {string} The absolute path to the hooks directory
 */
export function getHooksPath(): string {
  let appPath = app.getAppPath();
  // If running from asar, use unpacked path
  if (appPath.includes('app.asar')) {
    appPath = appPath.replace('app.asar', 'app.asar.unpacked');
  }
  return path.join(appPath, 'hooks');
}

/**
 * Configure Claude Code hooks for status notifications
 * Sets up PostToolUse, Stop, SessionStart, SessionEnd, and Notification hooks
 * in the Claude settings file
 */
export async function configureStatusHooks(): Promise<void> {
  try {
    const hooksDir = getHooksPath();

    // Check if hooks directory exists
    if (!fs.existsSync(hooksDir)) {
      console.log('Hooks directory not found at', hooksDir);
      return;
    }

    const claudeDir = path.join(os.homedir(), '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    // Ensure .claude directory exists
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Read existing settings
    let settings: {
      hooks?: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>>;
      [key: string]: unknown;
    } = {};

    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch {
        settings = {};
      }
    }

    // Initialize hooks if not present
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Define our hooks
    const postToolUseHook = path.join(hooksDir, 'post-tool-use.sh');
    const stopHook = path.join(hooksDir, 'on-stop.sh');
    const sessionStartHook = path.join(hooksDir, 'session-start.sh');
    const sessionEndHook = path.join(hooksDir, 'session-end.sh');
    const notificationHook = path.join(hooksDir, 'notification.sh');

    // Check which hooks exist
    const hasPostToolUse = fs.existsSync(postToolUseHook);
    const hasStop = fs.existsSync(stopHook);
    const hasSessionStart = fs.existsSync(sessionStartHook);
    const hasSessionEnd = fs.existsSync(sessionEndHook);
    const hasNotification = fs.existsSync(notificationHook);

    let updated = false;

    // Helper: ensure a hook entry exists with the correct command path.
    // If a stale entry exists (matching filename but wrong path), update it in place.
    const ensureHook = (
      hookType: string,
      filename: string,
      commandPath: string,
      matcher?: string,
    ) => {
      if (!fs.existsSync(commandPath)) return;

      const existing = settings.hooks![hookType] || [];
      const entryIndex = existing.findIndex((h) =>
        h.hooks?.some((hh) => hh.command?.includes(filename))
      );

      if (entryIndex >= 0) {
        // Entry exists — check if the path needs updating
        const entry = existing[entryIndex];
        const hookIndex = entry.hooks.findIndex((hh) => hh.command?.includes(filename));
        if (hookIndex >= 0 && entry.hooks[hookIndex].command !== commandPath) {
          entry.hooks[hookIndex].command = commandPath;
          updated = true;
        }
      } else {
        // No entry — add a new one
        const hookConfig: { matcher?: string; hooks: Array<{ type: string; command: string; timeout: number }> } = {
          hooks: [{ type: 'command', command: commandPath, timeout: 30 }]
        };
        if (matcher) hookConfig.matcher = matcher;
        settings.hooks![hookType] = [...existing, hookConfig];
        updated = true;
      }
    };

    ensureHook('PostToolUse', 'post-tool-use.sh', postToolUseHook, '*');
    ensureHook('Stop', 'on-stop.sh', stopHook);
    ensureHook('SessionStart', 'session-start.sh', sessionStartHook, '*');
    ensureHook('SessionEnd', 'session-end.sh', sessionEndHook, '*');
    ensureHook('Notification', 'notification.sh', notificationHook, '*');

    // Write updated settings
    if (updated) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('Status hooks configured/updated in', settingsPath);
    } else {
      console.log('Status hooks already configured');
    }
  } catch (err) {
    console.error('Failed to configure status hooks:', err);
  }
}
