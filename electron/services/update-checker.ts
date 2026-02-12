import { GITHUB_REPO } from '../constants';
import * as fs from 'fs';
import * as path from 'path';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  releaseNotes: string;
  hasUpdate: boolean;
}

function getCurrentVersion(): string {
  try {
    // Try reading from package.json in the app directory
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return pkg.version || '0.0.0';
    }
    // Fallback: try from app root
    const rootPackageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(rootPackageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
      return pkg.version || '0.0.0';
    }
  } catch {
    // ignore
  }
  return '0.0.0';
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Dorothy-App',
      },
    });

    if (!response.ok) {
      console.error(`GitHub API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    const tagName: string = data.tag_name || '';
    const latestVersion = tagName.replace(/^v/, '');
    const currentVersion = getCurrentVersion();

    const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;

    // Find a suitable download asset (prefer .dmg for macOS)
    let downloadUrl = '';
    if (data.assets && Array.isArray(data.assets)) {
      const dmgAsset = data.assets.find((a: { name: string }) => a.name.endsWith('.dmg'));
      const zipAsset = data.assets.find((a: { name: string }) => a.name.endsWith('.zip'));
      downloadUrl = (dmgAsset || zipAsset)?.browser_download_url || '';
    }

    return {
      currentVersion,
      latestVersion,
      downloadUrl: downloadUrl || data.html_url || '',
      releaseUrl: data.html_url || '',
      releaseNotes: data.body || '',
      hasUpdate,
    };
  } catch (err) {
    console.error('Failed to check for updates:', err);
    return null;
  }
}
