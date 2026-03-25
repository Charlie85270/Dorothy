'use client';

import { useState, useRef, useCallback } from 'react';
import { Save, X, Eye, Pencil } from 'lucide-react';

interface FileEditorPanelProps {
  filePath: string;
  filename: string;
  content: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

type EditorTab = 'write' | 'preview';

export default function FileEditorPanel({ filePath, filename, content: initialContent, onSave, onClose }: FileEditorPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [activeTab, setActiveTab] = useState<EditorTab>('write');
  const [saved, setSaved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    onSave(content);
    setSaved(true);
  }, [content, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-t border-border"
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary border-b border-border select-none shrink-0">
        <span className="text-xs font-medium text-foreground truncate flex-1" title={filePath}>
          {filename}
        </span>
        {!saved && (
          <span className="text-[10px] text-amber-400 font-medium">modified</span>
        )}

        {/* Tab toggle */}
        <div className="flex items-center bg-secondary/50 rounded p-0.5">
          <button
            onClick={() => setActiveTab('write')}
            className={`p-1 rounded text-[10px] ${activeTab === 'write' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`p-1 rounded text-[10px] ${activeTab === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Preview"
          >
            <Eye className="w-3 h-3" />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saved}
          className="p-1 hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Save (⌘S)"
        >
          <Save className="w-3 h-3" />
        </button>
        <button
          onClick={onClose}
          className="p-1 hover:bg-primary/10 transition-colors text-muted-foreground hover:text-red-400"
          title="Close file"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      {activeTab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 w-full text-xs bg-[#1a1a2e] text-foreground font-mono p-3 outline-none border-none resize-none leading-relaxed"
          spellCheck={false}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 text-xs text-foreground bg-[#1a1a2e]">
          <pre className="whitespace-pre-wrap font-mono">{content}</pre>
        </div>
      )}
    </div>
  );
}
