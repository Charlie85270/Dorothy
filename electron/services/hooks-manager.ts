import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getAllProviders } from '../providers';

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
 * Configure hooks for all providers that support them.
 * Each provider configures its own hooks via its configureHooks() method.
 */
export async function configureStatusHooks(): Promise<void> {
  try {
    const hooksDir = getHooksPath();

    if (!fs.existsSync(hooksDir)) {
      console.log('Hooks directory not found at', hooksDir);
      return;
    }

    // Delegate to each provider that supports native hooks
    for (const provider of getAllProviders()) {
      const hookConfig = provider.getHookConfig();
      if (hookConfig.supportsNativeHooks) {
        try {
          await provider.configureHooks(hooksDir);
        } catch (err) {
          console.error(`Failed to configure ${provider.displayName} hooks:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Failed to configure status hooks:', err);
  }
}
