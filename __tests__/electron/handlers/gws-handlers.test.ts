import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Mocks ────────────────────────────────────────────────────────────────────

let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
let tmpDir: string;

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn);
    }),
  },
}));

// Mock child_process.exec (used via promisify → execAsync)
const mockExec = vi.fn();
vi.mock('child_process', () => ({
  exec: (...args: unknown[]) => mockExec(...args),
}));

// Mock os.homedir to use temp directory
vi.mock('os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('os')>();
  return { ...mod, homedir: () => tmpDir };
});

// Controllable fs.existsSync filter for tests that need to hide real binaries
let existsSyncFilter: ((p: string) => boolean | null) | null = null;

vi.mock('fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('fs')>();
  return {
    ...mod,
    existsSync: (p: fs.PathLike) => {
      if (existsSyncFilter) {
        const result = existsSyncFilter(String(p));
        if (result !== null) return result;
      }
      return mod.existsSync(p);
    },
  };
});

// Mock buildFullPath
vi.mock('../../../electron/utils/path-builder', () => ({
  buildFullPath: () => '/mock/path',
}));

// Mock providers
const mockRegisterMcpServer = vi.fn().mockResolvedValue(undefined);
const mockRemoveMcpServer = vi.fn().mockResolvedValue(undefined);
const mockIsMcpServerRegistered = vi.fn().mockReturnValue(false);

const mockGetInstalledSkills = vi.fn().mockReturnValue([]);

const mockProvider = {
  id: 'claude',
  displayName: 'Claude',
  registerMcpServer: mockRegisterMcpServer,
  removeMcpServer: mockRemoveMcpServer,
  isMcpServerRegistered: mockIsMcpServerRegistered,
  getInstalledSkills: mockGetInstalledSkills,
};

vi.mock('../../../electron/providers', () => ({
  getAllProviders: () => [mockProvider],
}));

function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for "${channel}"`);
  return fn({}, ...args);
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  handlers = new Map();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gws-test-'));
  existsSyncFilter = null;
  mockExec.mockReset();
  mockRegisterMcpServer.mockReset().mockResolvedValue(undefined);
  mockRemoveMcpServer.mockReset().mockResolvedValue(undefined);
  mockIsMcpServerRegistered.mockReset().mockReturnValue(false);
  mockGetInstalledSkills.mockReset().mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockDefaultSettings() {
  return {
    getAppSettings: () => ({ gwsEnabled: false, gwsSkillsInstalled: false }),
    setAppSettings: vi.fn(),
    saveAppSettings: vi.fn(),
  };
}

async function registerHandlers() {
  const { registerGwsHandlers } = await import('../../../electron/handlers/gws-handlers');
  registerGwsHandlers(mockDefaultSettings() as never);
}

/** Simulate exec callback: exec(cmd, opts, callback) via promisify */
function mockExecSuccess(stdout: string) {
  mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    if (typeof _opts === 'function') {
      // exec(cmd, callback)
      (_opts as (err: Error | null, result: { stdout: string; stderr: string }) => void)(null, { stdout, stderr: '' });
    } else {
      // exec(cmd, opts, callback)
      cb(null, { stdout, stderr: '' });
    }
  });
}

function mockExecError(error: Error) {
  mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (err: Error | null, result?: unknown) => void) => {
    if (typeof _opts === 'function') {
      (_opts as (err: Error | null) => void)(error);
    } else {
      cb(error);
    }
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('gws-handlers', () => {
  describe('gws:detect', () => {
    it('returns path when gws binary found on filesystem', async () => {
      // Create a fake gws binary in a known path
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      await registerHandlers();
      const result = await invokeHandler('gws:detect');
      expect(result).toBe(path.join(binDir, 'gws'));
    });

    it('returns path from which command when not on filesystem', async () => {
      // No gws in filesystem, but `which` succeeds
      mockExecSuccess('/usr/bin/gws\n');

      await registerHandlers();
      const result = await invokeHandler('gws:detect');
      expect(result).toBe('/usr/bin/gws');
    });

    it('returns empty string when gws is not found anywhere', async () => {
      // No gws in filesystem, `which` fails
      mockExecError(new Error('not found'));

      await registerHandlers();
      const result = await invokeHandler('gws:detect');
      expect(result).toBe('');
    });

    it('scans nvm version directories', async () => {
      // Create nvm structure with gws in a specific node version
      const nvmBin = path.join(tmpDir, '.nvm', 'versions', 'node', 'v20.0.0', 'bin');
      fs.mkdirSync(nvmBin, { recursive: true });
      fs.writeFileSync(path.join(nvmBin, 'gws'), '#!/bin/sh');

      // Make `which` fail so it doesn't interfere
      mockExecError(new Error('not found'));

      await registerHandlers();
      const result = await invokeHandler('gws:detect');
      expect(result).toBe(path.join(nvmBin, 'gws'));
    });
  });

  describe('gws:detectGcloud', () => {
    it('returns path when gcloud binary found on filesystem', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gcloud'), '#!/bin/sh');

      await registerHandlers();
      const result = await invokeHandler('gws:detectGcloud');
      expect(result).toBe(path.join(binDir, 'gcloud'));
    });

    it('finds gcloud in home-relative google-cloud-sdk path', async () => {
      const gcloudBin = path.join(tmpDir, 'google-cloud-sdk', 'bin');
      fs.mkdirSync(gcloudBin, { recursive: true });
      fs.writeFileSync(path.join(gcloudBin, 'gcloud'), '#!/bin/sh');

      // Hide real system gcloud binaries so only our tmpDir one is found
      existsSyncFilter = (p) => {
        if (/[\\/]gcloud(\.exe|\.cmd)?$/i.test(p) && !p.startsWith(tmpDir)) return false;
        return null; // pass-through to real existsSync
      };

      await registerHandlers();
      const result = await invokeHandler('gws:detectGcloud');
      expect(result).toBe(path.join(gcloudBin, 'gcloud'));
    });

    it('returns path from which command when not on filesystem', async () => {
      // Hide all gcloud binaries on filesystem
      existsSyncFilter = (p) => /[\\/]gcloud(\.exe|\.cmd)?$/i.test(p) ? false : null;
      mockExecSuccess('/usr/local/bin/gcloud\n');

      await registerHandlers();
      const result = await invokeHandler('gws:detectGcloud');
      expect(result).toBe('/usr/local/bin/gcloud');
    });

    it('returns empty string when gcloud is not found anywhere', async () => {
      // Hide all gcloud binaries on filesystem
      existsSyncFilter = (p) => /[\\/]gcloud(\.exe|\.cmd)?$/i.test(p) ? false : null;
      mockExecError(new Error('not found'));

      await registerHandlers();
      const result = await invokeHandler('gws:detectGcloud');
      expect(result).toBe('');
    });
  });

  describe('gws:authStatus', () => {
    it('returns default status when gws is not installed', async () => {
      mockExecError(new Error('not found'));

      await registerHandlers();
      const result = await invokeHandler('gws:authStatus') as {
        authenticated: boolean;
        user: string | null;
        services: Record<string, string>;
      };

      expect(result.authenticated).toBe(false);
      expect(result.user).toBeNull();
      expect(result.services.gmail).toBe('none');
      expect(result.services.drive).toBe('none');
    });

    it('parses authenticated status with scopes', async () => {
      // First call: findGwsBinary finds it on filesystem
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      // Second call: auth status returns JSON
      const authJson = JSON.stringify({
        authenticated: true,
        user: 'test@gmail.com',
        tokenValid: true,
        scopes: [
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/calendar',
        ],
        authMethod: 'oauth2',
      });

      mockExecSuccess(authJson);

      await registerHandlers();
      const result = await invokeHandler('gws:authStatus') as {
        authenticated: boolean;
        user: string;
        tokenValid: boolean;
        scopes: string[];
        authMethod: string;
        services: Record<string, string>;
      };

      expect(result.authenticated).toBe(true);
      expect(result.user).toBe('test@gmail.com');
      expect(result.tokenValid).toBe(true);
      expect(result.authMethod).toBe('oauth2');
      // gmail.modify → write, drive (no readonly) → write, etc.
      expect(result.services.gmail).toBe('write');
      expect(result.services.drive).toBe('write');
      expect(result.services.sheets).toBe('write');
      expect(result.services.calendar).toBe('write');
      expect(result.services.docs).toBe('none');
      expect(result.services.slides).toBe('none');
    });

    it('parses real gws auth status output format', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      // Real output from `gws auth status`
      const authJson = JSON.stringify({
        auth_method: 'oauth2',
        user: 'user@gmail.com',
        token_valid: true,
        has_refresh_token: true,
        encrypted_credentials_exists: true,
        encryption_valid: true,
        scope_count: 5,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/documents.readonly',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
        ],
      });
      mockExecSuccess(authJson);

      await registerHandlers();
      const result = await invokeHandler('gws:authStatus') as {
        authenticated: boolean;
        user: string;
        tokenValid: boolean;
        authMethod: string;
        services: Record<string, string>;
      };

      expect(result.authenticated).toBe(true);
      expect(result.user).toBe('user@gmail.com');
      expect(result.tokenValid).toBe(true);
      expect(result.authMethod).toBe('oauth2');
      // All scopes are .readonly
      expect(result.services.drive).toBe('read');
      expect(result.services.gmail).toBe('read');
      expect(result.services.docs).toBe('read');
      expect(result.services.calendar).toBe('read');
      expect(result.services.sheets).toBe('read');
    });

    it('handles gws auth login output format (status/account fields)', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      // Output from `gws auth login` differs from `gws auth status`
      const authJson = JSON.stringify({
        status: 'success',
        account: 'alt@gmail.com',
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
        ],
      });
      mockExecSuccess(authJson);

      await registerHandlers();
      const result = await invokeHandler('gws:authStatus') as {
        authenticated: boolean;
        user: string;
        tokenValid: boolean;
        authMethod: string;
      };

      expect(result.authenticated).toBe(true);
      expect(result.user).toBe('alt@gmail.com');
      expect(result.tokenValid).toBe(true);
      expect(result.authMethod).toBe('oauth2');
    });

    it('returns defaults when auth status command fails', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      // Auth status command fails
      mockExecError(new Error('gws auth status failed'));

      await registerHandlers();
      const result = await invokeHandler('gws:authStatus') as {
        authenticated: boolean;
        user: string | null;
      };

      expect(result.authenticated).toBe(false);
      expect(result.user).toBeNull();
    });

    it('returns defaults when auth status returns invalid JSON', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      mockExecSuccess('not valid json');

      await registerHandlers();
      const result = await invokeHandler('gws:authStatus') as {
        authenticated: boolean;
      };

      expect(result.authenticated).toBe(false);
    });
  });

  describe('gws:setup', () => {
    it('registers MCP server with all providers', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');
      const gwsPath = path.join(binDir, 'gws');

      await registerHandlers();
      const result = await invokeHandler('gws:setup') as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockRegisterMcpServer).toHaveBeenCalledWith('google-workspace', gwsPath, ['mcp', '-s', 'drive,gmail,calendar,sheets,docs']);
    });

    it('accepts custom services parameter', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');
      const gwsPath = path.join(binDir, 'gws');

      await registerHandlers();
      const result = await invokeHandler('gws:setup', 'gmail,drive') as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockRegisterMcpServer).toHaveBeenCalledWith('google-workspace', gwsPath, ['mcp', '-s', 'gmail,drive']);
    });

    it('returns error when gws binary is not found', async () => {
      mockExecError(new Error('not found'));

      await registerHandlers();
      const result = await invokeHandler('gws:setup') as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('gws binary not found');
    });

    it('succeeds even when one provider fails to register', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      mockRegisterMcpServer.mockRejectedValueOnce(new Error('provider error'));

      await registerHandlers();
      const result = await invokeHandler('gws:setup') as { success: boolean };

      // Should still succeed — individual provider errors are caught
      expect(result.success).toBe(true);
    });
  });

  describe('gws:remove', () => {
    it('removes MCP server from all providers', async () => {
      await registerHandlers();
      const result = await invokeHandler('gws:remove') as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockRemoveMcpServer).toHaveBeenCalledWith('google-workspace');
    });

    it('succeeds even when one provider fails to remove', async () => {
      mockRemoveMcpServer.mockRejectedValueOnce(new Error('provider error'));

      await registerHandlers();
      const result = await invokeHandler('gws:remove') as { success: boolean };

      expect(result.success).toBe(true);
    });
  });

  describe('gws:getMcpStatus', () => {
    it('returns configured: true when registered with a provider', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      mockIsMcpServerRegistered.mockReturnValue(true);

      await registerHandlers();
      const result = await invokeHandler('gws:getMcpStatus') as { configured: boolean };

      expect(result.configured).toBe(true);
      expect(mockIsMcpServerRegistered).toHaveBeenCalledWith(
        'google-workspace',
        path.join(binDir, 'gws')
      );
    });

    it('returns configured: false when not registered', async () => {
      mockExecError(new Error('not found'));
      mockIsMcpServerRegistered.mockReturnValue(false);

      await registerHandlers();
      const result = await invokeHandler('gws:getMcpStatus') as { configured: boolean };

      expect(result.configured).toBe(false);
    });

    it('returns configured: false when provider check throws', async () => {
      const binDir = path.join(tmpDir, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'gws'), '#!/bin/sh');

      mockIsMcpServerRegistered.mockImplementation(() => { throw new Error('check failed'); });

      await registerHandlers();
      const result = await invokeHandler('gws:getMcpStatus') as { configured: boolean };

      expect(result.configured).toBe(false);
    });
  });

  describe('gws:listSkills', () => {
    it('returns gws- prefixed skills from providers', async () => {
      mockGetInstalledSkills.mockReturnValue([
        'gws-gmail', 'gws-drive', 'gws-calendar', 'other-skill', 'something-else',
      ]);

      await registerHandlers();
      const result = await invokeHandler('gws:listSkills') as string[];

      expect(result).toEqual(['gws-calendar', 'gws-drive', 'gws-gmail']);
    });

    it('returns empty array when no gws skills installed', async () => {
      mockGetInstalledSkills.mockReturnValue(['other-skill']);

      await registerHandlers();
      const result = await invokeHandler('gws:listSkills') as string[];

      expect(result).toEqual([]);
    });

    it('deduplicates skills across providers', async () => {
      // Simulate the same skill appearing from multiple providers
      mockGetInstalledSkills.mockReturnValue(['gws-gmail', 'gws-gmail', 'gws-drive']);

      await registerHandlers();
      const result = await invokeHandler('gws:listSkills') as string[];

      expect(result).toEqual(['gws-drive', 'gws-gmail']);
    });

    it('returns empty array when provider throws', async () => {
      mockGetInstalledSkills.mockImplementation(() => { throw new Error('failed'); });

      await registerHandlers();
      const result = await invokeHandler('gws:listSkills') as string[];

      expect(result).toEqual([]);
    });
  });
});

// ── Pure function tests: deriveServicesFromScopes ────────────────────────────

describe('deriveServicesFromScopes (logic)', () => {
  // Replicate the function since it's not exported
  const SCOPE_SERVICE_MAP: Record<string, string> = {
    gmail: 'gmail',
    drive: 'drive',
    spreadsheets: 'sheets',
    calendar: 'calendar',
    documents: 'docs',
    presentations: 'slides',
    tasks: 'tasks',
    chat: 'chat',
    contacts: 'people',
    people: 'people',
    forms: 'forms',
    keep: 'keep',
  };

  type ServiceAccess = 'none' | 'read' | 'write';

  function deriveServicesFromScopes(scopes: string[]): Record<string, ServiceAccess> {
    const services: Record<string, ServiceAccess> = {
      gmail: 'none', drive: 'none', sheets: 'none', calendar: 'none',
      docs: 'none', slides: 'none', tasks: 'none', chat: 'none',
      people: 'none', forms: 'none', keep: 'none',
    };
    for (const scope of scopes) {
      const lower = scope.toLowerCase();
      const isReadonly = lower.includes('readonly');
      for (const [pattern, serviceName] of Object.entries(SCOPE_SERVICE_MAP)) {
        if (lower.includes(pattern)) {
          if (services[serviceName] === 'none') {
            services[serviceName] = isReadonly ? 'read' : 'write';
          } else if (services[serviceName] === 'read' && !isReadonly) {
            services[serviceName] = 'write';
          }
        }
      }
    }
    return services;
  }

  it('returns all none for empty scopes', () => {
    const result = deriveServicesFromScopes([]);
    expect(Object.values(result).every(v => v === 'none')).toBe(true);
  });

  it('maps gmail.modify scope to write access', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/gmail.modify']);
    expect(result.gmail).toBe('write');
    expect(result.drive).toBe('none');
  });

  it('maps gmail.readonly scope to read access', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/gmail.readonly']);
    expect(result.gmail).toBe('read');
  });

  it('maps drive scope (no readonly) to write access', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/drive']);
    expect(result.drive).toBe('write');
  });

  it('maps drive.readonly to read access', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/drive.readonly']);
    expect(result.drive).toBe('read');
  });

  it('upgrades read to write when both scopes present', () => {
    const result = deriveServicesFromScopes([
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ]);
    expect(result.sheets).toBe('write');
  });

  it('never downgrades write to read', () => {
    const result = deriveServicesFromScopes([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ]);
    expect(result.sheets).toBe('write');
  });

  it('maps documents.readonly to docs read', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/documents.readonly']);
    expect(result.docs).toBe('read');
  });

  it('maps presentations scope to slides', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/presentations']);
    expect(result.slides).toBe('write');
  });

  it('maps contacts scope to people', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/contacts']);
    expect(result.people).toBe('write');
  });

  it('maps people scope to people', () => {
    const result = deriveServicesFromScopes(['https://www.googleapis.com/auth/people']);
    expect(result.people).toBe('write');
  });

  it('handles multiple scopes with mixed access', () => {
    const result = deriveServicesFromScopes([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/forms',
      'https://www.googleapis.com/auth/keep',
    ]);
    expect(result.gmail).toBe('read');
    expect(result.drive).toBe('write');
    expect(result.calendar).toBe('read');
    expect(result.tasks).toBe('write');
    expect(result.forms).toBe('write');
    expect(result.keep).toBe('write');
    expect(result.docs).toBe('none');
    expect(result.slides).toBe('none');
    expect(result.chat).toBe('none');
  });

  it('is case insensitive', () => {
    const result = deriveServicesFromScopes(['HTTPS://WWW.GOOGLEAPIS.COM/AUTH/GMAIL.MODIFY']);
    expect(result.gmail).toBe('write');
  });
});
