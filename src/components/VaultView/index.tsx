'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import {
  Search,
  Plus,
  X,
  Archive,
  Loader2,
} from 'lucide-react';
import type { VaultDocumentElectron, VaultFolderElectron, VaultAttachmentElectron } from '@/types/electron';

import FolderTree from './components/FolderTree';
import DocumentList from './components/DocumentList';
import DocumentViewer from './components/DocumentViewer';
import DocumentEditor from './components/DocumentEditor';
import SearchResults from './components/SearchResults';

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.vault;
}

type ViewMode = 'list' | 'view' | 'edit' | 'search';

const READ_DOCS_KEY = 'vault-read-docs';

function loadReadDocs(): Set<string> {
  try {
    const stored = localStorage.getItem(READ_DOCS_KEY);
    if (stored) return new Set(JSON.parse(stored));
    return new Set(); // First load — will be populated after initial fetch
  } catch {
    return new Set();
  }
}

function isFirstLoad(): boolean {
  return localStorage.getItem(READ_DOCS_KEY) === null;
}

function saveReadDocs(ids: Set<string>) {
  localStorage.setItem(READ_DOCS_KEY, JSON.stringify([...ids]));
}

export default function VaultView() {
  // Data state
  const [documents, setDocuments] = useState<VaultDocumentElectron[]>([]);
  const [allDocuments, setAllDocuments] = useState<VaultDocumentElectron[]>([]);
  const [folders, setFolders] = useState<VaultFolderElectron[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<VaultDocumentElectron | null>(null);
  const [selectedDocAttachments, setSelectedDocAttachments] = useState<VaultAttachmentElectron[]>([]);
  const [searchResults, setSearchResults] = useState<VaultDocumentElectron[]>([]);
  const [readDocIds, setReadDocIds] = useState<Set<string>>(() => loadReadDocs());

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const setVaultUnreadCount = useStore(s => s.setVaultUnreadCount);

  // Sync unread count to global store for sidebar badge
  const unreadCount = useMemo(
    () => allDocuments.filter(d => !readDocIds.has(d.id)).length,
    [allDocuments, readDocIds]
  );
  useEffect(() => {
    setVaultUnreadCount(unreadCount);
  }, [unreadCount, setVaultUnreadCount]);

  const markAsRead = useCallback((id: string) => {
    setReadDocIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadDocs(next);
      return next;
    });
  }, []);

  // Load documents and folders
  const loadDocuments = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const params = selectedFolderId ? { folder_id: selectedFolderId } : undefined;
      const result = await window.electronAPI!.vault!.listDocuments(params);
      if (result.documents) {
        setDocuments(result.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, [selectedFolderId]);

  const loadAllDocuments = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI!.vault!.listDocuments();
      if (result.documents) {
        setAllDocuments(result.documents);
      }
    } catch (err) {
      console.error('Failed to load all documents:', err);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI!.vault!.listFolders();
      if (result.folders) {
        setFolders(result.folders);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, []);

  // Initial load — on first ever load, mark all existing docs as read
  useEffect(() => {
    const firstLoad = isFirstLoad();
    const init = async () => {
      setLoading(true);
      await Promise.all([loadDocuments(), loadAllDocuments(), loadFolders()]);
      // On first load, mark all existing documents as already read
      if (firstLoad) {
        const result = await window.electronAPI?.vault?.listDocuments();
        if (result?.documents) {
          const ids = new Set(result.documents.map((d: VaultDocumentElectron) => d.id));
          setReadDocIds(ids);
          saveReadDocs(ids);
        }
      }
      setLoading(false);
    };
    init();
  }, [loadDocuments, loadAllDocuments, loadFolders]);

  // Reload documents when folder changes
  useEffect(() => {
    if (!loading) {
      loadDocuments();
    }
  }, [selectedFolderId]);

  // Real-time event listeners
  useEffect(() => {
    if (!isElectron()) return;

    const unsubCreated = window.electronAPI!.vault!.onDocumentCreated((doc) => {
      setDocuments(prev => [doc, ...prev]);
      setAllDocuments(prev => [doc, ...prev]);
    });

    const unsubUpdated = window.electronAPI!.vault!.onDocumentUpdated((doc) => {
      setDocuments(prev => prev.map(d => d.id === doc.id ? doc : d));
      setAllDocuments(prev => prev.map(d => d.id === doc.id ? doc : d));
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(doc);
      }
    });

    const unsubDeleted = window.electronAPI!.vault!.onDocumentDeleted(({ id }) => {
      setDocuments(prev => prev.filter(d => d.id !== id));
      setAllDocuments(prev => prev.filter(d => d.id !== id));
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
        setViewMode('list');
      }
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [selectedDoc?.id]);

  // Select document
  const handleSelectDocument = async (id: string) => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI!.vault!.getDocument(id);
      if (result.document) {
        setSelectedDoc(result.document);
        setSelectedDocAttachments(result.attachments || []);
        setViewMode('view');
        markAsRead(id);
      }
    } catch (err) {
      console.error('Failed to load document:', err);
    }
  };

  // Search
  const handleSearch = async (query: string) => {
    if (!isElectron() || !query.trim()) {
      setViewMode('list');
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await window.electronAPI!.vault!.search({ query: query.trim() });
      setSearchResults(result.results || []);
      setViewMode('search');
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Attach pending files to a document
  const attachPendingFiles = async (documentId: string, files: string[]) => {
    if (!isElectron() || files.length === 0) return;
    for (const filePath of files) {
      try {
        await window.electronAPI!.vault!.attachFile({ document_id: documentId, file_path: filePath });
      } catch (err) {
        console.error('Failed to attach file:', filePath, err);
      }
    }
  };

  // Create document
  const handleCreateDocument = async (data: { title: string; content: string; tags: string[]; folder_id: string | null; pendingFiles?: string[] }) => {
    if (!isElectron()) return;
    try {
      const result = await window.electronAPI!.vault!.createDocument({
        title: data.title,
        content: data.content,
        folder_id: data.folder_id || undefined,
        author: 'user',
        tags: data.tags,
      });
      if (result.document) {
        markAsRead(result.document.id);
        if (data.pendingFiles?.length) {
          await attachPendingFiles(result.document.id, data.pendingFiles);
        }
      }
      setViewMode('list');
      loadDocuments();
      loadAllDocuments();
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  // Update document
  const handleUpdateDocument = async (data: { title: string; content: string; tags: string[]; folder_id: string | null; pendingFiles?: string[] }) => {
    if (!isElectron() || !selectedDoc) return;
    try {
      await window.electronAPI!.vault!.updateDocument({
        id: selectedDoc.id,
        title: data.title,
        content: data.content,
        tags: data.tags,
        folder_id: data.folder_id,
      });
      if (data.pendingFiles?.length) {
        await attachPendingFiles(selectedDoc.id, data.pendingFiles);
      }
      setViewMode('view');
      // Reload to get updated doc
      const result = await window.electronAPI!.vault!.getDocument(selectedDoc.id);
      if (result.document) {
        setSelectedDoc(result.document);
        setSelectedDocAttachments(result.attachments || []);
      }
    } catch (err) {
      console.error('Failed to update document:', err);
    }
  };

  // Delete document
  const handleDeleteDocument = async (id: string) => {
    if (!isElectron()) return;
    try {
      await window.electronAPI!.vault!.deleteDocument(id);
      setSelectedDoc(null);
      setViewMode('list');
      loadDocuments();
      loadAllDocuments();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  // Create folder
  const handleCreateFolder = async (name: string, parentId?: string) => {
    if (!isElectron()) return;
    try {
      await window.electronAPI!.vault!.createFolder({ name, parent_id: parentId });
      loadFolders();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  // Delete folder
  const handleDeleteFolder = async (id: string) => {
    if (!isElectron()) return;
    try {
      await window.electronAPI!.vault!.deleteFolder({ id });
      if (selectedFolderId === id) {
        setSelectedFolderId(null);
      }
      loadFolders();
      loadDocuments();
      loadAllDocuments();
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  // Non-electron fallback
  if (!isElectron()) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Vault</p>
          <p className="text-sm mt-1">Available in the desktop app</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Vault</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Agent reports & knowledge base
          </p>
        </div>

        {(viewMode === 'list' || viewMode === 'search') && (
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch(searchQuery);
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setViewMode('list');
                  }
                }}
                placeholder="Search documents..."
                className="w-48 sm:w-64 lg:w-80 pl-9 pr-8 py-2 text-sm bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setViewMode('list'); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* New document button */}
            <button
              onClick={() => {
                setSelectedDoc(null);
                setViewMode('edit');
              }}
              className="flex items-center gap-1.5 px-3 lg:px-4 py-2 text-sm bg-foreground text-background rounded hover:bg-foreground/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Document</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content: sidebar + content area */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* Folder sidebar */}
        <div className="w-64 shrink-0 hidden lg:flex flex-col border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <FolderTree
              folders={folders}
              documents={allDocuments}
              selectedFolderId={selectedFolderId}
              selectedDocId={selectedDoc?.id || null}
              readDocIds={readDocIds}
              onSelectFolder={(id) => {
                setSelectedFolderId(id);
                setViewMode('list');
                setSelectedDoc(null);
              }}
              onSelectDocument={handleSelectDocument}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden min-w-0 border border-border rounded-lg bg-card">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === 'list' && (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto"
                >
                  <DocumentList
                    documents={documents}
                    selectedDocId={selectedDoc?.id || null}
                    onSelectDocument={handleSelectDocument}
                    onCreateDocument={() => {
                      setSelectedDoc(null);
                      setViewMode('edit');
                    }}
                  />
                </motion.div>
              )}

              {viewMode === 'search' && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto"
                >
                  <SearchResults
                    results={searchResults}
                    query={searchQuery}
                    onSelectDocument={handleSelectDocument}
                  />
                </motion.div>
              )}

              {viewMode === 'view' && selectedDoc && (
                <motion.div
                  key="view"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-y-auto"
                >
                  <DocumentViewer
                    document={selectedDoc}
                    attachments={selectedDocAttachments}
                    onBack={() => {
                      setSelectedDoc(null);
                      setViewMode('list');
                    }}
                    onEdit={() => setViewMode('edit')}
                    onDelete={handleDeleteDocument}
                  />
                </motion.div>
              )}

              {viewMode === 'edit' && (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-y-auto"
                >
                  <DocumentEditor
                    document={selectedDoc}
                    folders={folders}
                    defaultFolderId={!selectedDoc ? selectedFolderId : undefined}
                    onSave={selectedDoc ? handleUpdateDocument : handleCreateDocument}
                    onCancel={() => {
                      setViewMode(selectedDoc ? 'view' : 'list');
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
