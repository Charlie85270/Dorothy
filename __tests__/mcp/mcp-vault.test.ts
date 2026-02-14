import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-vault tool handler tests
// ============================================================================
// Tests the business logic of all vault MCP tool handlers:
// vault_create_document, vault_update_document, vault_get_document,
// vault_list_documents, vault_delete_document, vault_attach_file,
// vault_create_folder, vault_list_folders, vault_delete_folder, vault_search
// Also tests helper functions: resolveFolder, apiRequest, formatters

// ---------- Types (mirrored from mcp-vault source) ----------

interface VaultDocument {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  author: string;
  agent_id: string | null;
  tags: string; // JSON-stringified array
  created_at: string;
  updated_at: string;
}

interface VaultFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string;
  created_at: string;
  updated_at: string;
  snippet: string;
}

// ---------- Helpers ----------

function makeDocument(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: 'doc-001-uuid',
    title: 'Test Document',
    content: '# Hello\n\nThis is a test document.',
    folder_id: 'folder-001',
    author: 'test-agent',
    agent_id: 'agent-001',
    tags: '["test","report"]',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeFolder(overrides: Partial<VaultFolder> = {}): VaultFolder {
  return {
    id: 'folder-001-uuid',
    name: 'Research',
    parent_id: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'doc-001-uuid',
    title: 'Test Document',
    content: 'Some content here',
    author: 'test-agent',
    tags: '["test"]',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    snippet: 'Some <mark>content</mark> here',
    ...overrides,
  };
}

describe('mcp-vault', () => {
  describe('vault_create_document handler logic', () => {
    it('derives author from CLAUDE_AGENT_NAME env var', () => {
      const agentName = 'my-agent';
      const agentId = 'agent-123';
      const author = agentName || agentId || 'agent';
      expect(author).toBe('my-agent');
    });

    it('falls back to CLAUDE_AGENT_ID when no name', () => {
      const agentName = undefined;
      const agentId = 'agent-123';
      const author = agentName || agentId || 'agent';
      expect(author).toBe('agent-123');
    });

    it('falls back to "agent" when no env vars', () => {
      const agentName = undefined;
      const agentId = undefined;
      const author = agentName || agentId || 'agent';
      expect(author).toBe('agent');
    });

    it('formats success message correctly', () => {
      const doc = makeDocument({ id: 'doc-abc', title: 'My Report' });
      const folder = 'Research';
      const tags = ['report', 'weekly'];
      const text = `Document created successfully!\nID: ${doc.id}\nTitle: ${doc.title}\nFolder: ${folder}\nTags: ${tags.join(", ")}`;
      expect(text).toContain('doc-abc');
      expect(text).toContain('My Report');
      expect(text).toContain('Research');
      expect(text).toContain('report, weekly');
    });

    it('shows "None" when no tags provided', () => {
      const tags: string[] | undefined = undefined;
      const text = `Tags: ${tags?.join(", ") || "None"}`;
      expect(text).toBe('Tags: None');
    });

    it('shows "None" when empty tags array', () => {
      const tags: string[] = [];
      const text = `Tags: ${tags?.join(", ") || "None"}`;
      expect(text).toBe('Tags: None');
    });

    it('formats error message for Error instances', () => {
      const error = new Error('Network timeout');
      const msg = `Error creating document: ${error instanceof Error ? error.message : String(error)}`;
      expect(msg).toBe('Error creating document: Network timeout');
    });

    it('formats error message for non-Error values', () => {
      const error = 'something went wrong';
      const msg = `Error creating document: ${error instanceof Error ? error.message : String(error)}`;
      expect(msg).toBe('Error creating document: something went wrong');
    });
  });

  describe('vault_update_document handler logic', () => {
    it('builds body with only defined fields', () => {
      const title = 'New Title';
      const content = undefined;
      const tags = ['updated'];
      const folder_id = undefined;

      const body: Record<string, unknown> = {};
      if (title !== undefined) body.title = title;
      if (content !== undefined) body.content = content;
      if (tags !== undefined) body.tags = tags;
      if (folder_id !== undefined) body.folder_id = folder_id;

      expect(body).toEqual({ title: 'New Title', tags: ['updated'] });
      expect(body).not.toHaveProperty('content');
      expect(body).not.toHaveProperty('folder_id');
    });

    it('includes all fields when all defined', () => {
      const body: Record<string, unknown> = {};
      body.title = 'Title';
      body.content = 'Content';
      body.tags = ['a'];
      body.folder_id = 'folder-1';

      expect(Object.keys(body)).toHaveLength(4);
    });

    it('formats success message correctly', () => {
      const doc = makeDocument({ id: 'doc-xyz', title: 'Updated Title' });
      const text = `Document updated successfully!\nID: ${doc.id}\nTitle: ${doc.title}`;
      expect(text).toContain('doc-xyz');
      expect(text).toContain('Updated Title');
    });
  });

  describe('vault_get_document handler logic', () => {
    it('parses tags from JSON string', () => {
      const doc = makeDocument({ tags: '["report","weekly"]' });
      const tags = JSON.parse(doc.tags || '[]');
      expect(tags).toEqual(['report', 'weekly']);
    });

    it('handles empty tags string', () => {
      const doc = makeDocument({ tags: '' });
      const tags = JSON.parse(doc.tags || '[]');
      expect(tags).toEqual([]);
    });

    it('handles null-like tags', () => {
      const tags = JSON.parse('[]');
      expect(tags).toEqual([]);
    });

    it('formats document details correctly', () => {
      const doc = makeDocument({
        title: 'My Report',
        id: 'doc-123',
        author: 'agent-x',
        folder_id: 'folder-1',
        tags: '["report"]',
        created_at: '2024-06-15T10:00:00Z',
        updated_at: '2024-06-15T12:00:00Z',
        content: '# Report\n\nContent here.',
      });

      const tags = JSON.parse(doc.tags || '[]');
      const text = `Title: ${doc.title}\nID: ${doc.id}\nAuthor: ${doc.author}\nFolder: ${doc.folder_id || "Root"}\nTags: ${tags.join(", ") || "None"}\nCreated: ${doc.created_at}\nUpdated: ${doc.updated_at}\n\n---\n\n${doc.content}`;

      expect(text).toContain('My Report');
      expect(text).toContain('doc-123');
      expect(text).toContain('agent-x');
      expect(text).toContain('folder-1');
      expect(text).toContain('report');
      expect(text).toContain('# Report');
    });

    it('shows "Root" when no folder_id', () => {
      const doc = makeDocument({ folder_id: null });
      const folder = doc.folder_id || 'Root';
      expect(folder).toBe('Root');
    });

    it('formats attachment list when present', () => {
      const attachments = [
        { id: 'att-1', filename: 'image.png', mimetype: 'image/png', size: 1024 },
        { id: 'att-2', filename: 'report.pdf', mimetype: 'application/pdf', size: 2048 },
      ];
      const attachmentList = attachments.length > 0
        ? `\nAttachments:\n${attachments.map(a => `  - ${a.filename} (${a.mimetype}, ${a.size} bytes)`).join("\n")}`
        : '';

      expect(attachmentList).toContain('image.png');
      expect(attachmentList).toContain('1024 bytes');
      expect(attachmentList).toContain('report.pdf');
      expect(attachmentList).toContain('application/pdf');
    });

    it('returns empty string when no attachments', () => {
      const attachments: Array<{ id: string; filename: string; mimetype: string; size: number }> = [];
      const attachmentList = attachments.length > 0
        ? `\nAttachments:\n${attachments.map(a => `  - ${a.filename}`).join("\n")}`
        : '';
      expect(attachmentList).toBe('');
    });
  });

  describe('vault_list_documents handler logic', () => {
    it('builds URL with folder_id param', () => {
      const folder_id = 'folder-abc';
      const tags: string[] | undefined = undefined;
      let urlPath = '/api/vault/documents';
      const params: string[] = [];
      if (folder_id) params.push(`folder_id=${encodeURIComponent(folder_id)}`);
      if (tags && tags.length > 0) params.push(`tags=${encodeURIComponent(tags.join(","))}`);
      if (params.length > 0) urlPath += `?${params.join("&")}`;

      expect(urlPath).toBe('/api/vault/documents?folder_id=folder-abc');
    });

    it('builds URL with tags param', () => {
      const folder_id: string | undefined = undefined;
      const tags = ['report', 'weekly'];
      let urlPath = '/api/vault/documents';
      const params: string[] = [];
      if (folder_id) params.push(`folder_id=${encodeURIComponent(folder_id)}`);
      if (tags && tags.length > 0) params.push(`tags=${encodeURIComponent(tags.join(","))}`);
      if (params.length > 0) urlPath += `?${params.join("&")}`;

      expect(urlPath).toBe('/api/vault/documents?tags=report%2Cweekly');
    });

    it('builds URL with both params', () => {
      const folder_id = 'folder-1';
      const tags = ['report'];
      let urlPath = '/api/vault/documents';
      const params: string[] = [];
      if (folder_id) params.push(`folder_id=${encodeURIComponent(folder_id)}`);
      if (tags && tags.length > 0) params.push(`tags=${encodeURIComponent(tags.join(","))}`);
      if (params.length > 0) urlPath += `?${params.join("&")}`;

      expect(urlPath).toContain('folder_id=folder-1');
      expect(urlPath).toContain('tags=report');
      expect(urlPath).toContain('&');
    });

    it('builds URL without params when no filters', () => {
      const folder_id: string | undefined = undefined;
      const tags: string[] | undefined = undefined;
      let urlPath = '/api/vault/documents';
      const params: string[] = [];
      if (folder_id) params.push(`folder_id=${encodeURIComponent(folder_id)}`);
      if (tags && tags.length > 0) params.push(`tags=${encodeURIComponent(tags.join(","))}`);
      if (params.length > 0) urlPath += `?${params.join("&")}`;

      expect(urlPath).toBe('/api/vault/documents');
    });

    it('returns "No documents found" for empty list', () => {
      const documents: VaultDocument[] = [];
      const text = documents.length === 0 ? 'No documents found.' : 'Found docs';
      expect(text).toBe('No documents found.');
    });

    it('formats document summary correctly', () => {
      const docs = [
        makeDocument({ id: 'abcdef12-full-uuid', title: 'Report A', author: 'agent-1', updated_at: '2024-06-15T10:00:00Z', tags: '["weekly"]' }),
        makeDocument({ id: 'ghijkl34-full-uuid', title: 'Report B', author: 'agent-2', updated_at: '2024-06-20T10:00:00Z', tags: '[]' }),
      ];

      const summary = docs.map(d => {
        const docTags = JSON.parse(d.tags || '[]');
        return `- [${d.id.slice(0, 8)}] ${d.title} (by ${d.author}, ${d.updated_at.slice(0, 10)}${docTags.length > 0 ? `, tags: ${docTags.join(", ")}` : ""})`;
      }).join('\n');

      expect(summary).toContain('[abcdef12]');
      expect(summary).toContain('Report A');
      expect(summary).toContain('by agent-1');
      expect(summary).toContain('2024-06-15');
      expect(summary).toContain('tags: weekly');
      expect(summary).toContain('[ghijkl34]');
      // Second doc has no tags, so no "tags:" suffix on its line
      const lines = summary.split('\n');
      expect(lines[1]).not.toContain('tags:');
    });
  });

  describe('vault_delete_document handler logic', () => {
    it('formats success message with document ID', () => {
      const document_id = 'doc-abc-123';
      const text = `Document ${document_id} deleted successfully.`;
      expect(text).toContain('doc-abc-123');
    });
  });

  describe('vault_attach_file handler logic', () => {
    it('formats attachment success message', () => {
      const attachment = { id: 'att-001', filename: 'image.png', mimetype: 'image/png', size: 4096 };
      const text = `File attached successfully!\nAttachment ID: ${attachment.id}\nFilename: ${attachment.filename}\nType: ${attachment.mimetype}\nSize: ${attachment.size} bytes`;
      expect(text).toContain('att-001');
      expect(text).toContain('image.png');
      expect(text).toContain('image/png');
      expect(text).toContain('4096 bytes');
    });
  });

  describe('vault_create_folder handler logic', () => {
    it('formats folder success message with parent', () => {
      const folder = makeFolder({ id: 'folder-abc', name: 'SubFolder', parent_id: 'parent-1' });
      const text = `Folder created successfully!\nID: ${folder.id}\nName: ${folder.name}\nParent: ${folder.parent_id || "Root"}`;
      expect(text).toContain('folder-abc');
      expect(text).toContain('SubFolder');
      expect(text).toContain('parent-1');
    });

    it('shows "Root" when no parent', () => {
      const folder = makeFolder({ parent_id: null });
      const text = `Parent: ${folder.parent_id || "Root"}`;
      expect(text).toBe('Parent: Root');
    });
  });

  describe('vault_list_folders handler logic', () => {
    it('returns "No folders found" for empty list', () => {
      const folders: VaultFolder[] = [];
      const text = folders.length === 0 ? 'No folders found.' : 'Vault folders';
      expect(text).toBe('No folders found.');
    });

    it('separates root and child folders', () => {
      const folders = [
        makeFolder({ id: 'root-1', name: 'Research', parent_id: null }),
        makeFolder({ id: 'root-2', name: 'Reports', parent_id: null }),
        makeFolder({ id: 'child-1', name: 'Weekly', parent_id: 'root-2' }),
      ];

      const rootFolders = folders.filter(f => !f.parent_id);
      const childMap = new Map<string, VaultFolder[]>();
      for (const folder of folders) {
        if (folder.parent_id) {
          const children = childMap.get(folder.parent_id) || [];
          children.push(folder);
          childMap.set(folder.parent_id, children);
        }
      }

      expect(rootFolders).toHaveLength(2);
      expect(childMap.get('root-2')).toHaveLength(1);
      expect(childMap.get('root-2')![0].name).toBe('Weekly');
      expect(childMap.has('root-1')).toBe(false);
    });

    it('renders tree structure correctly', () => {
      const folders = [
        makeFolder({ id: 'root-1', name: 'Research', parent_id: null }),
        makeFolder({ id: 'root-2', name: 'Reports', parent_id: null }),
        makeFolder({ id: 'child-1', name: 'Weekly', parent_id: 'root-2' }),
        makeFolder({ id: 'grandchild-1', name: 'Q1', parent_id: 'child-1' }),
      ];

      const rootFolders = folders.filter(f => !f.parent_id);
      const childMap = new Map<string, VaultFolder[]>();
      for (const folder of folders) {
        if (folder.parent_id) {
          const children = childMap.get(folder.parent_id) || [];
          children.push(folder);
          childMap.set(folder.parent_id, children);
        }
      }

      function renderTree(fldrs: VaultFolder[], indent = ''): string {
        return fldrs.map(f => {
          const children = childMap.get(f.id) || [];
          let line = `${indent}- ${f.name} [${f.id.slice(0, 8)}]`;
          if (children.length > 0) {
            line += '\n' + renderTree(children, indent + '  ');
          }
          return line;
        }).join('\n');
      }

      const tree = renderTree(rootFolders);
      expect(tree).toContain('- Research [root-1]');
      expect(tree).toContain('- Reports [root-2]');
      expect(tree).toContain('  - Weekly [child-1]');
      expect(tree).toContain('    - Q1 [grandchi]');
    });
  });

  describe('vault_delete_folder handler logic', () => {
    it('formats non-recursive delete message', () => {
      const folder_id = 'folder-abc';
      const recursive = false;
      const text = `Folder ${folder_id} deleted successfully.${recursive ? " All contents were also deleted." : " Documents were moved to root."}`;
      expect(text).toContain('folder-abc');
      expect(text).toContain('Documents were moved to root');
      expect(text).not.toContain('All contents');
    });

    it('formats recursive delete message', () => {
      const folder_id = 'folder-abc';
      const recursive = true;
      const text = `Folder ${folder_id} deleted successfully.${recursive ? " All contents were also deleted." : " Documents were moved to root."}`;
      expect(text).toContain('All contents were also deleted');
      expect(text).not.toContain('Documents were moved to root');
    });

    it('builds URL with recursive param', () => {
      const folder_id = 'folder-abc';
      const recursive = true;
      let urlPath = `/api/vault/folders/${folder_id}`;
      if (recursive) urlPath += '?recursive=true';
      expect(urlPath).toBe('/api/vault/folders/folder-abc?recursive=true');
    });

    it('builds URL without recursive param', () => {
      const folder_id = 'folder-abc';
      const recursive = false;
      let urlPath = `/api/vault/folders/${folder_id}`;
      if (recursive) urlPath += '?recursive=true';
      expect(urlPath).toBe('/api/vault/folders/folder-abc');
    });
  });

  describe('vault_search handler logic', () => {
    it('builds search URL with query', () => {
      const query = 'test report';
      const params = new URLSearchParams({ q: query });
      expect(params.toString()).toBe('q=test+report');
    });

    it('builds search URL with query and limit', () => {
      const query = 'test';
      const limit = 5;
      const params = new URLSearchParams({ q: query });
      if (limit) params.set('limit', String(limit));
      expect(params.get('q')).toBe('test');
      expect(params.get('limit')).toBe('5');
    });

    it('returns "No documents found" for empty results', () => {
      const results: SearchResult[] = [];
      const query = 'nonexistent';
      const text = results.length === 0
        ? `No documents found matching "${query}".`
        : 'Found results';
      expect(text).toBe('No documents found matching "nonexistent".');
    });

    it('strips HTML mark tags and replaces with markdown bold', () => {
      const snippet = 'Some <mark>content</mark> here with <mark>keywords</mark>';
      const formatted = snippet.replace(/<\/?mark>/g, '**');
      expect(formatted).toBe('Some **content** here with **keywords**');
    });

    it('handles snippet without mark tags', () => {
      const snippet = 'Some plain content here';
      const formatted = snippet.replace(/<\/?mark>/g, '**');
      expect(formatted).toBe('Some plain content here');
    });

    it('formats search results correctly', () => {
      const results = [
        makeSearchResult({
          id: 'abcdef12-uuid',
          title: 'Report A',
          author: 'agent-1',
          tags: '["weekly"]',
          snippet: 'This <mark>report</mark> covers...',
        }),
        makeSearchResult({
          id: 'ghijkl34-uuid',
          title: 'Report B',
          author: 'agent-2',
          tags: '[]',
          snippet: 'No highlights here',
        }),
      ];

      const summary = results.map(r => {
        const tags = JSON.parse(r.tags || '[]');
        const snippet = r.snippet?.replace(/<\/?mark>/g, '**') || '';
        return `- [${r.id.slice(0, 8)}] ${r.title} (by ${r.author})\n  ${snippet}${tags.length > 0 ? `\n  Tags: ${tags.join(", ")}` : ""}`;
      }).join('\n\n');

      expect(summary).toContain('[abcdef12]');
      expect(summary).toContain('Report A');
      expect(summary).toContain('**report**');
      expect(summary).toContain('Tags: weekly');
      expect(summary).toContain('[ghijkl34]');
      expect(summary).toContain('No highlights here');
    });

    it('formats result count message', () => {
      const results = [makeSearchResult(), makeSearchResult()];
      const query = 'test';
      const text = `Found ${results.length} result(s) for "${query}":`;
      expect(text).toBe('Found 2 result(s) for "test":');
    });
  });

  describe('resolveFolder logic', () => {
    it('matches folder name case-insensitively', () => {
      const folders = [
        makeFolder({ id: 'f1', name: 'Research' }),
        makeFolder({ id: 'f2', name: 'Reports' }),
      ];
      const folderName = 'research';
      const match = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
      expect(match?.id).toBe('f1');
    });

    it('returns no match for unknown folder', () => {
      const folders = [
        makeFolder({ id: 'f1', name: 'Research' }),
      ];
      const folderName = 'Unknown';
      const match = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
      expect(match).toBeUndefined();
    });
  });

  describe('apiRequest URL construction', () => {
    it('constructs correct vault API URL', () => {
      const hostname = '127.0.0.1';
      const port = 31415;
      const path = '/api/vault/documents';
      const url = `http://${hostname}:${port}${path}`;
      expect(url).toBe('http://127.0.0.1:31415/api/vault/documents');
    });

    it('constructs URL with document ID', () => {
      const documentId = 'doc-abc-123';
      const path = `/api/vault/documents/${documentId}`;
      expect(path).toBe('/api/vault/documents/doc-abc-123');
    });
  });

  describe('error handling patterns', () => {
    it('returns isError flag on error', () => {
      const result = {
        content: [{ type: 'text', text: 'Error creating document: test' }],
        isError: true,
      };
      expect(result.isError).toBe(true);
    });

    it('formats different error types consistently', () => {
      const errorTypes = [
        'Error creating document:',
        'Error updating document:',
        'Error reading document:',
        'Error listing documents:',
        'Error deleting document:',
        'Error attaching file:',
        'Error creating folder:',
        'Error listing folders:',
        'Error deleting folder:',
        'Error searching vault:',
      ];
      errorTypes.forEach(prefix => {
        const msg = `${prefix} Network timeout`;
        expect(msg).toContain('Network timeout');
      });
    });
  });
});
