'use client';

import { useState, useEffect, useMemo, Suspense, useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import AgentCharacter from './AgentCharacter';
import Workstation from './Workstation';
import OfficeEnvironment from './OfficeEnvironment';
import AgentTerminalDialog from './AgentTerminalDialog';
import type { AgentStatus } from '@/types/electron';
import { useElectronAgents, useElectronFS, isElectron } from '@/hooks/useElectron';
import { Loader2, AlertCircle, Bot, Users, FolderOpen, Layers, AlertTriangle } from 'lucide-react';

// Calculate workstation positions in a semi-circle around the center
function getWorkstationPosition(index: number, total: number): { position: [number, number, number]; rotation: number } {
  const radius = 5;
  const startAngle = Math.PI * 0.25; // Start at 45 degrees
  const endAngle = Math.PI * 0.75; // End at 135 degrees
  const angleStep = total > 1 ? (endAngle - startAngle) / (total - 1) : 0;
  const angle = startAngle + angleStep * index;

  // Rotation to face the center (opposite of the angle)
  const rotation = angle - Math.PI / 2;

  return {
    position: [
      Math.cos(angle) * radius,
      0,
      -Math.sin(angle) * radius,
    ],
    rotation,
  };
}

// Cafeteria position - where idle agents hang out (updated to match new layout)
const CAFETERIA_CENTER: [number, number, number] = [-9, 0, 6];

// Calculate agent position based on status
// Now supports multiple agents at the same workstation
function getAgentPosition(
  agent: AgentStatus,
  workstationData: Map<string, { position: [number, number, number]; rotation: number }>,
  agentIndex: number, // Index of this agent among agents working on same project
  totalAgentsAtDesk: number, // Total agents working on same project
  idleAgentIndex: number, // Index among all idle agents
  totalIdleAgents: number // Total idle agents
): [number, number, number] {
  if (agent.status === 'running' || agent.status === 'waiting') {
    // Agent is working - position near workstation
    const wsData = workstationData.get(agent.projectPath);
    if (wsData) {
      const { position: wsPos, rotation } = wsData;
      // Calculate offset for multiple agents at same desk
      // Spread agents side by side relative to workstation orientation
      const spacing = 0.5;
      const totalWidth = (totalAgentsAtDesk - 1) * spacing;
      const localXOffset = agentIndex * spacing - totalWidth / 2;

      // Position behind the desk (in front of chair for the camera)
      // Transform local offset to world coordinates based on workstation rotation
      const localZ = 0.9; // Distance behind desk
      const worldX = wsPos[0] + localXOffset * Math.cos(rotation) + localZ * Math.sin(rotation);
      const worldZ = wsPos[2] - localXOffset * Math.sin(rotation) + localZ * Math.cos(rotation);

      return [worldX, 0, worldZ];
    }
  }

  // Idle agents go to the cafeteria!
  // Position them around the cafeteria tables (updated to match new cafeteria position at -9, 0, 6)
  const cafeteriaSpots: [number, number, number][] = [
    // Around first table (-10.5, 0, 7)
    [-11.2, 0, 7], [-10.5, 0, 6.3], [-10.5, 0, 7.7], [-9.8, 0, 7],
    // Around second table (-7.5, 0, 7)
    [-8.2, 0, 7], [-7.5, 0, 6.3], [-7.5, 0, 7.7], [-6.8, 0, 7],
    // Around third table (-9, 0, 7.8)
    [-9.7, 0, 7.8], [-9, 0, 7.1], [-9, 0, 8.5], [-8.3, 0, 7.8],
    // At the bar
    [-10.2, 0, 4.7], [-9.4, 0, 4.7], [-8.6, 0, 4.7], [-7.8, 0, 4.7],
    // Near vending machines
    [-6.5, 0, 5], [-6.5, 0, 5.8],
  ];

  // Use agent hash to pick a consistent spot
  const hash = agent.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const spotIndex = (hash + idleAgentIndex) % cafeteriaSpots.length;

  // Add small random offset to avoid exact overlap
  const offsetX = ((hash % 10) - 5) * 0.05;
  const offsetZ = (((hash >> 4) % 10) - 5) * 0.05;

  const spot = cafeteriaSpots[spotIndex];
  return [spot[0] + offsetX, spot[1], spot[2] + offsetZ];
}

// Animated agent that smoothly moves to target position
function AnimatedAgent({
  agent,
  targetPosition,
  isSelected,
  onClick,
  needsAttention,
}: {
  agent: AgentStatus;
  targetPosition: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  needsAttention: boolean;
}) {
  const positionRef = useRef<THREE.Vector3>(new THREE.Vector3(...targetPosition));
  const [currentPosition, setCurrentPosition] = useState<[number, number, number]>(targetPosition);
  const lastUpdateRef = useRef<[number, number, number]>(targetPosition);

  useFrame((_, delta) => {
    const target = new THREE.Vector3(...targetPosition);
    positionRef.current.lerp(target, Math.min(delta * 2, 1));

    // Only update state if position changed significantly (threshold: 0.01)
    const dx = Math.abs(positionRef.current.x - lastUpdateRef.current[0]);
    const dy = Math.abs(positionRef.current.y - lastUpdateRef.current[1]);
    const dz = Math.abs(positionRef.current.z - lastUpdateRef.current[2]);

    if (dx > 0.01 || dy > 0.01 || dz > 0.01) {
      const newPos: [number, number, number] = [
        positionRef.current.x,
        positionRef.current.y,
        positionRef.current.z,
      ];
      lastUpdateRef.current = newPos;
      setCurrentPosition(newPos);
    }
  });

  // Use "frog" character for agent named "bitwonka"
  const characterType = agent.name?.toLowerCase() === 'bitwonka'
    ? 'frog'
    : (agent.character || 'robot');

  return (
    <AgentCharacter
      position={currentPosition}
      character={characterType}
      name={agent.name || `Agent ${agent.id.slice(0, 4)}`}
      status={agent.status}
      isSelected={isSelected}
      onClick={onClick}
      needsAttention={needsAttention}
    />
  );
}

// Camera controller for focusing on agents
function CameraController({
  focusTarget,
  controlsRef,
}: {
  focusTarget: [number, number, number] | null;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (focusTarget && controlsRef.current) {
      // Animate camera to focus on agent
      const targetPosition = new THREE.Vector3(...focusTarget);
      const cameraOffset = new THREE.Vector3(3, 3, 5);
      const newCameraPosition = targetPosition.clone().add(cameraOffset);

      // Smoothly update controls target
      controlsRef.current.target.copy(targetPosition);
      camera.position.copy(newCameraPosition);
      controlsRef.current.update();
    }
  }, [focusTarget, camera, controlsRef]);

  return null;
}

// Scene content (inside Canvas)
function Scene({
  agents,
  selectedAgentId,
  onAgentClick,
  focusTarget,
}: {
  agents: AgentStatus[];
  selectedAgentId: string | null;
  onAgentClick: (agent: AgentStatus) => void;
  focusTarget: [number, number, number] | null;
}) {
  const controlsRef = useRef<any>(null);

  // Get unique project paths for workstations
  const uniqueProjects = useMemo(() => {
    const projectSet = new Set<string>();
    agents.forEach((agent) => projectSet.add(agent.projectPath));
    return Array.from(projectSet);
  }, [agents]);

  // Calculate workstation positions and rotations
  const workstationData = useMemo(() => {
    const data = new Map<string, { position: [number, number, number]; rotation: number }>();
    uniqueProjects.forEach((project, index) => {
      data.set(project, getWorkstationPosition(index, uniqueProjects.length));
    });
    return data;
  }, [uniqueProjects]);

  // Calculate agent positions at each workstation for collaborative seating
  const agentsByProject = useMemo(() => {
    const byProject = new Map<string, AgentStatus[]>();
    agents.forEach((agent) => {
      if (agent.status === 'running' || agent.status === 'waiting') {
        const existing = byProject.get(agent.projectPath) || [];
        existing.push(agent);
        byProject.set(agent.projectPath, existing);
      }
    });
    return byProject;
  }, [agents]);

  // Get list of idle agents for cafeteria positioning
  const idleAgents = useMemo(() => {
    return agents.filter((a) => a.status !== 'running' && a.status !== 'waiting');
  }, [agents]);

  // Get agent's index and total at its workstation
  const getAgentWorkstationInfo = (agent: AgentStatus): { index: number; total: number } => {
    if (agent.status !== 'running' && agent.status !== 'waiting') {
      return { index: 0, total: 1 };
    }
    const agentsAtDesk = agentsByProject.get(agent.projectPath) || [];
    const index = agentsAtDesk.findIndex((a) => a.id === agent.id);
    return { index: Math.max(0, index), total: agentsAtDesk.length };
  };

  // Get idle agent's index for cafeteria positioning
  const getIdleAgentInfo = (agent: AgentStatus): { index: number; total: number } => {
    const index = idleAgents.findIndex((a) => a.id === agent.id);
    return { index: Math.max(0, index), total: idleAgents.length };
  };

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[12, 10, 12]} fov={50} />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />
      <CameraController focusTarget={focusTarget} controlsRef={controlsRef} />

      {/* Bright office lighting - colorful interior */}
      <ambientLight intensity={0.8} color="#ffffff" />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        color="#FFFBEB"
      />
      {/* Fill light from windows */}
      <directionalLight
        position={[-15, 10, 0]}
        intensity={0.5}
        color="#E0F2FE"
      />
      {/* Hemisphere fill light */}
      <hemisphereLight
        color="#F8FAFC"
        groundColor="#E2E8F0"
        intensity={0.6}
      />

      {/* Subtle fog for depth - matches dark sky background */}
      <fog attach="fog" args={['#1a1a2e', 40, 80]} />

      {/* Office Environment */}
      <OfficeEnvironment />

      {/* Workstations */}
      {uniqueProjects.map((projectPath) => {
        const data = workstationData.get(projectPath)!;
        const projectName = projectPath.split('/').pop() || 'Project';
        const agentWorking = agents.some(
          (a) => a.projectPath === projectPath && (a.status === 'running' || a.status === 'waiting')
        );
        return (
          <Workstation
            key={projectPath}
            position={data.position}
            rotation={data.rotation}
            projectName={projectName}
            isActive={agentWorking}
            agentWorking={agentWorking}
          />
        );
      })}

      {/* Agents */}
      {agents.map((agent) => {
        const { index: workIndex, total: workTotal } = getAgentWorkstationInfo(agent);
        const { index: idleIndex, total: idleTotal } = getIdleAgentInfo(agent);
        const needsAttention = agent.status === 'waiting';
        return (
          <AnimatedAgent
            key={agent.id}
            agent={agent}
            targetPosition={getAgentPosition(agent, workstationData, workIndex, workTotal, idleIndex, idleTotal)}
            isSelected={selectedAgentId === agent.id}
            onClick={() => onAgentClick(agent)}
            needsAttention={needsAttention}
          />
        );
      })}

      {/* Center marker when no agents - floating crystal */}
      {agents.length === 0 && (
        <group position={[0, 0.8, 0]}>
          <mesh rotation={[0, Date.now() * 0.001, 0]}>
            <octahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial
              color="#22d3ee"
              emissive="#22d3ee"
              emissiveIntensity={0.5}
              flatShading
            />
          </mesh>
          <pointLight color="#22d3ee" intensity={0.5} distance={3} />
        </group>
      )}
    </>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #0a0a1a 0%, #1a1a2e 50%, #0d1117 100%)' }}>
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-cyan mx-auto mb-4" />
        <p className="text-text-secondary">Loading Open space...</p>
      </div>
    </div>
  );
}

// Generate consistent color for project based on name
const getProjectColor = (name: string) => {
  const colors = [
    { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' },
    { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
    { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30' },
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Agent list item component
function AgentListItem({
  agent,
  isSelected,
  onClick,
}: {
  agent: AgentStatus;
  isSelected: boolean;
  onClick: () => void;
}) {
  const needsAttention = agent.status === 'waiting';
  const statusColors: Record<string, string> = {
    running: 'bg-emerald-500',
    waiting: 'bg-amber-500',
    idle: 'bg-gray-400',
    stopped: 'bg-red-500',
  };

  const characterEmojis: Record<string, string> = {
    robot: '🤖',
    ninja: '🥷',
    wizard: '🧙',
    astronaut: '👨‍🚀',
    knight: '⚔️',
    pirate: '🏴‍☠️',
    alien: '👽',
    viking: '🛡️',
    frog: '🐸',
  };

  const projectName = agent.projectPath.split('/').pop() || 'Unknown';
  const projectColor = getProjectColor(projectName);

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-none text-left transition-all
        ${isSelected
          ? 'bg-accent-cyan/20 border border-accent-cyan'
          : 'bg-bg-tertiary hover:bg-bg-tertiary/80 border border-transparent'
        }
        ${needsAttention ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-bg-primary' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Character avatar */}
        <div className="relative">
          <div className={`w-10 h-10 rounded-none ${agent.name?.toLowerCase() === 'bitwonka' ? 'bg-accent-green/20' : 'bg-bg-secondary'} flex items-center justify-center text-xl`}>
            {agent.name?.toLowerCase() === 'bitwonka' ? '🐸' : (characterEmojis[agent.character || 'robot'] || '🤖')}
          </div>
          {/* Status dot */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-bg-primary ${statusColors[agent.status]}`}
          />
          {/* Attention indicator */}
          {needsAttention && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center animate-bounce">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary truncate">
              {agent.name || `Agent ${agent.id.slice(0, 6)}`}
            </span>
            {needsAttention && (
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="text-xs text-text-muted truncate mt-0.5">
            {agent.pathMissing ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Path not found
              </span>
            ) : (
              agent.currentTask?.slice(0, 40) || 'No active task'
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`
                text-[10px] px-1.5 py-0.5 rounded font-medium
                ${agent.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' : ''}
                ${agent.status === 'waiting' ? 'bg-amber-500/20 text-amber-400' : ''}
                ${agent.status === 'idle' ? 'bg-gray-500/20 text-gray-400' : ''}
                ${agent.status === 'error' ? 'bg-red-500/20 text-red-400' : ''}
              `}
            >
              {agent.status}
            </span>
            {/* Project badge */}
            <span
              className={`
                text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]
                ${projectColor.bg} ${projectColor.text}
              `}
              title={projectName}
            >
              {projectName}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// Main component
export default function AgentWorld() {
  const { agents, startAgent, stopAgent, refresh } = useElectronAgents();
  const { projects, openFolderDialog } = useElectronFS();
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<[number, number, number] | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null); // null = All

  // Get unique projects from agents
  const uniqueProjects = useMemo(() => {
    const projectSet = new Map<string, string>();
    agents.forEach((agent) => {
      const projectName = agent.projectPath.split('/').pop() || 'Unknown';
      projectSet.set(agent.projectPath, projectName);
    });
    return Array.from(projectSet.entries()).map(([path, name]) => ({ path, name }));
  }, [agents]);

  // Filter agents by selected project
  const filteredAgents = useMemo(() => {
    if (!projectFilter) return agents;
    return agents.filter(a => a.projectPath === projectFilter);
  }, [agents, projectFilter]);

  // Calculate agent positions for focusing
  const getAgentWorldPosition = useCallback((agent: AgentStatus): [number, number, number] => {
    // Simplified position calculation for camera focus
    if (agent.status === 'running' || agent.status === 'waiting') {
      // Working agents are near the center
      const workingAgents = agents.filter(a =>
        (a.status === 'running' || a.status === 'waiting') && a.projectPath === agent.projectPath
      );
      const index = workingAgents.findIndex(a => a.id === agent.id);
      const total = workingAgents.length;

      const uniqueProjects = Array.from(new Set(agents.map(a => a.projectPath)));
      const projectIndex = uniqueProjects.indexOf(agent.projectPath);
      const totalProjects = uniqueProjects.length;

      const radius = 5;
      const startAngle = Math.PI * 0.25;
      const endAngle = Math.PI * 0.75;
      const angleStep = totalProjects > 1 ? (endAngle - startAngle) / (totalProjects - 1) : 0;
      const angle = startAngle + angleStep * projectIndex;

      return [
        Math.cos(angle) * radius,
        0.5,
        -Math.sin(angle) * radius + 0.9,
      ];
    }

    // Idle agents in cafeteria
    return [-9, 0.5, 6];
  }, [agents]);

  const handleAgentClick = (agent: AgentStatus) => {
    setSelectedAgent(agent);
    setDialogOpen(true);
  };

  const handleAgentListClick = (agent: AgentStatus) => {
    setSelectedAgent(agent);
    setDialogOpen(true);
    // Focus camera on agent
    const pos = getAgentWorldPosition(agent);
    setFocusTarget(pos);
  };

  const handleStart = async (agentId: string, prompt: string) => {
    await startAgent(agentId, prompt);
  };

  const handleStop = async (agentId: string) => {
    await stopAgent(agentId);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAgent(null);
  };

  // Count agents needing attention
  const waitingCount = agents.filter(a => a.status === 'waiting').length;
  const runningCount = agents.filter(a => a.status === 'running').length;

  return (
    <div className="relative w-full h-full min-h-[600px] flex">
      {/* 3D Scene */}
      <div className="flex-1 relative">
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            shadows
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'linear-gradient(to bottom, #0a0a1a 0%, #1a1a2e 50%, #0d1117 100%)' }}
          >
            <Scene
              agents={agents}
              selectedAgentId={selectedAgent?.id || null}
              onAgentClick={handleAgentClick}
              focusTarget={focusTarget}
            />
          </Canvas>
        </Suspense>

        {/* Agent count indicator */}
        <div className="absolute top-4 left-4 px-4 py-2.5 bg-bg-secondary/90 backdrop-blur-sm border border-border-primary rounded-none shadow-lg">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-text-muted font-medium">Agents:</span>
            <span className="font-bold text-accent-cyan">{agents.length}</span>
            {runningCount > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {runningCount} working
              </span>
            )}
            {waitingCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <AlertCircle className="w-4 h-4" />
                {waitingCount} waiting
              </span>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 px-4 py-2.5 bg-bg-secondary/90 backdrop-blur-sm border border-border-primary rounded-none shadow-lg text-xs text-text-secondary">
          <p className="font-medium">Click on an agent to open terminal</p>
          <p className="text-text-muted mt-0.5">Drag to rotate | Scroll to zoom</p>
        </div>
      </div>

      {/* Agent List Panel - Right Side */}
      <div className="w-80 bg-bg-secondary border-l border-border-primary overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-cyan" />
              <h3 className="font-semibold text-text-primary">Active Agents</h3>
            </div>
            <div className="text-xs text-text-muted">
              {runningCount} running
              {waitingCount > 0 && (
                <span className="ml-2 text-amber-500 font-medium">
                  {waitingCount} waiting!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Project Filter Tabs */}
        {uniqueProjects.length > 0 && (
          <div className="p-2 border-b border-border-primary">
            <div className="flex flex-wrap gap-1.5">
              {/* All tab */}
              <button
                onClick={() => setProjectFilter(null)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-none text-xs font-medium transition-all
                  ${projectFilter === null
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                    : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-transparent'
                  }
                `}
              >
                <Layers className="w-3.5 h-3.5" />
                All
                <span className={`px-1 py-0.5 rounded text-[10px] ${projectFilter === null ? 'bg-accent-cyan/30' : 'bg-bg-secondary'
                  }`}>
                  {agents.length}
                </span>
              </button>

              {/* Project tabs */}
              {uniqueProjects.map(({ path, name }) => {
                const projectColor = getProjectColor(name);
                const agentCount = agents.filter(a => a.projectPath === path).length;
                const isActive = projectFilter === path;

                return (
                  <button
                    key={path}
                    onClick={() => setProjectFilter(path)}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1.5 rounded-none text-xs font-medium transition-all
                      ${isActive
                        ? `${projectColor.bg} ${projectColor.text} border ${projectColor.border}`
                        : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-transparent'
                      }
                    `}
                    title={path}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[80px]">{name}</span>
                    <span className={`px-1 py-0.5 rounded text-[10px] ${isActive ? `${projectColor.bg}` : 'bg-bg-secondary'
                      }`}>
                      {agentCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredAgents.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-text-muted text-sm">
                {agents.length === 0 ? 'No agents active' : 'No agents for this project'}
              </p>
              <p className="text-text-muted text-xs mt-1">
                {agents.length === 0 ? 'Start an agent from a project' : 'Select another project or "All"'}
              </p>
            </div>
          ) : (
            <>
              {/* Show waiting agents first */}
              {filteredAgents
                .sort((a, b) => {
                  if (a.status === 'waiting' && b.status !== 'waiting') return -1;
                  if (a.status !== 'waiting' && b.status === 'waiting') return 1;
                  if (a.status === 'running' && b.status !== 'running') return -1;
                  if (a.status !== 'running' && b.status === 'running') return 1;
                  return 0;
                })
                .map((agent) => (
                  <AgentListItem
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgent?.id === agent.id}
                    onClick={() => handleAgentListClick(agent)}
                  />
                ))}
            </>
          )}
        </div>
      </div>

      {/* Terminal Dialog */}
      <AgentTerminalDialog
        agent={selectedAgent}
        open={dialogOpen}
        onClose={handleCloseDialog}
        onStart={handleStart}
        onStop={handleStop}
        projects={projects}
        agents={agents}
        onBrowseFolder={isElectron() ? openFolderDialog : undefined}
        onAgentUpdated={refresh}
      />
    </div>
  );
}
