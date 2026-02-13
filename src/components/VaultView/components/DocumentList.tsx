'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  Clock,
  User,
  Tag,
  Plus,
} from 'lucide-react';
import type { VaultDocumentElectron } from '@/types/electron';

interface DocumentListProps {
  documents: VaultDocumentElectron[];
  selectedDocId: string | null;
  onSelectDocument: (id: string) => void;
  onCreateDocument?: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function parseTags(tagsStr: string): string[] {
  try {
    return JSON.parse(tagsStr || '[]');
  } catch {
    return [];
  }
}

export default function DocumentList({ documents, selectedDocId, onSelectDocument, onCreateDocument }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="w-14 h-14 mb-4 opacity-30" />
        <p className="text-base font-medium">No documents yet</p>
        <p className="text-sm mt-1 opacity-70">Create one or let an agent write a report</p>
        {onCreateDocument && (
          <button
            onClick={onCreateDocument}
            className="flex items-center gap-1.5 mt-4 px-4 py-2 text-sm bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Document
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {documents.map((doc, index) => {
        const tags = parseTags(doc.tags);
        const isSelected = selectedDocId === doc.id;
        const preview = doc.content.replace(/[#*_`~\[\]]/g, '').slice(0, 120);

        return (
          <motion.button
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectDocument(doc.id)}
            className={`
              w-full text-left p-3 rounded-lg border transition-all
              ${isSelected
                ? 'bg-primary/10 border-primary/30 shadow-sm'
                : 'bg-card border-border hover:bg-secondary/50 hover:border-border/80'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm text-foreground truncate flex-1">
                {doc.title}
              </h3>
            </div>

            {preview && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {preview}...
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {doc.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(doc.updated_at)}
              </span>
            </div>

            {tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                {tags.slice(0, 4).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-secondary text-muted-foreground">
                    {tag}
                  </span>
                ))}
                {tags.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{tags.length - 4}</span>
                )}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
