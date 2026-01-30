'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Low-poly plant with pot
function Plant({ position, scale = 1, potColor = '#E07A5F' }: {
  position: [number, number, number];
  scale?: number;
  potColor?: string;
}) {
  const plantRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (plantRef.current) {
      const t = state.clock.getElapsedTime();
      plantRef.current.rotation.z = Math.sin(t * 0.5 + position[0]) * 0.02;
    }
  });

  return (
    <group position={position} scale={scale}>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.1, 0.2, 6]} />
        <meshStandardMaterial color={potColor} flatShading />
      </mesh>
      <group ref={plantRef} position={[0, 0.15, 0]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <dodecahedronGeometry args={[0.15, 0]} />
          <meshStandardMaterial color="#4ADE80" flatShading />
        </mesh>
        <mesh position={[0.08, 0.18, 0.05]} castShadow>
          <dodecahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color="#22C55E" flatShading />
        </mesh>
        <mesh position={[-0.06, 0.15, -0.04]} castShadow>
          <dodecahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial color="#16A34A" flatShading />
        </mesh>
      </group>
    </group>
  );
}

// Tall plant/tree
function TallPlant({ position, variant = 0 }: { position: [number, number, number]; variant?: number }) {
  const plantRef = useRef<THREE.Group>(null);
  const colors = [
    ['#22C55E', '#4ADE80', '#16A34A'],
    ['#10B981', '#34D399', '#059669'],
    ['#14B8A6', '#2DD4BF', '#0D9488'],
  ];
  const leafColors = colors[variant % colors.length];

  useFrame((state) => {
    if (plantRef.current) {
      const t = state.clock.getElapsedTime();
      plantRef.current.rotation.z = Math.sin(t * 0.3 + position[0]) * 0.015;
    }
  });

  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.25, 0.2, 0.35, 6]} />
        <meshStandardMaterial color="#8B7355" flatShading />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.8, 5]} />
        <meshStandardMaterial color="#8B5A2B" flatShading />
      </mesh>
      <group ref={plantRef} position={[0, 0.9, 0]}>
        <mesh castShadow>
          <dodecahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial color={leafColors[0]} flatShading />
        </mesh>
        <mesh position={[0.15, 0.2, 0.1]} castShadow>
          <dodecahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial color={leafColors[1]} flatShading />
        </mesh>
        <mesh position={[-0.1, 0.25, -0.08]} castShadow>
          <dodecahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color={leafColors[2]} flatShading />
        </mesh>
      </group>
    </group>
  );
}

// Hanging plant
function HangingPlant({ position }: { position: [number, number, number] }) {
  const plantRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (plantRef.current) {
      const t = state.clock.getElapsedTime();
      plantRef.current.rotation.z = Math.sin(t * 0.4 + position[0]) * 0.03;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.6, 4]} />
        <meshStandardMaterial color="#A0522D" flatShading />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.18, 6]} />
        <meshStandardMaterial color="#D4A373" flatShading />
      </mesh>
      <group ref={plantRef}>
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <group key={i} position={[Math.cos(rad) * 0.1, -0.1, Math.sin(rad) * 0.1]}>
              <mesh>
                <sphereGeometry args={[0.06, 4, 4]} />
                <meshStandardMaterial color="#4ADE80" flatShading />
              </mesh>
              <mesh position={[0, -0.12, 0]}>
                <sphereGeometry args={[0.05, 4, 4]} />
                <meshStandardMaterial color="#22C55E" flatShading />
              </mesh>
              <mesh position={[0.02, -0.22, 0]}>
                <sphereGeometry args={[0.04, 4, 4]} />
                <meshStandardMaterial color="#16A34A" flatShading />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// Waterfall feature
function Waterfall({ position }: { position: [number, number, number] }) {
  const waterRef = useRef<THREE.Mesh>(null);
  const splashRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (waterRef.current && waterRef.current.material instanceof THREE.MeshStandardMaterial) {
      waterRef.current.material.emissiveIntensity = 0.3 + Math.sin(t * 3) * 0.1;
    }
    if (splashRef.current) {
      splashRef.current.children.forEach((child, i) => {
        child.position.y = 0.1 + Math.abs(Math.sin(t * 4 + i)) * 0.15;
        child.scale.setScalar(0.8 + Math.sin(t * 5 + i) * 0.2);
      });
    }
  });

  return (
    <group position={position}>
      {/* Rocks */}
      <mesh position={[0, 0.8, -0.3]} castShadow>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color="#6B7280" flatShading />
      </mesh>
      <mesh position={[0.4, 0.5, -0.2]} castShadow>
        <dodecahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color="#9CA3AF" flatShading />
      </mesh>
      <mesh position={[-0.3, 0.4, -0.1]} castShadow>
        <dodecahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial color="#6B7280" flatShading />
      </mesh>
      {/* Water stream */}
      <mesh ref={waterRef} position={[0, 0.4, 0.1]}>
        <boxGeometry args={[0.3, 0.8, 0.08]} />
        <meshStandardMaterial color="#60A5FA" emissive="#60A5FA" emissiveIntensity={0.3} transparent opacity={0.7} flatShading />
      </mesh>
      {/* Pool */}
      <mesh position={[0, 0.02, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 8]} />
        <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.2} transparent opacity={0.8} flatShading />
      </mesh>
      {/* Splash particles */}
      <group ref={splashRef} position={[0, 0, 0.3]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[(i - 2) * 0.15, 0.1, 0]}>
            <sphereGeometry args={[0.05, 4, 4]} />
            <meshStandardMaterial color="#93C5FD" flatShading transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
      {/* Plants around waterfall */}
      <Plant position={[-0.7, 0, 0.4]} scale={0.6} potColor="#059669" />
      <Plant position={[0.6, 0, 0.5]} scale={0.5} potColor="#0D9488" />
    </group>
  );
}

// Glass partition wall (for dashed lines in floor plan)
function GlassPartition({ position, rotation = [0, 0, 0], size = [3, 2.2, 0.05] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#BFDBFE" transparent opacity={0.25} flatShading />
      </mesh>
      {/* Frame */}
      <mesh position={[0, size[1], 0]}>
        <boxGeometry args={[size[0] + 0.04, 0.04, size[2] + 0.02]} />
        <meshStandardMaterial color="#64748B" flatShading />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[size[0] + 0.04, 0.04, size[2] + 0.02]} />
        <meshStandardMaterial color="#64748B" flatShading />
      </mesh>
      <mesh position={[-size[0] / 2, size[1] / 2, 0]}>
        <boxGeometry args={[0.04, size[1], size[2] + 0.02]} />
        <meshStandardMaterial color="#64748B" flatShading />
      </mesh>
      <mesh position={[size[0] / 2, size[1] / 2, 0]}>
        <boxGeometry args={[0.04, size[1], size[2] + 0.02]} />
        <meshStandardMaterial color="#64748B" flatShading />
      </mesh>
    </group>
  );
}

// Solid wall (for closed offices)
function SolidWall({ position, rotation = [0, 0, 0], size = [3, 2.5, 0.12] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
}) {
  return (
    <mesh position={[position[0], position[1] + size[1] / 2, position[2]]} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#E5E7EB" flatShading />
    </mesh>
  );
}

// Door
function Door({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.9, 2, 0.08]} />
        <meshStandardMaterial color="#78716C" flatShading />
      </mesh>
      {/* Handle */}
      <mesh position={[0.3, 1, 0.06]}>
        <boxGeometry args={[0.1, 0.04, 0.06]} />
        <meshStandardMaterial color="#A1A1AA" flatShading />
      </mesh>
    </group>
  );
}

// Office chair
function Chair({ position, rotation = [0, 0, 0], color = '#3B82F6' }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Seat */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.4, 0.06, 0.4]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.55, -0.17]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.06]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.24, 6]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      {/* Wheels base */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 5]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
    </group>
  );
}

// Closed Office with SOLID walls (not glass)
function ClosedOffice({ position, label, size = [3.5, 3.5], doorSide = 'front' }: {
  position: [number, number, number];
  label: string;
  size?: [number, number];
  doorSide?: 'front' | 'back' | 'left' | 'right';
}) {
  const wallHeight = 2.5;
  const halfW = size[0] / 2;
  const halfD = size[1] / 2;

  return (
    <group position={position}>
      {/* SOLID walls */}
      {/* Back wall */}
      <SolidWall position={[0, 0, -halfD]} size={[size[0], wallHeight, 0.12]} />
      {/* Left wall */}
      <SolidWall position={[-halfW, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[size[1], wallHeight, 0.12]} />
      {/* Right wall */}
      <SolidWall position={[halfW, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[size[1], wallHeight, 0.12]} />
      {/* Front wall with door */}
      <SolidWall position={[-halfW / 2 - 0.3, 0, halfD]} size={[halfW - 0.2, wallHeight, 0.12]} />
      <SolidWall position={[halfW / 2 + 0.3, 0, halfD]} size={[halfW - 0.2, wallHeight, 0.12]} />
      <Door position={[0, 0, halfD]} />

      {/* Desk */}
      <mesh position={[0, 0.38, -halfD / 2]} castShadow>
        <boxGeometry args={[1.6, 0.05, 0.8]} />
        <meshStandardMaterial color="#D4A373" flatShading />
      </mesh>
      {/* Desk legs */}
      {[[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.18, -halfD / 2 + z]} castShadow>
          <boxGeometry args={[0.05, 0.36, 0.05]} />
          <meshStandardMaterial color="#9CA3AF" flatShading />
        </mesh>
      ))}

      {/* Monitor */}
      <mesh position={[0, 0.65, -halfD / 2 - 0.2]} castShadow>
        <boxGeometry args={[0.55, 0.35, 0.03]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      <mesh position={[0, 0.48, -halfD / 2 - 0.15]} castShadow>
        <boxGeometry args={[0.1, 0.15, 0.08]} />
        <meshStandardMaterial color="#374151" flatShading />
      </mesh>

      {/* Chair */}
      <Chair position={[0, 0, -halfD / 2 + 0.6]} color="#1E3A5F" />

      {/* Label */}
      <Html position={[0, 2.8, 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="px-2 py-1 bg-slate-700 text-white text-xs font-bold rounded shadow-lg whitespace-nowrap">
          {label}
        </div>
      </Html>
    </group>
  );
}

// Springfield/Shelbyville - Large meeting room with GLASS walls (dashed lines)
function LargeMeetingRoom({ position, label, chairs = 8, tableColor = '#FBBF24' }: {
  position: [number, number, number];
  label: string;
  chairs?: number;
  tableColor?: string;
}) {
  const roomWidth = 5;
  const roomDepth = 4;
  const chairsPerSide = Math.floor(chairs / 2);

  return (
    <group position={position}>
      {/* GLASS walls (dashed lines in floor plan) */}
      <GlassPartition position={[0, 0, -roomDepth / 2]} size={[roomWidth, 2.2, 0.05]} />
      <GlassPartition position={[-roomWidth / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[roomDepth, 2.2, 0.05]} />
      <GlassPartition position={[roomWidth / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[roomDepth, 2.2, 0.05]} />

      {/* Conference table */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[3, 0.08, 1.2]} />
        <meshStandardMaterial color={tableColor} flatShading />
      </mesh>
      {/* Table legs */}
      {[[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.18, z]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.36, 6]} />
          <meshStandardMaterial color="#6B7280" flatShading />
        </mesh>
      ))}

      {/* Chairs - distributed on both sides */}
      {Array.from({ length: chairsPerSide }).map((_, i) => {
        const x = -1.2 + (i * 2.4) / (chairsPerSide - 1 || 1);
        return (
          <group key={`chair-front-${i}`}>
            <Chair position={[x, 0, 0.9]} rotation={[0, Math.PI, 0]} color={i % 2 === 0 ? '#3B82F6' : '#8B5CF6'} />
            <Chair position={[x, 0, -0.9]} color={i % 2 === 0 ? '#3B82F6' : '#8B5CF6'} />
          </group>
        );
      })}

      {/* TV/Screen on back wall */}
      <mesh position={[0, 1.3, -roomDepth / 2 + 0.1]} castShadow>
        <boxGeometry args={[2.2, 1.2, 0.06]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      <mesh position={[0, 1.3, -roomDepth / 2 + 0.13]}>
        <boxGeometry args={[2.1, 1.1, 0.01]} />
        <meshStandardMaterial color="#0f172a" emissive="#1e3a5f" emissiveIntensity={0.15} flatShading />
      </mesh>

      {/* Label */}
      <Html position={[0, 2.5, 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="px-3 py-1 bg-amber-500 text-white text-sm font-bold rounded-none shadow-lg whitespace-nowrap">
          {label}
        </div>
      </Html>
    </group>
  );
}

// Small meeting room with GLASS walls - North Haverbrook, Ogdenville, Brockway style
function SmallMeetingRoom({ position, label, chairs = 4, color = '#6366F1' }: {
  position: [number, number, number];
  label: string;
  chairs?: number;
  color?: string;
}) {
  return (
    <group position={position}>
      {/* GLASS walls (dashed lines) */}
      <GlassPartition position={[0, 0, -1.3]} size={[2.6, 2.2, 0.05]} />
      <GlassPartition position={[-1.3, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[2.6, 2.2, 0.05]} />
      <GlassPartition position={[1.3, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[2.6, 2.2, 0.05]} />

      {/* Round table */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 12]} />
        <meshStandardMaterial color="#FFFFFF" flatShading />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.36, 6]} />
        <meshStandardMaterial color="#6B7280" flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 8]} />
        <meshStandardMaterial color="#6B7280" flatShading />
      </mesh>

      {/* Chairs around table */}
      {Array.from({ length: chairs }).map((_, i) => {
        const angle = (i * 360 / chairs) * Math.PI / 180;
        return (
          <Chair
            key={i}
            position={[Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9]}
            rotation={[0, -angle + Math.PI, 0]}
            color={color}
          />
        );
      })}

      {/* Label */}
      <Html position={[0, 2.5, 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="px-2 py-1 bg-indigo-500 text-white text-xs font-bold rounded-none shadow-lg whitespace-nowrap">
          {label}
        </div>
      </Html>
    </group>
  );
}

// Framery Pod (Phone booth) - standalone unit
function FrameryPod({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main structure - dark frame */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[1.3, 2.3, 1.3]} />
        <meshStandardMaterial color="#1E293B" flatShading />
      </mesh>
      {/* Glass front door */}
      <mesh position={[0, 1.1, 0.62]}>
        <boxGeometry args={[1.1, 2, 0.05]} />
        <meshStandardMaterial color="#93C5FD" transparent opacity={0.35} flatShading />
      </mesh>
      {/* Interior light */}
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[1, 0.05, 1]} />
        <meshStandardMaterial color="#FEF3C7" emissive="#FEF3C7" emissiveIntensity={0.5} flatShading />
      </mesh>
      {/* Small desk */}
      <mesh position={[0, 0.75, -0.35]} castShadow>
        <boxGeometry args={[1, 0.04, 0.5]} />
        <meshStandardMaterial color="#D4A373" flatShading />
      </mesh>
      {/* Stool */}
      <mesh position={[0, 0.4, 0.15]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 8]} />
        <meshStandardMaterial color="#6366F1" flatShading />
      </mesh>
      <mesh position={[0, 0.2, 0.15]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 6]} />
        <meshStandardMaterial color="#4B5563" flatShading />
      </mesh>
    </group>
  );
}

// Chill Zone Orange - L-shaped sofas (NO walls - open area)
function ChillZoneOrange({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* NO WALLS - open area */}

      {/* L-shaped orange sofa - horizontal part */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[3.5, 0.44, 1]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>
      {/* Backrest horizontal */}
      <mesh position={[0, 0.55, -0.4]} castShadow>
        <boxGeometry args={[3.5, 0.5, 0.2]} />
        <meshStandardMaterial color="#EA580C" flatShading />
      </mesh>

      {/* L-shaped orange sofa - vertical part */}
      <mesh position={[-1.75, 0.22, 1.25]} castShadow>
        <boxGeometry args={[1, 0.44, 2.5]} />
        <meshStandardMaterial color="#F97316" flatShading />
      </mesh>
      {/* Backrest vertical */}
      <mesh position={[-2.15, 0.55, 1.25]} castShadow>
        <boxGeometry args={[0.2, 0.5, 2.5]} />
        <meshStandardMaterial color="#EA580C" flatShading />
      </mesh>

      {/* Coffee table */}
      <mesh position={[0.5, 0.22, 1.2]} castShadow>
        <boxGeometry args={[1.4, 0.04, 0.9]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      {/* Table legs */}
      {[[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]].map(([x, z], i) => (
        <mesh key={i} position={[0.5 + x * 0.9, 0.1, 1.2 + z * 0.9]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 6]} />
          <meshStandardMaterial color="#374151" flatShading />
        </mesh>
      ))}

      {/* Cushions */}
      <mesh position={[-0.9, 0.5, 0.15]} castShadow rotation={[0.05, 0.1, 0]}>
        <boxGeometry args={[0.45, 0.18, 0.45]} />
        <meshStandardMaterial color="#FBBF24" flatShading />
      </mesh>
      <mesh position={[0.9, 0.5, 0.15]} castShadow rotation={[-0.05, -0.08, 0]}>
        <boxGeometry args={[0.45, 0.18, 0.45]} />
        <meshStandardMaterial color="#FCD34D" flatShading />
      </mesh>
      <mesh position={[-1.75, 0.5, 2]} castShadow rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.4, 0.18, 0.4]} />
        <meshStandardMaterial color="#FDBA74" flatShading />
      </mesh>

      {/* Label */}
      <Html position={[-0.5, 1.5, 0.5]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-none shadow-lg whitespace-nowrap">
          CHILL ZONE ORANGE
        </div>
      </Html>
    </group>
  );
}

// Storage/MEC room - SOLID walls
function StorageMEC({ position }: { position: [number, number, number] }) {
  const w = 3;
  const d = 2.5;

  return (
    <group position={position}>
      {/* SOLID walls */}
      <SolidWall position={[0, 0, -d / 2]} size={[w, 2.5, 0.12]} />
      <SolidWall position={[-w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[d, 2.5, 0.12]} />
      <SolidWall position={[w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[d, 2.5, 0.12]} />
      {/* Front wall with door gap */}
      <SolidWall position={[-w / 4 - 0.3, 0, d / 2]} size={[w / 2 - 0.3, 2.5, 0.12]} />
      <SolidWall position={[w / 4 + 0.3, 0, d / 2]} size={[w / 2 - 0.3, 2.5, 0.12]} />
      <Door position={[0, 0, d / 2]} />

      {/* Shelving unit */}
      <mesh position={[0, 0.9, -d / 2 + 0.4]} castShadow>
        <boxGeometry args={[2.2, 1.8, 0.5]} />
        <meshStandardMaterial color="#64748B" flatShading />
      </mesh>
      {/* Shelves */}
      {[0.3, 0.7, 1.1, 1.5].map((y, i) => (
        <mesh key={i} position={[0, y, -d / 2 + 0.4]}>
          <boxGeometry args={[2.1, 0.03, 0.45]} />
          <meshStandardMaterial color="#94A3B8" flatShading />
        </mesh>
      ))}
      {/* Boxes */}
      <mesh position={[-0.5, 0.45, -d / 2 + 0.5]} castShadow>
        <boxGeometry args={[0.4, 0.25, 0.35]} />
        <meshStandardMaterial color="#F472B6" flatShading />
      </mesh>
      <mesh position={[0.2, 0.45, -d / 2 + 0.5]} castShadow>
        <boxGeometry args={[0.35, 0.25, 0.35]} />
        <meshStandardMaterial color="#60A5FA" flatShading />
      </mesh>
      <mesh position={[0.6, 0.85, -d / 2 + 0.5]} castShadow>
        <boxGeometry args={[0.4, 0.25, 0.35]} />
        <meshStandardMaterial color="#34D399" flatShading />
      </mesh>
      <mesh position={[-0.3, 0.85, -d / 2 + 0.5]} castShadow>
        <boxGeometry args={[0.35, 0.25, 0.35]} />
        <meshStandardMaterial color="#FBBF24" flatShading />
      </mesh>

      {/* Label */}
      <Html position={[0, 2.8, 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="px-2 py-1 bg-slate-600 text-white text-xs font-bold rounded-none shadow-lg">
          STORAGE/MEC
        </div>
      </Html>
    </group>
  );
}

// Cafeteria with round tables
function Cafeteria({ position, tables = 4 }: { position: [number, number, number]; tables?: number }) {
  return (
    <group position={position}>
      {/* Counter/Kitchen area */}
      <mesh position={[-2.5, 0.55, -2]} castShadow>
        <boxGeometry args={[3, 1.1, 0.7]} />
        <meshStandardMaterial color="#92400E" flatShading />
      </mesh>
      <mesh position={[-2.5, 1.12, -2]} castShadow>
        <boxGeometry args={[3.2, 0.06, 0.8]} />
        <meshStandardMaterial color="#78350F" flatShading />
      </mesh>

      {/* Coffee machine */}
      <mesh position={[-3.2, 1.35, -2]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.35]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      <mesh position={[-3.2, 1.48, -1.82]}>
        <boxGeometry args={[0.25, 0.18, 0.02]} />
        <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={0.5} flatShading />
      </mesh>

      {/* Round tables with chairs */}
      {[
        [0, 0], [2.5, 0], [0, 2], [2.5, 2]
      ].slice(0, tables).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Table */}
          <mesh position={[0, 0.38, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.05, 12]} />
            <meshStandardMaterial color="#FFFFFF" flatShading />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.36, 6]} />
            <meshStandardMaterial color="#9CA3AF" flatShading />
          </mesh>
          {/* 4 chairs per table */}
          {[0, 90, 180, 270].map((angle, j) => {
            const rad = (angle * Math.PI) / 180;
            const colors = ['#F472B6', '#A78BFA', '#34D399', '#FBBF24'];
            return (
              <Chair
                key={j}
                position={[Math.cos(rad) * 0.8, 0, Math.sin(rad) * 0.8]}
                rotation={[0, -rad + Math.PI, 0]}
                color={colors[(i + j) % 4]}
              />
            );
          })}
        </group>
      ))}

      {/* Vending machine */}
      <mesh position={[4, 0.85, -1.5]} castShadow>
        <boxGeometry args={[0.7, 1.7, 0.55]} />
        <meshStandardMaterial color="#3B82F6" flatShading />
      </mesh>
      <mesh position={[4, 0.9, -1.22]}>
        <boxGeometry args={[0.55, 0.9, 0.02]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>

      {/* Label */}
      <Html position={[1, 2.2, 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="px-3 py-1 bg-emerald-500 text-white text-sm font-bold rounded-none shadow-lg">
          CAFETERIA
        </div>
      </Html>
    </group>
  );
}

// Main Entrance
function MainEntrance({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Glass double doors */}
      <mesh position={[-0.6, 1.1, 0]}>
        <boxGeometry args={[1.1, 2.2, 0.08]} />
        <meshStandardMaterial color="#93C5FD" transparent opacity={0.4} flatShading />
      </mesh>
      <mesh position={[0.6, 1.1, 0]}>
        <boxGeometry args={[1.1, 2.2, 0.08]} />
        <meshStandardMaterial color="#93C5FD" transparent opacity={0.4} flatShading />
      </mesh>
      {/* Door frames */}
      <mesh position={[-1.2, 1.1, 0]}>
        <boxGeometry args={[0.08, 2.3, 0.12]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.08, 2.3, 0.12]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      <mesh position={[1.2, 1.1, 0]}>
        <boxGeometry args={[0.08, 2.3, 0.12]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[2.5, 0.08, 0.12]} />
        <meshStandardMaterial color="#1F2937" flatShading />
      </mesh>
      {/* Handles */}
      <mesh position={[-0.2, 1.05, 0.08]}>
        <boxGeometry args={[0.25, 0.04, 0.04]} />
        <meshStandardMaterial color="#9CA3AF" flatShading />
      </mesh>
      <mesh position={[0.2, 1.05, 0.08]}>
        <boxGeometry args={[0.25, 0.04, 0.04]} />
        <meshStandardMaterial color="#9CA3AF" flatShading />
      </mesh>

      {/* Welcome mat */}
      <mesh position={[0, 0.01, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 1.2]} />
        <meshStandardMaterial color="#374151" flatShading />
      </mesh>

      {/* Label */}
      <Html position={[0, 2.6, 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="px-3 py-1 bg-cyan-500 text-white text-xs font-bold rounded-none shadow-lg">
          MAIN ENTRANCE
        </div>
      </Html>
    </group>
  );
}

// Open desk cluster
function DeskCluster({ position, desks = 4, orientation = 'horizontal' }: {
  position: [number, number, number];
  desks?: number;
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <group position={position}>
      {Array.from({ length: desks }).map((_, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = orientation === 'horizontal' ? (row - (desks / 4 - 0.5)) * 1.5 : (col - 0.5) * 1.5;
        const z = orientation === 'horizontal' ? (col - 0.5) * 1.3 : (row - (desks / 4 - 0.5)) * 1.3;

        return (
          <group key={i} position={[x, 0, z]}>
            {/* Desk */}
            <mesh position={[0, 0.38, 0]} castShadow>
              <boxGeometry args={[1.2, 0.04, 0.65]} />
              <meshStandardMaterial color="#D4A373" flatShading />
            </mesh>
            {/* Legs */}
            {[[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].map(([lx, lz], j) => (
              <mesh key={j} position={[lx, 0.18, lz]} castShadow>
                <boxGeometry args={[0.04, 0.36, 0.04]} />
                <meshStandardMaterial color="#9CA3AF" flatShading />
              </mesh>
            ))}
            {/* Monitor */}
            <mesh position={[0, 0.6, -0.15]} castShadow>
              <boxGeometry args={[0.45, 0.28, 0.025]} />
              <meshStandardMaterial color="#1F2937" flatShading />
            </mesh>
            {/* Keyboard */}
            <mesh position={[0, 0.41, 0.1]} castShadow>
              <boxGeometry args={[0.25, 0.015, 0.08]} />
              <meshStandardMaterial color="#4B5563" flatShading />
            </mesh>
            {/* Chair */}
            <Chair
              position={[0, 0, 0.55]}
              rotation={[0, Math.PI, 0]}
              color={['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'][i % 4]}
            />
          </group>
        );
      })}
    </group>
  );
}

// Company Logo
function CompanyLogo({ position, rotation = [0, 0, 0] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const logoTexture = useTexture('/logo.png');

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.01]} castShadow>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color="#FFFFFF" flatShading />
      </mesh>
      <mesh>
        <planeGeometry args={[2, 1.8]} />
        <meshBasicMaterial map={logoTexture} transparent alphaTest={0.1} />
      </mesh>
      <Html position={[0, -1.4, 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
        <div className="text-2xl font-bold text-white" style={{ fontFamily: 'system-ui', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          OCTAV
        </div>
      </Html>
    </group>
  );
}

// Brick wall
function BrickWall({ position, rotation = [0, 0, 0], size = [28, 5] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
}) {
  const brickColors = ['#B45309', '#A3522B', '#C2410C', '#9A3412', '#B91C1C'];
  const bricksX = Math.floor(size[0] / 0.5);
  const bricksY = Math.floor(size[1] / 0.25);

  return (
    <group position={position} rotation={rotation}>
      <mesh receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#78350F" flatShading />
      </mesh>
      {Array.from({ length: bricksY }).map((_, row) =>
        Array.from({ length: bricksX }).map((_, col) => {
          const offsetX = row % 2 === 0 ? 0 : 0.25;
          const x = col * 0.5 + offsetX - size[0] / 2 + 0.25;
          const y = row * 0.25 - size[1] / 2 + 0.125;
          const colorIndex = (row * bricksX + col) % brickColors.length;

          return (
            <mesh key={`brick-${row}-${col}`} position={[x, y, 0.01]}>
              <planeGeometry args={[0.45, 0.2]} />
              <meshStandardMaterial color={brickColors[colorIndex]} flatShading />
            </mesh>
          );
        })
      )}
    </group>
  );
}

// Window
function Window({ position, rotation = [0, 0, 0], size = [1.8, 2] }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[size[0], size[1], 0.1]} />
        <meshStandardMaterial color="#0a1628" emissive="#1e3a5f" emissiveIntensity={0.2} flatShading />
      </mesh>
      {/* Stars */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (Math.sin(i * 1.7) * size[0] * 0.4),
            (Math.cos(i * 2.3) * size[1] * 0.4),
            0.06
          ]}
        >
          <sphereGeometry args={[0.02 + (i % 3) * 0.01, 4, 4]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1} flatShading />
        </mesh>
      ))}
      {/* Frame */}
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[size[0] + 0.1, size[1] + 0.1, 0.02]} />
        <meshStandardMaterial color="#4A5568" flatShading />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.04, size[1], 0.02]} />
        <meshStandardMaterial color="#4A5568" flatShading />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[size[0], 0.04, 0.02]} />
        <meshStandardMaterial color="#4A5568" flatShading />
      </mesh>
      <pointLight position={[0, 0, 0.5]} intensity={0.15} distance={3} color="#4A90D9" />
    </group>
  );
}

// Wood floor
function WoodFloor() {
  const plankColors = ['#D4A373', '#CBA36A', '#C9956C', '#D1A87A', '#C4935F'];
  const plankWidth = 1.0;
  const plankHeight = 0.35;
  const floorMinX = -22;
  const floorMaxX = 22;
  const floorMinZ = -12;
  const floorMaxZ = 12;

  const cols = Math.ceil((floorMaxX - floorMinX) / plankWidth);
  const rows = Math.ceil((floorMaxZ - floorMinZ) / plankHeight);

  return (
    <group>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => {
          const offsetX = row % 2 === 0 ? 0 : plankWidth / 2;
          const x = floorMinX + col * plankWidth + offsetX + plankWidth / 2;
          const z = floorMinZ + row * plankHeight + plankHeight / 2;

          if (x - plankWidth / 2 > floorMaxX || x + plankWidth / 2 < floorMinX) return null;

          return (
            <mesh
              key={`plank-${row}-${col}`}
              position={[x, -0.01, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[plankWidth * 0.98, plankHeight * 0.95]} />
              <meshStandardMaterial
                color={plankColors[(row + col) % plankColors.length]}
                flatShading
              />
            </mesh>
          );
        })
      )}
    </group>
  );
}

// Ceiling light
function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 8]} />
        <meshStandardMaterial color="#F3F4F6" flatShading />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.03, 8]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.5} flatShading />
      </mesh>
      <pointLight position={[0, -0.2, 0]} intensity={0.4} distance={8} color="#FFFFFF" />
    </group>
  );
}

// Main office environment matching floor plan
export default function OfficeEnvironment() {
  return (
    <group>
      {/* Wood floor */}
      <WoodFloor />

      {/* Brick walls */}
      <BrickWall position={[0, 2.5, -12]} size={[48, 5]} />
      <BrickWall position={[0, 2.5, 12]} rotation={[0, Math.PI, 0]} size={[48, 5]} />
      <BrickWall position={[-22, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} size={[28, 5]} />
      <BrickWall position={[22, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} size={[28, 5]} />

      {/* Windows on back wall */}
      {[-18, -14, -10, 10, 14, 18].map((x, i) => (
        <Window key={`win-back-${i}`} position={[x, 2.8, -11.9]} />
      ))}
      {/* Windows on front wall */}
      {[-18, -14, 14, 18].map((x, i) => (
        <Window key={`win-front-${i}`} position={[x, 2.8, 11.9]} rotation={[0, Math.PI, 0]} />
      ))}
      {/* Windows on side walls */}
      {[-7, -2, 3, 8].map((z, i) => (
        <Window key={`win-left-${i}`} position={[-21.9, 2.8, z]} rotation={[0, Math.PI / 2, 0]} />
      ))}
      {[-7, -2, 3, 8].map((z, i) => (
        <Window key={`win-right-${i}`} position={[21.9, 2.8, z]} rotation={[0, -Math.PI / 2, 0]} />
      ))}

      {/* Company Logo */}
      <CompanyLogo position={[0, 3.5, -11.85]} />

      {/* ========== TOP ROW (Back wall) ========== */}

      {/* CLOSED OFFICE #2 - Top left corner - SOLID walls */}
      <ClosedOffice position={[-18, 0, -8]} label="CLOSED OFFICE #2" size={[3.5, 3.5]} />

      {/* CLOSED OFFICE #3 - Top middle - SOLID walls */}
      <ClosedOffice position={[-8, 0, -8]} label="CLOSED OFFICE #3" size={[3.5, 3.5]} />

      {/* SPRINGFIELD - Large meeting room - GLASS walls - 8 chairs */}
      <LargeMeetingRoom position={[8, 0, -8]} label="SPRINGFIELD" chairs={8} tableColor="#FBBF24" />

      {/* SHELBYVILLE - Large meeting room - GLASS walls - 8 chairs */}
      <LargeMeetingRoom position={[16, 0, -8]} label="SHELBYVILLE" chairs={8} tableColor="#60A5FA" />

      {/* ========== MIDDLE ROW ========== */}


      {/* NORTH HAVERBROOK - Small meeting room - GLASS walls - 4 chairs */}
      <SmallMeetingRoom position={[8, 0, 0]} label="NORTH HAVERBROOK" chairs={4} color="#8B5CF6" />

      {/* OGDENVILLE - Small meeting room - GLASS walls - 4 chairs */}
      <SmallMeetingRoom position={[12, 0, 0]} label="OGDENVILLE" chairs={4} color="#EC4899" />

      {/* BROCKWAY - Small meeting room - GLASS walls - 4 chairs */}
      <SmallMeetingRoom position={[16, 0, 0]} label="BROCKWAY" chairs={4} color="#14B8A6" />

      {/* ========== BOTTOM ROW (Front wall) ========== */}

      {/* CLOSED OFFICE #4 - Bottom left corner - SOLID walls */}
      <ClosedOffice position={[-18, 0, 8]} label="CLOSED OFFICE #4" size={[3.5, 3.5]} />

      {/* CHILL ZONE ORANGE - NO walls, L-shaped orange sofas */}
      <ChillZoneOrange position={[-11, 0, 7]} />

      {/* CAFETERIA - 4 round tables with chairs */}
      <Cafeteria position={[12, 0, 7]} tables={4} />

      {/* MAIN ENTRANCE - Bottom right */}
      <MainEntrance position={[6, 0, 11.5]} />

      {/* ========== OPEN DESK AREAS ========== */}

      {/* Desk clusters in open areas */}
      <DeskCluster position={[-13, 0, -2]} desks={4} orientation="horizontal" />
      <DeskCluster position={[-13, 0, 2]} desks={4} orientation="horizontal" />
      <DeskCluster position={[-5, 0, 4]} desks={4} orientation="horizontal" />
      <DeskCluster position={[0, 0, 4]} desks={4} orientation="horizontal" />

      {/* ========== WATERFALL ========== */}
      <Waterfall position={[-14, 0, -4]} />

      {/* ========== PLANTS ========== */}

      {/* Tall plants - corners and edges */}
      <TallPlant position={[-20, 0, -10]} variant={0} />
      <TallPlant position={[-20, 0, 10]} variant={1} />
      <TallPlant position={[20, 0, 10]} variant={2} />
      <TallPlant position={[20, 0, -4]} variant={0} />
      <TallPlant position={[-14, 0, -10]} variant={1} />
      <TallPlant position={[4, 0, -10]} variant={2} />
      <TallPlant position={[20, 0, -10]} variant={1} />
      <TallPlant position={[-20, 0, 0]} variant={2} />
      <TallPlant position={[20, 0, 0]} variant={0} />
      <TallPlant position={[-6, 0, -10]} variant={1} />
      <TallPlant position={[0, 0, 10]} variant={2} />
      <TallPlant position={[-10, 0, 10]} variant={0} />

      {/* Small plants - scattered throughout */}
      <Plant position={[-6, 0, 8]} scale={0.85} potColor="#F472B6" />
      <Plant position={[4, 0, 4]} scale={0.8} potColor="#A78BFA" />
      <Plant position={[-16, 0, 0]} scale={0.9} potColor="#34D399" />
      <Plant position={[6, 0, -4]} scale={0.75} potColor="#FBBF24" />
      <Plant position={[19, 0, 4]} scale={0.85} potColor="#60A5FA" />
      <Plant position={[-3, 0, 10]} scale={0.8} potColor="#EC4899" />
      <Plant position={[10, 0, 8]} scale={0.9} potColor="#14B8A6" />
      <Plant position={[-8, 0, 4]} scale={0.75} potColor="#F97316" />
      <Plant position={[15, 0, -2]} scale={0.85} potColor="#8B5CF6" />
      <Plant position={[-12, 0, -6]} scale={0.8} potColor="#EF4444" />
      <Plant position={[2, 0, -6]} scale={0.7} potColor="#06B6D4" />
      <Plant position={[-4, 0, 0]} scale={0.85} potColor="#84CC16" />
      <Plant position={[8, 0, 2]} scale={0.9} potColor="#D946EF" />
      <Plant position={[-18, 0, 4]} scale={0.75} potColor="#F472B6" />
      <Plant position={[18, 0, 8]} scale={0.8} potColor="#22D3EE" />
      <Plant position={[-2, 0, 8]} scale={0.85} potColor="#A3E635" />

      {/* Hanging plants - along walls */}
      <HangingPlant position={[-18, 3.2, -11]} />
      <HangingPlant position={[-10, 3.2, -11]} />
      <HangingPlant position={[10, 3.2, -11]} />
      <HangingPlant position={[18, 3.2, -11]} />
      <HangingPlant position={[-4, 3.2, -11]} />
      <HangingPlant position={[4, 3.2, -11]} />
      <HangingPlant position={[-18, 3.2, 11]} />
      <HangingPlant position={[18, 3.2, 11]} />

    </group>
  );
}
