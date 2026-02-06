'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, FolderOpen, Plus, Minus, Sparkles, Wand2, ListTodo, Loader2, Paperclip, FileImage, FileText, File } from 'lucide-react';
import type { KanbanTaskCreate, TaskAttachment } from '@/types/kanban';
import { isElectron } from '@/hooks/useElectron';

interface NewTaskModalProps {
  onClose: () => void;
  onCreate: (data: KanbanTaskCreate) => Promise<void>;
}

interface Project {
  path: string;
  name: string;
  lastModified?: string;
}

type TabType = 'quick' | 'manual';

// Helper to determine file type from extension
function getFileType(path: string): TaskAttachment['type'] {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['doc', 'docx', 'txt', 'md', 'rtf', 'odt'].includes(ext)) {
    return 'document';
  }
  return 'other';
}

// Get icon for file type
function FileTypeIcon({ type }: { type: TaskAttachment['type'] }) {
  switch (type) {
    case 'image':
      return <FileImage className="w-4 h-4 text-blue-400" />;
    case 'pdf':
      return <FileText className="w-4 h-4 text-red-400" />;
    case 'document':
      return <FileText className="w-4 h-4 text-green-400" />;
    default:
      return <File className="w-4 h-4 text-muted-foreground" />;
  }
}

export function NewTaskModal({ onClose, onCreate }: NewTaskModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('quick');

  // Quick mode state
  const [quickPrompt, setQuickPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTask, setGeneratedTask] = useState<{
    title: string;
    description: string;
    projectPath: string;
    priority: 'low' | 'medium' | 'high';
    labels: string[];
    requiredSkills: string[];
  } | null>(null);

  // Shared attachments state (for both modes)
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);

  // Manual mode state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [selectedProjectPath, setSelectedProjectPath] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      if (isElectron() && window.electronAPI?.fs?.listProjects) {
        const projectList = await window.electronAPI.fs.listProjects();
        setProjects(projectList);
        if (projectList.length > 0) {
          setSelectedProjectPath(projectList[0].path);
        }
      }
    };
    loadProjects();
  }, []);

  const handleAddSkill = () => {
    if (skillInput.trim() && !requiredSkills.includes(skillInput.trim())) {
      setRequiredSkills([...requiredSkills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setRequiredSkills(requiredSkills.filter((s) => s !== skill));
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !labels.includes(labelInput.trim())) {
      setLabels([...labels, labelInput.trim()]);
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label));
  };

  const handleSelectFolder = async () => {
    if (isElectron() && window.electronAPI?.dialog?.openFolder) {
      const path = await window.electronAPI.dialog.openFolder();
      if (path) {
        setSelectedProjectPath(path);
      }
    }
  };

  const handleAddAttachments = async () => {
    if (isElectron() && window.electronAPI?.dialog?.openFiles) {
      const filePaths = await window.electronAPI.dialog.openFiles();
      if (filePaths && filePaths.length > 0) {
        const newAttachments: TaskAttachment[] = filePaths.map(path => ({
          path,
          name: path.split('/').pop() || path,
          type: getFileType(path),
        }));
        // Avoid duplicates
        const existingPaths = new Set(attachments.map(a => a.path));
        const uniqueNew = newAttachments.filter(a => !existingPaths.has(a.path));
        setAttachments([...attachments, ...uniqueNew]);
      }
    }
  };

  const handleRemoveAttachment = (path: string) => {
    setAttachments(attachments.filter(a => a.path !== path));
  };

  // Generate task from prompt using AI
  const handleGenerateTask = async () => {
    if (!quickPrompt.trim()) return;

    setIsGenerating(true);
    setGeneratedTask(null);

    try {
      // Call the API to generate task details
      const response = await fetch('http://127.0.0.1:31415/api/kanban/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: quickPrompt,
          availableProjects: projects.map(p => ({ path: p.path, name: p.name })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedTask(data.task);
      } else {
        // Fallback: create basic task from prompt
        const firstLine = quickPrompt.split('\n')[0].slice(0, 100);
        setGeneratedTask({
          title: firstLine,
          description: quickPrompt,
          projectPath: projects[0]?.path || '',
          priority: 'medium',
          labels: [],
          requiredSkills: [],
        });
      }
    } catch (err) {
      // Fallback on error
      const firstLine = quickPrompt.split('\n')[0].slice(0, 100);
      setGeneratedTask({
        title: firstLine,
        description: quickPrompt,
        projectPath: projects[0]?.path || '',
        priority: 'medium',
        labels: [],
        requiredSkills: [],
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickSubmit = async () => {
    if (!generatedTask || !generatedTask.projectPath) return;

    setIsSubmitting(true);
    try {
      const projectId = generatedTask.projectPath.replace(/[^a-zA-Z0-9]/g, '-');
      await onCreate({
        title: generatedTask.title,
        description: generatedTask.description,
        projectId,
        projectPath: generatedTask.projectPath,
        requiredSkills: generatedTask.requiredSkills,
        priority: generatedTask.priority,
        labels: generatedTask.labels,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !selectedProjectPath) {
      return;
    }

    setIsSubmitting(true);

    try {
      const projectId = selectedProjectPath.replace(/[^a-zA-Z0-9]/g, '-');

      await onCreate({
        title: title.trim(),
        description: description.trim(),
        projectId,
        projectPath: selectedProjectPath,
        requiredSkills,
        priority,
        labels,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
      >
        <div className="bg-card border border-border rounded-lg shadow-xl">
          {/* Header with Tabs */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('quick')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'quick'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Wand2 className="w-4 h-4" />
                Quick
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'manual'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <ListTodo className="w-4 h-4" />
                Manual
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Quick Mode */}
          {activeTab === 'quick' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  What do you need done?
                </label>
                <textarea
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="Describe your task in natural language...&#10;&#10;e.g., Fix the login bug on the claude-manager project where users can't sign in with Google"
                  rows={5}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  autoFocus
                />
              </div>

              {/* Attachments Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4" />
                    Attachments
                  </label>
                  <button
                    type="button"
                    onClick={handleAddAttachments}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Files
                  </button>
                </div>
                {attachments.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.path}
                        className="flex items-center gap-2 px-2 py-1.5 bg-secondary/50 border border-border rounded text-sm"
                      >
                        <FileTypeIcon type={attachment.type} />
                        <span className="flex-1 truncate text-foreground" title={attachment.path}>
                          {attachment.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(attachment.path)}
                          className="p-0.5 hover:bg-secondary rounded"
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add images, PDFs, or documents for reference
                  </p>
                )}
              </div>

              {!generatedTask && (
                <button
                  onClick={handleGenerateTask}
                  disabled={!quickPrompt.trim() || isGenerating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-md hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Task
                    </>
                  )}
                </button>
              )}

              {/* Generated Task Preview */}
              {generatedTask && (
                <div className="space-y-3 p-3 bg-secondary/50 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Generated Task
                    </span>
                    <button
                      onClick={() => setGeneratedTask(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit prompt
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Title</label>
                    <input
                      type="text"
                      value={generatedTask.title}
                      onChange={(e) => setGeneratedTask({ ...generatedTask, title: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 bg-background border border-border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Project</label>
                    <select
                      value={generatedTask.projectPath}
                      onChange={(e) => setGeneratedTask({ ...generatedTask, projectPath: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 bg-background border border-border rounded text-sm"
                    >
                      {projects.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Priority</label>
                    <div className="flex gap-1 mt-1">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setGeneratedTask({ ...generatedTask, priority: p })}
                          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                            generatedTask.priority === p
                              ? p === 'high'
                                ? 'bg-red-900/50 text-red-400'
                                : p === 'medium'
                                ? 'bg-yellow-900/50 text-yellow-400'
                                : 'bg-zinc-700 text-zinc-300'
                              : 'bg-background text-muted-foreground hover:bg-secondary'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {generatedTask.labels.length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground">Labels</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {generatedTask.labels.map((label) => (
                          <span
                            key={label}
                            className="px-2 py-0.5 bg-purple-900/30 text-purple-400 text-xs rounded-full"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={onClose}
                      className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleQuickSubmit}
                      disabled={isSubmitting || !generatedTask.projectPath}
                      className="px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Task'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Mode */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed instructions for the agent..."
                  rows={3}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Project */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Project <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedProjectPath}
                    onChange={(e) => setSelectedProjectPath(e.target.value)}
                    className="flex-1 px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {projects.length === 0 && (
                      <option value="">Select a project</option>
                    )}
                    {projects.map((p) => (
                      <option key={p.path} value={p.path}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="px-3 py-2 bg-secondary border border-border rounded-md hover:bg-secondary/80 transition-colors"
                    title="Browse folders"
                  >
                    <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Priority
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`
                        flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors
                        ${priority === p
                          ? p === 'high'
                            ? 'bg-red-900/30 border-red-500/50 text-red-400'
                            : p === 'medium'
                            ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400'
                            : 'bg-zinc-700/50 border-zinc-500/50 text-zinc-400'
                          : 'bg-secondary border-border text-muted-foreground hover:bg-secondary/80'
                        }
                      `}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Required Skills */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Required Skills
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="e.g., commit, test"
                    className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-2 py-1.5 bg-secondary border border-border rounded-md hover:bg-secondary/80"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {requiredSkills.map((skill) => (
                      <span
                        key={skill}
                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded-full"
                      >
                        {skill}
                        <button type="button" onClick={() => handleRemoveSkill(skill)}>
                          <Minus className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Labels */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Labels
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLabel();
                      }
                    }}
                    placeholder="e.g., bug, feature"
                    className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddLabel}
                    className="px-2 py-1.5 bg-secondary border border-border rounded-md hover:bg-secondary/80"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {labels.map((label) => (
                      <span
                        key={label}
                        className="flex items-center gap-1 px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full"
                      >
                        {label}
                        <button type="button" onClick={() => handleRemoveLabel(label)}>
                          <Minus className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4" />
                    Attachments
                  </label>
                  <button
                    type="button"
                    onClick={handleAddAttachments}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Files
                  </button>
                </div>
                {attachments.length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.path}
                        className="flex items-center gap-2 px-2 py-1.5 bg-secondary/50 border border-border rounded text-sm"
                      >
                        <FileTypeIcon type={attachment.type} />
                        <span className="flex-1 truncate text-foreground" title={attachment.path}>
                          {attachment.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(attachment.path)}
                          className="p-0.5 hover:bg-secondary rounded"
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add images, PDFs, or documents for reference
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !selectedProjectPath || isSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </>
  );
}
