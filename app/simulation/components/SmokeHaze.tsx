"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "../store";
import { getSectorSmoke } from "../smoke";
import { clampDt } from "../runtime";

/**
 * 3D volumetric smoke haze volumes that visually accumulate in the
 * Science Block (sec/wcorr), Central Corridor (lobby), and East Corridor (ecorr)
 * as the smoke hazard progresses.
 */
export default function SmokeHaze() {
  const hazardElapsed = useSimulation((s) => s.hazardElapsed);
  const coreSnapshot = useSimulation((s) => s.coreSnapshot);

  const secSmokeMat = useRef<THREE.MeshBasicMaterial>(null);
  const lobbySmokeMat = useRef<THREE.MeshBasicMaterial>(null);
  const ecorrSmokeMat = useRef<THREE.MeshBasicMaterial>(null);
  const fireGlowLight = useRef<THREE.PointLight>(null);

  useFrame(({ clock }, rawDt) => {
    const dt = clampDt(rawDt);
    const time = clock.elapsedTime;

    const smokeFor = (roomId: "sec" | "lobby" | "ecorr") =>
      coreSnapshot?.hazards[roomId]?.density ?? getSectorSmoke(roomId, hazardElapsed);
    const sSec = smokeFor("sec");
    const sLobby = smokeFor("lobby");
    const sEcorr = smokeFor("ecorr");

    // 1. Science Block / Chemistry Lab 1A — fire origin
    if (secSmokeMat.current) {
      const pulse = 0.95 + 0.05 * Math.sin(time * 3.5);
      const targetOpacity = Math.min(0.85, sSec * 0.9 * pulse);
      secSmokeMat.current.opacity += (targetOpacity - secSmokeMat.current.opacity) * Math.min(1, dt * 3);
    }

    // Fire glow pulse at origin
    if (fireGlowLight.current) {
      if (sSec > 0.05) {
        const flicker = Math.sin(time * 12) * 0.2 + Math.cos(time * 7) * 0.15;
        fireGlowLight.current.intensity = Math.min(2.5, (0.8 + flicker) * sSec * 2.0);
      } else {
        fireGlowLight.current.intensity = 0;
      }
    }

    // 2. Central Corridor rolling smoke
    if (lobbySmokeMat.current) {
      const pulse = 0.96 + 0.04 * Math.sin(time * 2.2 + 1.0);
      const targetOpacity = Math.min(0.82, sLobby * 0.88 * pulse);
      lobbySmokeMat.current.opacity += (targetOpacity - lobbySmokeMat.current.opacity) * Math.min(1, dt * 3);
    }

    // 3. East Corridor smoke accumulation
    if (ecorrSmokeMat.current) {
      const targetOpacity = Math.min(0.92, sEcorr * 0.95);
      ecorrSmokeMat.current.opacity += (targetOpacity - ecorrSmokeMat.current.opacity) * Math.min(1, dt * 3);
    }
  });

  // Positions aligned to actual room bounds from level.ts
  return (
    <group>
      {/* Science Block / Chemistry Lab 1A — smoke origin (sec: x -22 to -8, z -7 to 7) */}
      <group position={[-15, 1.8, 0]}>
        <pointLight
          ref={fireGlowLight}
          color="#f97316"
          intensity={0}
          distance={12}
          decay={2}
          position={[0, 0.4, 0]}
        />
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[14, 3.4, 14]} />
          <meshBasicMaterial
            ref={secSmokeMat}
            color="#2a2320"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Central Corridor smoke spill (lobby: x -5.5 to 5.5, z -7 to 7) */}
      <mesh position={[0, 2.0, 0]}>
        <boxGeometry args={[11, 2.8, 14]} />
        <meshBasicMaterial
          ref={lobbySmokeMat}
          color="#332d2a"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* East Corridor smoke (ecorr: x 5.5 to 8, z 1 to 4) */}
      <mesh position={[6.75, 2.0, 2.5]}>
        <boxGeometry args={[2.5, 3.2, 3]} />
        <meshBasicMaterial
          ref={ecorrSmokeMat}
          color="#1e1917"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
