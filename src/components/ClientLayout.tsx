'use client';

import { useStore } from '@/store';
import Sidebar from './Sidebar';
import { motion } from 'framer-motion';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useStore();

  return (
    <div className="min-h-screen bg-bg-primary grid-pattern noise-overlay relative">
      <Sidebar />
      <motion.main
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="min-h-screen p-6"
      >
        {children}
      </motion.main>
    </div>
  );
}
