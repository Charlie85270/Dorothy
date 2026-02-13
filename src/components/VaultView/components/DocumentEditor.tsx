'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Tag,
  FolderOpen,
  Bold,
  Italic,
  Code,
  Link,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  FileCode,
  Eye,
  Pencil,
  ImagePlus,
  Paperclip,
} from 'lucide-react';
import type { VaultDocumentElectron, VaultFolderElectron } from '@/types/electron';
import { SimpleMarkdown } from './MarkdownRenderer';

interface DocumentEditorProps {
  document?: VaultDocumentElectron | null;
  folders: VaultFolderElectron[];
  defaultFolderId?: string | null;
  onSave: (data: {
    title: string;
    content: string;
    tags: string[];
    folder_id: string | null;
    pendingFiles?: string[];
  }) => void;
  onCancel: () => void;
}

function parseTags(tagsStr: string): string[] {
  try {
    return JSON.parse(tagsStr || '[]');
  } catch {
    return [];
  }
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.dialog;
}

type EditorTab = 'write' | 'preview';

interface ToolbarAction {
  icon: React.FC<{ className?: string }>;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: Bold, label: 'Bold', prefix: '**', suffix: '**' },
  { icon: Italic, label: 'Italic', prefix: '*', suffix: '*' },
  { icon: Code, label: 'Inline code', prefix: '`', suffix: '`' },
  { icon: Link, label: 'Link', prefix: '[', suffix: '](url)' },
];

const TOOLBAR_BLOCK_ACTIONS: ToolbarAction[] = [
  { icon: Heading1, label: 'Heading 1', prefix: '# ', suffix: '', block: true },
  { icon: Heading2, label: 'Heading 2', prefix: '## ', suffix: '', block: true },
  { icon: Heading3, label: 'Heading 3', prefix: '### ', suffix: '', block: true },
  { icon: List, label: 'Bullet list', prefix: '- ', suffix: '', block: true },
  { icon: ListOrdered, label: 'Numbered list', prefix: '1. ', suffix: '', block: true },
  { icon: Quote, label: 'Blockquote', prefix: '> ', suffix: '', block: true },
  { icon: Minus, label: 'Horizontal rule', prefix: '\n---\n', suffix: '', block: true },
  { icon: FileCode, label: 'Code block', prefix: '```\n', suffix: '\n```', block: true },
];

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif', 'tiff', 'tif', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

function getFileExtension(filepath: string): string {
  return filepath.split('.').pop()?.toLowerCase() || '';
}

function getFileName(filepath: string): string {
  return filepath.split('/').pop()?.split('\\').pop() || 'file';
}

export default function DocumentEditor({ document, folders, defaultFolderId, onSave, onCancel }: DocumentEditorProps) {
  const [title, setTitle] = useState(document?.title || '');
  const [content, setContent] = useState(document?.content || '');
  const [tagsInput, setTagsInput] = useState(document ? parseTags(document.tags).join(', ') : '');
  const [folderId, setFolderId] = useState<string | null>(document?.folder_id || defaultFolderId || null);
  const [activeTab, setActiveTab] = useState<EditorTab>('write');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isNew = !document;

  const handleSave = () => {
    if (!title.trim()) return;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    onSave({ title: title.trim(), content, tags, folder_id: folderId, pendingFiles });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const insertTextAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + text);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insert = (needsNewline ? '\n' : '') + text + '\n';
    const newContent = before + insert + after;
    setContent(newContent);

    const newPos = start + insert.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [content]);

  const applyFormatting = useCallback((action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);

    let newContent: string;
    let newCursorPos: number;

    if (action.block && !selectedText) {
      const beforeCursor = content.slice(0, start);
      const afterCursor = content.slice(end);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = (needsNewline ? '\n' : '') + action.prefix;
      newContent = beforeCursor + prefix + action.suffix + afterCursor;
      newCursorPos = start + prefix.length;
    } else if (selectedText) {
      newContent = content.slice(0, start) + action.prefix + selectedText + action.suffix + content.slice(end);
      newCursorPos = start + action.prefix.length + selectedText.length + action.suffix.length;
    } else {
      newContent = content.slice(0, start) + action.prefix + action.suffix + content.slice(end);
      newCursorPos = start + action.prefix.length;
    }

    setContent(newContent);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [content]);

  const handleInsertFiles = useCallback(async () => {
    if (!isElectron()) return;

    try {
      const filePaths = await window.electronAPI!.dialog.openFiles();
      if (!filePaths || filePaths.length === 0) return;

      for (const filePath of filePaths) {
        const ext = getFileExtension(filePath);
        const name = getFileName(filePath);

        // Track file for attachment after save
        setPendingFiles(prev => [...prev, filePath]);

        // Insert appropriate markdown
        if (IMAGE_EXTENSIONS.includes(ext)) {
          insertTextAtCursor(`![${name}](${filePath})`);
        } else if (VIDEO_EXTENSIONS.includes(ext)) {
          insertTextAtCursor(`[Video: ${name}](${filePath})`);
        } else {
          insertTextAtCursor(`[${name}](${filePath})`);
        }
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  }, [insertTextAtCursor]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      applyFormatting(TOOLBAR_ACTIONS[0]);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      applyFormatting(TOOLBAR_ACTIONS[1]);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + '  ' + content.slice(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-semibold text-foreground">
            {isNew ? 'New Document' : 'Edit Document'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-foreground text-background rounded hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor form */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 lg:px-6 py-5 space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title..."
            className="w-full text-sm bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />

          {/* Meta row: folder + tags */}
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="text-sm bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No folder</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (comma-separated)..."
                className="flex-1 text-sm bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Markdown editor */}
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Tab bar + Toolbar */}
            <div className="border-b border-border bg-secondary/30 !rounded-b-none">
              {/* Tabs */}
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center bg-secondary rounded-md p-0.5">
                  <button
                    onClick={() => setActiveTab('write')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${activeTab === 'write'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Pencil className="w-3 h-3" />
                    Write
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${activeTab === 'preview'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  Markdown supported
                </span>
              </div>

              {/* Toolbar - only shown in write mode */}
              {activeTab === 'write' && (
                <div className="flex items-center border-none gap-0.5 px-3 py-1.5 flex-wrap !rounded-b-none">
                  {TOOLBAR_ACTIONS.map(action => (
                    <button
                      key={action.label}
                      onClick={() => applyFormatting(action)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                      title={action.label}
                    >
                      <action.icon className="w-3.5 h-3.5" />
                    </button>
                  ))}

                  <div className="w-px h-4 bg-border mx-1" />

                  {TOOLBAR_BLOCK_ACTIONS.map(action => (
                    <button
                      key={action.label}
                      onClick={() => applyFormatting(action)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                      title={action.label}
                    >
                      <action.icon className="w-3.5 h-3.5" />
                    </button>
                  ))}

                  <div className="w-px h-4 bg-border mx-1" />

                  {/* File attachments */}
                  <button
                    onClick={handleInsertFiles}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                    title="Insert image"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleInsertFiles}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                    title="Attach file"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Content area */}
            {activeTab === 'write' ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Write your document content here..."
                className="w-full min-h-[400px] text-sm bg-transparent outline-none !border-none text-foreground placeholder:text-muted-foreground/40 focus:outline-none resize-none leading-relaxed font-mono p-4"
                style={{ height: 'calc(100vh - 380px)' }}
              />
            ) : (
              <div
                className="p-4 min-h-[400px]"
                style={{ minHeight: 'calc(100vh - 380px)' }}
              >
                {content.trim() ? (
                  <SimpleMarkdown content={content} />
                ) : (
                  <p className="text-muted-foreground/50 text-sm italic">Nothing to preview</p>
                )}
              </div>
            )}
          </div>

          {/* Pending files indicator */}
          {pendingFiles.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Paperclip className="w-3 h-3" />
              <span>{pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} will be attached on save</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
