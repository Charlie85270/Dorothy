import { BrowserWindow } from 'electron';

/**
 * Broadcast an IPC event to all open BrowserWindows (main + tray panel).
 */
export function broadcastToAllWindows(channel: string, ...args: unknown[]): void {
  const windows = BrowserWindow.getAllWindows();
  if (channel === 'agent:status' || channel === 'agents:tick') {
    console.log(`[broadcast] ${channel} → ${windows.length} window(s)`);
  }
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}
