'use client';
import { useCallback } from 'react';
import { InteriorContentProps } from '../types';
import { getAgentSpritePath } from '../constants';
import AgentBattleView from '../overlays/AgentBattleView';

export default function ClaudeLabContent({ onExit, onTalkToAgent, selectedNpcId, agents }: InteriorContentProps) {
  const agent = agents?.find(a => a.id === selectedNpcId) || null;
  const agentSpritePath = selectedNpcId ? getAgentSpritePath(selectedNpcId, agent?.name) : '';

  // Super agent check — no DELETE for super agents
  const agentNameLower = (agent?.name || '').toLowerCase();
  const isSuperAgent = agentNameLower.includes('super agent') || agentNameLower.includes('orchestrator');

  const actions = [
    { id: 'talk', label: 'TALK' },
    { id: 'return', label: 'RETURN' },
    ...(!isSuperAgent ? [{ id: 'delete', label: 'DELETE', color: '#f85858' }] : []),
  ];

  const handleAction = useCallback((actionId: string) => {
    if (actionId === 'talk') {
      if (selectedNpcId && onTalkToAgent) {
        onTalkToAgent(selectedNpcId);
      }
    } else if (actionId === 'delete') {
      if (selectedNpcId && window.electronAPI?.agent?.remove) {
        window.electronAPI.agent.remove(selectedNpcId).catch(() => { });
      }
      onExit();
    } else if (actionId === 'return') {
      onExit();
    }
  }, [onExit, selectedNpcId, onTalkToAgent]);

  if (!selectedNpcId || !agent) {
    onExit();
    return null;
  }

  return (
    <AgentBattleView
      agentName={agent.name}
      agentSpritePath={agentSpritePath}
      actions={actions}
      onAction={handleAction}
      onEscape={onExit}
    />
  );
}
