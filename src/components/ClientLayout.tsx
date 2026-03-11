'use client';

import { useStore } from '@/store';
import Sidebar from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Download, ExternalLink, RotateCw, Loader2 } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/** Strip HTML tags and collapse whitespace so release notes render as plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|div|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  hasUpdate: boolean;
  downloadUrl?: string;
  releaseUrl?: string;
}

type UpdateFlowState = 'available' | 'downloading' | 'ready' | 'restarting';

const VAULT_READ_DOCS_KEY = 'vault-read-docs';

function loadVaultReadDocs(): Set<string> {
  try {
    const stored = localStorage.getItem(VAULT_READ_DOCS_KEY);
    if (stored) return new Set(JSON.parse(stored));
    return new Set();
  } catch {
    return new Set();
  }
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Tray panel is a standalone Electron popup — render without sidebar/chrome
  if (pathname?.startsWith('/tray-panel')) {
    return <>{children}</>;
  }

  return <ClientLayoutInner>{children}</ClientLayoutInner>;
}

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, mobileMenuOpen, setMobileMenuOpen, darkMode, setDarkMode, setVaultUnreadCount } = useStore();
  const isMobile = useIsMobile();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateFlowState, setUpdateFlowState] = useState<UpdateFlowState>('available');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const downloadClickedRef = useRef(false);

  // Listen for auto-check update available event from main process
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.updates) return;
    const unsubs: (() => void)[] = [];

    if (window.electronAPI.updates.onUpdateAvailable) {
      unsubs.push(window.electronAPI.updates.onUpdateAvailable((info) => {
        if (info.hasUpdate) {
          setUpdateInfo(info);
          setUpdateDismissed(false);
          setUpdateFlowState('available');
          downloadClickedRef.current = false;
        }
      }));
    }

    if (window.electronAPI.updates.onDownloadProgress) {
      unsubs.push(window.electronAPI.updates.onDownloadProgress((progress) => {
        setDownloadPercent(progress.percent);
        setDownloadSpeed(progress.bytesPerSecond);
      }));
    }

    if (window.electronAPI.updates.onUpdateDownloaded) {
      unsubs.push(window.electronAPI.updates.onUpdateDownloaded(() => {
        setUpdateFlowState('ready');
      }));
    }

    if (window.electronAPI.updates.onUpdateError) {
      unsubs.push(window.electronAPI.updates.onUpdateError(() => {
        setUpdateFlowState('available');
        downloadClickedRef.current = false;
      }));
    }

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const isFallbackUpdate = !!(updateInfo?.downloadUrl);

  const handleDownloadUpdate = useCallback(() => {
    if (downloadClickedRef.current) return;
    downloadClickedRef.current = true;
    if (isFallbackUpdate && updateInfo?.downloadUrl) {
      // Fallback mode: open browser (no in-app download available)
      window.electronAPI?.updates?.openExternal(updateInfo.downloadUrl);
      setUpdateDismissed(true);
    } else {
      setUpdateFlowState('downloading');
      setDownloadPercent(0);
      window.electronAPI?.updates?.download();
    }
  }, [isFallbackUpdate, updateInfo]);

  const handleQuitAndInstall = useCallback(() => {
    setUpdateFlowState('restarting');
    window.electronAPI?.updates?.quitAndInstall();
  }, []);

  // Initialize dark mode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dorothy-dark-mode');
    if (saved === 'true') {
      setDarkMode(true);
    }
  }, [setDarkMode]);

  // Sync dark class on <html> and persist to localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('dorothy-dark-mode', String(darkMode));
  }, [darkMode]);

  // Global vault unread badge: listen for new documents even when VaultView is not mounted
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.vault) return;

    // Compute initial unread count on app start
    const initUnread = async () => {
      try {
        const result = await window.electronAPI!.vault!.listDocuments();
        if (result?.documents) {
          const readIds = loadVaultReadDocs();
          // If localStorage key doesn't exist yet (first ever load), don't show badges
          if (localStorage.getItem(VAULT_READ_DOCS_KEY) === null) return;
          const unread = result.documents.filter((d: { id: string }) => !readIds.has(d.id)).length;
          setVaultUnreadCount(unread);
        }
      } catch {
        // Ignore
      }
    };
    initUnread();

    // Listen for real-time document creation — increment unread
    const unsub = window.electronAPI!.vault!.onDocumentCreated(() => {
      setVaultUnreadCount(useStore.getState().vaultUnreadCount + 1);
    });

    return unsub;
  }, [setVaultUnreadCount]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    if (!isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, mobileMenuOpen, setMobileMenuOpen]);

  const mainMarginLeft = isMobile ? 0 : (sidebarCollapsed ? 72 : 240);

  return (
    <div className="min-h-screen bg-bg-primary relative">
      {/* Full-width window drag bar at the very top (desktop only) */}
      <div className="window-drag hidden lg:block fixed top-0 left-0 right-0 h-7 z-[60]" />

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-bg-secondary border-b border-border-primary z-40 flex items-center px-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
            <img src="/dorothy-without-text.png" alt="Dorothy" className="w-full h-full object-cover scale-150" />
          </div>
          <span className="text-base font-semibold tracking-wide text-foreground" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>Dorothy</span>
        </div>
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop: always visible, Mobile: drawer */}
      <Sidebar isMobile={isMobile} />

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: mainMarginLeft }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="min-h-screen pt-16 lg:pt-0 p-4 lg:p-6 pb-6"
      >
        {children}
      </motion.main>

      {/* Update Available Dialog */}
      <AnimatePresence>
        {updateInfo && !updateDismissed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setUpdateDismissed(true)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <img src="/dorothy-without-text.png" alt="Dorothy" className="w-full h-full object-cover scale-150" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Update Available</h3>
                  <p className="text-sm text-muted-foreground">
                    Dorothy {updateInfo.latestVersion} is ready
                  </p>
                </div>
              </div>

              <div className="p-3 bg-secondary/50 border border-border rounded mb-4">
                <p className="text-sm text-muted-foreground">
                  You&apos;re currently on version <span className="font-mono font-medium text-foreground">{updateInfo.currentVersion}</span>
                </p>
              </div>

              {updateInfo.releaseNotes && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Release notes:</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-6">
                    {stripHtml(updateInfo.releaseNotes).slice(0, 400)}
                    {updateInfo.releaseNotes.length > 400 ? '...' : ''}
                  </p>
                </div>
              )}

              {/* Download progress bar */}
              {updateFlowState === 'downloading' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Downloading... {downloadPercent.toFixed(0)}%</span>
                    <span>{downloadSpeed > 0 ? `${(downloadSpeed / 1024 / 1024).toFixed(1)} MB/s` : ''}</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-300"
                      style={{ width: `${downloadPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {updateFlowState === 'available' && (
                  <button
                    onClick={handleDownloadUpdate}
                    className="flex-1 px-4 py-2 text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 rounded"
                  >
                    {isFallbackUpdate ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    Download Update
                  </button>
                )}

                {updateFlowState === 'downloading' && (
                  <button
                    disabled
                    className="flex-1 px-4 py-2 text-sm bg-foreground/50 text-background cursor-not-allowed flex items-center justify-center gap-2 rounded"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading...
                  </button>
                )}

                {updateFlowState === 'ready' && (
                  <button
                    onClick={handleQuitAndInstall}
                    className="flex-1 px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2 rounded"
                  >
                    <RotateCw className="w-4 h-4" />
                    Restart to Apply
                  </button>
                )}

                {updateFlowState === 'restarting' && (
                  <button
                    disabled
                    className="flex-1 px-4 py-2 text-sm bg-foreground/50 text-background cursor-not-allowed flex items-center justify-center gap-2 rounded"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Restarting...
                  </button>
                )}

                {updateFlowState !== 'restarting' && (
                  <button
                    onClick={() => setUpdateDismissed(true)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded"
                  >
                    Later
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
