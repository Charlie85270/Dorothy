import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;
let mockExecSync: ReturnType<typeof vi.fn>;

vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return { ...mod, homedir: () => tmpDir };
});

vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-prov-test-'));
  mockExecSync = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function getProvider() {
  const { CodexProvider } = await import('../../../electron/providers/codex-provider');
  return new CodexProvider();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CodexProvider', () => {
  describe('getMcpConfigStrategy', () => {
    it('returns config-file', async () => {
      const provider = await getProvider();
      expect(provider.getMcpConfigStrategy()).toBe('config-file');
    });
  });

  describe('registerMcpServer', () => {
    it('uses codex mcp add when CLI succeeds', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('Added global MCP server');

      await provider.registerMcpServer('my-mcp', 'node', ['/path/to/bundle.js']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('codex mcp add my-mcp -- node'),
        expect.objectContaining({ encoding: 'utf-8', stdio: 'pipe' }),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('/path/to/bundle.js'),
        expect.any(Object),
      );
    });

    it('does not write config.toml when CLI succeeds', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('Added');

      await provider.registerMcpServer('my-mcp', 'node', ['/bundle.js']);

      const configPath = path.join(tmpDir, '.codex', 'config.toml');
      expect(fs.existsSync(configPath)).toBe(false);
    });

    it('falls back to config.toml when CLI fails', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('command not found'); });

      await provider.registerMcpServer('my-mcp', 'node', ['/path/to/bundle.js']);

      const configPath = path.join(tmpDir, '.codex', 'config.toml');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('[mcp_servers.my-mcp]');
      expect(content).toContain('command = "node"');
      expect(content).toContain('"/path/to/bundle.js"');
    });

    it('creates .codex directory if missing in fallback', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });

      await provider.registerMcpServer('srv', 'node', ['/x.js']);

      expect(fs.existsSync(path.join(tmpDir, '.codex'))).toBe(true);
    });

    it('preserves existing config.toml content in fallback', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });

      const codexDir = path.join(tmpDir, '.codex');
      fs.mkdirSync(codexDir, { recursive: true });
      fs.writeFileSync(path.join(codexDir, 'config.toml'), 'model = "gpt-5.3-codex"\n');

      await provider.registerMcpServer('my-mcp', 'node', ['/bundle.js']);

      const content = fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf-8');
      expect(content).toContain('model = "gpt-5.3-codex"');
      expect(content).toContain('[mcp_servers.my-mcp]');
    });

    it('replaces existing MCP section in fallback', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });

      const codexDir = path.join(tmpDir, '.codex');
      fs.mkdirSync(codexDir, { recursive: true });
      fs.writeFileSync(path.join(codexDir, 'config.toml'),
        'model = "gpt-5"\n\n[mcp_servers.my-mcp]\ncommand = "node"\nargs = ["/old.js"]\n'
      );

      await provider.registerMcpServer('my-mcp', 'node', ['/new.js']);

      const content = fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf-8');
      expect(content).toContain('/new.js');
      expect(content).not.toContain('/old.js');
      // Should still only have one section for my-mcp
      expect(content.match(/\[mcp_servers\.my-mcp\]/g)).toHaveLength(1);
    });
  });

  describe('removeMcpServer', () => {
    it('calls codex mcp remove', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      await provider.removeMcpServer('my-mcp');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('codex mcp remove my-mcp'),
        expect.any(Object),
      );
    });

    it('also cleans config.toml', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      const codexDir = path.join(tmpDir, '.codex');
      fs.mkdirSync(codexDir, { recursive: true });
      fs.writeFileSync(path.join(codexDir, 'config.toml'),
        'model = "gpt-5"\n\n[mcp_servers.my-mcp]\ncommand = "node"\nargs = ["/x.js"]\n'
      );

      await provider.removeMcpServer('my-mcp');

      const content = fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf-8');
      expect(content).not.toContain('[mcp_servers.my-mcp]');
      expect(content).toContain('model = "gpt-5"');
    });

    it('does not throw when config.toml does not exist', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      await expect(provider.removeMcpServer('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('isMcpServerRegistered', () => {
    it('returns true when TOML section exists with matching path', async () => {
      const provider = await getProvider();
      const codexDir = path.join(tmpDir, '.codex');
      fs.mkdirSync(codexDir, { recursive: true });
      fs.writeFileSync(path.join(codexDir, 'config.toml'),
        '[mcp_servers.my-mcp]\ncommand = "node"\nargs = ["/bundle.js"]\n'
      );

      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(true);
    });

    it('returns false when section exists but path differs', async () => {
      const provider = await getProvider();
      const codexDir = path.join(tmpDir, '.codex');
      fs.mkdirSync(codexDir, { recursive: true });
      fs.writeFileSync(path.join(codexDir, 'config.toml'),
        '[mcp_servers.my-mcp]\ncommand = "node"\nargs = ["/old.js"]\n'
      );

      expect(provider.isMcpServerRegistered('my-mcp', '/new.js')).toBe(false);
    });

    it('returns false when config.toml does not exist', async () => {
      const provider = await getProvider();
      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(false);
    });

    it('returns false when section is missing', async () => {
      const provider = await getProvider();
      const codexDir = path.join(tmpDir, '.codex');
      fs.mkdirSync(codexDir, { recursive: true });
      fs.writeFileSync(path.join(codexDir, 'config.toml'), 'model = "gpt-5"\n');

      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(false);
    });
  });
});
