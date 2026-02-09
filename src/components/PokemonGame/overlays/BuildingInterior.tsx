'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { InteriorConfig, InteriorPhase, InteriorContentProps, InteriorNPC, TerminalConfig, GameAssets } from '../types';
import { INTERIOR_ROOM_CONFIGS, AGENT_GRID_POSITIONS, getAgentSpritePath } from '../constants';
import DialogueBox from './DialogueBox';
import InteriorRoom from './InteriorRoom';

// ── Content Registry ───────────────────────────────────────────────────────
// Each building's content component is registered here.
// To add a new interior: import the component and add it to this map.
import SkillDojoContent from '../interiors/SkillDojoContent';
import SettingsContent from '../interiors/SettingsContent';
import ClaudeLabContent from '../interiors/ClaudeLabContent';
import PluginShopContent from '../interiors/PluginShopContent';

const INTERIOR_CONTENT_REGISTRY: Record<string, React.ComponentType<InteriorContentProps>> = {
  skills: SkillDojoContent,
  settings: SettingsContent,
  'claude-lab': ClaudeLabContent,
  'plugin-shop': PluginShopContent,
};

// ── Agent data interface (matches what index.tsx provides) ─────────────────
interface AgentData {
  id: string;
  name: string;
  status: string;
  character?: string;
  assignedProject?: string;
}

// ── Component ──────────────────────────────────────────────────────────────
interface BuildingInteriorProps {
  interiorId: string;
  config: InteriorConfig;
  assets: GameAssets;
  onExit: () => void;
  agents?: AgentData[];
  onTalkToAgent?: (agentId: string) => void;
  onInstallSkill?: (repo: string, title: string) => void;
  onInstallPlugin?: (command: string, title: string) => void;
}

export default function BuildingInterior({ interiorId, config, assets, onExit, agents, onTalkToAgent, onInstallSkill, onInstallPlugin }: BuildingInteriorProps) {
  const [phase, setPhase] = useState<InteriorPhase>('entering');
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [selectedNpcId, setSelectedNpcId] = useState<string | undefined>();

  const roomConfig = INTERIOR_ROOM_CONFIGS[interiorId];

  // Compute dynamic InteriorNPCs from agents (for claude-lab)
  const interiorNPCs: InteriorNPC[] | undefined = useMemo(() => {
    if (interiorId !== 'claude-lab' || !agents || agents.length === 0) return undefined;
    return agents.slice(0, AGENT_GRID_POSITIONS.length).map((agent, i) => ({
      id: agent.id,
      x: AGENT_GRID_POSITIONS[i].x,
      y: AGENT_GRID_POSITIONS[i].y,
      spritePath: getAgentSpritePath(agent.id, agent.name),
      name: agent.name,
      status: agent.status,
      project: agent.assignedProject,
    }));
  }, [interiorId, agents]);

  // Entering fade-in → room
  useEffect(() => {
    if (phase !== 'entering') return;
    const timer = setTimeout(() => {
      setPhase('room');
    }, 300);
    return () => clearTimeout(timer);
  }, [phase]);

  // ESC during dialogue → back to room
  useEffect(() => {
    if (phase !== 'dialogue') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPhase('room');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase]);

  const dialogue = config.npcDialogue || [];

  // Player presses Space facing interaction point → start dialogue or go straight to content
  const handleNPCInteract = useCallback((npcId?: string) => {
    if (npcId) {
      // Dynamic NPC interaction (claude-lab agents)
      setSelectedNpcId(npcId);
      setPhase('content');
    } else if (dialogue.length > 0) {
      setDialogueIndex(0);
      setPhase('dialogue');
    } else {
      setPhase('content');
    }
  }, [dialogue.length]);

  // Dialogue advancement
  const handleDialogueAdvance = useCallback(() => {
    const nextIndex = dialogueIndex + 1;
    if (nextIndex < dialogue.length) {
      setDialogueIndex(nextIndex);
    } else {
      setPhase('content');
    }
  }, [dialogueIndex, dialogue.length]);

  // Content exit → back to room (player can walk around again or leave)
  const handleContentExit = useCallback(() => {
    setSelectedNpcId(undefined);
    setPhase('room');
  }, []);

  // Kept for interface compat — no-op since skills use onInstallSkill now
  const handleOpenTerminal = useCallback((_tc: TerminalConfig) => {}, []);

  const ContentComponent = INTERIOR_CONTENT_REGISTRY[interiorId];
  const isRoomVisible = phase !== 'entering';

  return (
    <div className="absolute inset-0 z-30 overflow-hidden" style={{ backgroundColor: '#000' }}>
      {/* Fade from black on enter */}
      {phase === 'entering' && (
        <div className="absolute inset-0 bg-black"
          style={{ animation: 'fadeOut 0.3s ease-out forwards' }} />
      )}

      {/* Walkable room canvas (stays mounted so player position is preserved) */}
      {isRoomVisible && roomConfig && (
        <InteriorRoom
          config={config}
          roomConfig={roomConfig}
          assets={assets}
          active={phase === 'room'}
          onInteractNPC={handleNPCInteract}
          onExit={onExit}
          interiorNPCs={interiorNPCs}
        />
      )}

      {/* Dialogue box (renders on top of room) */}
      {phase === 'dialogue' && dialogue.length > 0 && (
        <DialogueBox
          text={dialogue[dialogueIndex]}
          speakerName={config.npcName || ''}
          onAdvance={handleDialogueAdvance}
        />
      )}

      {/* Content overlay (renders on top of room) */}
      {phase === 'content' && ContentComponent && (
        <ContentComponent
          onExit={handleContentExit}
          onOpenTerminal={handleOpenTerminal}
          onTalkToAgent={onTalkToAgent}
          onInstallSkill={onInstallSkill}
          onInstallPlugin={onInstallPlugin}
          selectedNpcId={selectedNpcId}
          agents={agents?.map(a => ({ id: a.id, name: a.name, status: a.status, assignedProject: a.assignedProject }))}
        />
      )}

      {/* CSS animation */}
      <style jsx>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
