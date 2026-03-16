'use client';

import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { CHANGELOG, LATEST_RELEASE, WHATS_NEW_STORAGE_KEY } from '@/data/changelog';

export default function WhatsNewPage() {
  // Mark as seen when user visits this page
  useEffect(() => {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, String(LATEST_RELEASE.id));
    // Dispatch a storage event so Sidebar can react without a full reload
    window.dispatchEvent(new Event('whats-new-seen'));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">What&apos;s New</h1>
        <p className="text-sm text-muted-foreground">Release history and recent improvements to Dorothy</p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-8">
          {CHANGELOG.map((release, i) => (
            <div key={release.id} className="relative pl-8">
              {/* Timeline dot */}
              <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 ${
                i === 0
                  ? 'bg-primary border-primary'
                  : 'bg-card border-border'
              }`} />

              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-semibold text-base">v{release.version}</span>
                {i === 0 && (
                  <span className="text-[10px] font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                    Latest
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{formatDate(release.date)}</span>
              </div>

              <ul className="space-y-1.5">
                {release.updates.map((update, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                    <span>{update}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
