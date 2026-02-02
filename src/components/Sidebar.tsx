'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  Puzzle,
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
  { href: '/plugins', icon: Puzzle, label: 'Plugins', shortcut: '6' },
  { href: '/usage', icon: BarChart2, label: 'Usage', shortcut: '7' },
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
        className="fixed left-0 top-0 h-screen bg-card border-r border-border flex-col z-50 hidden lg:flex"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white flex items-center justify-center">
              <Bot className="w-5 h-5 text-black" />
            </div>
            {showLabels && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="font-semibold text-sm tracking-wide text-foreground">Claude</span>
                <span className="text-muted-foreground font-semibold text-sm"> Manager</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 transition-all duration-150
                  ${isActive
                    ? 'bg-white text-black font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }
                `}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                </div>
                {showLabels && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm flex-1"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status indicator */}
        {showLabels && (
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>Claude Code Connected</span>
            </div>
          </div>
        )}

        {/* Settings & Collapse */}
        <div className="border-t border-border">
          <Link
            href="/settings"
            className={`
              flex items-center gap-3 px-5 py-3 transition-colors
              ${pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'bg-white text-black'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }
            `}
          >
            <Settings className="w-5 h-5" />
            {showLabels && <span className="text-sm">Settings</span>}
          </Link>
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center gap-3 px-5 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
          className="fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 lg:hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Logo */}
          <div className="h-14 flex items-center px-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div>
                <span className="font-semibold text-sm tracking-wide text-foreground">Claude</span>
                <span className="text-muted-foreground font-semibold text-sm"> Manager</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
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
                    group flex items-center gap-3 px-3 py-2.5 transition-all duration-150
                    ${isActive
                      ? 'bg-white text-black font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }
                  `}
                >
                  <div className="relative">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm flex-1">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Status indicator */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>Claude Code Connected</span>
            </div>
          </div>

          {/* Settings */}
          <div className="border-t border-border">
            <Link
              href="/settings"
              onClick={handleNavClick}
              className={`
                flex items-center gap-3 px-5 py-3 transition-colors
                ${pathname === '/settings' || pathname.startsWith('/settings/')
                  ? 'bg-white text-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }
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
