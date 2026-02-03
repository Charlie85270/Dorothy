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

    // Configure PostToolUse hook
    if (hasPostToolUse) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: postToolUseHook, timeout: 30 }]
      };

      // Check if already configured
      const existing = settings.hooks.PostToolUse || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('post-tool-use.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.PostToolUse = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure Stop hook
    if (hasStop) {
      const hookConfig = {
        hooks: [{ type: 'command', command: stopHook, timeout: 30 }]
      };

      const existing = settings.hooks.Stop || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('on-stop.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.Stop = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure SessionStart hook
    if (hasSessionStart) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: sessionStartHook, timeout: 30 }]
      };

      const existing = settings.hooks.SessionStart || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('session-start.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.SessionStart = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure SessionEnd hook
    if (hasSessionEnd) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: sessionEndHook, timeout: 30 }]
      };

      const existing = settings.hooks.SessionEnd || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('session-end.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.SessionEnd = [...existing, hookConfig];
        updated = true;
      }
    }

    // Configure Notification hook
    if (hasNotification) {
      const hookConfig = {
        matcher: '*',
        hooks: [{ type: 'command', command: notificationHook, timeout: 30 }]
      };

      const existing = settings.hooks.Notification || [];
      const alreadyConfigured = existing.some((h) =>
        h.hooks?.some((hh) => hh.command?.includes('notification.sh'))
      );

      if (!alreadyConfigured) {
        settings.hooks.Notification = [...existing, hookConfig];
        updated = true;
      }
    }

    // Write updated settings
    if (updated) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('Status hooks configured in', settingsPath);
    } else {
      console.log('Status hooks already configured');
    }
  } catch (err) {
    console.error('Failed to configure status hooks:', err);
  }
}
