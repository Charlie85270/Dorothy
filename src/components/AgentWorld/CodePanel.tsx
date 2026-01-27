'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Search,
  FileSearch,
  RefreshCw,
  Loader2,
  FileText,
  Folder,
  Copy,
  Check,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Code2,
} from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromPath, type FileNode } from './constants';

interface CodePanelProps {
  projectPath: string;
  className?: string;
}

// Memoized file tree node component
const FileTreeNode = memo(function FileTreeNode({
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
        const isModified = gitStatus.some((f) => node.path.endsWith(f));
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
              <span className={`truncate ${isModified ? 'text-amber-400' : ''}`}>{node.name}</span>
              {isModified && <GitBranch className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
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
});

// Build tree structure from flat paths - memoized helper
function buildFileTree(paths: string[], basePath: string): FileNode[] {
  const root: FileNode[] = [];
  const seen = new Set<string>();

  paths.forEach((relativePath) => {
    const cleanPath = relativePath.replace(/^\.\//, '').replace(/\r/g, '').trim();
    if (!cleanPath) return;

    const parts = cleanPath.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const pathKey = parts.slice(0, index + 1).join('/');

      if (seen.has(pathKey)) {
        const existing = current.find((n) => n.name === part);
        if (existing && existing.children) {
          current = existing.children;
        }
        return;
      }

      const existing = current.find((n) => n.name === part);

      if (existing) {
        if (existing.children) {
          current = existing.children;
        }
      } else {
        seen.add(pathKey);
        const fullPath = `${basePath}/${pathKey}`.replace(/\r/g, '');
        const isFile = isLast;
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
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }));
  };

  return sortNodes(root);
}

export default function CodePanel({ projectPath, className = '' }: CodePanelProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [gitStatus, setGitStatus] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'file' | 'content'>('file');
  const [searchResults, setSearchResults] = useState<
    Array<{ path: string; line?: number; match?: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load file tree from project directory
  const loadFileTree = useCallback(async () => {
    if (!projectPath || !window.electronAPI?.shell?.exec) return;

    setLoading(true);

    try {
      const result = await window.electronAPI.shell.exec({
        command: `find . -maxdepth 3 -type f 2>/dev/null | grep -v node_modules | grep -v '/\\.git' | grep -v '/dist/' | grep -v '/\\.next/' | grep -v __pycache__ | sort | head -300`,
        cwd: projectPath,
      });

      if (result.success && result.output) {
        const paths = result.output
          .split('\n')
          .map((p) => p.replace(/\r/g, '').trim())
          .filter((p) => p && p !== '.');
        const tree = buildFileTree(paths, projectPath);
        setFileTree(tree);
      }

      const gitResult = await window.electronAPI.shell.exec({
        command: 'git status --porcelain 2>/dev/null || echo ""',
        cwd: projectPath,
      });

      if (gitResult.success && gitResult.output) {
        const modified = gitResult.output
          .split('\n')
          .map((l) => l.replace(/\r/g, '').trim())
          .filter((l) => l)
          .map((l) => l.slice(3));
        setGitStatus(modified);
      }
    } catch (err) {
      console.error('Failed to load file tree:', err);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  // Load file content
  const loadFileContent = useCallback(async (filePath: string) => {
    if (!window.electronAPI?.shell?.exec) return;

    const cleanPath = filePath.replace(/\r/g, '').trim();
    setSelectedFile(cleanPath);
    setFileContent('Loading...');

    try {
      const result = await window.electronAPI.shell.exec({
        command: `cat "${cleanPath}" 2>/dev/null | head -500`,
      });

      if (result.success && result.output) {
        setFileContent(result.output.replace(/\r/g, ''));
      } else {
        setFileContent(result.error || 'Failed to load file');
      }
    } catch (err) {
      setFileContent('Error loading file');
    }
  }, []);

  // Copy path to clipboard
  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Toggle folder expansion - optimized to avoid full tree reconstruction
  const toggleFolder = useCallback((path: string) => {
    setFileTree((prev) => {
      const toggle = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
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
  }, []);

  // Search for files or content
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !projectPath || !window.electronAPI?.shell?.exec) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      if (searchMode === 'file') {
        const result = await window.electronAPI.shell.exec({
          command: `find . -maxdepth 5 -type f -iname "*${searchQuery}*" 2>/dev/null | grep -v node_modules | grep -v '/\\.git' | grep -v '/dist/' | grep -v '/\\.next/' | head -50`,
          cwd: projectPath,
        });

        if (result.success && result.output) {
          const files = result.output
            .split('\n')
            .map((p) => p.replace(/\r/g, '').trim().replace(/^\.\//, ''))
            .filter((p) => p)
            .map((p) => ({ path: `${projectPath}/${p}` }));
          setSearchResults(files);
        }
      } else {
        const result = await window.electronAPI.shell.exec({
          command: `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" --include="*.css" --include="*.md" "${searchQuery}" . 2>/dev/null | grep -v node_modules | grep -v '/\\.git' | head -50`,
          cwd: projectPath,
        });

        if (result.success && result.output) {
          const matches = result.output
            .split('\n')
            .map((line) => line.replace(/\r/g, '').trim())
            .filter((line) => line)
            .map((line) => {
              const colonIndex = line.indexOf(':');
              const secondColonIndex = line.indexOf(':', colonIndex + 1);
              if (colonIndex > 0 && secondColonIndex > colonIndex) {
                const filePath = line.slice(0, colonIndex).replace(/^\.\//, '');
                const lineNum = parseInt(line.slice(colonIndex + 1, secondColonIndex), 10);
                const match = line.slice(secondColonIndex + 1).trim();
                return {
                  path: `${projectPath}/${filePath}`,
                  line: lineNum,
                  match: match.slice(0, 100),
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
  }, [searchQuery, searchMode, projectPath]);

  // Copy code with file path context
  const copyCodeWithContext = useCallback(async () => {
    if (!selectedFile || !fileContent) return;

    const contextText = `// ${selectedFile}\n${fileContent}`;
    try {
      await navigator.clipboard.writeText(contextText);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [selectedFile, fileContent]);

  // Load file tree on mount
  useEffect(() => {
    if (fileTree.length === 0) {
      loadFileTree();
    }
  }, [loadFileTree, fileTree.length]);

  // Memoize syntax highlighting language
  const highlightLanguage = useMemo(() => {
    return selectedFile ? getLanguageFromPath(selectedFile) : 'typescript';
  }, [selectedFile]);

  return (
    <div className={`flex flex-col bg-[#0d0d14] ${className}`}>
      {/* Search Bar */}
      <div className="px-2 py-2 border-b border-border-primary bg-bg-tertiary/30 shrink-0">
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
              placeholder={searchMode === 'file' ? 'Search files...' : 'Search in files...'}
              className="flex-1 bg-transparent text-xs outline-none text-text-primary placeholder:text-text-muted"
            />
            {isSearching && <Loader2 className="w-3 h-3 animate-spin text-text-muted" />}
          </div>
          <button
            onClick={() => setSearchMode(searchMode === 'file' ? 'content' : 'file')}
            className={`p-1.5 rounded transition-colors ${
              searchMode === 'content'
                ? 'bg-purple-500/20 text-purple-400'
                : 'hover:bg-bg-tertiary text-text-muted'
            }`}
            title={searchMode === 'file' ? 'Switch to search in files' : 'Switch to search files'}
          >
            <FileSearch className="w-3 h-3" />
          </button>
          <button
            onClick={loadFileTree}
            className="p-1.5 hover:bg-bg-tertiary rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 text-text-muted ${loading ? 'animate-spin' : ''}`} />
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
                  key={`${result.path}-${idx}`}
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
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : fileTree.length === 0 ? (
            <div className="p-3 text-xs text-text-muted text-center">No files found</div>
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

        {/* File Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="px-3 py-1.5 border-b border-border-primary bg-bg-tertiary/20 flex items-center justify-between shrink-0">
                <span className="text-xs text-text-muted truncate font-mono">
                  {selectedFile.split('/').pop()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyCodeWithContext}
                    className="p-1 hover:bg-bg-tertiary rounded transition-colors flex items-center gap-1"
                    title="Copy code with file path"
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
                  <Highlight theme={themes.nightOwl} code={fileContent} language={highlightLanguage}>
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
      </div>
    </div>
  );
}
