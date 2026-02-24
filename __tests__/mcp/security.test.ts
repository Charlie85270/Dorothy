import { describe, it, expect } from 'vitest';

// ============================================================================
// Repo Validation Tests (Fixes 4 & 5)
// ============================================================================

describe('GitHub repo validation', () => {
  const REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

  it('should accept valid repo names', () => {
    expect(REPO_RE.test('owner/repo')).toBe(true);
    expect(REPO_RE.test('my-org/my-repo')).toBe(true);
    expect(REPO_RE.test('user123/project.js')).toBe(true);
    expect(REPO_RE.test('org_name/repo_name')).toBe(true);
  });

  it('should reject command injection in repo names', () => {
    expect(REPO_RE.test('owner/repo; rm -rf /')).toBe(false);
    expect(REPO_RE.test('owner/repo && cat /etc/passwd')).toBe(false);
    expect(REPO_RE.test("owner/repo' --body 'pwned")).toBe(false);
    expect(REPO_RE.test('$(whoami)/repo')).toBe(false);
  });

  it('should reject missing slash', () => {
    expect(REPO_RE.test('just-a-name')).toBe(false);
  });

  it('should reject empty segments', () => {
    expect(REPO_RE.test('/repo')).toBe(false);
    expect(REPO_RE.test('owner/')).toBe(false);
  });

  it('should reject multiple slashes', () => {
    expect(REPO_RE.test('owner/repo/extra')).toBe(false);
  });
});

// ============================================================================
// Issue/PR Number Validation Tests (Fix 5)
// ============================================================================

describe('issue/PR number validation', () => {
  function isValidNumber(n: unknown): boolean {
    return typeof n === 'number' && Number.isInteger(n) && n > 0;
  }

  it('should accept positive integers', () => {
    expect(isValidNumber(1)).toBe(true);
    expect(isValidNumber(42)).toBe(true);
    expect(isValidNumber(9999)).toBe(true);
  });

  it('should reject zero', () => {
    expect(isValidNumber(0)).toBe(false);
  });

  it('should reject negative numbers', () => {
    expect(isValidNumber(-1)).toBe(false);
  });

  it('should reject floats', () => {
    expect(isValidNumber(1.5)).toBe(false);
  });

  it('should reject NaN', () => {
    expect(isValidNumber(NaN)).toBe(false);
  });

  it('should reject strings', () => {
    expect(isValidNumber('42' as unknown)).toBe(false);
  });
});

// ============================================================================
// escapeForBashDoubleQuotes Tests (Fix 6)
// ============================================================================

describe('escapeForBashDoubleQuotes', () => {
  // Inline the function for testing (same logic as in scheduler.ts)
  function escapeForBashDoubleQuotes(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/!/g, '\\!');
  }

  it('should escape double quotes', () => {
    expect(escapeForBashDoubleQuotes('path with "quotes"')).toBe('path with \\"quotes\\"');
  });

  it('should escape dollar signs', () => {
    expect(escapeForBashDoubleQuotes('$HOME/project')).toBe('\\$HOME/project');
  });

  it('should escape backticks', () => {
    expect(escapeForBashDoubleQuotes('path with `cmd`')).toBe('path with \\`cmd\\`');
  });

  it('should escape backslashes', () => {
    expect(escapeForBashDoubleQuotes('path\\with\\backslashes')).toBe('path\\\\with\\\\backslashes');
  });

  it('should escape exclamation marks', () => {
    expect(escapeForBashDoubleQuotes('danger!')).toBe('danger\\!');
  });

  it('should pass clean paths unchanged', () => {
    const clean = '/Users/test/my-project';
    expect(escapeForBashDoubleQuotes(clean)).toBe(clean);
  });

  it('should handle combined dangerous chars', () => {
    const input = '"; rm -rf / #';
    const escaped = escapeForBashDoubleQuotes(input);
    expect(escaped).toBe('\\"; rm -rf / #');
  });
});

// ============================================================================
// Webhook URL SSRF Validation Tests (Fix 16)
// ============================================================================

describe('webhook URL SSRF protection', () => {
  function isAllowedWebhookUrl(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      if (parsed.protocol !== 'https:') return false;
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '[::1]') return false;
      const ipParts = hostname.split('.').map(Number);
      if (ipParts.length === 4 && ipParts.every(p => !isNaN(p))) {
        const [a, b] = ipParts;
        if (a === 127) return false;
        if (a === 10) return false;
        if (a === 172 && b >= 16 && b <= 31) return false;
        if (a === 192 && b === 168) return false;
        if (a === 169 && b === 254) return false;
        if (a === 0) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  it('should allow public HTTPS URLs', () => {
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/T00/B00/xxx')).toBe(true);
    expect(isAllowedWebhookUrl('https://api.example.com/webhook')).toBe(true);
    expect(isAllowedWebhookUrl('https://discord.com/api/webhooks/123/abc')).toBe(true);
  });

  it('should reject HTTP (non-TLS) URLs', () => {
    expect(isAllowedWebhookUrl('http://hooks.slack.com/services/T00/B00/xxx')).toBe(false);
    expect(isAllowedWebhookUrl('http://example.com/webhook')).toBe(false);
  });

  it('should reject localhost', () => {
    expect(isAllowedWebhookUrl('https://localhost/admin')).toBe(false);
    expect(isAllowedWebhookUrl('https://localhost:8080/api')).toBe(false);
  });

  it('should reject loopback IPs (127.x.x.x)', () => {
    expect(isAllowedWebhookUrl('https://127.0.0.1/admin')).toBe(false);
    expect(isAllowedWebhookUrl('https://127.0.0.2:9090/api')).toBe(false);
  });

  it('should reject private IPs (10.x.x.x)', () => {
    expect(isAllowedWebhookUrl('https://10.0.0.1/internal')).toBe(false);
    expect(isAllowedWebhookUrl('https://10.255.255.255/api')).toBe(false);
  });

  it('should reject private IPs (172.16-31.x.x)', () => {
    expect(isAllowedWebhookUrl('https://172.16.0.1/api')).toBe(false);
    expect(isAllowedWebhookUrl('https://172.31.255.255/api')).toBe(false);
  });

  it('should allow non-private 172 IPs', () => {
    expect(isAllowedWebhookUrl('https://172.15.0.1/api')).toBe(true);
    expect(isAllowedWebhookUrl('https://172.32.0.1/api')).toBe(true);
  });

  it('should reject private IPs (192.168.x.x)', () => {
    expect(isAllowedWebhookUrl('https://192.168.1.1/api')).toBe(false);
    expect(isAllowedWebhookUrl('https://192.168.0.100/api')).toBe(false);
  });

  it('should reject link-local IPs (169.254.x.x)', () => {
    expect(isAllowedWebhookUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('should reject invalid URLs', () => {
    expect(isAllowedWebhookUrl('not-a-url')).toBe(false);
    expect(isAllowedWebhookUrl('')).toBe(false);
  });

  it('should reject IPv6 loopback', () => {
    expect(isAllowedWebhookUrl('https://[::1]/api')).toBe(false);
  });
});
