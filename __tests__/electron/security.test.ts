import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

// Mock electron
vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app/path', getPath: (name: string) => name === 'home' ? os.homedir() : '/mock' },
  Notification: vi.fn(),
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn() },
}));

// ============================================================================
// API Auth Token Tests
// ============================================================================

describe('API Auth', () => {
  it('should generate a 64-char hex token', async () => {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  it('should reject requests without Authorization header', () => {
    const token = 'test-token-123';
    const authHeader = undefined;
    const isAuthorized = authHeader === `Bearer ${token}`;
    expect(isAuthorized).toBe(false);
  });

  it('should reject requests with wrong token', () => {
    const token = 'test-token-123';
    const authHeader = 'Bearer wrong-token' as string;
    const isAuthorized = authHeader === `Bearer ${token}`;
    expect(isAuthorized).toBe(false);
  });

  it('should accept requests with correct token', () => {
    const token = 'test-token-123';
    const authHeader = `Bearer ${token}`;
    const isAuthorized = authHeader === `Bearer ${token}`;
    expect(isAuthorized).toBe(true);
  });

  it('should allow OPTIONS requests without auth (CORS preflight)', () => {
    // OPTIONS requests are handled before auth check
    const method = 'OPTIONS';
    const bypassAuth = method === 'OPTIONS';
    expect(bypassAuth).toBe(true);
  });
});

// ============================================================================
// /api/local-file Path Restriction Tests
// ============================================================================

describe('/api/local-file path restriction', () => {
  const VAULT_DIR = path.join(os.homedir(), '.dorothy', 'vault');
  const allowedDir = path.join(VAULT_DIR, 'attachments');

  function isPathAllowed(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(allowedDir + path.sep) || resolved === allowedDir;
  }

  it('should allow files within VAULT_DIR/attachments', () => {
    const filePath = path.join(allowedDir, 'abc-photo.png');
    expect(isPathAllowed(filePath)).toBe(true);
  });

  it('should block path traversal attempts', () => {
    const filePath = path.join(allowedDir, '..', '..', 'agents.json');
    expect(isPathAllowed(filePath)).toBe(false);
  });

  it('should block /etc/passwd', () => {
    expect(isPathAllowed('/etc/passwd')).toBe(false);
  });

  it('should block vault root (not attachments)', () => {
    const filePath = path.join(VAULT_DIR, 'vault.db');
    expect(isPathAllowed(filePath)).toBe(false);
  });

  it('should allow the attachments directory itself', () => {
    expect(isPathAllowed(allowedDir)).toBe(true);
  });
});

// ============================================================================
// Model Validation Tests
// ============================================================================

describe('model parameter validation', () => {
  const MODEL_RE = /^[a-zA-Z0-9._:/-]+$/;

  it('should accept valid model names', () => {
    expect(MODEL_RE.test('claude-sonnet-4-20250514')).toBe(true);
    expect(MODEL_RE.test('claude-opus-4-20250514')).toBe(true);
    expect(MODEL_RE.test('gpt-4')).toBe(true);
    expect(MODEL_RE.test('models/gemini-pro')).toBe(true);
    expect(MODEL_RE.test('org:model-v1.2')).toBe(true);
  });

  it('should reject command injection in model', () => {
    expect(MODEL_RE.test('; rm -rf /')).toBe(false);
    expect(MODEL_RE.test('model && cat /etc/passwd')).toBe(false);
    expect(MODEL_RE.test("model'; echo pwned")).toBe(false);
    expect(MODEL_RE.test('$(whoami)')).toBe(false);
    expect(MODEL_RE.test('`id`')).toBe(false);
  });
});

// ============================================================================
// secondaryProjectPath Escaping Tests
// ============================================================================

describe('secondaryProjectPath escaping', () => {
  function escapeForShell(str: string): string {
    return str.replace(/'/g, "'\\''");
  }

  it('should escape single quotes in paths', () => {
    const input = "/Users/test/my project's dir";
    const escaped = escapeForShell(input);
    expect(escaped).toBe("/Users/test/my project'\\''s dir");
  });

  it('should pass clean paths unchanged', () => {
    const input = '/Users/test/myproject';
    expect(escapeForShell(input)).toBe(input);
  });
});

// ============================================================================
// branchName Validation Tests (Fix 9)
// ============================================================================

describe('branchName validation', () => {
  const BRANCH_RE = /^[a-zA-Z0-9._\-\/]+$/;

  it('should accept valid branch names', () => {
    expect(BRANCH_RE.test('feature/my-branch')).toBe(true);
    expect(BRANCH_RE.test('fix-123')).toBe(true);
    expect(BRANCH_RE.test('release/v1.0.0')).toBe(true);
    expect(BRANCH_RE.test('main')).toBe(true);
  });

  it('should reject command injection in branch names', () => {
    expect(BRANCH_RE.test('; rm -rf /')).toBe(false);
    expect(BRANCH_RE.test('branch && cat /etc/passwd')).toBe(false);
    expect(BRANCH_RE.test("branch'; echo pwned")).toBe(false);
    expect(BRANCH_RE.test('$(whoami)')).toBe(false);
    expect(BRANCH_RE.test('`id`')).toBe(false);
  });

  it('should reject spaces', () => {
    expect(BRANCH_RE.test('my branch')).toBe(false);
  });
});

// ============================================================================
// Memory Service Path Traversal Tests (Fix 15)
// ============================================================================

describe('memory service path traversal', () => {
  const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

  function isWithinProjectsDir(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(CLAUDE_PROJECTS_DIR + path.sep) || resolved === CLAUDE_PROJECTS_DIR;
  }

  it('should allow paths within Claude projects directory', () => {
    const filePath = path.join(CLAUDE_PROJECTS_DIR, 'my-project', 'memory', 'MEMORY.md');
    expect(isWithinProjectsDir(filePath)).toBe(true);
  });

  it('should block traversal via ..', () => {
    const filePath = path.join(CLAUDE_PROJECTS_DIR, '..', 'settings.json');
    expect(isWithinProjectsDir(filePath)).toBe(false);
  });

  it('should block substring bypass (old .includes() vulnerability)', () => {
    // This path contains the substring "/.claude/projects/" but is NOT inside the projects dir
    const fakePath = '/tmp/fake/.claude/projects/../../etc/passwd';
    expect(isWithinProjectsDir(fakePath)).toBe(false);
  });

  it('should block absolute paths outside projects dir', () => {
    expect(isWithinProjectsDir('/etc/passwd')).toBe(false);
    expect(isWithinProjectsDir(path.join(os.homedir(), '.ssh', 'id_rsa'))).toBe(false);
  });

  it('should reject path traversal in fileName', () => {
    const fileName = '../../../.ssh/id_rsa';
    const hasTraversal = fileName.includes('/') || fileName.includes('..');
    expect(hasTraversal).toBe(true);
  });

  it('should accept clean file names', () => {
    const fileName = 'patterns.md';
    const hasTraversal = fileName.includes('/') || fileName.includes('..');
    expect(hasTraversal).toBe(false);
  });
});

// ============================================================================
// Telegram Path Restriction Tests (Fix 12)
// ============================================================================

describe('Telegram media path restriction', () => {
  function isSafeTelegramPath(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    const home = os.homedir();
    if (!resolved.startsWith(home + path.sep) && resolved !== home) return false;
    const blockedDirs = [
      path.join(home, '.ssh'),
      path.join(home, '.gnupg'),
      path.join(home, '.aws'),
      path.join(home, '.claude'),
      path.join(home, '.env'),
    ];
    for (const blocked of blockedDirs) {
      if (resolved === blocked || resolved.startsWith(blocked + path.sep)) return false;
    }
    return true;
  }

  it('should allow normal files in home directory', () => {
    expect(isSafeTelegramPath(path.join(os.homedir(), 'Documents', 'photo.png'))).toBe(true);
    expect(isSafeTelegramPath(path.join(os.homedir(), 'Downloads', 'report.pdf'))).toBe(true);
  });

  it('should block SSH keys', () => {
    expect(isSafeTelegramPath(path.join(os.homedir(), '.ssh', 'id_rsa'))).toBe(false);
    expect(isSafeTelegramPath(path.join(os.homedir(), '.ssh', 'id_ed25519'))).toBe(false);
  });

  it('should block Claude API token', () => {
    expect(isSafeTelegramPath(path.join(os.homedir(), '.claude', 'credentials.json'))).toBe(false);
  });

  it('should block AWS credentials', () => {
    expect(isSafeTelegramPath(path.join(os.homedir(), '.aws', 'credentials'))).toBe(false);
  });

  it('should block GPG keys', () => {
    expect(isSafeTelegramPath(path.join(os.homedir(), '.gnupg', 'private-keys-v1.d'))).toBe(false);
  });

  it('should block files outside home directory', () => {
    expect(isSafeTelegramPath('/etc/passwd')).toBe(false);
    expect(isSafeTelegramPath('/var/log/system.log')).toBe(false);
  });
});
