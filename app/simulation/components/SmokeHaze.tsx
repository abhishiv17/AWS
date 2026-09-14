"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "../store";
import { getSectorSmoke } from "../smoke";
import { clampDt } from "../runtime";

/**
 * 3D volumetric smoke haze volumes that visually accumulate in Lab 202,
 * Central Junction, and East Corridor as the fire hazard progresses.
 */
export default function SmokeHaze() {
  const hazardElapsed = useSimulation((s) => s.hazardElapsed);
  const interventionApplied = useSimulation((s) => s.interventionApplied);

  const lab202SmokeMat = useRef<THREE.MeshBasicMaterial>(null);
  const eastCorrSmokeMat = useRef<THREE.MeshBasicMaterial>(null);
  const stairEastSmokeMat = useRef<THREE.MeshBasicMaterial>(null);
  const fireGlowLight = useRef<THREE.PointLight>(null);

  useFrame(({ clock }, rawDt) => {
    const dt = clampDt(rawDt);
    const time = clock.elapsedTime;

    const sLab = getSectorSmoke("lab-202", hazardElapsed, interventionApplied);
    const sEastCorr = getSectorSmoke("corridor-east", hazardElapsed, interventionApplied);
    const sEastStair = getSectorSmoke("stair-east", hazardElapsed, interventionApplied);

    // 1. Lab 202 Fire & Smoke Haze
    if (lab202SmokeMat.current) {
      const pulse = 0.95 + 0.05 * Math.sin(time * 3.5);
      const targetOpacity = Math.min(0.85, sLab * 0.9 * pulse);
      lab202SmokeMat.current.opacity += (targetOpacity - lab202SmokeMat.current.opacity) * Math.min(1, dt * 3);
    }

    // Fire glow pulse at origin
    if (fireGlowLight.current) {
      if (sLab > 0.05) {
        const flicker = Math.sin(time * 12) * 0.2 + Math.cos(time * 7) * 0.15;
        fireGlowLight.current.intensity = Math.min(2.5, (0.8 + flicker) * sLab * 2.0);
      } else {
        fireGlowLight.current.intensity = 0;
      }
    }

    // 2. East Corridor Rolling Smoke
    if (eastCorrSmokeMat.current) {
      const pulse = 0.96 + 0.04 * Math.sin(time * 2.2 + 1.0);
      const targetOpacity = Math.min(0.82, sEastCorr * 0.88 * pulse);
      eastCorrSmokeMat.current.opacity += (targetOpacity - eastCorrSmokeMat.current.opacity) * Math.min(1, dt * 3);
    }

    // 3. East Stairwell Smoke Accumulation
    if (stairEastSmokeMat.current) {
      const targetOpacity = Math.min(0.92, sEastStair * 0.95);
      stairEastSmokeMat.current.opacity += (targetOpacity - stairEastSmokeMat.current.opacity) * Math.min(1, dt * 3);
    }
  });

  return (
    <group>
      {/* Lab 202 Chemical Fire Origin Volumes */}
      <group position={[-1, 1.8, 6]}>
        <pointLight
          ref={fireGlowLight}
          color="#f97316"
          intensity={0}
          distance={12}
          decay={2}
          position={[0, 0.4, 0]}
        />
        {/* Layered smoke volumes */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[13.5, 3.4, 7.5]} />
          <meshBasicMaterial
            ref={lab202SmokeMat}
            color="#2a2320"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* East Corridor Smoke Spill Volume (x: 6 to 22, z: -2 to 2) */}
      <mesh position={[14, 2.0, 0]}>
        <boxGeometry args={[15.6, 2.8, 3.6]} />
        <meshBasicMaterial
          ref={eastCorrSmokeMat}
          color="#332d2a"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* East Stairwell Smoke Volume (x: 16 to 24, z: 2 to 14) */}
      <mesh position={[20, 2.0, 8]}>
        <boxGeometry args={[7.6, 3.2, 11.6]} />
        <meshBasicMaterial
          ref={stairEastSmokeMat}
          color="#1e1917"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
