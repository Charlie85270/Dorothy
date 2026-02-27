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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-prov-test-'));
  mockExecSync = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function getProvider() {
  const { ClaudeProvider } = await import('../../../electron/providers/claude-provider');
  return new ClaudeProvider();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ClaudeProvider', () => {
  describe('buildInteractiveCommand', () => {
    it('includes --mcp-config when mcpConfigPath is provided', async () => {
      const provider = await getProvider();
      const mcpPath = path.join(tmpDir, '.claude', 'mcp.json');
      fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
      fs.writeFileSync(mcpPath, '{}');

      const cmd = provider.buildInteractiveCommand({
        binaryPath: 'claude',
        prompt: 'hello',
        mcpConfigPath: mcpPath,
      });

      expect(cmd).toContain('--mcp-config');
      expect(cmd).toContain(mcpPath);
    });

    it('omits --mcp-config when mcpConfigPath is undefined', async () => {
      const provider = await getProvider();

      const cmd = provider.buildInteractiveCommand({
        binaryPath: 'claude',
        prompt: 'hello',
      });

      expect(cmd).not.toContain('--mcp-config');
    });

    it('omits --mcp-config when mcpConfigPath file does not exist', async () => {
      const provider = await getProvider();

      const cmd = provider.buildInteractiveCommand({
        binaryPath: 'claude',
        prompt: 'hello',
        mcpConfigPath: '/nonexistent/mcp.json',
      });

      expect(cmd).not.toContain('--mcp-config');
    });
  });

  describe('getMcpConfigStrategy', () => {
    it('returns flag', async () => {
      const provider = await getProvider();
      expect(provider.getMcpConfigStrategy()).toBe('flag');
    });
  });

  describe('registerMcpServer', () => {
    it('uses claude mcp add when CLI succeeds', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      await provider.registerMcpServer('test-server', 'node', ['/path/to/bundle.js']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('claude mcp add -s user test-server'),
        expect.objectContaining({ encoding: 'utf-8', stdio: 'pipe' }),
      );
    });

    it('falls back to mcp.json when CLI fails', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('command not found'); });

      await provider.registerMcpServer('test-server', 'node', ['/path/to/bundle.js']);

      const mcpPath = path.join(tmpDir, '.claude', 'mcp.json');
      expect(fs.existsSync(mcpPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      expect(config.mcpServers['test-server']).toEqual({
        command: 'node',
        args: ['/path/to/bundle.js'],
      });
    });

    it('creates .claude directory if missing in fallback', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });

      await provider.registerMcpServer('srv', 'node', ['/x.js']);

      expect(fs.existsSync(path.join(tmpDir, '.claude'))).toBe(true);
    });

    it('preserves existing mcp.json entries in fallback', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });

      const mcpDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.writeFileSync(path.join(mcpDir, 'mcp.json'), JSON.stringify({
        mcpServers: { existing: { command: 'node', args: ['/existing.js'] } },
      }));

      await provider.registerMcpServer('new-server', 'node', ['/new.js']);

      const config = JSON.parse(fs.readFileSync(path.join(mcpDir, 'mcp.json'), 'utf-8'));
      expect(config.mcpServers.existing).toBeDefined();
      expect(config.mcpServers['new-server']).toBeDefined();
    });
  });

  describe('removeMcpServer', () => {
    it('calls claude mcp remove', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      await provider.removeMcpServer('test-server');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('claude mcp remove -s user test-server'),
        expect.any(Object),
      );
    });

    it('also cleans mcp.json', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('');

      const mcpDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.writeFileSync(path.join(mcpDir, 'mcp.json'), JSON.stringify({
        mcpServers: {
          'test-server': { command: 'node', args: ['/x.js'] },
          'keep-server': { command: 'node', args: ['/y.js'] },
        },
      }));

      await provider.removeMcpServer('test-server');

      const config = JSON.parse(fs.readFileSync(path.join(mcpDir, 'mcp.json'), 'utf-8'));
      expect(config.mcpServers['test-server']).toBeUndefined();
      expect(config.mcpServers['keep-server']).toBeDefined();
    });
  });

  describe('isMcpServerRegistered', () => {
    it('returns true when server exists in mcp.json with matching path', async () => {
      const provider = await getProvider();
      const mcpDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.writeFileSync(path.join(mcpDir, 'mcp.json'), JSON.stringify({
        mcpServers: { 'my-mcp': { command: 'node', args: ['/bundle.js'] } },
      }));

      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(true);
    });

    it('returns false when server exists but path differs', async () => {
      const provider = await getProvider();
      const mcpDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.writeFileSync(path.join(mcpDir, 'mcp.json'), JSON.stringify({
        mcpServers: { 'my-mcp': { command: 'node', args: ['/old-bundle.js'] } },
      }));

      expect(provider.isMcpServerRegistered('my-mcp', '/new-bundle.js')).toBe(false);
    });

    it('returns false when mcp.json does not exist', async () => {
      const provider = await getProvider();
      expect(provider.isMcpServerRegistered('my-mcp', '/bundle.js')).toBe(false);
    });
  });
});
