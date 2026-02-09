'use client';
import { useEffect } from 'react';
import PokemonGame from '@/components/PokemonGame';
import { useStore } from '@/store';

export default function PalletTownPage() {
  useEffect(() => {
    useStore.setState({ sidebarCollapsed: true });
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <PokemonGame />
    </div>
  );
}
