// eslint-disable-next-line no-control-regex
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}

export function extractStatusLine(output: string[], maxLen = 120): string {
  for (let i = output.length - 1; i >= 0 && i >= output.length - 20; i--) {
    const lines = stripAnsi(output[i]).split('\n');
    for (let j = lines.length - 1; j >= 0; j--) {
      const line = lines[j].trim();
      if (line.length > 0) {
        return line.length > maxLen ? line.slice(0, maxLen) + '…' : line;
      }
    }
  }
  return '';
}
