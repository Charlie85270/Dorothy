import type { Terminal } from 'xterm';

/**
 * Strip Ink/ANSI cursor movement sequences that break during output replay.
 */
export function stripCursorSequences(data: string): string {
  return data
    .replace(/\x1b\[\d*[ABCDEFGH]/g, '')
    .replace(/\x1b\[\d*;\d*[Hf]/g, '')
    .replace(/\x1b\[\d*K/g, '')
    .replace(/\x1b\[\d*J/g, '')
    .replace(/\x1b\[?[su78]/g, '')
    .replace(/\x1b\[\?25[lh]/g, '')
    .replace(/\x1b\[\?1049[hl]/g, '');
}

/**
 * Attach Shift+Enter handler to a terminal so it inserts a newline
 * (via ESC+CR) instead of submitting the current line.
 *
 * @param term     - The xterm Terminal instance
 * @param sendFn   - Callback that forwards the escape sequence to the PTY/agent
 */
export function attachShiftEnterHandler(
  term: Terminal,
  sendFn: (data: string) => void,
): void {
  term.attachCustomKeyEventHandler((event) => {
    if (event.key === 'Enter' && event.shiftKey && event.type === 'keydown') {
      sendFn('\x1b\r');
      return false;
    }
    return true;
  });
}
