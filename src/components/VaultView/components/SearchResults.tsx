'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  Clock,
  User,
  Tag,
  Search,
} from 'lucide-react';
import type { VaultDocumentElectron } from '@/types/electron';

interface SearchResultsProps {
  results: VaultDocumentElectron[];
  query: string;
  onSelectDocument: (id: string) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 1) return 'Today';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function sanitizeSnippet(html: string): string {
  // Escape all HTML, then restore only the <mark> tags that SQLite FTS5 snippet() inserts
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}

function parseTags(tagsStr: string): string[] {
  try {
    return JSON.parse(tagsStr || '[]');
  } catch {
    return [];
  }
}

export default function SearchResults({ results, query, onSelectDocument }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">No results found for &ldquo;{query}&rdquo;</p>
        <p className="text-xs mt-1">Try different keywords or check your spelling</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-muted-foreground px-1 mb-3">
        {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </p>
      {results.map((doc, index) => {
        const tags = parseTags(doc.tags);

        return (
          <motion.button
            key={doc.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectDocument(doc.id)}
            className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 hover:border-border/80 transition-all"
          >
            <h3 className="font-medium text-sm text-foreground">{doc.title}</h3>

            {/* Snippet with highlighted matches */}
            {doc.snippet && (
              <p
                className="text-xs text-muted-foreground mt-1 line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded"
                dangerouslySetInnerHTML={{ __html: sanitizeSnippet(doc.snippet) }}
              />
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
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                {tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-secondary text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
