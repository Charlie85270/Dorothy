'use client';
import { useMemo } from 'react';
import { InteriorContentProps, PokemonMenuItem } from '../types';
import { SKILLS_DATABASE } from '@/lib/skills-database';
import { useClaude } from '@/hooks/useClaude';
import { useElectronSkills } from '@/hooks/useElectron';
import PokemonMenu from '../overlays/PokemonMenu';

export default function SkillDojoContent({ onExit, onInstallSkill }: InteriorContentProps) {
  const { data } = useClaude();
  const { installedSkills: electronSkills } = useElectronSkills();

  // Merge all installed skill sources (same logic as skills page)
  const installedSkillNames = useMemo(() => {
    const fromPlugins = (data?.plugins || []).map(p => p.name.toLowerCase());
    const fromClaudeSkills = (data?.skills || []).map(s => s.name.toLowerCase());
    const fromElectron = electronSkills.map(s => s.toLowerCase());
    return [...new Set([...fromPlugins, ...fromClaudeSkills, ...fromElectron])];
  }, [data?.plugins, data?.skills, electronSkills]);

  const isSkillInstalled = (name: string) => installedSkillNames.includes(name.toLowerCase());

  const items: PokemonMenuItem[] = useMemo(() => {
    return SKILLS_DATABASE.map(skill => ({
      id: `skill-${skill.rank}`,
      name: skill.name,
      description: skill.description || `${skill.category} skill from ${skill.repo}`,
      category: skill.category,
      installs: skill.installs,
      repo: skill.repo,
      badge: isSkillInstalled(skill.name) ? 'installed' as const : null,
    }));
  }, [installedSkillNames]);

  const actions = [
    { id: 'install', label: 'INSTALL' },
    { id: 'leave', label: 'LEAVE' },
  ];

  const handleAction = (actionId: string, item: PokemonMenuItem) => {
    if (actionId === 'install' && item.repo && onInstallSkill) {
      onInstallSkill(`${item.repo}/${item.name}`, item.name);
    } else if (actionId === 'leave') {
      onExit();
    }
  };

  const leftPanel = (
    <div className="text-center">
      <img
        src="/pokemon/chen.png"
        alt="Prof. Chen"
        className="mx-auto"
        style={{
          width: 80,
          height: 128,
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
        Prof. Chen
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
      title="SKILLS"
    />
  );
}
