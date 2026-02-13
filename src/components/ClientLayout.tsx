'use client';

import { useStore } from '@/store';
import Sidebar from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Download, ExternalLink } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

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

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  releaseNotes: string;
  hasUpdate: boolean;
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, mobileMenuOpen, setMobileMenuOpen, darkMode, setDarkMode } = useStore();
  const isMobile = useIsMobile();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // Listen for auto-check update available event from main process
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.updates?.onUpdateAvailable) return;
    const unsub = window.electronAPI.updates.onUpdateAvailable((info) => {
      if (info.hasUpdate) {
        setUpdateInfo(info);
        setUpdateDismissed(false);
      }
    });
    return unsub;
  }, []);

  const handleOpenLink = useCallback((url: string) => {
    window.electronAPI?.updates?.openExternal(url);
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

  // Close mobile menu on resize to desktop
  useEffect(() => {
    if (!isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, mobileMenuOpen, setMobileMenuOpen]);

  const mainMarginLeft = isMobile ? 0 : (sidebarCollapsed ? 72 : 240);

  return (
    <div className="min-h-screen bg-bg-primary relative">
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
                    {updateInfo.releaseNotes.slice(0, 400)}
                    {updateInfo.releaseNotes.length > 400 ? '...' : ''}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenLink(updateInfo.downloadUrl || updateInfo.releaseUrl)}
                  className="flex-1 px-4 py-2 text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 rounded"
                >
                  <Download className="w-4 h-4" />
                  Download Update
                </button>
                <button
                  onClick={() => handleOpenLink(updateInfo.releaseUrl)}
                  className="px-4 py-2 text-sm border border-border hover:border-foreground text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 rounded"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setUpdateDismissed(true)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded"
                >
                  Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
