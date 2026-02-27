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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-prov-test-'));
  mockExecSync = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function getProvider() {
  const { GeminiProvider } = await import('../../../electron/providers/gemini-provider');
  return new GeminiProvider();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GeminiProvider', () => {
  describe('getMcpConfigStrategy', () => {
    it('returns config-file', async () => {
      const provider = await getProvider();
      expect(provider.getMcpConfigStrategy()).toBe('config-file');
    });
  });

  describe('registerMcpServer', () => {
    it('uses gemini mcp add when CLI succeeds', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('MCP server added');

      await provider.registerMcpServer('my-mcp', 'node', ['/path/to/bundle.js']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gemini mcp add -s user my-mcp node'),
        expect.objectContaining({ encoding: 'utf-8', stdio: 'pipe' }),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('/path/to/bundle.js'),
        expect.any(Object),
      );
    });

    it('does not write settings.json when CLI succeeds', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('Added');

      await provider.registerMcpServer('my-mcp', 'node', ['/bundle.js']);

      const settingsPath = path.join(tmpDir, '.gemini', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(false);
    });

    it('falls back to settings.json when CLI fails', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('command not found'); });

      await provider.registerMcpServer('my-mcp', 'node', ['/path/to/bundle.js']);

      const settingsPath = path.join(tmpDir, '.gemini', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(settings.mcpServers['my-mcp']).toEqual({
        command: 'node',
        args: ['/path/to/bundle.js'],
      });
    });

    it('creates .gemini directory if missing in fallback', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });

      await provider.registerMcpServer('srv', 'node', ['/x.js']);

      expect(fs.existsSync(path.join(tmpDir, '.gemini'))).toBe(true);
    });

    it('preserves existing settings.json content in fallback', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });

      const geminiDir = path.join(tmpDir, '.gemini');
      fs.mkdirSync(geminiDir, { recursive: true });
      fs.writeFileSync(path.join(geminiDir, 'settings.json'), JSON.stringify({
        security: { auth: { selectedType: 'oauth' } },
        mcpServers: { existing: { command: 'node', args: ['/existing.js'] } },
      }));

      await provider.registerMcpServer('new-mcp', 'node', ['/new.js']);

      const settings = JSON.parse(fs.readFileSync(path.join(geminiDir, 'settings.json'), 'utf-8'));
      expect(settings.security.auth.selectedType).toBe('oauth');
      expect(settings.mcpServers.existing).toBeDefined();
      expect(settings.mcpServers['new-mcp']).toBeDefined();
    });
  });

  describe('removeMcpServer', () => {
    it('calls gemini mcp remove', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      await provider.removeMcpServer('my-mcp');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gemini mcp remove -s user my-mcp'),
        expect.any(Object),
      );
    });

    it('also cleans settings.json', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      const geminiDir = path.join(tmpDir, '.gemini');
      fs.mkdirSync(geminiDir, { recursive: true });
      fs.writeFileSync(path.join(geminiDir, 'settings.json'), JSON.stringify({
        mcpServers: {
          'my-mcp': { command: 'node', args: ['/x.js'] },
          'keep-mcp': { command: 'node', args: ['/y.js'] },
        },
      }));

      await provider.removeMcpServer('my-mcp');

      const settings = JSON.parse(fs.readFileSync(path.join(geminiDir, 'settings.json'), 'utf-8'));
      expect(settings.mcpServers['my-mcp']).toBeUndefined();
      expect(settings.mcpServers['keep-mcp']).toBeDefined();
    });

    it('does not throw when settings.json does not exist', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      await expect(provider.removeMcpServer('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('isMcpServerRegistered', () => {
    it('returns true when server exists in settings.json with matching path', async () => {
      const provider = await getProvider();
      const geminiDir = path.join(tmpDir, '.gemini');
      fs.mkdirSync(geminiDir, { recursive: true });
      fs.writeFileSync(path.join(geminiDir, 'settings.json'), JSON.stringify({
        mcpServers: { 'my-mcp': { command: 'node', args: ['/bundle.js'] } },
      }));

      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(true);
    });

    it('returns false when server exists but path differs', async () => {
      const provider = await getProvider();
      const geminiDir = path.join(tmpDir, '.gemini');
      fs.mkdirSync(geminiDir, { recursive: true });
      fs.writeFileSync(path.join(geminiDir, 'settings.json'), JSON.stringify({
        mcpServers: { 'my-mcp': { command: 'node', args: ['/old.js'] } },
      }));

      expect(provider.isMcpServerRegistered('my-mcp', '/new.js')).toBe(false);
    });

    it('returns false when settings.json does not exist', async () => {
      const provider = await getProvider();
      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(false);
    });

    it('returns false when mcpServers key is missing', async () => {
      const provider = await getProvider();
      const geminiDir = path.join(tmpDir, '.gemini');
      fs.mkdirSync(geminiDir, { recursive: true });
      fs.writeFileSync(path.join(geminiDir, 'settings.json'), JSON.stringify({ security: {} }));

      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(false);
    });
  });
});
