import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MemoryFile {
  name: string;
  path: string;
  content: string;
  size: number;
  lastModified: string;
  isEntrypoint: boolean; // true for MEMORY.md
}

export interface ProjectMemory {
  id: string;          // encoded dir name
  projectName: string; // last segment of decoded path
  projectPath: string; // decoded full path
  memoryDir: string;   // absolute path to memory/ dir
  files: MemoryFile[];
  totalSize: number;
  lastModified: string;
  hasMemory: boolean;
  provider: string;    // 'claude' | 'codex' | 'gemini'
}

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

/** All provider memory directories to scan */
const PROVIDER_MEMORY_DIRS: { provider: string; dir: string }[] = [
  { provider: 'claude', dir: CLAUDE_PROJECTS_DIR },
  // Codex and Gemini may store project memory in similar structures.
  // These are checked only if they exist — no error if missing.
  { provider: 'codex', dir: path.join(os.homedir(), '.codex', 'projects') },
  { provider: 'gemini', dir: path.join(os.homedir(), '.gemini', 'projects') },
];

/**
 * Validate that a file path is within any provider's projects directory.
 * Uses path.resolve + startsWith to prevent traversal bypasses.
 */
function isWithinProjectsDir(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return PROVIDER_MEMORY_DIRS.some(({ dir }) =>
    resolved.startsWith(dir + path.sep) || resolved === dir
  );
}

/**
 * Decode Claude's project directory name back to a filesystem path.
 * Encoding: absolute path with each '/' replaced by '-', prefixed with '-'.
 * e.g. '-Users-charlie-Documents-octav-server' → '/Users/charlie/Documents/octav-server'
 *
 * The naive replace-all approach breaks for directory names containing '-'
 * (e.g. 'octav-server' would wrongly become 'octav/server').
 * Instead we traverse the filesystem greedily: at each position we try the
 * longest possible hyphen-joined token that exists on disk, falling back to
 * shorter combinations if not found.
 */
function decodePath(dirName: string): string {
  const tokens = dirName.replace(/^-/, '').split('-');
  let resolved = '/';
  let i = 0;

  while (i < tokens.length) {
    let matched = false;
    // Try longest match first to handle directory names that contain '-'
    for (let len = tokens.length - i; len >= 1; len--) {
      const name = tokens.slice(i, i + len).join('-');
      const candidate = path.join(resolved, name);
      try {
        if (fs.existsSync(candidate)) {
          resolved = candidate;
          i += len;
          matched = true;
          break;
        }
      } catch {
        // ignore fs errors, try shorter
      }
    }
    if (!matched) {
      // Nothing found on disk — just append the single token as-is
      resolved = path.join(resolved, tokens[i]);
      i++;
    }
  }

  return resolved;
}

function getProjectName(decodedPath: string): string {
  return path.basename(decodedPath) || decodedPath;
}

function readMemoryFile(filePath: string): MemoryFile {
  const stat = fs.statSync(filePath);
  const name = path.basename(filePath);
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    content = '';
  }
  return {
    name,
    path: filePath,
    content,
    size: stat.size,
    lastModified: stat.mtime.toISOString(),
    isEntrypoint: name === 'MEMORY.md',
  };
}

export function listProjectMemories(): ProjectMemory[] {
  const results: ProjectMemory[] = [];

  for (const { provider, dir: projectsDir } of PROVIDER_MEMORY_DIRS) {
    if (!fs.existsSync(projectsDir)) continue;

    let entries;
    try {
      entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const memoryDir = path.join(projectsDir, entry.name, 'memory');
      const decodedPath = decodePath(entry.name);
      const projectName = getProjectName(decodedPath);

      const project: ProjectMemory = {
        id: `${provider}:${entry.name}`,
        projectName,
        projectPath: decodedPath,
        memoryDir,
        files: [],
        totalSize: 0,
        lastModified: '',
        hasMemory: false,
        provider,
      };

      if (fs.existsSync(memoryDir)) {
        try {
          const mdFiles = fs.readdirSync(memoryDir)
            .filter(f => f.endsWith('.md'))
            .sort((a, b) => {
              // MEMORY.md always first
              if (a === 'MEMORY.md') return -1;
              if (b === 'MEMORY.md') return 1;
              return a.localeCompare(b);
            });

          const files = mdFiles.map(f => readMemoryFile(path.join(memoryDir, f)));
          const totalSize = files.reduce((sum, f) => sum + f.size, 0);
          const lastModified = files.reduce((latest, f) =>
            f.lastModified > latest ? f.lastModified : latest, '');

          project.files = files;
          project.totalSize = totalSize;
          project.lastModified = lastModified;
          project.hasMemory = files.length > 0;
        } catch {
          // Skip unreadable directories
        }
      }

      results.push(project);
    }
  }

  // Sort: projects with memory first, then by lastModified desc
  return results.sort((a, b) => {
    if (a.hasMemory && !b.hasMemory) return -1;
    if (!a.hasMemory && b.hasMemory) return 1;
    return b.lastModified.localeCompare(a.lastModified);
  });
}

export function readMemoryFileContent(filePath: string): { content: string; error?: string } {
  try {
    if (!isWithinProjectsDir(filePath)) {
      return { content: '', error: 'Access denied: path outside Claude projects directory' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content };
  } catch (err) {
    return { content: '', error: err instanceof Error ? err.message : 'Failed to read file' };
  }
}

export function writeMemoryFileContent(filePath: string, content: string): { success: boolean; error?: string } {
  try {
    if (!isWithinProjectsDir(filePath)) {
      return { success: false, error: 'Access denied: path outside Claude projects directory' };
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to write file' };
  }
}

export function createMemoryFile(memoryDir: string, fileName: string, content: string = ''): { success: boolean; file?: MemoryFile; error?: string } {
  try {
    if (!isWithinProjectsDir(memoryDir)) {
      return { success: false, error: 'Access denied' };
    }
    // Reject path traversal in fileName
    if (fileName.includes('/') || fileName.includes('..')) {
      return { success: false, error: 'Invalid file name' };
    }
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    const filePath = path.join(memoryDir, fileName.endsWith('.md') ? fileName : `${fileName}.md`);
    if (fs.existsSync(filePath)) {
      return { success: false, error: 'File already exists' };
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, file: readMemoryFile(filePath) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create file' };
  }
}

export function deleteMemoryFile(filePath: string): { success: boolean; error?: string } {
  try {
    if (!isWithinProjectsDir(filePath)) {
      return { success: false, error: 'Access denied' };
    }
    if (path.basename(filePath) === 'MEMORY.md') {
      return { success: false, error: 'Cannot delete the main MEMORY.md entrypoint' };
    }
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete file' };
  }
}
