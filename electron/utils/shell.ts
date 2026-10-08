import * as path from 'path';
import * as fs from 'fs';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Cross-platform shell resolution.
 *
 * All agent commands are built with POSIX syntax (single-quote escaping,
 * `export`, `which`, bash scripts). On Windows we run them through Git Bash,
 * which Claude Code already requires there, so the same commands work unchanged.
 * On macOS/Linux the behavior is identical to the historical hardcoded values.
 */

export const isWindows = process.platform === 'win32';

let cachedWindowsBash: string | null | undefined;

/** Locate Git for Windows' bash.exe. Returns null if not found. */
export function findWindowsBash(): string | null {
  if (cachedWindowsBash !== undefined) return cachedWindowsBash;

  const candidates: string[] = [];
  // Same override variable Claude Code itself honors
  if (process.env.CLAUDE_CODE_GIT_BASH_PATH) candidates.push(process.env.CLAUDE_CODE_GIT_BASH_PATH);
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432]) {
    if (base) candidates.push(path.join(base, 'Git', 'bin', 'bash.exe'));
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'));
  }

  // Derive from git.exe location (…\Git\cmd\git.exe or …\Git\mingw64\bin\git.exe)
  try {
    const out = execFileSync('where', ['git'], { encoding: 'utf-8', windowsHide: true });
    for (const gitPath of out.split(/\r?\n/).filter(Boolean)) {
      let dir = path.dirname(gitPath.trim());
      for (let i = 0; i < 3; i++) {
        candidates.push(path.join(dir, 'bin', 'bash.exe'));
        dir = path.dirname(dir);
      }
    }
  } catch {
    // git not on PATH
  }

  cachedWindowsBash = candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  }) ?? null;

  if (!cachedWindowsBash) {
    console.warn('Git Bash not found — install Git for Windows or set CLAUDE_CODE_GIT_BASH_PATH');
  }
  return cachedWindowsBash;
}

export const GIT_BASH_MISSING_ERROR =
  'Git Bash not found. Install Git for Windows (https://git-scm.com/download/win) or set CLAUDE_CODE_GIT_BASH_PATH.';

/** Git Bash on Windows, or throw — POSIX agent commands cannot run in PowerShell. */
function requireWindowsBash(): string {
  const bash = findWindowsBash();
  if (!bash) throw new Error(GIT_BASH_MISSING_ERROR);
  return bash;
}

/**
 * Bash binary used to run agent commands (was hardcoded '/bin/bash').
 * Throws on Windows when Git Bash is missing.
 */
export function getBashShell(): string {
  if (isWindows) return requireWindowsBash();
  return '/bin/bash';
}

/**
 * Shell that receives POSIX command strings (`cd '…' && …`): the user's shell
 * on macOS/Linux (was `process.env.SHELL || '/bin/zsh'`), Git Bash on Windows.
 * Throws on Windows when Git Bash is missing.
 */
export function getCommandShell(): string {
  if (isWindows) return requireWindowsBash();
  return process.env.SHELL || '/bin/zsh';
}

/**
 * User's interactive terminal shell (was `process.env.SHELL || '/bin/zsh'`).
 * Only for terminals the user types into — falls back to PowerShell on Windows.
 */
export function getUserShell(): string {
  if (isWindows) return findWindowsBash() ?? 'powershell.exe';
  return process.env.SHELL || '/bin/zsh';
}

/** Arguments to start a login shell, adapted when falling back to PowerShell. */
export function loginShellArgs(shell: string): string[] {
  return /powershell(\.exe)?$/i.test(shell) ? ['-NoLogo'] : ['-l'];
}

/**
 * Build a PTY environment with the given PATH.
 * On Windows, process.env exposes PATH as "Path"; spreading it and adding "PATH"
 * would produce two conflicting keys, so drop every case variant first.
 */
export function envWithPath(
  base: NodeJS.ProcessEnv | Record<string, string | undefined>,
  fullPath: string
): { [key: string]: string } {
  const env: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (isWindows && key.toUpperCase() === 'PATH') continue;
    env[key] = value;
  }
  env.PATH = fullPath;
  return env;
}

/**
 * Candidate file names for a binary. On Windows, commands run through Git Bash, so prefer a
 * native .exe, then npm's extensionless sh shim (calls node directly), and only then the .cmd
 * shim — a .cmd routes arguments through cmd.exe, which mangles prompts containing & | % etc.
 */
export function binaryNames(name: string): string[] {
  return isWindows ? [`${name}.exe`, name, `${name}.cmd`] : [name];
}

/** First existing binary `name` in `dirs`, or ''. */
export function findInDirs(name: string, dirs: string[]): string {
  for (const dir of dirs) {
    for (const file of binaryNames(name)) {
      const candidate = path.join(dir, file);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return '';
}

/** Resolve `name` via `which` (`where` on Windows) with `dirs` prepended to PATH, or ''. */
export async function whichBinary(name: string, dirs: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(isWindows ? 'where' : 'which', [name], {
      env: { ...process.env, PATH: `${dirs.join(path.delimiter)}${path.delimiter}${process.env.PATH}` },
    });
    if (isWindows) {
      // `where` lists every match; apply the same preference order as binaryNames()
      const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return lines.find((l) => /\.exe$/i.test(l)) || lines.find((l) => !path.extname(l)) || lines[0] || '';
    }
    return stdout.trim();
  } catch {
    return '';
  }
}
