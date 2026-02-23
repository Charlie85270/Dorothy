'use client';
import { useMemo, useCallback } from 'react';
import { InteriorContentProps, PokemonMenuItem } from '../types';
import { usePluginsDatabase } from '@/lib/plugins-database';
import { useClaude } from '@/hooks/useClaude';
import PokemonMenu from '../overlays/PokemonMenu';

export default function PluginShopContent({ onExit, onInstallPlugin }: InteriorContentProps) {
  const { data } = useClaude();
  const { plugins: PLUGINS_DATABASE } = usePluginsDatabase();

  // Get installed plugins from settings (same logic as plugins page)
  const installedPlugins = useMemo(() => {
    const enabledPlugins = data?.settings?.enabledPlugins || {};
    return Object.keys(enabledPlugins).filter(key => enabledPlugins[key]);
  }, [data?.settings?.enabledPlugins]);

  const isPluginInstalled = useCallback((name: string, marketplace: string) => {
    const fullName = `${name}@${marketplace}`;
    return installedPlugins.some(p =>
      p === fullName ||
      p.toLowerCase() === fullName.toLowerCase() ||
      p.startsWith(`${name}@`)
    );
  }, [installedPlugins]);

  const items: PokemonMenuItem[] = useMemo(() => {
    return PLUGINS_DATABASE.map((plugin, i) => ({
      id: `plugin-${i}`,
      name: plugin.name,
      description: plugin.description,
      category: plugin.category,
      repo: plugin.marketplace,
      badge: isPluginInstalled(plugin.name, plugin.marketplace) ? 'installed' as const : null,
    }));
  }, [PLUGINS_DATABASE, isPluginInstalled]);

  const actions = [
    { id: 'install', label: 'INSTALL' },
    { id: 'leave', label: 'LEAVE' },
  ];

  const handleAction = (actionId: string, item: PokemonMenuItem) => {
    if (actionId === 'install' && onInstallPlugin) {
      // Find the original plugin to build the install command
      const plugin = PLUGINS_DATABASE.find(p => p.name === item.name);
      if (plugin) {
        const command = `/plugin install ${plugin.name}@${plugin.marketplace}`;
        onInstallPlugin(command, plugin.name);
      }
    } else if (actionId === 'leave') {
      onExit();
    }
  };

  const leftPanel = (
    <div className="text-center">
      <img
        src="/pokemon/shop/vendor.png"
        alt="Vendor"
        className="mx-auto"
        style={{
          width: 64,
          height: 80,
          imageRendering: 'pixelated',
          objectFit: 'contain',
        }}
      />
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        marginTop: '4px',
      }}>
        Vendor
      </div>
    </div>
  );

  return (
    <PokemonMenu
      items={items}
      actions={actions}
      onAction={handleAction}
      onBack={onExit}
      leftPanelContent={leftPanel}
      title="PLUGINS"
    />
  );
}
