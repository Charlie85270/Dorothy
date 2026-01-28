'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  BarChart2,
} from 'lucide-react';
import { useStore } from '@/store';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard', shortcut: '1' },
  { href: '/agents', icon: Bot, label: 'Agents', shortcut: '2' },
  { href: '/projects', icon: FolderKanban, label: 'Projects', shortcut: '3' },
  { href: '/chats', icon: MessageSquare, label: 'Conversations', shortcut: '4' },
  { href: '/skills', icon: Sparkles, label: 'Skills', shortcut: '5' },
  { href: '/usage', icon: BarChart2, label: 'Usage', shortcut: '6' },
];

interface SidebarProps {
  isMobile?: boolean;
}

export default function Sidebar({ isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, setMobileMenuOpen } = useStore();

  // For mobile, sidebar is always expanded (240px) when open
  const sidebarWidth = isMobile ? 240 : (sidebarCollapsed ? 72 : 240);
  const showLabels = isMobile || !sidebarCollapsed;

  // Close mobile menu when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  // Desktop sidebar
  if (!isMobile) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-screen bg-bg-secondary border-r border-border-primary flex-col z-50 hidden lg:flex"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center glow-cyan">
              <Bot className="w-5 h-5 text-bg-primary" />
            </div>
            {showLabels && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="font-bold text-sm tracking-wide">CLAUDE</span>
                <span className="text-accent-cyan font-bold text-sm">.MGR</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${isActive
                    ? 'bg-accent-cyan/10 text-accent-cyan'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  }
                `}
              >
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-accent-cyan' : ''}`} />
                </div>
                {showLabels && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium flex-1"
                  >
                    {item.label}
                  </motion.span>
                )}
                {showLabels && (
                  <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.shortcut}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status indicator */}
        {showLabels && (
          <div className="px-4 py-3 border-t border-border-primary">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
              </span>
              <span>Claude Code Connected</span>
            </div>
          </div>
        )}

        {/* Settings & Collapse */}
        <div className="border-t border-border-primary">
          <Link
            href="/settings"
            className={`
              flex items-center gap-3 px-5 py-3 text-text-secondary hover:text-text-primary transition-colors
              ${pathname === '/settings' || pathname.startsWith('/settings/') ? 'text-accent-cyan' : ''}
            `}
          >
            <Settings className="w-5 h-5" />
            {showLabels && <span className="text-sm">Settings</span>}
          </Link>
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center gap-3 px-5 py-3 text-text-muted hover:text-text-primary transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </motion.aside>
    );
  }

  // Mobile sidebar (drawer)
  return (
    <AnimatePresence>
      {mobileMenuOpen && (
        <motion.aside
          initial={{ x: -sidebarWidth }}
          animate={{ x: 0 }}
          exit={{ x: -sidebarWidth }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="fixed left-0 top-0 h-screen bg-bg-secondary border-r border-border-primary flex flex-col z-50 lg:hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Logo */}
          <div className="h-14 flex items-center px-4 border-b border-border-primary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center glow-cyan">
                <Bot className="w-5 h-5 text-bg-primary" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-wide">CLAUDE</span>
                <span className="text-accent-cyan font-bold text-sm">.MGR</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-accent-cyan/10 text-accent-cyan'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    }
                  `}
                >
                  <div className="relative">
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-accent-cyan' : ''}`} />
                  </div>
                  <span className="text-sm font-medium flex-1">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Status indicator */}
          <div className="px-4 py-3 border-t border-border-primary">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
              </span>
              <span>Claude Code Connected</span>
            </div>
          </div>

          {/* Settings */}
          <div className="border-t border-border-primary">
            <Link
              href="/settings"
              onClick={handleNavClick}
              className={`
                flex items-center gap-3 px-5 py-3 text-text-secondary hover:text-text-primary transition-colors
                ${pathname === '/settings' || pathname.startsWith('/settings/') ? 'text-accent-cyan' : ''}
              `}
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm">Settings</span>
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
