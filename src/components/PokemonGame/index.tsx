'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NPC, Building, Screen } from './types';
import { CHARACTER_POKEMON_MAP, POKEMON_SPRITE_COLS, INTERIOR_CONFIGS, getAgentSpritePath } from './constants';
import { useAssetLoader } from './hooks/useAssetLoader';
import GameCanvas from './GameCanvas';
import TitleScreen from './overlays/TitleScreen';
import DialogueBox from './overlays/DialogueBox';
import BattleOverlay from './overlays/BattleOverlay';
import AgentInfoCard from './overlays/AgentInfoCard';
import GameMenu from './overlays/GameMenu';
import BuildingInterior from './overlays/BuildingInterior';
import { renderLoadingScreen } from './renderer/uiRenderer';
import AgentTerminalDialog from '@/components/AgentWorld/AgentTerminalDialog';
import SkillInstallDialog from '@/components/SkillInstallDialog';
import PluginInstallDialog from '@/components/PluginInstallDialog';
import 'xterm/css/xterm.css';

// Try to import electron hooks - gracefully handle if not available
let useElectronAgentsHook: (() => { agents: any[]; isElectron: boolean; startAgent: (id: string, prompt: string, options?: any) => Promise<void>; stopAgent: (id: string) => Promise<void> }) | null = null;
let isElectronFn: (() => boolean) | null = null;
let useElectronFSHook: (() => { projects: { path: string; name: string }[]; openFolderDialog: () => Promise<string | null> }) | null = null;
try {
  const mod = require('@/hooks/useElectron');
  useElectronAgentsHook = mod.useElectronAgents;
  isElectronFn = mod.isElectron;
  useElectronFSHook = mod.useElectronFS;
} catch {
  // Not in Electron environment
}

interface AgentData {
  id: string;
  name: string;
  status: string;
  character?: string;
  assignedProject?: string;
}

function mapAgentsToNPCs(agents: AgentData[]): NPC[] {
  // Place agents at various positions on paths/open areas
  const agentPositions = [
    { x: 12, y: 7 }, { x: 22, y: 7 }, { x: 30, y: 7 },
    { x: 12, y: 12 }, { x: 22, y: 12 }, { x: 30, y: 12 },
    { x: 14, y: 17 }, { x: 22, y: 17 }, { x: 30, y: 17 },
    { x: 12, y: 23 },
  ];
  return agents.map((agent, i) => {
    const pos = agentPositions[i % agentPositions.length];
    const character = agent.character || 'robot';
    const pokemon = CHARACTER_POKEMON_MAP[character] || CHARACTER_POKEMON_MAP.robot;
    const spriteIndex = pokemon.row * POKEMON_SPRITE_COLS + pokemon.col;

    return {
      id: agent.id,
      name: agent.name,
      type: 'agent' as const,
      x: pos.x,
      y: pos.y,
      direction: 'down' as const,
      spriteIndex,
      spritePath: getAgentSpritePath(agent.id, agent.name),
      agentStatus: agent.status,
      agentProject: agent.assignedProject,
      dialogue: [
        `${agent.name} (${pokemon.name}) is here!`,
        `Status: ${agent.status}`,
        agent.assignedProject ? `Working on: ${agent.assignedProject}` : 'Not assigned to any project.',
      ],
    };
  });
}

export default function PokemonGame() {
  const router = useRouter();
  const { assets, loaded, progress } = useAssetLoader();
  const [screen, setScreen] = useState<Screen>('title');
  const [dialogueText, setDialogueText] = useState<string | null>(null);
  const [dialogueQueue, setDialogueQueue] = useState<string[]>([]);
  const [dialogueSpeaker, setDialogueSpeaker] = useState<string | undefined>();
  const [battleNPC, setBattleNPC] = useState<NPC | null>(null);
  const [showAgentInfo, setShowAgentInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeInterior, setActiveInterior] = useState<string | null>(null);

  // ── Same pattern as agents/page.tsx ──
  // Get real agents from Electron
  const electronAgents = useElectronAgentsHook ? useElectronAgentsHook() : null;
  const inElectron = isElectronFn ? isElectronFn() : false;
  const electronFS = useElectronFSHook ? useElectronFSHook() : null;

  // Agent terminal dialog state — same as agents/page.tsx editAgentId
  const [editAgentId, setEditAgentId] = useState<string | null>(null);

  // Skill install dialog state — same as skills/page.tsx
  const [skillInstallRepo, setSkillInstallRepo] = useState<string | null>(null);
  const [skillInstallTitle, setSkillInstallTitle] = useState('');

  // Plugin install dialog state — same as plugins/page.tsx
  const [pluginInstallCommand, setPluginInstallCommand] = useState<string | null>(null);
  const [pluginInstallTitle, setPluginInstallTitle] = useState('');

  const [agentNPCs, setAgentNPCs] = useState<NPC[]>([]);
  const [rawAgents, setRawAgents] = useState<AgentData[]>([]);

  useEffect(() => {
    if (inElectron && electronAgents) {
      // Use real agents from Electron (all agents, including idle/stopped)
      const mapped: AgentData[] = electronAgents.agents.map((a: any) => ({
        id: a.id,
        name: a.name || a.id,
        status: a.status,
        character: a.character,
        assignedProject: a.projectPath ? a.projectPath.split('/').pop() : undefined,
      }));
      setRawAgents(mapped);
      setAgentNPCs(mapAgentsToNPCs(mapped));
    } else {
      // No Electron — no agents
      setRawAgents([]);
      setAgentNPCs([]);
    }
  }, [inElectron, electronAgents?.agents]);

  // Title screen start
  const handleStart = useCallback(() => {
    setScreen('game');
  }, []);

  // Building interaction
  const handleInteractBuilding = useCallback((building: Building) => {
    // If building has an interior, enter it directly
    if (building.interiorId && INTERIOR_CONFIGS[building.interiorId]) {
      setActiveInterior(building.interiorId);
      setScreen('interior');
      return;
    }

    // No interior — show "closed" message
    setDialogueSpeaker(undefined);
    setDialogueText(`The ${building.label} is closed for now, but will open soon!`);
    setDialogueQueue([]);
  }, []);

  // Exit interior
  const handleExitInterior = useCallback(() => {
    setActiveInterior(null);
    setScreen('game');
  }, []);

  // NPC interaction
  const handleInteractNPC = useCallback((npc: NPC) => {
    if (npc.type === 'agent') {
      setBattleNPC(npc);
      setScreen('battle');
    } else {
      // Professor Chen - show dialogue
      setDialogueSpeaker(npc.name);
      if (npc.dialogue.length > 0) {
        setDialogueText(npc.dialogue[0]);
        setDialogueQueue(npc.dialogue.slice(1));
      }
    }
  }, []);

  // Dialogue advancement
  const handleDialogueAdvance = useCallback(() => {
    if (dialogueQueue.length > 0) {
      setDialogueText(dialogueQueue[0]);
      setDialogueQueue(prev => prev.slice(1));
    } else {
      setDialogueText(null);
      setDialogueQueue([]);
      setDialogueSpeaker(undefined);
      // Check if there's a pending route navigation
      const pendingRoute = (window as any).__pendingRoute;
      if (pendingRoute) {
        delete (window as any).__pendingRoute;
        router.push(pendingRoute);
      }
    }
  }, [dialogueQueue, router]);

  // ── Talk to agent — same as agents/page.tsx handleSelectAgent + setEditAgentId ──
  const handleTalkToAgent = useCallback((agentId: string) => {
    setEditAgentId(agentId);
    // Auto-start idle agents — same as agents/page.tsx handleSelectAgent
    if (electronAgents) {
      const agent = electronAgents.agents.find((a: any) => a.id === agentId);
      if (agent && (agent.status === 'idle' || agent.status === 'completed' || agent.status === 'error') && !agent.pathMissing) {
        setTimeout(() => {
          electronAgents.startAgent(agentId, '');
        }, 100);
      }
    }
  }, [electronAgents]);

  // Battle actions
  const handleBattleAction = useCallback((action: 'talk' | 'info' | 'cancel' | 'delete') => {
    if (action === 'cancel') {
      setBattleNPC(null);
      setShowAgentInfo(false);
      setScreen('game');
    } else if (action === 'talk' && battleNPC) {
      // Open agent terminal (same as Claude Lab)
      setBattleNPC(null);
      setShowAgentInfo(false);
      setScreen('game');
      handleTalkToAgent(battleNPC.id);
    } else if (action === 'info' && battleNPC) {
      // Show agent info card overlay
      setShowAgentInfo(true);
    } else if (action === 'delete' && battleNPC) {
      // Delete agent
      if (window.electronAPI?.agent?.remove) {
        window.electronAPI.agent.remove(battleNPC.id).catch(() => {});
      }
      setBattleNPC(null);
      setShowAgentInfo(false);
      setScreen('game');
    }
  }, [battleNPC, handleTalkToAgent]);

  // Menu toggle
  const handleMenuToggle = useCallback(() => {
    if (screen === 'game' && !dialogueText) {
      setShowMenu(prev => !prev);
      setScreen(prev => prev === 'game' ? 'menu' : 'game');
    } else if (screen === 'menu') {
      setShowMenu(false);
      setScreen('game');
    } else if (screen === 'battle') {
      setBattleNPC(null);
      setScreen('game');
    }
  }, [screen, dialogueText]);

  // ── Same as agents/page.tsx handleStartAgent ──
  const handleStartAgent = useCallback(async (agentId: string, prompt: string) => {
    if (electronAgents) {
      await electronAgents.startAgent(agentId, prompt);
    }
  }, [electronAgents]);

  // ── Same as agents/page.tsx stopAgent ──
  const handleStopAgent = useCallback(async (agentId: string) => {
    if (electronAgents) {
      await electronAgents.stopAgent(agentId);
    }
  }, [electronAgents]);

  // ── Install skill — same as skills/page.tsx handleDirectInstall ──
  const handleInstallSkill = useCallback((repo: string, title: string) => {
    setSkillInstallRepo(repo);
    setSkillInstallTitle(title);
  }, []);

  // ── Install plugin — same as plugins/page.tsx handleInstall ──
  const handleInstallPlugin = useCallback((command: string, title: string) => {
    setPluginInstallCommand(command);
    setPluginInstallTitle(title);
  }, []);

  // Loading state
  if (!loaded) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4" style={{ fontFamily: 'monospace' }}>
            Loading assets...
          </p>
          <div className="w-48 h-3 bg-gray-800 rounded-full overflow-hidden mx-auto">
            <div
              className="h-full bg-green-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm mt-2" style={{ fontFamily: 'monospace' }}>
            {progress}%
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      {/* Title Screen */}
      {screen === 'title' && (
        <TitleScreen titleImage={assets.title} onStart={handleStart} />
      )}

      {/* Game Canvas (renders behind overlays) */}
      {screen !== 'title' && (
        <GameCanvas
          assets={assets}
          agentNPCs={agentNPCs}
          onInteractBuilding={handleInteractBuilding}
          onInteractNPC={handleInteractNPC}
          onDialogueAdvance={handleDialogueAdvance}
          onMenuToggle={handleMenuToggle}
          screen={screen === 'menu' ? 'menu' : screen === 'battle' ? 'battle' : screen === 'interior' ? 'interior' : 'game'}
          dialogueText={dialogueText}
        />
      )}

      {/* Dialogue Box Overlay */}
      {dialogueText && screen === 'game' && (
        <DialogueBox
          text={dialogueText}
          speakerName={dialogueSpeaker}
          onAdvance={handleDialogueAdvance}
        />
      )}

      {/* Battle Overlay */}
      {screen === 'battle' && battleNPC && (
        <>
          <BattleOverlay
            npc={battleNPC}
            assets={assets}
            onAction={handleBattleAction}
          />
          {showAgentInfo && (
            <AgentInfoCard
              npc={battleNPC}
              skills={electronAgents?.agents.find((a: any) => a.id === battleNPC.id)?.skills}
              onClose={() => setShowAgentInfo(false)}
            />
          )}
        </>
      )}

      {/* Game Menu */}
      {screen === 'menu' && (
        <GameMenu onClose={() => {
          setShowMenu(false);
          setScreen('game');
        }} />
      )}

      {/* Building Interior */}
      {screen === 'interior' && activeInterior && INTERIOR_CONFIGS[activeInterior] && (
        <BuildingInterior
          interiorId={activeInterior}
          config={INTERIOR_CONFIGS[activeInterior]}
          assets={assets}
          onExit={handleExitInterior}
          agents={rawAgents}
          onTalkToAgent={handleTalkToAgent}
          onInstallSkill={handleInstallSkill}
          onInstallPlugin={handleInstallPlugin}
        />
      )}

      {/* Agent Terminal Dialog — same as agents/page.tsx */}
      <AgentTerminalDialog
        agent={editAgentId ? (electronAgents?.agents.find((a: any) => a.id === editAgentId) || null) : null}
        open={!!editAgentId}
        onClose={() => setEditAgentId(null)}
        onStart={handleStartAgent}
        onStop={handleStopAgent}
        projects={electronFS?.projects.map(p => ({ path: p.path, name: p.name })) || []}
        agents={electronAgents?.agents || []}
        onBrowseFolder={inElectron && electronFS ? electronFS.openFolderDialog : undefined}
      />

      {/* Skill Install Dialog — same as skills/page.tsx */}
      <SkillInstallDialog
        open={!!skillInstallRepo}
        repo={skillInstallRepo || ''}
        title={skillInstallTitle}
        onClose={() => {
          setSkillInstallRepo(null);
          setSkillInstallTitle('');
        }}
      />

      {/* Plugin Install Dialog — same as plugins/page.tsx */}
      <PluginInstallDialog
        open={!!pluginInstallCommand}
        command={pluginInstallCommand || ''}
        title={pluginInstallTitle}
        onClose={() => {
          setPluginInstallCommand(null);
          setPluginInstallTitle('');
        }}
      />
    </div>
  );
}
