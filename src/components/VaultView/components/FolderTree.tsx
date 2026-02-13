'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  FileText,
  Plus,
} from 'lucide-react';
import type { VaultFolderElectron, VaultDocumentElectron } from '@/types/electron';

function parseTags(tagsStr: string): string[] {
  try { return JSON.parse(tagsStr || '[]'); } catch { return []; }
}

// Count unread docs in a folder and all its descendants
function countUnreadInFolder(
  folderId: string,
  allFolders: VaultFolderElectron[],
  documents: VaultDocumentElectron[],
  readDocIds: Set<string>
): number {
  let count = documents.filter(d => d.folder_id === folderId && !readDocIds.has(d.id)).length;
  const children = allFolders.filter(f => f.parent_id === folderId);
  for (const child of children) {
    count += countUnreadInFolder(child.id, allFolders, documents, readDocIds);
  }
  return count;
}

interface FolderTreeProps {
  folders: VaultFolderElectron[];
  documents: VaultDocumentElectron[];
  selectedFolderId: string | null;
  selectedDocId: string | null;
  readDocIds: Set<string>;
  onSelectFolder: (folderId: string | null) => void;
  onSelectDocument: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (id: string) => void;
}

interface FolderNodeProps {
  folder: VaultFolderElectron;
  childFolders: VaultFolderElectron[];
  allFolders: VaultFolderElectron[];
  documents: VaultDocumentElectron[];
  selectedFolderId: string | null;
  selectedDocId: string | null;
  readDocIds: Set<string>;
  onSelectFolder: (folderId: string | null) => void;
  onSelectDocument: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (id: string) => void;
  depth: number;
}

function FolderNode({ folder, childFolders, allFolders, documents, selectedFolderId, selectedDocId, readDocIds, onSelectFolder, onSelectDocument, onCreateFolder, onDeleteFolder, depth }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [showNewSubfolder, setShowNewSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const isSelected = selectedFolderId === folder.id;
  const folderDocs = documents.filter(d => d.folder_id === folder.id);
  const hasChildren = childFolders.length > 0;
  const hasContent = hasChildren || folderDocs.length > 0 || showNewSubfolder;
  const unreadCount = useMemo(
    () => countUnreadInFolder(folder.id, allFolders, documents, readDocIds),
    [folder.id, allFolders, documents, readDocIds]
  );

  const handleCreateSubfolder = () => {
    if (newSubfolderName.trim()) {
      onCreateFolder(newSubfolderName.trim(), folder.id);
      setNewSubfolderName('');
      setShowNewSubfolder(false);
    }
  };

  return (
    <div>
      <div
        onClick={() => { onSelectFolder(folder.id); setExpanded(true); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectFolder(folder.id); }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-sm transition-colors group cursor-pointer select-none ${
          isSelected
            ? 'bg-primary/10 text-foreground font-medium rounded'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0 hover:text-foreground p-0.5"
        >
          {expanded && hasContent
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />
          }
        </span>
        <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : ''}`} />
        <span className="truncate flex-1">{folder.name}</span>
        {unreadCount > 0 && (
          <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-medium bg-primary text-primary-foreground rounded-full px-1">
            {unreadCount}
          </span>
        )}
        <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
              setShowNewSubfolder(true);
            }}
            className="p-0.5 hover:text-foreground transition-opacity"
            title="New subfolder"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
            className="p-0.5 hover:text-red-500 transition-opacity"
            title="Delete folder"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </span>
      </div>

      <AnimatePresence>
        {expanded && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Child folders */}
            {childFolders.map(child => {
              const grandchildren = allFolders.filter(f => f.parent_id === child.id);
              return (
                <FolderNode
                  key={child.id}
                  folder={child}
                  childFolders={grandchildren}
                  allFolders={allFolders}
                  documents={documents}
                  selectedFolderId={selectedFolderId}
                  selectedDocId={selectedDocId}
                  readDocIds={readDocIds}
                  onSelectFolder={onSelectFolder}
                  onSelectDocument={onSelectDocument}
                  onCreateFolder={onCreateFolder}
                  onDeleteFolder={onDeleteFolder}
                  depth={depth + 1}
                />
              );
            })}

            {/* Documents in this folder */}
            {folderDocs.map(doc => {
              const tags = parseTags(doc.tags);
              const isUnread = !readDocIds.has(doc.id);
              return (
                <button
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className={`w-full flex items-center gap-1.5 py-1 text-left text-xs transition-colors ${
                    selectedDocId === doc.id
                      ? 'text-foreground font-medium'
                      : isUnread
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
                  title={doc.title}
                >
                  {isUnread && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <FileText className={`w-3 h-3 shrink-0 ${selectedDocId === doc.id ? 'text-primary' : ''}`} />
                  <span className="truncate">{doc.title}</span>
                  {tags.length > 0 && (
                    <span className="flex items-center gap-0.5 shrink-0">
                      {tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1 text-[9px] rounded bg-secondary text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                      {tags.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Inline subfolder creation */}
            {showNewSubfolder && (
              <div style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }} className="pr-2 py-1">
                <input
                  type="text"
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubfolder();
                    if (e.key === 'Escape') { setShowNewSubfolder(false); setNewSubfolderName(''); }
                  }}
                  onBlur={() => {
                    if (!newSubfolderName.trim()) {
                      setShowNewSubfolder(false);
                      setNewSubfolderName('');
                    }
                  }}
                  placeholder="Subfolder name..."
                  className="w-full px-2 py-1 text-xs bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FolderTree({ folders, documents, selectedFolderId, selectedDocId, readDocIds, onSelectFolder, onSelectDocument, onCreateFolder, onDeleteFolder }: FolderTreeProps) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const rootFolders = folders.filter(f => !f.parent_id);
  const rootDocs = useMemo(
    () => documents.filter(d => !d.folder_id),
    [documents]
  );
  const totalUnread = useMemo(
    () => documents.filter(d => !readDocIds.has(d.id)).length,
    [documents, readDocIds]
  );

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  return (
    <div className="p-1.5">
      {/* All Documents */}
      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
          selectedFolderId === null
            ? 'bg-primary/10 text-foreground font-medium rounded'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded'
        }`}
      >
        <FileText className={`w-3.5 h-3.5 ${selectedFolderId === null ? 'text-primary' : ''}`} />
        <span className="flex-1">All Documents</span>
        {totalUnread > 0 && (
          <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-medium bg-primary text-primary-foreground rounded-full px-1">
            {totalUnread}
          </span>
        )}
      </button>

      {/* Folder tree */}
      {rootFolders.map(folder => {
        const children = folders.filter(f => f.parent_id === folder.id);
        return (
          <FolderNode
            key={folder.id}
            folder={folder}
            childFolders={children}
            allFolders={folders}
            documents={documents}
            selectedFolderId={selectedFolderId}
            selectedDocId={selectedDocId}
            readDocIds={readDocIds}
            onSelectFolder={onSelectFolder}
            onSelectDocument={onSelectDocument}
            onCreateFolder={onCreateFolder}
            onDeleteFolder={onDeleteFolder}
            depth={0}
          />
        );
      })}

      {/* Root-level documents (no folder) */}
      {rootDocs.map(doc => {
        const tags = parseTags(doc.tags);
        const isUnread = !readDocIds.has(doc.id);
        return (
          <button
            key={doc.id}
            onClick={() => onSelectDocument(doc.id)}
            className={`w-full flex items-center gap-1.5 px-3 py-1 text-left text-xs transition-colors ${
              selectedDocId === doc.id
                ? 'text-foreground font-medium'
                : isUnread
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
            }`}
            title={doc.title}
          >
            {isUnread && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
            <FileText className={`w-3 h-3 shrink-0 ${selectedDocId === doc.id ? 'text-primary' : ''}`} />
            <span className="truncate">{doc.title}</span>
            {tags.length > 0 && (
              <span className="flex items-center gap-0.5 shrink-0">
                {tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-1 text-[9px] rounded bg-secondary text-muted-foreground">
                    {tag}
                  </span>
                ))}
                {tags.length > 2 && (
                  <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>
                )}
              </span>
            )}
          </button>
        );
      })}

      {/* New root folder */}
      {showNewFolder ? (
        <div className="px-2 pt-1">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
            }}
            onBlur={() => {
              if (!newFolderName.trim()) {
                setShowNewFolder(false);
                setNewFolderName('');
              }
            }}
            placeholder="Folder name..."
            className="w-full px-2 py-1 text-xs bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setShowNewFolder(true)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>
      )}
    </div>
  );
}
