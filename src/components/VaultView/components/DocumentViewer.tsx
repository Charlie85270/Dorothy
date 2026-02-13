'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Clock,
  User,
  Tag,
  Paperclip,
  FileText,
} from 'lucide-react';
import type { VaultDocumentElectron, VaultAttachmentElectron } from '@/types/electron';
import { SimpleMarkdown } from './MarkdownRenderer';

interface DocumentViewerProps {
  document: VaultDocumentElectron;
  attachments: VaultAttachmentElectron[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function parseTags(tagsStr: string): string[] {
  try {
    return JSON.parse(tagsStr || '[]');
  } catch {
    return [];
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentViewer({ document, attachments, onBack, onEdit, onDelete }: DocumentViewerProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const tags = parseTags(document.tags);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground truncate">{document.title}</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {document.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(document.updated_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(document.id)}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-xs bg-secondary rounded hover:bg-secondary/80"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-secondary rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-card">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          {tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <SimpleMarkdown content={document.content} />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="border-t border-border px-4 py-3 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Attachments ({attachments.length})
            </span>
          </div>
          <div className="space-y-1">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50 text-sm"
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{att.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(att.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
