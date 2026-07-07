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

/**
 * Write a command to a PTY and submit it.
 *
 * When `bracketPaste` is true (used for sending messages to an already-running
 * Claude Code session), the carriage return is ALWAYS sent as a separate,
 * delayed write — even for short single-line messages. Claude Code's TUI treats
 * a rapid "text\r" burst as a single paste event and buffers it without
 * submitting (the text lands in the input box as "[Pasted text]" but is never
 * sent). Delaying the \r lets the paste settle so it registers as a deliberate
 * submit keystroke. Multi-line / long input is additionally wrapped in bracket
 * paste markers so the terminal treats it as one paste rather than line-by-line
 * input.
 *
 * When `bracketPaste` is false (default — used for the initial shell command
 * that starts Claude Code), the data is sent as plain text + \r, which is what
 * a raw bash/zsh shell expects and has no paste-detection race.
 *
 * DO NOT use this for raw keystroke passthrough from xterm.js UI terminals.
 */
export function writeProgrammaticInput(
  ptyProcess: pty.IPty,
  data: string,
  bracketPaste = false,
): void {
  if (bracketPaste) {
    if (data.includes('\n') || data.length > 200) {
      // Bracket paste mode: \x1b[200~ ... \x1b[201~ tells the terminal
      // "everything between these markers is pasted content, not typed input"
      ptyProcess.write('\x1b[200~' + data + '\x1b[201~');
    } else {
      // Short single-line message: no bracket markers needed, but the \r must
      // still be delayed (see below) so it isn't swallowed into the paste.
      ptyProcess.write(data);
    }
    // Delay the carriage return so the TUI finishes processing the input before
    // receiving the submit keystroke. Without this, short Telegram/Slack
    // messages get typed into the box but never sent.
    setTimeout(() => ptyProcess.write('\r'), 300);
  } else {
    // Plain shell command for a raw bash/zsh prompt: send directly.
    ptyProcess.write(data + '\r');
  }
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shell:ptyOutput', { ptyId: id, data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shell:ptyExit', { ptyId: id, exitCode });
    }
    quickPtyProcesses.delete(id);
  });

  return id;
}
