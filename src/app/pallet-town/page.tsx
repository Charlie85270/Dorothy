'use client';
import { useEffect } from 'react';
import PokemonGame from '@/components/PokemonGame';
import { useStore } from '@/store';

export default function PalletTownPage() {
  useEffect(() => {
    const previous = useStore.getState().sidebarCollapsed;
    useStore.setState({ sidebarCollapsed: true });
    return () => {
      useStore.setState({ sidebarCollapsed: previous });
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <PokemonGame />
    </div>
  );
}
