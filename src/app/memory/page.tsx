'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  Edit3,
  X,
  AlertCircle,
  Loader2,
  Database,
  Clock,
  HardDrive,
  Share2,
} from 'lucide-react';
import { useMemory, formatBytes, timeAgo } from '@/hooks/useMemory';
import type { ProjectMemory, MemoryFile } from '@/types/electron';
import AgentKnowledgeGraph from '@/components/Memory/AgentKnowledgeGraph';

// ─── Inline editor with save/cancel ────────────────────────────────────────

function FileEditor({
  file,
  onSave,
  onCancel,
  saving,
}: {
  file: MemoryFile;
  onSave: (content: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [content, setContent] = useState(file.content);
  const dirty = content !== file.content;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30 shrink-0">
        <span className="text-xs font-mono text-muted-foreground flex items-center gap-2">
          <Edit3 className="w-3 h-3" />
          Editing {file.name}
          {dirty && <span className="text-amber-500">•</span>}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(content)}
            disabled={!dirty || saving}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>
      <textarea
        className="flex-1 w-full resize-none bg-background font-mono text-xs leading-relaxed p-4 focus:outline-none text-foreground placeholder:text-muted-foreground/50"
        value={content}
        onChange={e => setContent(e.target.value)}
        spellCheck={false}
        autoFocus
      />
    </div>
  );
}

// ─── File viewer (read mode) ────────────────────────────────────────────────

function FileViewer({
  file,
  onEdit,
  onDelete,
}: {
  file: MemoryFile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-foreground font-medium">{file.name}</span>
          {file.isEntrypoint && (
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 font-medium">
              ENTRYPOINT
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-2">{timeAgo(file.lastModified)}</span>
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Edit file"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          {!file.isEntrypoint && (
            <button
              onClick={onDelete}
              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete file"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {file.content ? (
          <pre className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {file.content}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs">
            File is empty
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Project card ────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  isSelected,
  activeAgents,
  onClick,
}: {
  project: ProjectMemory;
  isSelected: boolean;
  activeAgents: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 transition-all duration-100 border-l-2 !rounded-none group ${isSelected
        ? 'bg-primary/10 border-l-primary text-foreground'
        : 'border-l-transparent hover:bg-secondary/60 hover:border-l-border text-muted-foreground hover:text-foreground'
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className={`w-4 h-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
          <span className="text-sm font-medium truncate">{project.projectName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {activeAgents > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-600 dark:text-green-400 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              {activeAgents}
            </span>
          )}
          {project.hasMemory && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono ${isSelected ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
              {project.files.length}f
            </span>
          )}
        </div>
      </div>
      {project.hasMemory ? (
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground ml-6">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(project.lastModified)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {formatBytes(project.totalSize)}
          </span>
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-muted-foreground/50 ml-6 italic">No memory yet</p>
      )}
    </button>
  );
}

// ─── New file modal ──────────────────────────────────────────────────────────

function NewFileModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border p-6 w-80 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          New Memory File
        </h3>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          placeholder="e.g. debugging or api-conventions"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
          className="w-full px-3 py-2 text-sm bg-background border border-border focus:outline-none focus:border-primary transition-colors font-mono"
        />
        <p className="mt-1.5 text-[10px] text-muted-foreground">.md will be appended automatically</p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs text-muted-foreground border border-border hover:border-foreground/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 py-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Create
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const {
    filteredProjects,
    agentCountByPath,
    selectedProject,
    selectedFile,
    loading,
    saving,
    error,
    searchQuery,
    setSearchQuery,
    totalFiles,
    totalSize,
    projectsWithMemory,
    isElectron,
    selectProject,
    selectFile,
    saveFile,
    createFile,
    deleteFile,
    refresh,
  } = useMemory();

  const [activeTab, setActiveTab] = useState<'projects' | 'agents'>('projects');
  const [editingFile, setEditingFile] = useState<MemoryFile | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const handleSelectProject = useCallback((project: ProjectMemory) => {
    selectProject(project);
    setEditingFile(null);
  }, [selectProject]);

  const handleSelectFile = useCallback((file: MemoryFile) => {
    selectFile(file);
    setEditingFile(null);
  }, [selectFile]);

  const handleSave = useCallback(async (content: string) => {
    if (!editingFile) return;
    const ok = await saveFile(editingFile.path, content);
    if (ok) setEditingFile(null);
  }, [editingFile, saveFile]);

  const handleDelete = useCallback(async (filePath: string) => {
    setDeletingFile(filePath);
    await deleteFile(filePath);
    setDeletingFile(null);
  }, [deleteFile]);

  const handleCreateFile = useCallback(async (name: string) => {
    if (!selectedProject) return;
    setShowNewFileModal(false);
    await createFile(selectedProject.memoryDir, name);
  }, [selectedProject, createFile]);

  if (!isElectron) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-center">
        <div>
          <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Memory is only available in the desktop app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Memory
          </h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Native Claude Code memory — per-project context that persists across sessions
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'projects' && (
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 lg:px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-0 border-b border-border mb-4 shrink-0">
        {([
          { id: 'projects', label: 'Projects', icon: FolderOpen },
          { id: 'agents',   label: 'Agents',   icon: Share2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Agents graph tab ── */}
      {activeTab === 'agents' && (
        <div className="flex-1 min-h-0">
          <AgentKnowledgeGraph />
        </div>
      )}

      {/* ── Projects tab content ── */}
      {activeTab === 'projects' && <>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3 mb-4 shrink-0">
        {[
          { icon: Database, label: 'Projects', value: projectsWithMemory },
          { icon: FileText, label: 'Memory Files', value: totalFiles },
          { icon: HardDrive, label: 'Total Size', value: formatBytes(totalSize) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-card border border-border px-4 py-3 flex items-center gap-3">
            <Icon className="w-4 h-4 text-primary/60 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className="text-sm font-semibold tabular-nums">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Main 3-pane layout ── */}
      <div className="flex-1 flex gap-0 border border-border overflow-hidden min-h-0 bg-card">

        {/* ── Left: Project list ── */}
        <div className="w-56 lg:w-64 shrink-0 flex flex-col border-r border-border overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter projects…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border focus:outline-none focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Brain className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? 'No projects match your search' : 'No Claude projects found'}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Memory is created automatically as you work with Claude Code
                </p>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.04 } },
                  hidden: {},
                }}
              >
                {filteredProjects.map((project) => (
                  <motion.div
                    key={project.id}
                    variants={{
                      hidden: { opacity: 0, x: -8 },
                      visible: { opacity: 1, x: 0 },
                    }}
                  >
                    <ProjectCard
                      project={project}
                      isSelected={selectedProject?.id === project.id}
                      activeAgents={agentCountByPath.get(project.projectPath) ?? 0}
                      onClick={() => handleSelectProject(project)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Middle: File list ── */}
        <div className="w-44 lg:w-52 shrink-0 flex flex-col border-r border-border overflow-hidden">
          {selectedProject ? (
            <>
              {/* Project header */}
              <div className="px-3 py-2 border-b !rounded-none border-border !border-t-0image.png shrink-0 bg-secondary/20">
                <p className="text-xs font-semibold truncate">{selectedProject.projectName}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={selectedProject.projectPath}>
                  {selectedProject.projectPath}
                </p>
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto">
                {!selectedProject.hasMemory ? (
                  <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
                    <FileText className="w-7 h-7 text-muted-foreground/30 mb-2" />
                    <p className="text-[10px] text-muted-foreground">No memory files yet</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {selectedProject.files.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => handleSelectFile(file)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all group ${selectedFile?.path === file.path
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          }`}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono truncate">{file.name}</p>
                          {file.isEntrypoint && (
                            <p className="text-[9px] text-primary/70 mt-0.5">entrypoint</p>
                          )}
                        </div>
                        {selectedFile?.path === file.path && (
                          <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* New file button */}
              <div className="border-t border-border shrink-0">
                <button
                  onClick={() => setShowNewFileModal(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New topic file
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full px-3 text-center">
              <FolderOpen className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground/60">Select a project</p>
            </div>
          )}
        </div>

        {/* ── Right: Content viewer / editor ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key={selectedFile.path}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {editingFile?.path === selectedFile.path ? (
                  <FileEditor
                    file={editingFile}
                    onSave={handleSave}
                    onCancel={() => setEditingFile(null)}
                    saving={saving}
                  />
                ) : (
                  <FileViewer
                    file={selectedFile}
                    onEdit={() => setEditingFile(selectedFile)}
                    onDelete={() => handleDelete(selectedFile.path)}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center px-8"
              >
                <Brain className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm text-muted-foreground">
                  {selectedProject
                    ? 'Select a memory file to view or edit'
                    : 'Select a project to explore its memory'}
                </p>
                <p className="text-xs text-muted-foreground/50 mt-2 max-w-xs leading-relaxed">
                  Claude Code automatically saves learnings, patterns, and architectural notes here as you work.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── New file modal ── */}
      <AnimatePresence>
        {showNewFileModal && (
          <NewFileModal
            onConfirm={handleCreateFile}
            onClose={() => setShowNewFileModal(false)}
          />
        )}
      </AnimatePresence>

      </>}
    </div>
  );
}
