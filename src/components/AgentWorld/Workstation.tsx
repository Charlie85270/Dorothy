'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface WorkstationProps {
  position: [number, number, number];
  rotation?: number; // Y-axis rotation to face center
  projectName: string;
  isActive?: boolean;
  agentWorking?: boolean;
}

export default function Workstation({
  position,
  rotation = 0,
  projectName,
  isActive,
  agentWorking,
}: WorkstationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const screenRef = useRef<THREE.Mesh>(null);

  // Screen content animation
  useFrame((state) => {
    if (!screenRef.current) return;
    const t = state.clock.getElapsedTime();

    // Screen flicker when active
    if (agentWorking && screenRef.current.material instanceof THREE.MeshStandardMaterial) {
      screenRef.current.material.emissiveIntensity = 0.5 + Math.sin(t * 10) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {/* Glass partition behind desk */}
      <group position={[0, 0, -0.4]}>
        {/* Glass panel */}
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[1.4, 1.4, 0.05]} />
          <meshStandardMaterial color="#BFDBFE" transparent opacity={0.25} flatShading />
        </mesh>
        {/* Frame - top */}
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[1.44, 0.04, 0.07]} />
          <meshStandardMaterial color="#64748B" flatShading />
        </mesh>
        {/* Frame - bottom */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.44, 0.04, 0.07]} />
          <meshStandardMaterial color="#64748B" flatShading />
        </mesh>
        {/* Frame - left */}
        <mesh position={[-0.7, 0.7, 0]}>
          <boxGeometry args={[0.04, 1.4, 0.07]} />
          <meshStandardMaterial color="#64748B" flatShading />
        </mesh>
        {/* Frame - right */}
        <mesh position={[0.7, 0.7, 0]}>
          <boxGeometry args={[0.04, 1.4, 0.07]} />
          <meshStandardMaterial color="#64748B" flatShading />
        </mesh>
      </group>

      {/* Desk - low poly wooden style */}
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.06, 0.55]} />
        <meshStandardMaterial color="#DEB887" flatShading />
      </mesh>

      {/* Desk legs - chunky low poly style */}
      {[[-0.42, -0.18], [0.42, -0.18], [-0.42, 0.18], [0.42, 0.18]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.17, z]} castShadow>
          <boxGeometry args={[0.08, 0.34, 0.08]} />
          <meshStandardMaterial color="#A0522D" flatShading />
        </mesh>
      ))}

      {/* Monitor stand */}
      <mesh position={[0, 0.45, -0.1]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#4A5568" flatShading />
      </mesh>

      {/* Monitor base */}
      <mesh position={[0, 0.41, -0.1]} castShadow>
        <boxGeometry args={[0.2, 0.02, 0.12]} />
        <meshStandardMaterial color="#4A5568" flatShading />
      </mesh>

      {/* Monitor frame */}
      <mesh position={[0, 0.7, -0.12]} castShadow>
        <boxGeometry args={[0.65, 0.42, 0.04]} />
        <meshStandardMaterial color="#2D3748" flatShading />
      </mesh>

      {/* Monitor screen */}
      <mesh ref={screenRef} position={[0, 0.7, -0.095]}>
        <boxGeometry args={[0.58, 0.35, 0.01]} />
        <meshStandardMaterial
          color={agentWorking ? '#1a1a2e' : '#0f0f1a'}
          emissive={agentWorking ? '#22d3ee' : '#333333'}
          emissiveIntensity={agentWorking ? 0.6 : 0.1}
          flatShading
        />
      </mesh>

      {/* Screen content when working */}
      {agentWorking && (
        <Html
          position={[0, 0.7, -0.08]}
          transform
          occlude
          distanceFactor={3}
          zIndexRange={[100, 0]}
          style={{
            width: '120px',
            height: '70px',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <div className="w-full h-full bg-[#0a0a0f] p-1 font-mono text-[5px] text-cyan-400 overflow-hidden rounded">
            <div className="animate-pulse space-y-0.5">
              <div className="text-green-400">$ claude working...</div>
              <div className="text-gray-400">Reading files...</div>
              <div className="text-purple-400">Analyzing code...</div>
              <div className="text-yellow-400">Making changes...</div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-1 h-1.5 bg-cyan-400 animate-pulse" />
              </div>
            </div>
          </div>
        </Html>
      )}

      {/* Keyboard - chunky low poly */}
      <mesh position={[0, 0.42, 0.12]} castShadow>
        <boxGeometry args={[0.35, 0.02, 0.12]} />
        <meshStandardMaterial color="#4A5568" flatShading />
      </mesh>
      {/* Keyboard keys suggestion */}
      <mesh position={[0, 0.435, 0.12]}>
        <boxGeometry args={[0.32, 0.01, 0.1]} />
        <meshStandardMaterial color="#374151" flatShading />
      </mesh>

      {/* Mouse */}
      <mesh position={[0.25, 0.42, 0.15]} castShadow>
        <boxGeometry args={[0.05, 0.02, 0.08]} />
        <meshStandardMaterial color="#4A5568" flatShading />
      </mesh>

      {/* Coffee mug */}
      <group position={[-0.35, 0.41, 0.1]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.035, 0.03, 0.07, 6]} />
          <meshStandardMaterial color="#FFFFFF" flatShading />
        </mesh>
        {/* Coffee inside */}
        <mesh position={[0, 0.025, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.02, 6]} />
          <meshStandardMaterial color="#4A3728" flatShading />
        </mesh>
        {/* Handle */}
        <mesh position={[0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.02, 0.006, 4, 6, Math.PI]} />
          <meshStandardMaterial color="#FFFFFF" flatShading />
        </mesh>
      </group>

      {/* Small plant on desk */}
      <group position={[0.38, 0.41, -0.15]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.035, 0.03, 0.06, 6]} />
          <meshStandardMaterial color="#8B4513" flatShading />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <dodecahedronGeometry args={[0.04, 0]} />
          <meshStandardMaterial color="#22C55E" flatShading />
        </mesh>
        <mesh position={[0.02, 0.08, 0.01]} castShadow>
          <dodecahedronGeometry args={[0.025, 0]} />
          <meshStandardMaterial color="#4ADE80" flatShading />
        </mesh>
      </group>

      {/* Project name label */}
      <Html
        position={[0, 1.05, 0]}
        center
        distanceFactor={8}
        zIndexRange={[100, 0]}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          className={`
            px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap
            shadow-lg transition-all
            ${agentWorking
              ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white'
              : 'bg-white/95 text-gray-700 border border-gray-200'}
          `}
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {projectName}
          {agentWorking && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <span className="text-[10px]">Active</span>
            </span>
          )}
        </div>
      </Html>

      {/* Glow effect when active */}
      {agentWorking && (
        <pointLight
          position={[0, 0.7, 0.3]}
          color="#22d3ee"
          intensity={0.5}
          distance={2}
        />
      )}

      {/* Chair - low poly style */}
      <group position={[0, 0, 0.5]}>
        {/* Seat */}
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.32, 0.05, 0.32]} />
          <meshStandardMaterial color="#E57373" flatShading />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0.52, -0.13]} castShadow>
          <boxGeometry args={[0.32, 0.35, 0.05]} />
          <meshStandardMaterial color="#E57373" flatShading />
        </mesh>
        {/* Chair stem */}
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.32, 6]} />
          <meshStandardMaterial color="#4A5568" flatShading />
        </mesh>
        {/* Chair base - star shape */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 5]} />
          <meshStandardMaterial color="#4A5568" flatShading />
        </mesh>
        {/* Wheels */}
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <mesh key={i} position={[Math.cos(rad) * 0.1, 0.02, Math.sin(rad) * 0.1]}>
              <sphereGeometry args={[0.02, 4, 4]} />
              <meshStandardMaterial color="#1a1a2e" flatShading />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
