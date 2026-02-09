'use client';
import { useCallback } from 'react';
import { NPC, GameAssets } from '../types';
import AgentBattleView from './AgentBattleView';

interface BattleOverlayProps {
  npc: NPC;
  assets: GameAssets;
  onAction: (action: 'talk' | 'info' | 'cancel' | 'delete') => void;
}

const ACTIONS = [
  { id: 'talk', label: 'TALK' },
  { id: 'info', label: 'INFO' },
  { id: 'cancel', label: 'CANCEL' },
  { id: 'delete', label: 'DELETE', color: '#f85858' },
];

export default function BattleOverlay({ npc, assets, onAction }: BattleOverlayProps) {
  const handleAction = useCallback((actionId: string) => {
    onAction(actionId as 'talk' | 'info' | 'cancel' | 'delete');
  }, [onAction]);

  return (
    <AgentBattleView
      agentName={npc.name}
      agentSpritePath={npc.spritePath || ''}
      actions={ACTIONS}
      onAction={handleAction}
      onEscape={() => onAction('cancel')}
    />
  );
}
