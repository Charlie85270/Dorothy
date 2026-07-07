import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// pty-manager imports node-pty (native) and electron at module load — mock both
// so the module can be imported in the test environment.
vi.mock('node-pty', () => ({ spawn: vi.fn() }));
vi.mock('electron', () => ({ BrowserWindow: vi.fn() }));

import { writeProgrammaticInput } from '../../../electron/core/pty-manager';
import type { IPty } from 'node-pty';

function makeFakePty() {
  const writes: string[] = [];
  const pty = {
    write: vi.fn((data: string) => {
      writes.push(data);
    }),
  } as unknown as IPty;
  return { pty, writes };
}

describe('writeProgrammaticInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a raw shell command as text + \\r in a single write (bracketPaste = false)', () => {
    const { pty, writes } = makeFakePty();
    writeProgrammaticInput(pty, "cd '/tmp' && claude");
    expect(writes).toEqual(["cd '/tmp' && claude\r"]);
  });

  it('delays the carriage return for a short single-line message (bracketPaste = true)', () => {
    // Regression: short Telegram/Slack messages must NOT be sent as an atomic
    // "text\r" — Claude Code's TUI treats that as a paste event and never
    // submits. The \r has to be a separate, delayed write.
    const { pty, writes } = makeFakePty();
    const msg = '[FROM TELEGRAM chat_id=123] hey, check the deploy';
    expect(msg.length).toBeLessThan(200);
    expect(msg).not.toContain('\n');

    writeProgrammaticInput(pty, msg, true);

    // Text is written immediately, but the \r has NOT been sent yet.
    expect(writes).toEqual([msg]);

    vi.advanceTimersByTime(300);
    expect(writes).toEqual([msg, '\r']);
  });

  it('wraps long/multi-line input in bracket paste markers with a delayed \\r', () => {
    const { pty, writes } = makeFakePty();
    const msg = 'line one\nline two';

    writeProgrammaticInput(pty, msg, true);
    expect(writes).toEqual(['\x1b[200~' + msg + '\x1b[201~']);

    vi.advanceTimersByTime(300);
    expect(writes).toEqual(['\x1b[200~' + msg + '\x1b[201~', '\r']);
  });
});
