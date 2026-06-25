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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-prov-test-'));
  mockExecSync = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function getProvider() {
  const { GrokProvider } = await import('../../../electron/providers/grok-provider');
  return new GrokProvider();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GrokProvider', () => {
  describe('identity', () => {
    it('exposes the grok id and binary', async () => {
      const provider = await getProvider();
      expect(provider.id).toBe('grok');
      expect(provider.binaryName).toBe('grok');
      expect(provider.displayName).toBe('Grok CLI');
    });

    it('lists at least one model', async () => {
      const provider = await getProvider();
      const models = provider.getModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.map(m => m.id)).toContain('grok-4');
    });
  });

  describe('resolveBinaryPath', () => {
    it('uses the configured path when present', async () => {
      const provider = await getProvider();
      const p = provider.resolveBinaryPath({ cliPaths: { grok: '/opt/bin/grok' } } as never);
      expect(p).toBe('/opt/bin/grok');
    });

    it('falls back to the bare binary name', async () => {
      const provider = await getProvider();
      const p = provider.resolveBinaryPath({ cliPaths: {} } as never);
      expect(p).toBe('grok');
    });
  });

  describe('buildInteractiveCommand', () => {
    it('passes the model with -m', async () => {
      const provider = await getProvider();
      const cmd = provider.buildInteractiveCommand({
        binaryPath: 'grok',
        prompt: 'hello',
        model: 'grok-4',
      });
      expect(cmd).toContain("-m 'grok-4'");
      expect(cmd).toContain("'hello'");
    });

    it('rejects an invalid model name', async () => {
      const provider = await getProvider();
      expect(() =>
        provider.buildInteractiveCommand({ binaryPath: 'grok', prompt: 'x', model: 'bad model!' }),
      ).toThrow('Invalid model name');
    });

    it('adds secondary directories with --add-dir', async () => {
      const provider = await getProvider();
      const cmd = provider.buildInteractiveCommand({
        binaryPath: 'grok',
        prompt: 'x',
        secondaryProjectPath: '/work/other',
      });
      expect(cmd).toContain("--add-dir '/work/other'");
    });
  });

  describe('buildScheduledCommand', () => {
    it('runs headless with -p', async () => {
      const provider = await getProvider();
      const cmd = provider.buildScheduledCommand({
        binaryPath: 'grok',
        prompt: 'do the thing',
        autonomous: true,
      });
      expect(cmd).toContain("-p 'do the thing'");
    });

    it('emits streaming-json when an output format is requested', async () => {
      const provider = await getProvider();
      const cmd = provider.buildScheduledCommand({
        binaryPath: 'grok',
        prompt: 'x',
        autonomous: false,
        outputFormat: 'json',
      });
      expect(cmd).toContain('--output-format streaming-json');
    });
  });

  describe('buildOneShotCommand', () => {
    it('builds a -p one-shot with optional model', async () => {
      const provider = await getProvider();
      const cmd = provider.buildOneShotCommand({ binaryPath: 'grok', prompt: 'hi', model: 'grok-4-fast' });
      expect(cmd).toContain(' -p');
      expect(cmd).toContain('-m grok-4-fast');
      expect(cmd).toContain("'hi'");
    });
  });

  describe('getMcpConfigStrategy', () => {
    it('returns config-file', async () => {
      const provider = await getProvider();
      expect(provider.getMcpConfigStrategy()).toBe('config-file');
    });
  });

  describe('registerMcpServer', () => {
    it('uses grok mcp add when the CLI succeeds', async () => {
      const provider = await getProvider();
      mockExecSync.mockReturnValue('Added MCP server');

      await provider.registerMcpServer('my-mcp', 'node', ['/path/to/bundle.js']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('grok mcp add my-mcp -- node'),
        expect.objectContaining({ encoding: 'utf-8', stdio: 'pipe' }),
      );
      // No fallback file written on CLI success.
      const settingsPath = path.join(tmpDir, '.grok', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(false);
    });

    it('falls back to settings.json when the CLI throws', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('command not found'); });

      await provider.registerMcpServer('my-mcp', 'node', ['/bundle.js']);

      const settingsPath = path.join(tmpDir, '.grok', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(parsed.mcpServers['my-mcp']).toEqual({ command: 'node', args: ['/bundle.js'] });
    });
  });

  describe('isMcpServerRegistered', () => {
    it('detects a server with the expected path in settings.json', async () => {
      const provider = await getProvider();
      mockExecSync.mockImplementation(() => { throw new Error('no cli'); });
      await provider.registerMcpServer('vault', 'node', ['/abs/vault-mcp.js']);

      expect(provider.isMcpServerRegistered('vault', '/abs/vault-mcp.js')).toBe(true);
      expect(provider.isMcpServerRegistered('vault', '/other/path.js')).toBe(false);
      expect(provider.isMcpServerRegistered('missing', '/abs/vault-mcp.js')).toBe(false);
    });
  });
});
