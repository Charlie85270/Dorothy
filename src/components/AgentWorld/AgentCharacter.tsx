'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentCharacter as CharacterType } from '@/types/electron';

// Character color schemes - bright and colorful
const CHARACTER_COLORS: Record<CharacterType, {
  skin: string;
  primary: string;
  secondary: string;
  accent: string;
  hair: string;
}> = {
  robot: { skin: '#C0C0C0', primary: '#3D9B94', secondary: '#1a1a2e', accent: '#FF6B6B', hair: '#4A5568' },
  ninja: { skin: '#FFD7B5', primary: '#1a1a2e', secondary: '#4A5568', accent: '#FF4444', hair: '#1a1a2e' },
  wizard: { skin: '#FFE4C9', primary: '#8B5CF6', secondary: '#312E81', accent: '#FFD700', hair: '#E5E5E5' },
  astronaut: { skin: '#FFD7B5', primary: '#FFFFFF', secondary: '#4A90D9', accent: '#FF6B35', hair: '#8B4513' },
  knight: { skin: '#FFD7B5', primary: '#9CA3AF', secondary: '#374151', accent: '#FFD700', hair: '#D4A373' },
  pirate: { skin: '#E0B896', primary: '#8B0000', secondary: '#1a1a2e', accent: '#FFD700', hair: '#1a1a2e' },
  alien: { skin: '#90EE90', primary: '#4ADE80', secondary: '#166534', accent: '#FF69B4', hair: '#22C55E' },
  viking: { skin: '#FFD7B5', primary: '#8B4513', secondary: '#D4A373', accent: '#FF6B35', hair: '#D97706' },
  frog: { skin: '#4ADE80', primary: '#22C55E', secondary: '#166534', accent: '#FACC15', hair: '#15803D' },
};

// Character emoji for dialog
export const CHARACTER_FACES: Record<CharacterType, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🪓',
  frog: '🐸',
};

interface AgentCharacterProps {
  position: [number, number, number];
  character: CharacterType;
  name: string;
  status: 'idle' | 'running' | 'waiting' | 'completed' | 'error';
  isSelected?: boolean;
  onClick?: () => void;
  needsAttention?: boolean;
}

export default function AgentCharacter({
  position,
  character,
  name,
  status,
  isSelected,
  onClick,
  needsAttention,
}: AgentCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const armLeftRef = useRef<THREE.Mesh>(null);
  const armRightRef = useRef<THREE.Mesh>(null);
  const legLeftRef = useRef<THREE.Mesh>(null);
  const legRightRef = useRef<THREE.Mesh>(null);

  const colors = CHARACTER_COLORS[character];
  const isWorking = status === 'running' || status === 'waiting';

  // Animation
  useFrame((state) => {
    if (!groupRef.current || !bodyRef.current) return;
    const t = state.clock.getElapsedTime();

    if (isWorking) {
      // Working animation - typing motion
      bodyRef.current.position.y = 0.5 + Math.sin(t * 3) * 0.02;

      // Arm typing animation
      if (armLeftRef.current && armRightRef.current) {
        armLeftRef.current.rotation.x = -0.5 + Math.sin(t * 8) * 0.2;
        armRightRef.current.rotation.x = -0.5 + Math.sin(t * 8 + Math.PI) * 0.2;
      }
    } else {
      // Idle animation - gentle breathing
      bodyRef.current.position.y = 0.5 + Math.sin(t * 1.5) * 0.015;

      // Idle arm swing
      if (armLeftRef.current && armRightRef.current) {
        armLeftRef.current.rotation.x = Math.sin(t * 1.5) * 0.1;
        armRightRef.current.rotation.x = Math.sin(t * 1.5 + Math.PI) * 0.1;
      }

      // Leg idle animation
      if (legLeftRef.current && legRightRef.current) {
        legLeftRef.current.rotation.x = Math.sin(t * 1.5) * 0.05;
        legRightRef.current.rotation.x = Math.sin(t * 1.5 + Math.PI) * 0.05;
      }
    }

    // Selection highlight pulse
    const baseScale = 1.8; // Must match characterScale
    if (isSelected) {
      groupRef.current.scale.setScalar(baseScale * (1 + Math.sin(t * 4) * 0.05));
    } else {
      groupRef.current.scale.setScalar(baseScale);
    }
  });

  // Character-specific accessories
  const renderAccessories = () => {
    switch (character) {
      case 'wizard':
        return (
          <group>
            {/* Wizard hat */}
            <mesh position={[0, 0.42, 0]} castShadow>
              <coneGeometry args={[0.18, 0.35, 6]} />
              <meshStandardMaterial color={colors.primary} flatShading />
            </mesh>
            <mesh position={[0, 0.24, 0]} castShadow>
              <cylinderGeometry args={[0.22, 0.22, 0.04, 6]} />
              <meshStandardMaterial color={colors.primary} flatShading />
            </mesh>
            {/* Star on hat */}
            <mesh position={[0, 0.55, 0.08]}>
              <octahedronGeometry args={[0.04, 0]} />
              <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.5} flatShading />
            </mesh>
          </group>
        );
      case 'ninja':
        return (
          <group>
            {/* Ninja mask/headband */}
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[0.25, 0.08, 0.22]} />
              <meshStandardMaterial color={colors.accent} flatShading />
            </mesh>
            {/* Headband tail */}
            <mesh position={[-0.18, 0.15, -0.05]} rotation={[0, 0, -0.5]} castShadow>
              <boxGeometry args={[0.15, 0.04, 0.02]} />
              <meshStandardMaterial color={colors.accent} flatShading />
            </mesh>
          </group>
        );
      case 'astronaut':
        return (
          <group>
            {/* Helmet */}
            <mesh position={[0, 0.12, 0]} castShadow>
              <sphereGeometry args={[0.18, 8, 8]} />
              <meshStandardMaterial color={colors.primary} flatShading transparent opacity={0.9} />
            </mesh>
            {/* Visor */}
            <mesh position={[0, 0.12, 0.1]}>
              <sphereGeometry args={[0.12, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#4A90D9" flatShading transparent opacity={0.6} />
            </mesh>
          </group>
        );
      case 'knight':
        return (
          <group>
            {/* Helmet */}
            <mesh position={[0, 0.18, 0]} castShadow>
              <sphereGeometry args={[0.15, 6, 6]} />
              <meshStandardMaterial color={colors.primary} flatShading metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Plume */}
            <mesh position={[0, 0.35, -0.05]} rotation={[0.3, 0, 0]} castShadow>
              <boxGeometry args={[0.04, 0.15, 0.08]} />
              <meshStandardMaterial color={colors.accent} flatShading />
            </mesh>
          </group>
        );
      case 'pirate':
        return (
          <group>
            {/* Pirate hat */}
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[0.28, 0.08, 0.2]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            <mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI]} castShadow>
              <coneGeometry args={[0.12, 0.12, 3]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            {/* Skull emblem */}
            <mesh position={[0, 0.24, 0.11]}>
              <sphereGeometry args={[0.03, 4, 4]} />
              <meshStandardMaterial color="#FFFFFF" flatShading />
            </mesh>
            {/* Eye patch */}
            <mesh position={[-0.06, 0.04, 0.14]}>
              <circleGeometry args={[0.03, 6]} />
              <meshStandardMaterial color="#1a1a2e" flatShading />
            </mesh>
          </group>
        );
      case 'viking':
        return (
          <group>
            {/* Viking helmet */}
            <mesh position={[0, 0.16, 0]} castShadow>
              <sphereGeometry args={[0.14, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={colors.primary} flatShading />
            </mesh>
            {/* Horns */}
            <mesh position={[-0.12, 0.18, 0]} rotation={[0, 0, 0.4]} castShadow>
              <coneGeometry args={[0.03, 0.12, 4]} />
              <meshStandardMaterial color="#F5F5DC" flatShading />
            </mesh>
            <mesh position={[0.12, 0.18, 0]} rotation={[0, 0, -0.4]} castShadow>
              <coneGeometry args={[0.03, 0.12, 4]} />
              <meshStandardMaterial color="#F5F5DC" flatShading />
            </mesh>
            {/* Beard */}
            <mesh position={[0, -0.08, 0.1]} castShadow>
              <boxGeometry args={[0.12, 0.1, 0.04]} />
              <meshStandardMaterial color={colors.hair} flatShading />
            </mesh>
          </group>
        );
      case 'alien':
        return (
          <group>
            {/* Big alien eyes (larger head already accounted for) */}
            {/* Antennae */}
            <mesh position={[-0.08, 0.25, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            <mesh position={[-0.08, 0.32, 0]}>
              <sphereGeometry args={[0.03, 4, 4]} />
              <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.5} flatShading />
            </mesh>
            <mesh position={[0.08, 0.25, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            <mesh position={[0.08, 0.32, 0]}>
              <sphereGeometry args={[0.03, 4, 4]} />
              <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.5} flatShading />
            </mesh>
          </group>
        );
      case 'frog':
        // Frog has its own body render, just return empty for accessories
        return null;
      case 'robot':
      default:
        return (
          <group>
            {/* Antenna */}
            <mesh position={[0, 0.28, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.1, 4]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color={colors.primary} emissive={colors.primary} emissiveIntensity={0.5} flatShading />
            </mesh>
            {/* Ear panels */}
            <mesh position={[-0.15, 0.08, 0]} castShadow>
              <boxGeometry args={[0.04, 0.08, 0.06]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            <mesh position={[0.15, 0.08, 0]} castShadow>
              <boxGeometry args={[0.04, 0.08, 0.06]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
          </group>
        );
    }
  };

  // Character scale - make them bigger and more visible
  const characterScale = 1.8;

  return (
    <group
      ref={groupRef}
      position={position}
      scale={characterScale}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Character body group */}
      <group ref={bodyRef} position={[0, 0.5, 0]}>
        {character === 'frog' ? (
          /* ============ FROG BODY ============ */
          <group>
            {/* Frog Body - round and wide */}
            <mesh position={[0, 0.05, 0]} castShadow>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshStandardMaterial color={colors.skin} flatShading />
            </mesh>

            {/* Lighter belly */}
            <mesh position={[0, 0, 0.15]}>
              <sphereGeometry args={[0.14, 8, 8]} />
              <meshStandardMaterial color="#A7F3D0" flatShading />
            </mesh>

            {/* Frog Head - connected to body */}
            <mesh position={[0, 0.2, 0.08]} castShadow>
              <sphereGeometry args={[0.16, 8, 8]} />
              <meshStandardMaterial color={colors.skin} flatShading />
            </mesh>

            {/* Bulging Eyes - on top of head */}
            {/* Left eye bulge */}
            <mesh position={[-0.1, 0.35, 0.08]} castShadow>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color={colors.skin} flatShading />
            </mesh>
            {/* Left eyeball white */}
            <mesh position={[-0.1, 0.35, 0.14]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial color="#FFFFFF" flatShading />
            </mesh>
            {/* Left pupil */}
            <mesh position={[-0.1, 0.35, 0.18]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color="#1a1a2e" flatShading />
            </mesh>
            {/* Left eye highlight */}
            <mesh position={[-0.09, 0.37, 0.19]}>
              <sphereGeometry args={[0.01, 4, 4]} />
              <meshStandardMaterial color="#FFFFFF" flatShading />
            </mesh>

            {/* Right eye bulge */}
            <mesh position={[0.1, 0.35, 0.08]} castShadow>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color={colors.skin} flatShading />
            </mesh>
            {/* Right eyeball white */}
            <mesh position={[0.1, 0.35, 0.14]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial color="#FFFFFF" flatShading />
            </mesh>
            {/* Right pupil */}
            <mesh position={[0.1, 0.35, 0.18]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color="#1a1a2e" flatShading />
            </mesh>
            {/* Right eye highlight */}
            <mesh position={[0.11, 0.37, 0.19]}>
              <sphereGeometry args={[0.01, 4, 4]} />
              <meshStandardMaterial color="#FFFFFF" flatShading />
            </mesh>

            {/* Wide frog mouth */}
            <mesh position={[0, 0.12, 0.2]}>
              <boxGeometry args={[0.2, 0.03, 0.02]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            {/* Smile curves */}
            {isWorking && (
              <mesh position={[0, 0.1, 0.2]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.08, 0.012, 4, 8, Math.PI]} />
                <meshStandardMaterial color="#E57373" flatShading />
              </mesh>
            )}

            {/* Nostrils */}
            <mesh position={[-0.04, 0.22, 0.22]}>
              <sphereGeometry args={[0.015, 4, 4]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            <mesh position={[0.04, 0.22, 0.22]}>
              <sphereGeometry args={[0.015, 4, 4]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>

            {/* Cheek blush */}
            <mesh position={[-0.12, 0.15, 0.18]}>
              <circleGeometry args={[0.03, 6]} />
              <meshStandardMaterial color="#FCA5A5" flatShading transparent opacity={0.5} />
            </mesh>
            <mesh position={[0.12, 0.15, 0.18]}>
              <circleGeometry args={[0.03, 6]} />
              <meshStandardMaterial color="#FCA5A5" flatShading transparent opacity={0.5} />
            </mesh>

            {/* Front legs - shorter, webbed */}
            <group position={[-0.18, -0.05, 0.1]}>
              <mesh ref={armLeftRef} rotation={[0.3, 0, 0.2]} castShadow>
                <boxGeometry args={[0.06, 0.12, 0.06]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Webbed hand */}
              <mesh position={[-0.02, -0.08, 0.04]} rotation={[0.5, 0, 0]} castShadow>
                <boxGeometry args={[0.08, 0.02, 0.08]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
            </group>

            <group position={[0.18, -0.05, 0.1]}>
              <mesh ref={armRightRef} rotation={[0.3, 0, -0.2]} castShadow>
                <boxGeometry args={[0.06, 0.12, 0.06]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Webbed hand */}
              <mesh position={[0.02, -0.08, 0.04]} rotation={[0.5, 0, 0]} castShadow>
                <boxGeometry args={[0.08, 0.02, 0.08]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
            </group>

            {/* Back legs - bent frog legs */}
            {/* Left back leg */}
            <group position={[-0.15, -0.12, -0.05]}>
              {/* Thigh */}
              <mesh ref={legLeftRef} rotation={[0.8, 0, 0.3]} castShadow>
                <boxGeometry args={[0.08, 0.15, 0.08]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Lower leg */}
              <mesh position={[-0.05, -0.12, 0.1]} rotation={[-0.5, 0, 0]} castShadow>
                <boxGeometry args={[0.07, 0.14, 0.07]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Webbed foot */}
              <mesh position={[-0.05, -0.22, 0.18]} rotation={[0.3, 0, 0]} castShadow>
                <boxGeometry args={[0.12, 0.02, 0.14]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
            </group>

            {/* Right back leg */}
            <group position={[0.15, -0.12, -0.05]}>
              {/* Thigh */}
              <mesh ref={legRightRef} rotation={[0.8, 0, -0.3]} castShadow>
                <boxGeometry args={[0.08, 0.15, 0.08]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Lower leg */}
              <mesh position={[0.05, -0.12, 0.1]} rotation={[-0.5, 0, 0]} castShadow>
                <boxGeometry args={[0.07, 0.14, 0.07]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Webbed foot */}
              <mesh position={[0.05, -0.22, 0.18]} rotation={[0.3, 0, 0]} castShadow>
                <boxGeometry args={[0.12, 0.02, 0.14]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
            </group>
          </group>
        ) : (
          /* ============ REGULAR HUMANOID BODY ============ */
          <group>
            {/* Head */}
            <group position={[0, 0.4, 0]}>
              {/* Main head - slightly rounder for cartoon look */}
              <mesh castShadow>
                <boxGeometry args={[0.28, 0.28, 0.25]} />
                <meshStandardMaterial color={colors.skin} flatShading />
              </mesh>

              {/* Cheeks - cute blush */}
              <mesh position={[-0.1, -0.02, 0.13]}>
                <circleGeometry args={[0.03, 6]} />
                <meshStandardMaterial color="#FFB6C1" flatShading transparent opacity={0.6} />
              </mesh>
              <mesh position={[0.1, -0.02, 0.13]}>
                <circleGeometry args={[0.03, 6]} />
                <meshStandardMaterial color="#FFB6C1" flatShading transparent opacity={0.6} />
              </mesh>

              {/* Eyes - bigger for cartoon effect */}
              <mesh position={[-0.06, 0.03, 0.126]}>
                <circleGeometry args={[0.045, 8]} />
                <meshStandardMaterial color="#FFFFFF" flatShading />
              </mesh>
              <mesh position={[-0.06, 0.03, 0.13]}>
                <circleGeometry args={[0.025, 6]} />
                <meshStandardMaterial color={character === 'alien' ? '#FF69B4' : '#3B2F2F'} flatShading />
              </mesh>
              <mesh position={[-0.055, 0.04, 0.135]}>
                <circleGeometry args={[0.008, 4]} />
                <meshStandardMaterial color="#FFFFFF" flatShading />
              </mesh>

              <mesh position={[0.06, 0.03, 0.126]}>
                <circleGeometry args={[0.045, 8]} />
                <meshStandardMaterial color="#FFFFFF" flatShading />
              </mesh>
              <mesh position={[0.06, 0.03, 0.13]}>
                <circleGeometry args={[0.025, 6]} />
                <meshStandardMaterial color={character === 'alien' ? '#FF69B4' : '#3B2F2F'} flatShading />
              </mesh>
              <mesh position={[0.065, 0.04, 0.135]}>
                <circleGeometry args={[0.008, 4]} />
                <meshStandardMaterial color="#FFFFFF" flatShading />
              </mesh>

              {/* Eyebrows */}
              <mesh position={[-0.06, 0.08, 0.125]} rotation={[0, 0, isWorking ? -0.2 : 0]}>
                <boxGeometry args={[0.05, 0.015, 0.01]} />
                <meshStandardMaterial color={colors.hair} flatShading />
              </mesh>
              <mesh position={[0.06, 0.08, 0.125]} rotation={[0, 0, isWorking ? 0.2 : 0]}>
                <boxGeometry args={[0.05, 0.015, 0.01]} />
                <meshStandardMaterial color={colors.hair} flatShading />
              </mesh>

              {/* Mouth - smile when working */}
              {isWorking ? (
                // Happy working mouth
                <mesh position={[0, -0.06, 0.126]}>
                  <torusGeometry args={[0.03, 0.008, 4, 8, Math.PI]} />
                  <meshStandardMaterial color="#E57373" flatShading />
                </mesh>
              ) : (
                // Neutral mouth
                <mesh position={[0, -0.06, 0.126]}>
                  <boxGeometry args={[0.04, 0.012, 0.01]} />
                  <meshStandardMaterial color="#E57373" flatShading />
                </mesh>
              )}

              {/* Hair/Top of head (for non-helmet characters) */}
              {!['astronaut', 'knight', 'wizard', 'viking', 'pirate', 'robot'].includes(character) && (
                <mesh position={[0, 0.15, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.06, 0.22]} />
                  <meshStandardMaterial color={colors.hair} flatShading />
                </mesh>
              )}

              {/* Accessories */}
              {renderAccessories()}
            </group>

            {/* Body/Torso */}
            <mesh position={[0, 0.1, 0]} castShadow>
              <boxGeometry args={[0.26, 0.26, 0.18]} />
              <meshStandardMaterial color={colors.primary} flatShading />
            </mesh>

            {/* Shirt collar detail */}
            <mesh position={[0, 0.22, 0.06]}>
              <boxGeometry args={[0.12, 0.04, 0.08]} />
              <meshStandardMaterial color={colors.skin} flatShading />
            </mesh>

            {/* Belt/waist detail */}
            <mesh position={[0, -0.02, 0]} castShadow>
              <boxGeometry args={[0.28, 0.05, 0.2]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>

            {/* Belt buckle */}
            <mesh position={[0, -0.02, 0.11]}>
              <boxGeometry args={[0.04, 0.03, 0.01]} />
              <meshStandardMaterial color={colors.accent} flatShading />
            </mesh>

            {/* Arms */}
            <group position={[-0.18, 0.1, 0]}>
              <mesh ref={armLeftRef} position={[0, 0, 0]} castShadow>
                <boxGeometry args={[0.08, 0.2, 0.08]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Hand */}
              <mesh position={[0, -0.12, 0]} castShadow>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshStandardMaterial color={colors.skin} flatShading />
              </mesh>
            </group>

            <group position={[0.18, 0.1, 0]}>
              <mesh ref={armRightRef} position={[0, 0, 0]} castShadow>
                <boxGeometry args={[0.08, 0.2, 0.08]} />
                <meshStandardMaterial color={colors.primary} flatShading />
              </mesh>
              {/* Hand */}
              <mesh position={[0, -0.12, 0]} castShadow>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshStandardMaterial color={colors.skin} flatShading />
              </mesh>
            </group>

            {/* Legs */}
            <mesh
              ref={legLeftRef}
              position={[-0.07, -0.18, 0]}
              castShadow
            >
              <boxGeometry args={[0.09, 0.18, 0.09]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>
            <mesh
              ref={legRightRef}
              position={[0.07, -0.18, 0]}
              castShadow
            >
              <boxGeometry args={[0.09, 0.18, 0.09]} />
              <meshStandardMaterial color={colors.secondary} flatShading />
            </mesh>

            {/* Feet/Shoes */}
            <mesh position={[-0.07, -0.29, 0.02]} castShadow>
              <boxGeometry args={[0.1, 0.04, 0.12]} />
              <meshStandardMaterial color={character === 'robot' ? colors.secondary : '#5D4037'} flatShading />
            </mesh>
            <mesh position={[0.07, -0.29, 0.02]} castShadow>
              <boxGeometry args={[0.1, 0.04, 0.12]} />
              <meshStandardMaterial color={character === 'robot' ? colors.secondary : '#5D4037'} flatShading />
            </mesh>
          </group>
        )}
      </group>

      {/* Shadow on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.2, 8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.15} />
      </mesh>

      {/* Name label */}
      <Html
        position={[0, 1.25, 0]}
        center
        distanceFactor={8}
        zIndexRange={[100, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className={`
            px-2 py-1 rounded-none text-xs font-bold whitespace-nowrap
            shadow-lg transition-all
            ${isWorking
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
              : 'bg-white/95 text-gray-800 border border-gray-200'}
          `}
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {CHARACTER_FACES[character]} {name}
          {isWorking && (
            <span className="ml-1.5 inline-flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </span>
          )}
        </div>
      </Html>

      {/* Working indicator - floating particles */}
      {isWorking && (
        <group position={[0, 0.9, 0]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh
              key={i}
              position={[
                Math.sin((Date.now() / 400) + i * 1.25) * 0.25,
                0.15 + Math.sin((Date.now() / 250) + i * 0.8) * 0.1,
                Math.cos((Date.now() / 400) + i * 1.25) * 0.25,
              ]}
            >
              <octahedronGeometry args={[0.025, 0]} />
              <meshStandardMaterial
                color={colors.accent}
                emissive={colors.accent}
                emissiveIntensity={0.8}
                flatShading
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.3, 0.35, 8]} />
          <meshBasicMaterial color={colors.primary} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Attention indicator - exclamation point when waiting for user input */}
      {needsAttention && (
        <group position={[0, 1.5, 0]}>
          {/* Exclamation mark bubble */}
          <mesh>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5} flatShading />
          </mesh>
          {/* Exclamation mark */}
          <mesh position={[0, 0.02, 0.08]}>
            <boxGeometry args={[0.04, 0.12, 0.02]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, -0.06, 0.08]}>
            <boxGeometry args={[0.04, 0.04, 0.02]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          {/* Pulsing glow */}
          <pointLight color="#F59E0B" intensity={1} distance={2} />
        </group>
      )}
    </group>
  );
}
