'use client';

import { useState, useRef, useCallback } from 'react';
import { Save, X, Eye, Pencil, PanelTop, PanelBottom, PanelLeft, PanelRight } from 'lucide-react';

export type DockPosition = 'top' | 'bottom' | 'left' | 'right';

interface FileEditorPanelProps {
  filePath: string;
  filename: string;
  content: string;
  position: DockPosition;
  onSave: (content: string) => void;
  onClose: () => void;
  onPositionChange: (position: DockPosition) => void;
}

type EditorTab = 'write' | 'preview';

export default function FileEditorPanel({ filePath, filename, content: initialContent, position, onSave, onClose, onPositionChange }: FileEditorPanelProps) {
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
      className={`flex flex-col h-full overflow-hidden ${position === 'top' || position === 'bottom' ? 'border-t border-b' : 'border-l border-r'} border-border`}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1 bg-secondary border-b border-border select-none shrink-0">
        <span className="text-[10px] font-medium text-foreground truncate flex-1" title={filePath}>
          {filename}
        </span>
        {!saved && (
          <span className="text-[9px] text-amber-400 font-medium">modified</span>
        )}

        {/* Tab toggle */}
        <div className="flex items-center bg-secondary/50 rounded p-0.5">
          <button
            onClick={() => setActiveTab('write')}
            className={`p-0.5 rounded ${activeTab === 'write' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Edit"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`p-0.5 rounded ${activeTab === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Preview"
          >
            <Eye className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Position buttons */}
        <div className="flex items-center bg-secondary/50 rounded p-0.5">
          <button
            onClick={() => onPositionChange('top')}
            className={`p-0.5 rounded ${position === 'top' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Dock top"
          >
            <PanelTop className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => onPositionChange('bottom')}
            className={`p-0.5 rounded ${position === 'bottom' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Dock bottom"
          >
            <PanelBottom className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => onPositionChange('left')}
            className={`p-0.5 rounded ${position === 'left' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Dock left"
          >
            <PanelLeft className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => onPositionChange('right')}
            className={`p-0.5 rounded ${position === 'right' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            title="Dock right"
          >
            <PanelRight className="w-2.5 h-2.5" />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saved}
          className="p-0.5 hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Save (⌘S)"
        >
          <Save className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-primary/10 transition-colors text-muted-foreground hover:text-red-400"
          title="Close file"
        >
          <X className="w-2.5 h-2.5" />
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
