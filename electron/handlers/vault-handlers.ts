import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getVaultDb } from '../services/vault-db';
import { VAULT_DIR } from '../constants';

// Types
export interface VaultFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultDocument {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  author: string;
  agent_id: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface VaultAttachment {
  id: string;
  document_id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  created_at: string;
}

export interface VaultHandlerDependencies {
  getMainWindow: () => BrowserWindow | null;
}

function emitVaultEvent(mainWindow: BrowserWindow | null, event: string, data: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(event, data);
  }
}

export function registerVaultHandlers(deps: VaultHandlerDependencies): void {
  const { getMainWindow } = deps;

  // List documents
  ipcMain.handle('vault:listDocuments', async (_event, params?: { folder_id?: string; tags?: string[] }) => {
    try {
      const db = getVaultDb();
      let query = 'SELECT * FROM documents';
      const conditions: string[] = [];
      const queryParams: unknown[] = [];

      if (params?.folder_id) {
        conditions.push('folder_id = ?');
        queryParams.push(params.folder_id);
      }

      if (params?.tags && params.tags.length > 0) {
        // Filter documents that contain any of the specified tags
        const tagConditions = params.tags.map(() => "tags LIKE ?");
        conditions.push(`(${tagConditions.join(' OR ')})`);
        params.tags.forEach(tag => queryParams.push(`%"${tag}"%`));
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY updated_at DESC';

      const documents = db.prepare(query).all(...queryParams) as VaultDocument[];
      return { documents };
    } catch (err) {
      console.error('Failed to list vault documents:', err);
      return { documents: [], error: String(err) };
    }
  });

  // Get document
  ipcMain.handle('vault:getDocument', async (_event, id: string) => {
    try {
      const db = getVaultDb();
      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as VaultDocument | undefined;
      if (!document) {
        return { error: 'Document not found' };
      }
      const attachments = db.prepare('SELECT * FROM attachments WHERE document_id = ? ORDER BY created_at DESC').all(id) as VaultAttachment[];
      return { document, attachments };
    } catch (err) {
      console.error('Failed to get vault document:', err);
      return { error: String(err) };
    }
  });

  // Create document
  ipcMain.handle('vault:createDocument', async (_event, params: {
    title: string;
    content: string;
    folder_id?: string;
    author: string;
    agent_id?: string;
    tags?: string[];
  }) => {
    try {
      const db = getVaultDb();
      const id = uuidv4();
      const now = new Date().toISOString();
      const tags = JSON.stringify(params.tags || []);

      db.prepare(`
        INSERT INTO documents (id, title, content, folder_id, author, agent_id, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, params.title, params.content, params.folder_id || null, params.author, params.agent_id || null, tags, now, now);

      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as VaultDocument;
      emitVaultEvent(getMainWindow(), 'vault:document-created', document);
      return { success: true, document };
    } catch (err) {
      console.error('Failed to create vault document:', err);
      return { success: false, error: String(err) };
    }
  });

  // Update document
  ipcMain.handle('vault:updateDocument', async (_event, params: {
    id: string;
    title?: string;
    content?: string;
    tags?: string[];
    folder_id?: string | null;
  }) => {
    try {
      const db = getVaultDb();
      const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(params.id) as VaultDocument | undefined;
      if (!existing) {
        return { success: false, error: 'Document not found' };
      }

      const now = new Date().toISOString();
      const updates: string[] = ['updated_at = ?'];
      const values: unknown[] = [now];

      if (params.title !== undefined) {
        updates.push('title = ?');
        values.push(params.title);
      }
      if (params.content !== undefined) {
        updates.push('content = ?');
        values.push(params.content);
      }
      if (params.tags !== undefined) {
        updates.push('tags = ?');
        values.push(JSON.stringify(params.tags));
      }
      if (params.folder_id !== undefined) {
        updates.push('folder_id = ?');
        values.push(params.folder_id);
      }

      values.push(params.id);
      db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(params.id) as VaultDocument;
      emitVaultEvent(getMainWindow(), 'vault:document-updated', document);
      return { success: true, document };
    } catch (err) {
      console.error('Failed to update vault document:', err);
      return { success: false, error: String(err) };
    }
  });

  // Delete document
  ipcMain.handle('vault:deleteDocument', async (_event, id: string) => {
    try {
      const db = getVaultDb();

      // Delete associated attachment files
      const attachments = db.prepare('SELECT * FROM attachments WHERE document_id = ?').all(id) as VaultAttachment[];
      for (const att of attachments) {
        try {
          if (fs.existsSync(att.filepath)) {
            fs.unlinkSync(att.filepath);
          }
        } catch {
          // Ignore file deletion errors
        }
      }

      db.prepare('DELETE FROM documents WHERE id = ?').run(id);
      emitVaultEvent(getMainWindow(), 'vault:document-deleted', { id });
      return { success: true };
    } catch (err) {
      console.error('Failed to delete vault document:', err);
      return { success: false, error: String(err) };
    }
  });

  // Search documents
  ipcMain.handle('vault:search', async (_event, params: { query: string; limit?: number }) => {
    try {
      const db = getVaultDb();
      const limit = params.limit || 20;
      const results = db.prepare(`
        SELECT d.*, snippet(documents_fts, 1, '<mark>', '</mark>', '...', 40) as snippet
        FROM documents_fts fts
        JOIN documents d ON d.rowid = fts.rowid
        WHERE documents_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(params.query, limit);
      return { results };
    } catch (err) {
      console.error('Failed to search vault:', err);
      return { results: [], error: String(err) };
    }
  });

  // List folders
  ipcMain.handle('vault:listFolders', async () => {
    try {
      const db = getVaultDb();
      const folders = db.prepare('SELECT * FROM folders ORDER BY name').all() as VaultFolder[];
      return { folders };
    } catch (err) {
      console.error('Failed to list vault folders:', err);
      return { folders: [], error: String(err) };
    }
  });

  // Create folder
  ipcMain.handle('vault:createFolder', async (_event, params: { name: string; parent_id?: string }) => {
    try {
      const db = getVaultDb();
      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO folders (id, name, parent_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, params.name, params.parent_id || null, now, now);

      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as VaultFolder;
      return { success: true, folder };
    } catch (err) {
      console.error('Failed to create vault folder:', err);
      return { success: false, error: String(err) };
    }
  });

  // Delete folder
  ipcMain.handle('vault:deleteFolder', async (_event, params: { id: string; recursive?: boolean }) => {
    try {
      const db = getVaultDb();

      if (params.recursive) {
        // Delete all documents in folder and subfolders
        const deleteDocsRecursive = (folderId: string) => {
          // Delete attachment files for documents in this folder
          const docs = db.prepare('SELECT id FROM documents WHERE folder_id = ?').all(folderId) as { id: string }[];
          for (const doc of docs) {
            const attachments = db.prepare('SELECT filepath FROM attachments WHERE document_id = ?').all(doc.id) as { filepath: string }[];
            for (const att of attachments) {
              try { if (fs.existsSync(att.filepath)) fs.unlinkSync(att.filepath); } catch { /* ignore */ }
            }
          }
          db.prepare('DELETE FROM documents WHERE folder_id = ?').run(folderId);

          // Recurse into subfolders
          const subfolders = db.prepare('SELECT id FROM folders WHERE parent_id = ?').all(folderId) as { id: string }[];
          for (const sub of subfolders) {
            deleteDocsRecursive(sub.id);
          }
        };

        deleteDocsRecursive(params.id);
      } else {
        // Move documents to root (no folder)
        db.prepare('UPDATE documents SET folder_id = NULL WHERE folder_id = ?').run(params.id);
      }

      // CASCADE will handle subfolders
      db.prepare('DELETE FROM folders WHERE id = ?').run(params.id);
      return { success: true };
    } catch (err) {
      console.error('Failed to delete vault folder:', err);
      return { success: false, error: String(err) };
    }
  });

  // Attach file
  ipcMain.handle('vault:attachFile', async (_event, params: { document_id: string; file_path: string }) => {
    try {
      const db = getVaultDb();

      // Verify document exists
      const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(params.document_id);
      if (!doc) {
        return { success: false, error: 'Document not found' };
      }

      // Verify source file exists
      if (!fs.existsSync(params.file_path)) {
        return { success: false, error: 'File not found' };
      }

      const id = uuidv4();
      const filename = path.basename(params.file_path);
      const destFilename = `${id}-${filename}`;
      const destPath = path.join(VAULT_DIR, 'attachments', destFilename);

      // Copy file to vault attachments directory
      fs.copyFileSync(params.file_path, destPath);

      const stats = fs.statSync(destPath);
      const ext = path.extname(filename).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
        '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
        '.json': 'application/json', '.csv': 'text/csv',
      };
      const mimetype = mimeMap[ext] || 'application/octet-stream';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO attachments (id, document_id, filename, filepath, mimetype, size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, params.document_id, filename, destPath, mimetype, stats.size, now);

      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as VaultAttachment;
      return { success: true, attachment };
    } catch (err) {
      console.error('Failed to attach file:', err);
      return { success: false, error: String(err) };
    }
  });
}
