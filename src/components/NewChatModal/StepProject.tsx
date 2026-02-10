import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  FolderPlus,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  Layers,
} from 'lucide-react';
import type { Project } from './types';

interface StepProjectProps {
  projects: Project[];
  projectPath: string;
  selectedProject: string;
  customPath: string;
  onSelectProject: (path: string) => void;
  onCustomPathChange: (path: string) => void;
  onBrowseFolder?: () => Promise<string | null>;
  showSecondaryProject: boolean;
  onToggleSecondary: () => void;
  selectedSecondaryProject: string;
  onSelectSecondaryProject: (path: string) => void;
  customSecondaryPath: string;
  onCustomSecondaryPathChange: (path: string) => void;
  onClearSecondary: () => void;
}

const StepProject = React.memo(function StepProject({
  projects,
  projectPath,
  selectedProject,
  customPath,
  onSelectProject,
  onCustomPathChange,
  onBrowseFolder,
  showSecondaryProject,
  onToggleSecondary,
  selectedSecondaryProject,
  onSelectSecondaryProject,
  customSecondaryPath,
  onCustomSecondaryPathChange,
  onClearSecondary,
}: StepProjectProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-accent-blue" />
          Select Project
        </h3>
        <p className="text-text-secondary text-sm mb-4">
          Choose an existing project or enter a custom path
        </p>
      </div>

      {/* Existing Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {projects.map((project) => (
          <button
            key={project.path}
            onClick={() => onSelectProject(project.path)}
            className={`
              text-left p-4 rounded-none border transition-all
              ${selectedProject === project.path
                ? 'border-accent-blue bg-accent-blue/10'
                : 'border-border-primary hover:border-border-accent bg-bg-tertiary/30'
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-accent-purple" />
                <span className="font-medium">{project.name}</span>
              </div>
              {selectedProject === project.path && (
                <Check className="w-4 h-4 text-accent-blue" />
              )}
            </div>
            <p className="text-xs text-text-muted mt-1 truncate font-mono">
              {project.path}
            </p>
          </button>
        ))}
      </div>

      {/* Custom Path */}
      <div className="relative">
        <label className="block text-sm font-medium mb-2">Or enter a custom path:</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPath}
            onChange={(e) => onCustomPathChange(e.target.value)}
            placeholder="/path/to/your/project"
            className="flex-1 px-4 py-3 rounded-none font-mono text-sm"
          />
          {onBrowseFolder && (
            <button
              type="button"
              onClick={async () => {
                const path = await onBrowseFolder();
                if (path) onCustomPathChange(path);
              }}
              className="px-4 py-3 rounded-none bg-bg-tertiary border border-border-primary hover:border-accent-blue transition-colors flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4 text-accent-blue" />
              <span className="text-sm">Browse</span>
            </button>
          )}
        </div>
      </div>

      {/* Secondary Project (Collapsible) */}
      <div className="border border-border-primary rounded-none overflow-hidden">
        <button
          onClick={onToggleSecondary}
          className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors"
        >
          <span className="font-medium text-sm flex items-center gap-2">
            {showSecondaryProject ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Layers className="w-4 h-4 text-accent-purple" />
            Add second project for context (optional)
          </span>
          {(selectedSecondaryProject || customSecondaryPath) && (
            <span className="text-xs text-accent-purple px-2 py-0.5 rounded bg-accent-purple/10">
              Selected
            </span>
          )}
        </button>

        <AnimatePresence>
          {showSecondaryProject && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4 border-t border-border-primary">
                <p className="text-xs text-text-muted">
                  The agent will have access to this project via <code className="bg-bg-tertiary px-1 rounded">--add-dir</code>
                </p>

                {projects.filter(p => p.path !== projectPath).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {projects.filter(p => p.path !== projectPath).map((project) => (
                      <button
                        key={project.path}
                        onClick={() => onSelectSecondaryProject(project.path)}
                        className={`
                          text-left p-3 rounded-none border transition-all text-sm
                          ${selectedSecondaryProject === project.path
                            ? 'border-accent-purple bg-accent-purple/10'
                            : 'border-border-primary hover:border-border-accent bg-bg-tertiary/30'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderPlus className="w-3.5 h-3.5 text-accent-amber" />
                            <span className="font-medium">{project.name}</span>
                          </div>
                          {selectedSecondaryProject === project.path && (
                            <Check className="w-3.5 h-3.5 text-accent-purple" />
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-1 truncate font-mono">
                          {project.path}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">No other projects available</p>
                )}

                {/* Custom secondary path */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSecondaryPath}
                    onChange={(e) => onCustomSecondaryPathChange(e.target.value)}
                    placeholder="/path/to/secondary/project"
                    className="flex-1 px-3 py-2 rounded-none font-mono text-sm"
                  />
                  {onBrowseFolder && (
                    <button
                      type="button"
                      onClick={async () => {
                        const path = await onBrowseFolder();
                        if (path) onCustomSecondaryPathChange(path);
                      }}
                      className="px-3 py-2 rounded-none bg-bg-tertiary border border-border-primary hover:border-accent-purple transition-colors flex items-center gap-2"
                    >
                      <FolderOpen className="w-4 h-4 text-accent-purple" />
                      <span className="text-sm">Browse</span>
                    </button>
                  )}
                </div>

                {/* Clear button */}
                {(selectedSecondaryProject || customSecondaryPath) && (
                  <button
                    onClick={onClearSecondary}
                    className="text-xs text-text-muted hover:text-accent-red transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear selection
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default StepProject;
