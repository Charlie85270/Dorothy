'use client';

import 'xterm/css/xterm.css';
import TrayPanel from '@/components/TrayPanel/TrayPanel';

// Override xterm's internal viewport scrollbar so it overlays rather than
// taking up layout space — prevents the scrollbar from reducing col count.
const XTERM_SCROLLBAR_FIX = `
  .xterm-viewport::-webkit-scrollbar { width: 4px; }
  .xterm-viewport::-webkit-scrollbar-track { background: transparent; }
  .xterm-viewport::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
  .xterm-viewport { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
`;

export default function TrayPanelPage() {
  return (
    <>
      <style>{XTERM_SCROLLBAR_FIX}</style>
      <TrayPanel />
    </>
  );
}
