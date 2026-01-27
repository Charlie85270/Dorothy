'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Square,
  Terminal as TerminalIcon,
  Loader2,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Code2,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Folder,
  Copy,
  Check,
  GitBranch,
  PanelRightClose,
  PanelRight,
  RefreshCw,
  TerminalSquare,
  Search,
  FileSearch,
  GitCommit,
  Plus,
  Minus,
  FileDiff,
  Clock,
  User,
} from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import type { AgentStatus, AgentCharacter } from '@/types/electron';
import { isElectron } from '@/hooks/useElectron';
import 'xterm/css/xterm.css';

// Get language from file extension
const getLanguageFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'markup',
    xml: 'markup',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    prisma: 'graphql',
  };
  return langMap[ext] || 'typescript';
};

// File tree types
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isExpanded?: boolean;
}

// Character emoji/icons for the face
const CHARACTER_FACES: Record<AgentCharacter, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🪓',
  frog: '🐸',
};

// Store PTY IDs per agent to persist terminals across dialog open/close
// Key: agentId, Value: { ptyId, outputBuffer }
const persistentTerminals = new Map<string, { ptyId: string; outputBuffer: string[] }>();

// File Tree Node Component
function FileTreeNode({
  nodes,
  onSelect,
  onToggle,
  selectedFile,
  gitStatus,
  copyPath,
  copiedPath,
  depth = 0,
}: {
  nodes: FileNode[];
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  selectedFile: string | null;
  gitStatus: string[];
  copyPath: (path: string) => void;
  copiedPath: string | null;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isModified = gitStatus.some(f => node.path.endsWith(f));
        const isSelected = selectedFile === node.path;

        return (
          <div key={node.path}>
            <div
              className={`
                flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer text-xs group
                ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-bg-tertiary text-text-secondary'}
              `}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => {
                if (node.type === 'directory') {
                  onToggle(node.path);
                } else {
                  onSelect(node.path);
                }
              }}
            >
              {node.type === 'directory' ? (
                <>
                  {node.isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                  )}
                  <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                </>
              ) : (
                <>
                  <span className="w-3" />
                  <FileText className="w-3 h-3 text-text-muted shrink-0" />
                </>
              )}
              <span className={`truncate ${isModified ? 'text-amber-400' : ''}`}>
                {node.name}
              </span>
              {isModified && (
                <GitBranch className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyPath(node.path);
                }}
                className="ml-auto p-0.5 opacity-0 group-hover:opacity-100 hover:bg-bg-primary rounded transition-opacity"
                title="Copy path"
              >
                {copiedPath === node.path ? (
                  <Check className="w-2.5 h-2.5 text-green-400" />
                ) : (
                  <Copy className="w-2.5 h-2.5 text-text-muted" />
                )}
              </button>
            </div>
            {node.type === 'directory' && node.isExpanded && node.children && (
              <FileTreeNode
                nodes={node.children}
                onSelect={onSelect}
                onToggle={onToggle}
                selectedFile={selectedFile}
                gitStatus={gitStatus}
                copyPath={copyPath}
                copiedPath={copiedPath}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

interface AgentTerminalDialogProps {
  agent: AgentStatus | null;
  open: boolean;
  onClose: () => void;
  onStart: (agentId: string, prompt: string) => void;
  onStop: (agentId: string) => void;
}

export default function AgentTerminalDialog({
  agent,
  open,
  onClose,
  onStart,
  onStop,
}: AgentTerminalDialogProps) {
  const [terminalReady, setTerminalReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<string[]>([]);
  const [showQuickTerminal, setShowQuickTerminal] = useState(false);
  const [quickTerminalReady, setQuickTerminalReady] = useState(false);
  const [terminalMinimized, setTerminalMinimized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'file' | 'content'>('file');
  const [searchResults, setSearchResults] = useState<Array<{ path: string; line?: number; match?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [gitData, setGitData] = useState<{
    branch: string;
    status: Array<{ status: string; file: string }>;
    diff: string;
    commits: Array<{ hash: string; message: string; author: string; date: string }>;
  }>({ branch: '', status: [], diff: '', commits: [] });
  const [loadingGit, setLoadingGit] = useState(false);
  const [showCommits, setShowCommits] = useState(false);
  const quickTerminalRef = useRef<HTMLDivElement>(null);
  const quickXtermRef = useRef<import('xterm').Terminal | null>(null);
  const quickFitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const quickPtyIdRef = useRef<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const agentIdRef = useRef<string | null>(null);

  // Keep track of agent ID
  useEffect(() => {
    agentIdRef.current = agent?.id || null;
  }, [agent?.id]);

  // Initialize xterm when dialog opens
  useEffect(() => {
    if (!open || !agent) return;

    // Clean up existing terminal
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    // Wait for the DOM to be ready
    const initTerminal = async () => {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 150));

      if (!terminalRef.current) {
        console.warn('Terminal container not ready');
        return;
      }

      // Ensure the container has dimensions
      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn('Terminal container has no dimensions, retrying...');
        setTimeout(initTerminal, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: {
          background: '#1a1a2e',
          foreground: '#e4e4e7',
          cursor: '#22d3ee',
          cursorAccent: '#1a1a2e',
          selectionBackground: '#22d3ee33',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#22d3ee',
          white: '#e4e4e7',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#67e8f9',
          brightWhite: '#fafafa',
        },
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 10000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(terminalRef.current);
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Helper function to fit terminal and resize PTY
        const fitAndResize = () => {
          try {
            fitAddon.fit();
            // Resize agent PTY
            if (window.electronAPI?.agent?.resize && agent?.id) {
              window.electronAPI.agent.resize({
                id: agent.id,
                cols: term.cols,
                rows: term.rows,
              }).catch(() => {});
            }
          } catch (e) {
            console.warn('Failed to fit terminal:', e);
          }
        };

        // Multiple fit calls to handle animation timing
        // First fit immediately after open
        fitAndResize();

        // Fit again after short delay (during animation)
        setTimeout(fitAndResize, 50);

        // Fit after animation likely complete
        setTimeout(fitAndResize, 200);

        // Final fit and focus after animation definitely complete
        setTimeout(() => {
          fitAndResize();
          term.focus();
        }, 350);

        // Handle user input
        term.onData(async (data) => {
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.sendInput) {
            try {
              await window.electronAPI.agent.sendInput({ id, input: data });
            } catch (err) {
              console.error('Error sending input:', err);
            }
          }
        });

        setTerminalReady(true);

        // Load existing output
        term.writeln(`\x1b[36m● Connected to ${agent.name || 'Agent'}\x1b[0m`);
        term.writeln('');

        if (window.electronAPI?.agent?.get) {
          try {
            const latestAgent = await window.electronAPI.agent.get(agent.id);
            if (latestAgent && latestAgent.output && latestAgent.output.length > 0) {
              term.writeln(`\x1b[33m--- Previous output ---\x1b[0m`);
              latestAgent.output.forEach((line: string) => term.write(line));
              // Fit again after loading output
              setTimeout(fitAndResize, 50);
            }
          } catch (err) {
            console.error('Failed to fetch agent:', err);
          }
        }
      } catch (e) {
        console.error('Failed to initialize terminal:', e);
      }
    };

    initTerminal();

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
      setTerminalReady(false);
    };
  }, [open, agent?.id]);

  // Listen for agent output
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.agent?.onOutput) return;

    const unsubscribe = window.electronAPI.agent.onOutput((event) => {
      if (event.agentId === agentIdRef.current && xtermRef.current) {
        xtermRef.current.write(event.data);
      }
    });

    return unsubscribe;
  }, []);

  // Handle resize
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;

    const fitAndResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const id = agentIdRef.current;
          if (id && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Failed to fit terminal:', e);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      fitAndResize();
    });

    resizeObserver.observe(terminalRef.current);
    return () => resizeObserver.disconnect();
  }, [terminalReady]);

  // Fit terminal when fullscreen changes
  useEffect(() => {
    if (!terminalReady || !fitAddonRef.current || !xtermRef.current) return;

    // Delay to allow layout to update
    const timeouts = [
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const id = agentIdRef.current;
          if (id && xtermRef.current && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {});
          }
        }
      }, 50),
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      }, 150),
    ];

    return () => timeouts.forEach(clearTimeout);
  }, [isFullscreen, terminalReady]);

  const handleStart = () => {
    if (agent && prompt.trim()) {
      onStart(agent.id, prompt.trim());
      setPrompt('');
    }
  };

  const handleOpenInFinder = async () => {
    if (!agent || !window.electronAPI?.shell?.exec) return;

    const projectPath = agent.worktreePath || agent.projectPath;
    try {
      await window.electronAPI.shell.exec({
        command: `open "${projectPath}"`,
        cwd: projectPath
      });
    } catch (err) {
      console.error('Failed to open Finder:', err);
    }
  };

  // Load file tree from project directory
  const loadFileTree = useCallback(async () => {
    if (!agent || !window.electronAPI?.shell?.exec) return;

    const projectPath = agent.worktreePath || agent.projectPath;
    setLoadingFiles(true);

    try {
      // Get file listing using find command (limited depth for performance)
      // Only get files, we'll infer directories from the paths
      const result = await window.electronAPI.shell.exec({
        command: `find . -maxdepth 3 -type f 2>/dev/null | grep -v node_modules | grep -v '/\\.git' | grep -v '/dist/' | grep -v '/\\.next/' | grep -v __pycache__ | sort | head -300`,
        cwd: projectPath
      });

      if (result.success && result.output) {
        // Clean paths: remove \r, trim whitespace, filter empty
        const paths = result.output
          .split('\n')
          .map(p => p.replace(/\r/g, '').trim())
          .filter(p => p && p !== '.');
        const tree = buildFileTree(paths, projectPath);
        setFileTree(tree);
      }

      // Get git status
      const gitResult = await window.electronAPI.shell.exec({
        command: 'git status --porcelain 2>/dev/null || echo ""',
        cwd: projectPath
      });

      if (gitResult.success && gitResult.output) {
        const modified = gitResult.output
          .split('\n')
          .map(l => l.replace(/\r/g, '').trim())
          .filter(l => l)
          .map(l => l.slice(3));
        setGitStatus(modified);
      }
    } catch (err) {
      console.error('Failed to load file tree:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, [agent]);

  // Build tree structure from flat paths
  const buildFileTree = (paths: string[], basePath: string): FileNode[] => {
    const root: FileNode[] = [];
    const seen = new Set<string>();

    paths.forEach(relativePath => {
      // Clean the path
      const cleanPath = relativePath.replace(/^\.\//, '').replace(/\r/g, '').trim();
      if (!cleanPath) return;

      const parts = cleanPath.split('/').filter(Boolean);
      let current = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const pathKey = parts.slice(0, index + 1).join('/');

        // Skip if we've already processed this path
        if (seen.has(pathKey)) {
          const existing = current.find(n => n.name === part);
          if (existing && existing.children) {
            current = existing.children;
          }
          return;
        }

        const existing = current.find(n => n.name === part);

        if (existing) {
          if (existing.children) {
            current = existing.children;
          }
        } else {
          seen.add(pathKey);
          const fullPath = `${basePath}/${pathKey}`.replace(/\r/g, '');
          const isFile = isLast; // Files are always at the end of the path
          const node: FileNode = {
            name: part,
            path: fullPath,
            type: isFile ? 'file' : 'directory',
            children: isFile ? undefined : [],
            isExpanded: false,
          };
          current.push(node);
          if (node.children) {
            current = node.children;
          }
        }
      });
    });

    // Sort: directories first, then files, alphabetically
    const sortNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }).map(node => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined
      }));
    };

    return sortNodes(root);
  };

  // Load file content
  const loadFileContent = async (filePath: string) => {
    if (!window.electronAPI?.shell?.exec) return;

    // Clean the path of any \r or whitespace
    const cleanPath = filePath.replace(/\r/g, '').trim();
    setSelectedFile(cleanPath);
    setFileContent('Loading...');

    try {
      const result = await window.electronAPI.shell.exec({
        command: `cat "${cleanPath}" 2>/dev/null | head -500`,
      });

      if (result.success && result.output) {
        // Clean output of \r characters too
        setFileContent(result.output.replace(/\r/g, ''));
      } else {
        setFileContent(result.error || 'Failed to load file');
      }
    } catch (err) {
      setFileContent('Error loading file');
    }
  };

  // Copy path to clipboard
  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setFileTree(prev => {
      const toggle = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.path === path) {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children) {
            return { ...node, children: toggle(node.children) };
          }
          return node;
        });
      };
      return toggle(prev);
    });
  };

  // Search for files or content
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !agent || !window.electronAPI?.shell?.exec) return;

    const projectPath = agent.worktreePath || agent.projectPath;
    setIsSearching(true);
    setSearchResults([]);

    try {
      if (searchMode === 'file') {
        // Search for files by name
        const result = await window.electronAPI.shell.exec({
          command: `find . -maxdepth 5 -type f -iname "*${searchQuery}*" 2>/dev/null | grep -v node_modules | grep -v '/\\.git' | grep -v '/dist/' | grep -v '/\\.next/' | head -50`,
          cwd: projectPath
        });

        if (result.success && result.output) {
          const files = result.output
            .split('\n')
            .map(p => p.replace(/\r/g, '').trim().replace(/^\.\//, ''))
            .filter(p => p)
            .map(p => ({ path: `${projectPath}/${p}` }));
          setSearchResults(files);
        }
      } else {
        // Search for content in files using grep
        const result = await window.electronAPI.shell.exec({
          command: `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" --include="*.css" --include="*.md" "${searchQuery}" . 2>/dev/null | grep -v node_modules | grep -v '/\\.git' | head -50`,
          cwd: projectPath
        });

        if (result.success && result.output) {
          const matches = result.output
            .split('\n')
            .map(line => line.replace(/\r/g, '').trim())
            .filter(line => line)
            .map(line => {
              // Format: ./path/to/file.ts:123:matched content
              const colonIndex = line.indexOf(':');
              const secondColonIndex = line.indexOf(':', colonIndex + 1);
              if (colonIndex > 0 && secondColonIndex > colonIndex) {
                const filePath = line.slice(0, colonIndex).replace(/^\.\//, '');
                const lineNum = parseInt(line.slice(colonIndex + 1, secondColonIndex), 10);
                const match = line.slice(secondColonIndex + 1).trim();
                return {
                  path: `${projectPath}/${filePath}`,
                  line: lineNum,
                  match: match.slice(0, 100)
                };
              }
              return null;
            })
            .filter((r): r is { path: string; line: number; match: string } => r !== null);
          setSearchResults(matches);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchMode, agent]);

  // Copy code with file path and line numbers
  const copyCodeWithContext = async (startLine: number, endLine: number) => {
    if (!selectedFile || !fileContent) return;

    const lines = fileContent.split('\n');
    const selectedLines = lines.slice(startLine - 1, endLine);
    const codeSnippet = selectedLines.join('\n');

    // Format: file_path:start_line-end_line
    const lineRange = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
    const contextText = `// ${selectedFile}:${lineRange}\n${codeSnippet}`;

    try {
      await navigator.clipboard.writeText(contextText);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Load git data (branch, status, diff, commits)
  const loadGitData = useCallback(async () => {
    if (!agent || !window.electronAPI?.shell?.exec) return;

    const projectPath = agent.worktreePath || agent.projectPath;
    setLoadingGit(true);

    try {
      // Run all git commands in parallel
      const [branchResult, statusResult, diffResult, logResult] = await Promise.all([
        // Current branch
        window.electronAPI.shell.exec({
          command: 'git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null',
          cwd: projectPath
        }),
        // Status (porcelain format)
        window.electronAPI.shell.exec({
          command: 'git status --porcelain 2>/dev/null',
          cwd: projectPath
        }),
        // Diff summary
        window.electronAPI.shell.exec({
          command: 'git diff --stat 2>/dev/null | tail -20',
          cwd: projectPath
        }),
        // Recent commits
        window.electronAPI.shell.exec({
          command: 'git log --oneline --pretty=format:"%h|%s|%an|%ar" -10 2>/dev/null',
          cwd: projectPath
        }),
      ]);

      // Parse branch
      const branch = branchResult.success && branchResult.output
        ? branchResult.output.replace(/\r/g, '').trim()
        : 'unknown';

      // Parse status
      const status: Array<{ status: string; file: string }> = [];
      if (statusResult.success && statusResult.output) {
        const lines = statusResult.output.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const statusCode = line.slice(0, 2);
          const file = line.slice(3).replace(/\r/g, '').trim();
          if (file) {
            let statusText = 'modified';
            if (statusCode.includes('A') || statusCode.includes('?')) statusText = 'added';
            else if (statusCode.includes('D')) statusText = 'deleted';
            else if (statusCode.includes('R')) statusText = 'renamed';
            else if (statusCode.includes('M')) statusText = 'modified';
            status.push({ status: statusText, file });
          }
        });
      }

      // Parse diff
      const diff = diffResult.success && diffResult.output
        ? diffResult.output.replace(/\r/g, '')
        : '';

      // Parse commits
      const commits: Array<{ hash: string; message: string; author: string; date: string }> = [];
      if (logResult.success && logResult.output) {
        const lines = logResult.output.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const parts = line.split('|');
          if (parts.length >= 4) {
            commits.push({
              hash: parts[0].replace(/\r/g, ''),
              message: parts[1].replace(/\r/g, ''),
              author: parts[2].replace(/\r/g, ''),
              date: parts[3].replace(/\r/g, ''),
            });
          }
        });
      }

      setGitData({ branch, status, diff, commits });
    } catch (err) {
      console.error('Failed to load git data:', err);
    } finally {
      setLoadingGit(false);
    }
  }, [agent]);

  // Open project in Cursor IDE
  const handleOpenInCursor = async () => {
    if (!agent || !window.electronAPI?.shell?.exec) return;
    const projectPath = agent.worktreePath || agent.projectPath;
    try {
      // Use 'open -a' on macOS to open Cursor with the project folder
      await window.electronAPI.shell.exec({
        command: `open -a "Cursor" "${projectPath}"`,
      });
    } catch (err) {
      console.error('Failed to open in Cursor:', err);
    }
  };

  // Handle text selection in code viewer for copy with context
  const handleCodeSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Get selected text range
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Find line numbers from the selection
    const startNode = range.startContainer.parentElement?.closest('[data-line]');
    const endNode = range.endContainer.parentElement?.closest('[data-line]');

    if (startNode && endNode) {
      const startLine = parseInt(startNode.getAttribute('data-line') || '1', 10);
      const endLine = parseInt(endNode.getAttribute('data-line') || '1', 10);
      return { startLine, endLine, text: selection.toString() };
    }

    return null;
  };

  // Load file tree when code panel is shown
  useEffect(() => {
    if (showCodePanel && agent && fileTree.length === 0) {
      loadFileTree();
    }
  }, [showCodePanel, agent, fileTree.length, loadFileTree]);

  // Load git data when git panel is shown
  useEffect(() => {
    if (showGitPanel && agent) {
      loadGitData();
    }
  }, [showGitPanel, agent, loadGitData]);

  // Resize terminal when code panel is toggled
  useEffect(() => {
    if (!terminalReady || !fitAddonRef.current || !xtermRef.current) return;

    const timeouts = [
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const id = agentIdRef.current;
          if (id && xtermRef.current && window.electronAPI?.agent?.resize) {
            window.electronAPI.agent.resize({
              id,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            }).catch(() => {});
          }
        }
      }, 50),
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      }, 200),
    ];

    return () => timeouts.forEach(clearTimeout);
  }, [showCodePanel, terminalReady]);

  // Store project path in ref to avoid re-renders
  const projectPathRef = useRef<string>('');
  useEffect(() => {
    if (agent) {
      projectPathRef.current = agent.worktreePath || agent.projectPath;
    }
  }, [agent?.id, agent?.worktreePath, agent?.projectPath]);

  // Initialize quick terminal when shown (persists across dialog open/close)
  useEffect(() => {
    const agentId = agent?.id;
    if (!showQuickTerminal || !agentId) return;

    // Skip if already initialized in this session
    if (quickXtermRef.current && quickPtyIdRef.current) {
      return;
    }

    const projectPath = projectPathRef.current;
    if (!projectPath) return;

    const initQuickTerminal = async () => {
      await new Promise(resolve => setTimeout(resolve, 150));

      if (!quickTerminalRef.current) return;

      // Skip if already initialized (race condition check)
      if (quickXtermRef.current) return;

      const rect = quickTerminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initQuickTerminal, 100);
        return;
      }

      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');

      const term = new Terminal({
        theme: {
          background: '#0f0f1a',
          foreground: '#e4e4e7',
          cursor: '#a855f7',
          cursorAccent: '#0f0f1a',
          selectionBackground: '#a855f733',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#22d3ee',
          white: '#e4e4e7',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#67e8f9',
          brightWhite: '#fafafa',
        },
        fontSize: 12,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      try {
        term.open(quickTerminalRef.current);
        quickXtermRef.current = term;
        quickFitAddonRef.current = fitAddon;

        fitAddon.fit();
        setTimeout(() => fitAddon.fit(), 100);
        setTimeout(() => {
          fitAddon.fit();
          term.focus();
        }, 250);

        // Check if we have an existing PTY for this agent
        const existing = persistentTerminals.get(agentId);

        if (existing) {
          // Reconnect to existing PTY
          quickPtyIdRef.current = existing.ptyId;
          setQuickTerminalReady(true);

          // Replay buffered output
          if (existing.outputBuffer.length > 0) {
            existing.outputBuffer.forEach(data => term.write(data));
          }

          // Resize to current terminal size
          if (window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: existing.ptyId, cols: term.cols, rows: term.rows });
          }
        } else if (window.electronAPI?.pty?.create) {
          // Create new PTY
          const { id: ptyId } = await window.electronAPI.pty.create({
            cwd: projectPath,
            cols: term.cols,
            rows: term.rows,
          });

          quickPtyIdRef.current = ptyId;

          // Store in persistent map
          persistentTerminals.set(agentId, { ptyId, outputBuffer: [] });

          setQuickTerminalReady(true);
        }

        // Handle terminal input - write to PTY
        term.onData(async (data) => {
          if (quickPtyIdRef.current && window.electronAPI?.pty?.write) {
            await window.electronAPI.pty.write({ id: quickPtyIdRef.current, data });
          }
        });

        // Handle resize
        term.onResize(({ cols, rows }) => {
          if (quickPtyIdRef.current && window.electronAPI?.pty?.resize) {
            window.electronAPI.pty.resize({ id: quickPtyIdRef.current, cols, rows });
          }
        });
      } catch (e) {
        console.error('Failed to initialize quick terminal:', e);
      }
    };

    initQuickTerminal();

    // Cleanup xterm UI only when hiding (NOT the PTY - it persists)
    return () => {
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    };
  }, [showQuickTerminal, agent?.id]);

  // Cleanup xterm UI when dialog closes (PTY stays alive)
  useEffect(() => {
    if (!open) {
      if (quickXtermRef.current) {
        quickXtermRef.current.dispose();
        quickXtermRef.current = null;
        quickFitAddonRef.current = null;
      }
      setQuickTerminalReady(false);
    }
  }, [open]);

  // Kill PTY only when explicitly closing the terminal (not dialog)
  const closeQuickTerminal = useCallback(() => {
    const agentId = agent?.id;
    if (agentId) {
      const existing = persistentTerminals.get(agentId);
      if (existing && window.electronAPI?.pty?.kill) {
        window.electronAPI.pty.kill({ id: existing.ptyId });
        persistentTerminals.delete(agentId);
      }
    }
    if (quickXtermRef.current) {
      quickXtermRef.current.dispose();
      quickXtermRef.current = null;
      quickFitAddonRef.current = null;
    }
    quickPtyIdRef.current = null;
    setQuickTerminalReady(false);
    setShowQuickTerminal(false);
  }, [agent?.id]);

  // Listen for quick terminal PTY output (buffer for reconnection)
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.pty?.onData) return;
    const agentId = agent?.id;

    const unsubscribe = window.electronAPI.pty.onData((event) => {
      // Check if this event is for any of our persistent terminals
      if (agentId) {
        const existing = persistentTerminals.get(agentId);
        if (existing && event.id === existing.ptyId) {
          // Buffer output for reconnection (limit buffer size)
          existing.outputBuffer.push(event.data);
          if (existing.outputBuffer.length > 1000) {
            existing.outputBuffer.shift();
          }

          // Write to terminal if active
          if (quickXtermRef.current) {
            quickXtermRef.current.write(event.data);
          }
        }
      }
    });

    return unsubscribe;
  }, [agent?.id]);

  if (!open || !agent) return null;

  // Use "frog" character for agent named "bitwonka"
  const character = agent.name?.toLowerCase() === 'bitwonka'
    ? 'frog'
    : (agent.character || 'robot');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`
            bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-2xl
            ${isFullscreen ? 'fixed inset-4' : (showCodePanel || showGitPanel) ? 'w-full max-w-7xl h-[80vh]' : 'w-full max-w-4xl h-[80vh]'}
            flex flex-col
          `}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between bg-bg-tertiary/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{CHARACTER_FACES[character]}</span>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {agent.name || 'Agent'}
                  <span
                    className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${agent.status === 'running' ? 'bg-accent-cyan/20 text-accent-cyan' : ''}
                      ${agent.status === 'idle' ? 'bg-text-muted/20 text-text-muted' : ''}
                      ${agent.status === 'completed' ? 'bg-accent-green/20 text-accent-green' : ''}
                      ${agent.status === 'error' ? 'bg-accent-red/20 text-accent-red' : ''}
                    `}
                  >
                    {agent.status}
                  </span>
                </h3>
                <p className="text-xs text-text-muted font-mono truncate max-w-md">
                  {agent.projectPath.split('/').pop()}
                  {agent.branchName && (
                    <span className="text-accent-purple ml-2">({agent.branchName})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCodePanel(!showCodePanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showCodePanel
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                }`}
                title={showCodePanel ? "Hide code panel" : "Show code panel"}
              >
                {showCodePanel ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
                Code
              </button>
              <button
                onClick={() => {
                  if (!showCodePanel) setShowCodePanel(true);
                  setShowQuickTerminal(!showQuickTerminal);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors relative ${
                  showQuickTerminal
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
                }`}
                title={showQuickTerminal ? "Hide terminal (process keeps running)" : "Open terminal"}
              >
                <TerminalSquare className="w-3.5 h-3.5" />
                Terminal
                {/* Active session indicator */}
                {agent && persistentTerminals.has(agent.id) && !showQuickTerminal && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setShowGitPanel(!showGitPanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showGitPanel
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                }`}
                title={showGitPanel ? "Hide git panel" : "Show git panel"}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Git
                {gitData.status.length > 0 && !showGitPanel && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-orange-500/30 rounded-full">
                    {gitData.status.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleOpenInFinder}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                title="Open in Finder"
              >
                <FolderOpen className="w-4 h-4 text-text-muted" />
              </button>
              <div className="w-px h-5 bg-border-primary mx-1" />
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Terminal + Code Panel */}
          <div className="flex-1 min-h-[300px] flex">
            {/* Terminal */}
            <div className={`relative ${
              showCodePanel && showGitPanel ? 'w-1/3 border-r border-border-primary' :
              showCodePanel || showGitPanel ? 'w-1/2 border-r border-border-primary' :
              'flex-1'
            }`}>
              <div
                ref={terminalRef}
                className="absolute inset-0 bg-[#1a1a2e] p-2"
                style={{ cursor: 'text', minHeight: '300px' }}
                onClick={() => xtermRef.current?.focus()}
              />
              {!terminalReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-cyan" />
                </div>
              )}
            </div>

            {/* Git Panel */}
            {showGitPanel && (
              <div className={`${showCodePanel ? 'w-1/3' : 'w-1/2'} flex flex-col bg-[#0d0d14] border-r border-border-primary overflow-hidden`}>
                {/* Git Panel Header */}
                <div className="px-3 py-2 border-b border-border-primary bg-bg-tertiary/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium text-text-primary">Git</span>
                    <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
                      {gitData.branch || 'loading...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleOpenInCursor}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                      title="Open project in Cursor"
                    >
                      <Code2 className="w-3 h-3" />
                      Cursor
                    </button>
                    <button
                      onClick={loadGitData}
                      className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loadingGit ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {loadingGit && gitData.status.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Changed Files */}
                    <div className="border-b border-border-primary shrink-0">
                      <div className="px-3 py-2 bg-bg-tertiary/20">
                        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                          <FileDiff className="w-3.5 h-3.5" />
                          <span>Changes</span>
                          {gitData.status.length > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                              {gitData.status.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {gitData.status.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-text-muted text-center">
                          No changes
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          {gitData.status.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-tertiary/30"
                            >
                              {item.status === 'added' && <Plus className="w-3 h-3 text-green-400 shrink-0" />}
                              {item.status === 'deleted' && <Minus className="w-3 h-3 text-red-400 shrink-0" />}
                              {item.status === 'modified' && <FileDiff className="w-3 h-3 text-amber-400 shrink-0" />}
                              {item.status === 'renamed' && <FileText className="w-3 h-3 text-blue-400 shrink-0" />}
                              <span className={`truncate ${
                                item.status === 'added' ? 'text-green-400' :
                                item.status === 'deleted' ? 'text-red-400' :
                                item.status === 'modified' ? 'text-amber-400' :
                                'text-blue-400'
                              }`}>
                                {item.file}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Commits - Collapsed by default */}
                    <div className="shrink-0 border-t border-border-primary">
                        <button
                          onClick={() => setShowCommits(!showCommits)}
                          className="w-full px-3 py-2 bg-bg-tertiary/20 flex items-center justify-between hover:bg-bg-tertiary/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                            <GitCommit className="w-3.5 h-3.5" />
                            <span>Recent Commits</span>
                            {gitData.commits.length > 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                                {gitData.commits.length}
                              </span>
                            )}
                          </div>
                          {showCommits ? (
                            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                          )}
                        </button>
                        {showCommits && (
                          <>
                            {gitData.commits.length === 0 ? (
                              <div className="px-3 py-4 text-xs text-text-muted text-center">
                                No commits
                              </div>
                            ) : (
                              <div className="max-h-40 overflow-y-auto">
                                {gitData.commits.map((commit, idx) => (
                                  <div
                                    key={idx}
                                    className="px-3 py-2 border-b border-border-primary/50 last:border-0 hover:bg-bg-tertiary/30"
                                  >
                                    <div className="flex items-center gap-2">
                                      <code className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                                        {commit.hash}
                                      </code>
                                      <span className="text-xs text-text-primary truncate flex-1">
                                        {commit.message}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted">
                                      <span className="flex items-center gap-1">
                                        <User className="w-2.5 h-2.5" />
                                        {commit.author}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {commit.date}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                  </div>
                )}
              </div>
            )}

            {/* Code Panel */}
            {showCodePanel && (
              <div className={`${showGitPanel ? 'w-1/3' : 'w-1/2'} flex flex-col bg-[#0d0d14]`}>
                {/* Search Bar */}
                <div className="px-2 py-2 border-b border-border-primary bg-bg-tertiary/30">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 flex items-center gap-1 bg-bg-primary rounded-md px-2 py-1">
                      {searchMode === 'file' ? (
                        <Search className="w-3 h-3 text-text-muted shrink-0" />
                      ) : (
                        <FileSearch className="w-3 h-3 text-text-muted shrink-0" />
                      )}
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={searchMode === 'file' ? "Search files..." : "Search in files..."}
                        className="flex-1 bg-transparent text-xs outline-none text-text-primary placeholder:text-text-muted"
                      />
                      {isSearching && <Loader2 className="w-3 h-3 animate-spin text-text-muted" />}
                    </div>
                    <button
                      onClick={() => setSearchMode(searchMode === 'file' ? 'content' : 'file')}
                      className={`p-1.5 rounded transition-colors ${
                        searchMode === 'content' ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-bg-tertiary text-text-muted'
                      }`}
                      title={searchMode === 'file' ? "Switch to search in files" : "Switch to search files"}
                    >
                      <FileSearch className="w-3 h-3" />
                    </button>
                    <button
                      onClick={loadFileTree}
                      className="p-1.5 hover:bg-bg-tertiary rounded transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3 h-3 text-text-muted ${loadingFiles ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Split: File Tree + File Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* File Tree / Search Results */}
                  <div className="w-2/5 border-r border-border-primary overflow-y-auto">
                    {searchResults.length > 0 ? (
                      <div className="p-1">
                        <div className="px-2 py-1 text-[10px] text-text-muted uppercase tracking-wide">
                          {searchResults.length} results
                        </div>
                        {searchResults.map((result, idx) => (
                          <div
                            key={idx}
                            onClick={() => loadFileContent(result.path)}
                            className={`
                              flex flex-col gap-0.5 px-2 py-1 rounded cursor-pointer text-xs
                              ${selectedFile === result.path ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-bg-tertiary text-text-secondary'}
                            `}
                          >
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-text-muted shrink-0" />
                              <span className="truncate">{result.path.split('/').pop()}</span>
                              {result.line && (
                                <span className="text-[10px] text-cyan-400 shrink-0">:{result.line}</span>
                              )}
                            </div>
                            {result.match && (
                              <div className="text-[10px] text-text-muted truncate pl-4 font-mono">
                                {result.match}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setSearchResults([]);
                            setSearchQuery('');
                          }}
                          className="w-full mt-2 px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary"
                        >
                          Clear results
                        </button>
                      </div>
                    ) : loadingFiles ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                      </div>
                    ) : fileTree.length === 0 ? (
                      <div className="p-3 text-xs text-text-muted text-center">
                        No files found
                      </div>
                    ) : (
                      <div className="p-1">
                        <FileTreeNode
                          nodes={fileTree}
                          onSelect={loadFileContent}
                          onToggle={toggleFolder}
                          selectedFile={selectedFile}
                          gitStatus={gitStatus}
                          copyPath={copyPath}
                          copiedPath={copiedPath}
                        />
                      </div>
                    )}
                  </div>

                  {/* File Content + Quick Terminal */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* File Content */}
                    <div className={`${showQuickTerminal && !terminalMinimized ? 'h-1/2' : 'flex-1'} flex flex-col overflow-hidden`}>
                      {selectedFile ? (
                        <>
                          <div className="px-3 py-1.5 border-b border-border-primary bg-bg-tertiary/20 flex items-center justify-between">
                            <span className="text-xs text-text-muted truncate font-mono">
                              {selectedFile.split('/').pop()}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  const selection = handleCodeSelection();
                                  if (selection) {
                                    await copyCodeWithContext(selection.startLine, selection.endLine);
                                  } else {
                                    // Copy full file with path
                                    const contextText = `// ${selectedFile}\n${fileContent}`;
                                    await navigator.clipboard.writeText(contextText);
                                    setCopiedCode(true);
                                    setTimeout(() => setCopiedCode(false), 2000);
                                  }
                                }}
                                className="p-1 hover:bg-bg-tertiary rounded transition-colors flex items-center gap-1"
                                title="Copy code with file path (select text first for specific lines)"
                              >
                                {copiedCode ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <>
                                    <Code2 className="w-3 h-3 text-text-muted" />
                                    <span className="text-[10px] text-text-muted">Copy</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => copyPath(selectedFile)}
                                className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                                title="Copy path"
                              >
                                {copiedPath === selectedFile ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-text-muted" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-auto bg-[#0d0d14]">
                            {fileContent === 'Loading...' ? (
                              <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                              </div>
                            ) : (
                              <Highlight
                                theme={themes.nightOwl}
                                code={fileContent}
                                language={getLanguageFromPath(selectedFile)}
                              >
                                {({ style, tokens, getLineProps, getTokenProps }) => (
                                  <pre
                                    className="p-3 text-xs font-mono"
                                    style={{ ...style, background: 'transparent', margin: 0 }}
                                  >
                                    {tokens.map((line, i) => (
                                      <div
                                        key={i}
                                        {...getLineProps({ line })}
                                        data-line={i + 1}
                                        className="leading-relaxed hover:bg-white/5"
                                      >
                                        <span className="inline-block w-8 text-text-muted/40 select-none text-right pr-3">
                                          {i + 1}
                                        </span>
                                        {line.map((token, key) => (
                                          <span key={key} {...getTokenProps({ token })} />
                                        ))}
                                      </div>
                                    ))}
                                  </pre>
                                )}
                              </Highlight>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                          Select a file to view
                        </div>
                      )}
                    </div>

                    {/* Quick Terminal Panel */}
                    {showQuickTerminal && (
                      <div className={`${terminalMinimized ? 'h-8' : 'h-1/2'} border-t border-border-primary flex flex-col transition-all`}>
                        <div className="px-3 py-1.5 border-b border-border-primary bg-bg-tertiary/30 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-2">
                            <TerminalSquare className="w-3 h-3 text-cyan-400" />
                            <span className="text-xs font-medium text-text-secondary">Terminal</span>
                            <span className="text-[10px] text-text-muted font-mono">
                              {(agent.worktreePath || agent.projectPath).split('/').pop()}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setTerminalMinimized(!terminalMinimized)}
                              className="p-0.5 hover:bg-bg-tertiary rounded transition-colors"
                              title={terminalMinimized ? "Expand terminal" : "Minimize terminal"}
                            >
                              {terminalMinimized ? (
                                <ChevronUp className="w-3 h-3 text-text-muted" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-text-muted" />
                              )}
                            </button>
                            <button
                              onClick={closeQuickTerminal}
                              className="p-0.5 hover:bg-bg-tertiary rounded transition-colors"
                              title="Close terminal (kills process)"
                            >
                              <X className="w-3 h-3 text-text-muted" />
                            </button>
                          </div>
                        </div>
                        {!terminalMinimized && (
                          <div className="flex-1 relative">
                            <div
                              ref={quickTerminalRef}
                              className="absolute inset-0 bg-[#0f0f1a] p-1"
                              style={{ cursor: 'text' }}
                              onClick={() => quickXtermRef.current?.focus()}
                            />
                            {!quickTerminalReady && (
                              <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]">
                                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer / Controls */}
          <div className="px-5 py-3 border-t border-border-primary bg-bg-tertiary/30">
            {/* Warning for missing path */}
            {agent.pathMissing && (
              <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Project path no longer exists: <code className="font-mono text-xs">{agent.projectPath}</code></span>
              </div>
            )}
            {agent.status !== 'running' ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !agent.pathMissing && handleStart()}
                  placeholder={agent.pathMissing ? "Cannot start - path not found" : "Enter a task for this agent..."}
                  disabled={agent.pathMissing}
                  className={`flex-1 px-4 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm focus:outline-none focus:border-accent-cyan ${agent.pathMissing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  autoFocus={!agent.pathMissing}
                />
                <button
                  onClick={handleStart}
                  disabled={!prompt.trim() || agent.pathMissing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                    agent.pathMissing
                      ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                      : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Start
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-accent-cyan">
                  <TerminalIcon className="w-4 h-4" />
                  <span>Agent is working: {agent.currentTask?.slice(0, 50)}...</span>
                </div>
                <button
                  onClick={() => onStop(agent.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-red/20 text-accent-red rounded-lg hover:bg-accent-red/30 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
