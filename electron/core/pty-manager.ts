import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { BrowserWindow } from 'electron';

export const ptyProcesses: Map<string, pty.IPty> = new Map();
export const quickPtyProcesses: Map<string, pty.IPty> = new Map();
export const skillPtyProcesses: Map<string, pty.IPty> = new Map();
export const pluginPtyProcesses: Map<string, pty.IPty> = new Map();

export function killPty(ptyId: string, isQuick = false): boolean {
  const processes = isQuick ? quickPtyProcesses : ptyProcesses;
  const ptyProcess = processes.get(ptyId);
  if (ptyProcess) {
    ptyProcess.kill();
    processes.delete(ptyId);
    return true;
  }
  return false;
}

/** Kill all PTY processes across all maps. Called on app quit. */
export function killAllPty(): void {
  const allMaps = [ptyProcesses, quickPtyProcesses, skillPtyProcesses, pluginPtyProcesses];
  let killed = 0;
  for (const map of allMaps) {
    for (const [id, proc] of map) {
      try {
        proc.kill();
        killed++;
      } catch (err) {
        console.warn(`Failed to kill PTY ${id}:`, err);
      }
    }
    map.clear();
  }
  console.log(`Killed ${killed} PTY process(es) on shutdown`);
}

export function writeToPty(ptyId: string, data: string, isQuick = false): boolean {
  const processes = isQuick ? quickPtyProcesses : ptyProcesses;
  const ptyProcess = processes.get(ptyId);
  if (ptyProcess) {
    ptyProcess.write(data);
    return true;
  }
  return false;
}

export function resizePty(ptyId: string, cols: number, rows: number, isQuick = false): boolean {
  const processes = isQuick ? quickPtyProcesses : ptyProcesses;
  const ptyProcess = processes.get(ptyId);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return true;
  }
  return false;
}

export function createQuickPty(
  cwd: string | undefined,
  cols: number | undefined,
  rows: number | undefined,
  mainWindow: BrowserWindow | null
): string {
  const shell = process.env.SHELL || '/bin/zsh';

  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: process.env as { [key: string]: string },
  });

  const id = uuidv4();
  quickPtyProcesses.set(id, ptyProcess);

  ptyProcess.onData((data) => {
    mainWindow?.webContents.send('shell:ptyOutput', { ptyId: id, data });
  });

  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('shell:ptyExit', { ptyId: id, exitCode });
    quickPtyProcesses.delete(id);
  });

  return id;
}
