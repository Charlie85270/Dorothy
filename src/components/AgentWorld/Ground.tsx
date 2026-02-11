'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Grid } from '@react-three/drei';

export default function Ground() {
  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial
          color="#0a0a12"
          metalness={0.1}
          roughness={0.9}
        />
      </mesh>

      {/* Grid overlay */}
      <Grid
        position={[0, 0, 0]}
        args={[50, 50]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a1a2e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3D9B94"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />

      {/* Center platform */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[2, 2.2, 0.05, 32]} />
        <meshStandardMaterial
          color="#1a1a2e"
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Center glow ring */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.8, 2, 64]} />
        <meshBasicMaterial
          color="#3D9B94"
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Inner decorative ring */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 64]} />
        <meshBasicMaterial
          color="#a855f7"
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}
