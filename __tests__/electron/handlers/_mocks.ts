/**
 * Shared mocking utilities for handler tests.
 *
 * Provides a mock ipcMain that captures registered handlers so tests can
 * invoke them directly, plus helpers for temp directories and fs stubs.
 */
import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── ipcMain mock ───────────────────────────────────────────────────────────────

export type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;

const handlers = new Map<string, HandlerFn>();

export const mockIpcMain = {
  handle: vi.fn((channel: string, fn: HandlerFn) => {
    handlers.set(channel, fn);
  }),
};

/** Invoke a handler registered via ipcMain.handle(channel, ...) */
export function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler registered for "${channel}"`);
  return fn({}, ...args);
}

/** Clear all registered handlers (call in beforeEach) */
export function clearHandlers(): void {
  handlers.clear();
  mockIpcMain.handle.mockClear();
}

// ── Temp directory helper ──────────────────────────────────────────────────────

let tmpDir: string;

/** Create a temporary directory for the test and return its path */
export function setupTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dorothy-test-'));
  return tmpDir;
}

/** Remove the temporary directory recursively */
export function cleanupTmpDir(): void {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Write a JSON file into the temp directory */
export function writeTmpJson(relativePath: string, data: unknown): string {
  const fullPath = path.join(tmpDir, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  return fullPath;
}

/** Read a JSON file from the temp directory */
export function readTmpJson(relativePath: string): unknown {
  const fullPath = path.join(tmpDir, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

/** Check if a file exists in the temp directory */
export function tmpFileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(tmpDir, relativePath));
}

/** Get absolute path within the temp directory */
export function tmpPath(relativePath: string): string {
  return path.join(tmpDir, relativePath);
}
