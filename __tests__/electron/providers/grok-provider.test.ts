import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;
let mockExecFileSync: ReturnType<typeof vi.fn>;

vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return { ...mod, homedir: () => tmpDir };
});

vi.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-prov-test-'));
  mockExecFileSync = vi.fn();
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

    it('lists the grok-build default model', async () => {
      const provider = await getProvider();
      const models = provider.getModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.map(m => m.id)).toContain('grok-build');
    });

    it('uses config.toml for hooks/config', async () => {
      const provider = await getProvider();
      expect(provider.getHookConfig().settingsFile).toContain('config.toml');
    });

    it('reports no --add-dir flag (Grok has no multi-root flag)', async () => {
      const provider = await getProvider();
      expect(provider.getAddDirFlag()).toBe('');
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
    it('passes the model with -m and the prompt positionally', async () => {
      const provider = await getProvider();
      const cmd = provider.buildInteractiveCommand({
        binaryPath: 'grok',
        prompt: 'hello',
        model: 'grok-build',
      });
      expect(cmd).toContain("-m 'grok-build'");
      expect(cmd).toMatch(/'hello'$/);
    });

    it('rejects an invalid model name', async () => {
      const provider = await getProvider();
      expect(() =>
        provider.buildInteractiveCommand({ binaryPath: 'grok', prompt: 'x', model: 'bad model!' }),
      ).toThrow('Invalid model name');
    });

    it('maps permission modes to --permission-mode', async () => {
      const provider = await getProvider();
      const auto = provider.buildInteractiveCommand({ binaryPath: 'grok', prompt: 'x', permissionMode: 'auto' });
      expect(auto).toContain('--permission-mode auto');

      const bypass = provider.buildInteractiveCommand({ binaryPath: 'grok', prompt: 'x', permissionMode: 'bypass' });
      expect(bypass).toContain('--permission-mode bypassPermissions');

      const normal = provider.buildInteractiveCommand({ binaryPath: 'grok', prompt: 'x', permissionMode: 'normal' });
      expect(normal).not.toContain('--permission-mode');
    });

    it('passes non-default effort with --effort', async () => {
      const provider = await getProvider();
      const high = provider.buildInteractiveCommand({ binaryPath: 'grok', prompt: 'x', effort: 'high' });
      expect(high).toContain('--effort high');

      const medium = provider.buildInteractiveCommand({ binaryPath: 'grok', prompt: 'x', effort: 'medium' });
      expect(medium).not.toContain('--effort');
    });

    it('does not emit --add-dir for secondary directories', async () => {
      const provider = await getProvider();
      const cmd = provider.buildInteractiveCommand({
        binaryPath: 'grok',
        prompt: 'x',
        secondaryProjectPath: '/work/other',
      });
      expect(cmd).not.toContain('--add-dir');
    });
  });

  describe('buildScheduledCommand', () => {
    it('runs headless with -p and bypasses permissions when autonomous', async () => {
      const provider = await getProvider();
      const cmd = provider.buildScheduledCommand({
        binaryPath: 'grok',
        prompt: 'do the thing',
        autonomous: true,
      });
      expect(cmd).toContain("-p 'do the thing'");
      expect(cmd).toContain('--permission-mode bypassPermissions');
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
    it('places -m before -p so the prompt is the value of -p', async () => {
      const provider = await getProvider();
      const cmd = provider.buildOneShotCommand({ binaryPath: 'grok', prompt: 'hi', model: 'grok-build' });
      // -m must come before -p (which consumes its following token as the prompt)
      expect(cmd).toContain("-m 'grok-build'");
      expect(cmd.indexOf("-m 'grok-build'")).toBeLessThan(cmd.indexOf('-p '));
      expect(cmd).toMatch(/-p 'hi'$/);
    });
  });

  describe('getMcpConfigStrategy', () => {
    it('returns config-file', async () => {
      const provider = await getProvider();
      expect(provider.getMcpConfigStrategy()).toBe('config-file');
    });
  });

  describe('registerMcpServer', () => {
    it('uses grok mcp add with command before -- and args after', async () => {
      const provider = await getProvider();
      mockExecFileSync.mockReturnValue('Added stdio MCP server');

      await provider.registerMcpServer('my-mcp', 'node', ['/path/to/bundle.js']);

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'grok',
        ['mcp', 'add', 'my-mcp', 'node', '--', '/path/to/bundle.js'],
        expect.objectContaining({ encoding: 'utf-8', stdio: 'pipe' }),
      );
      // No fallback file written on CLI success.
      const configPath = path.join(tmpDir, '.grok', 'config.toml');
      expect(fs.existsSync(configPath)).toBe(false);
    });

    it('falls back to config.toml ([mcp_servers.<name>]) when the CLI throws', async () => {
      const provider = await getProvider();
      mockExecFileSync.mockImplementation(() => { throw new Error('command not found'); });

      await provider.registerMcpServer('my-mcp', 'node', ['/bundle.js']);

      const configPath = path.join(tmpDir, '.grok', 'config.toml');
      expect(fs.existsSync(configPath)).toBe(true);
      const toml = fs.readFileSync(configPath, 'utf-8');
      expect(toml).toContain('[mcp_servers.my-mcp]');
      expect(toml).toContain('command = "node"');
      expect(toml).toContain('args = ["/bundle.js"]');
    });
  });

  describe('isMcpServerRegistered', () => {
    it('detects a server with the expected path in config.toml', async () => {
      const provider = await getProvider();
      mockExecFileSync.mockImplementation(() => { throw new Error('no cli'); });
      await provider.registerMcpServer('vault', 'node', ['/abs/vault-mcp.js']);

      expect(provider.isMcpServerRegistered('vault', '/abs/vault-mcp.js')).toBe(true);
      expect(provider.isMcpServerRegistered('vault', '/other/path.js')).toBe(false);
      expect(provider.isMcpServerRegistered('missing', '/abs/vault-mcp.js')).toBe(false);
    });
  });
});
