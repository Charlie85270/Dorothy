import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn);
    }),
  },
  BrowserWindow: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'vault-uuid-1234'),
}));

// Mock database
const mockStmt = {
  all: vi.fn(() => []),
  get: vi.fn(() => undefined),
  run: vi.fn(),
};

const mockDb = {
  prepare: vi.fn(() => mockStmt),
};

vi.mock('../../../electron/services/vault-db', () => ({
  getVaultDb: vi.fn(() => mockDb),
}));

vi.mock('../../../electron/constants', () => ({
  VAULT_DIR: '/mock/vault',
}));

function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for "${channel}"`);
  return fn({}, ...args);
}

// ── Setup ────────────────────────────────────────────────────────────────────

const mockMainWindow = { webContents: { send: vi.fn() }, isDestroyed: vi.fn(() => false) };

beforeEach(() => {
  handlers = new Map();
  vi.clearAllMocks();
  mockStmt.all.mockReturnValue([]);
  mockStmt.get.mockReturnValue(undefined);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('vault-handlers', () => {
  async function registerHandlers() {
    const { registerVaultHandlers } = await import('../../../electron/handlers/vault-handlers');
    registerVaultHandlers({
      getMainWindow: () => mockMainWindow as any,
    });
  }

  it('registers all handlers', async () => {
    await registerHandlers();
    expect(handlers.has('vault:listDocuments')).toBe(true);
    expect(handlers.has('vault:getDocument')).toBe(true);
    expect(handlers.has('vault:createDocument')).toBe(true);
    expect(handlers.has('vault:updateDocument')).toBe(true);
    expect(handlers.has('vault:deleteDocument')).toBe(true);
    expect(handlers.has('vault:search')).toBe(true);
    expect(handlers.has('vault:listFolders')).toBe(true);
    expect(handlers.has('vault:createFolder')).toBe(true);
    expect(handlers.has('vault:deleteFolder')).toBe(true);
    expect(handlers.has('vault:attachFile')).toBe(true);
  });

  describe('vault:listDocuments', () => {
    it('returns all documents with no filters', async () => {
      const docs = [
        { id: 'doc-1', title: 'Doc 1', content: 'Hello', tags: '[]', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ];
      mockStmt.all.mockReturnValue(docs);

      await registerHandlers();
      const result = await invokeHandler('vault:listDocuments') as { documents: unknown[] };

      expect(result.documents).toEqual(docs);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM documents'));
    });

    it('filters by folder_id', async () => {
      mockStmt.all.mockReturnValue([]);

      await registerHandlers();
      await invokeHandler('vault:listDocuments', { folder_id: 'folder-1' });

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('folder_id = ?'));
    });

    it('filters by tags', async () => {
      mockStmt.all.mockReturnValue([]);

      await registerHandlers();
      await invokeHandler('vault:listDocuments', { tags: ['bug', 'urgent'] });

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('tags LIKE'));
    });

    it('returns empty array on error', async () => {
      mockDb.prepare.mockImplementationOnce(() => { throw new Error('DB error'); });

      await registerHandlers();
      const result = await invokeHandler('vault:listDocuments') as { documents: unknown[]; error: string };

      expect(result.documents).toEqual([]);
      expect(result.error).toContain('DB error');
    });
  });

  describe('vault:getDocument', () => {
    it('returns document with attachments', async () => {
      const doc = { id: 'doc-1', title: 'Test', content: 'body' };
      const attachments = [{ id: 'att-1', document_id: 'doc-1', filename: 'file.png' }];

      // First prepare returns the doc, second returns attachments
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn(() => doc) });
      mockDb.prepare.mockReturnValueOnce({ all: vi.fn(() => attachments) });

      await registerHandlers();
      const result = await invokeHandler('vault:getDocument', 'doc-1') as { document: unknown; attachments: unknown[] };

      expect(result.document).toEqual(doc);
      expect(result.attachments).toEqual(attachments);
    });

    it('returns error for non-existent document', async () => {
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn(() => undefined) });

      await registerHandlers();
      const result = await invokeHandler('vault:getDocument', 'missing') as { error: string };

      expect(result.error).toBe('Document not found');
    });
  });

  describe('vault:createDocument', () => {
    it('creates document and emits event', async () => {
      const createdDoc = { id: 'vault-uuid-1234', title: 'New', content: 'body' };
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // INSERT
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn(() => createdDoc) }); // SELECT

      await registerHandlers();
      const result = await invokeHandler('vault:createDocument', {
        title: 'New',
        content: 'body',
        author: 'user',
      }) as { success: boolean; document: unknown };

      expect(result.success).toBe(true);
      expect(result.document).toEqual(createdDoc);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('vault:document-created', createdDoc);
    });

    it('returns error on failure', async () => {
      mockDb.prepare.mockImplementationOnce(() => { throw new Error('Insert failed'); });

      await registerHandlers();
      const result = await invokeHandler('vault:createDocument', {
        title: 'Bad',
        content: '',
        author: 'user',
      }) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insert failed');
    });
  });

  describe('vault:updateDocument', () => {
    it('updates document fields', async () => {
      const existing = { id: 'upd-1', title: 'Old', content: 'old body' };
      const updated = { id: 'upd-1', title: 'New', content: 'old body' };
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn(() => existing) }); // SELECT existing
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // UPDATE
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn(() => updated) }); // SELECT updated

      await registerHandlers();
      const result = await invokeHandler('vault:updateDocument', {
        id: 'upd-1',
        title: 'New',
      }) as { success: boolean; document: unknown };

      expect(result.success).toBe(true);
      expect(result.document).toEqual(updated);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('vault:document-updated', updated);
    });

    it('returns error for non-existent document', async () => {
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn(() => undefined) });

      await registerHandlers();
      const result = await invokeHandler('vault:updateDocument', {
        id: 'missing',
      }) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Document not found');
    });
  });

  describe('vault:deleteDocument', () => {
    it('deletes document and emits event', async () => {
      mockDb.prepare.mockReturnValueOnce({ all: vi.fn(() => []) }); // SELECT attachments
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // DELETE

      await registerHandlers();
      const result = await invokeHandler('vault:deleteDocument', 'del-1') as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('vault:document-deleted', { id: 'del-1' });
    });
  });

  describe('vault:search', () => {
    it('returns search results', async () => {
      const results = [{ id: 'doc-1', title: 'Match', snippet: '<mark>test</mark>' }];
      mockDb.prepare.mockReturnValueOnce({ all: vi.fn(() => results) });

      await registerHandlers();
      const result = await invokeHandler('vault:search', { query: 'test' }) as { results: unknown[] };

      expect(result.results).toEqual(results);
    });

    it('returns empty on error', async () => {
      mockDb.prepare.mockImplementationOnce(() => { throw new Error('FTS error'); });

      await registerHandlers();
      const result = await invokeHandler('vault:search', { query: 'bad' }) as { results: unknown[]; error: string };

      expect(result.results).toEqual([]);
      expect(result.error).toContain('FTS error');
    });
  });

  describe('vault:listFolders', () => {
    it('returns folders', async () => {
      const folders = [{ id: 'f-1', name: 'Notes' }];
      mockStmt.all.mockReturnValue(folders);

      await registerHandlers();
      const result = await invokeHandler('vault:listFolders') as { folders: unknown[] };

      expect(result.folders).toEqual(folders);
    });
  });

  describe('vault:createFolder', () => {
    it('creates folder', async () => {
      const folder = { id: 'vault-uuid-1234', name: 'New Folder' };
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // INSERT
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn(() => folder) }); // SELECT

      await registerHandlers();
      const result = await invokeHandler('vault:createFolder', { name: 'New Folder' }) as { success: boolean; folder: unknown };

      expect(result.success).toBe(true);
      expect(result.folder).toEqual(folder);
    });
  });

  describe('vault:deleteFolder', () => {
    it('deletes folder (non-recursive moves docs to root)', async () => {
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // UPDATE docs
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // DELETE folder

      await registerHandlers();
      const result = await invokeHandler('vault:deleteFolder', { id: 'f-1' }) as { success: boolean };

      expect(result.success).toBe(true);
    });

    it('deletes folder recursively', async () => {
      // Mock for recursive deletion: docs query, attachments query, delete docs, subfolders query, delete folder
      mockDb.prepare.mockReturnValueOnce({ all: vi.fn(() => [{ id: 'doc-in-folder' }]) }); // docs in folder
      mockDb.prepare.mockReturnValueOnce({ all: vi.fn(() => []) }); // attachments for doc
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // DELETE docs in folder
      mockDb.prepare.mockReturnValueOnce({ all: vi.fn(() => []) }); // subfolders
      mockDb.prepare.mockReturnValueOnce({ run: vi.fn() }); // DELETE folder

      await registerHandlers();
      const result = await invokeHandler('vault:deleteFolder', { id: 'f-1', recursive: true }) as { success: boolean };

      expect(result.success).toBe(true);
    });
  });
});
