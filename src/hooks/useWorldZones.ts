import { useState, useEffect, useRef } from 'react';
import type { GenerativeZone } from '@/types/world';

export function useWorldZones() {
  const [zones, setZones] = useState<GenerativeZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Initial load
    async function loadZones() {
      try {
        const result = await window.electronAPI?.world?.listZones();
        if (result?.zones && mountedRef.current) {
          setZones(result.zones as GenerativeZone[]);
        }
      } catch {
        // Ignore errors
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    }

    loadZones();

    // Subscribe to live updates
    const unsubUpdate = window.electronAPI?.world?.onZoneUpdated((zone: unknown) => {
      if (!mountedRef.current) return;
      const z = zone as GenerativeZone;
      setZones(prev => {
        const idx = prev.findIndex(p => p.id === z.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = z;
          return updated;
        }
        return [...prev, z];
      });
    });

    const unsubDelete = window.electronAPI?.world?.onZoneDeleted((event: { id: string }) => {
      if (!mountedRef.current) return;
      setZones(prev => prev.filter(z => z.id !== event.id));
    });

    return () => {
      mountedRef.current = false;
      unsubUpdate?.();
      unsubDelete?.();
    };
  }, []);

  return { zones, isLoading };
}
