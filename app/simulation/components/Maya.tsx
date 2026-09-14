"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "../store";
import { clampDt } from "../runtime";

/** Maya's custom toon color palette: distinct purple/plum jacket & auburn hair */
const MAYA_COLORS = {
  skin: "#f3d8c2",
  hair: "#581c87",       // dark violet/auburn
  eye: "#1e1b4b",
  mouth: "#4a044e",
  hoodie: "#9333ea",     // distinct vibrant purple hoodie
  jacket: "#581c87",     // deep purple jacket
  pants: "#312e81",      // navy indigo pants
  shoe: "#faf5ff",       // clean white/lilac sneakers
  sole: "#c084fc",
  backpack: "#3b0764",   // dark plum backpack
} as const;

let ramp: THREE.DataTexture | null = null;
function toonRamp() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([70, 160, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
  }
  return ramp;
}

function StatusBeacon({ status }: { status: string }) {
  const color =
    status === "SAFE"
      ? "#22c55e"
      : status === "FOLLOWING"
        ? "#3b82f6"
        : status === "DISTRESSED"
          ? "#ef4444"
          : status === "WAITING_FOR_HELP" || status === "ALARMED"
            ? "#facc15"
            : "#94a3b8";

  return (
    <group position={[0, 2.3, 0]}>
      {/* Diamond beacon marker */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.2, 0.05]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Light ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 16]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function Maya() {
  const maya = useSimulation((s) => s.maya);
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const prevPos = useRef<[number, number, number]>(maya.position);
  const walkCycle = useRef(0);

  const gradientMap = useMemo(() => toonRamp(), []);

  // Material cache
  const matSkin = useMemo(
    () => new THREE.MeshToonMaterial({ color: MAYA_COLORS.skin, gradientMap }),
    [gradientMap],
  );
  const matHair = useMemo(
    () => new THREE.MeshToonMaterial({ color: MAYA_COLORS.hair, gradientMap }),
    [gradientMap],
  );
  const matHoodie = useMemo(
    () => new THREE.MeshToonMaterial({ color: MAYA_COLORS.hoodie, gradientMap }),
    [gradientMap],
  );
  const matJacket = useMemo(
    () => new THREE.MeshToonMaterial({ color: MAYA_COLORS.jacket, gradientMap }),
    [gradientMap],
  );
  const matPants = useMemo(
    () => new THREE.MeshToonMaterial({ color: MAYA_COLORS.pants, gradientMap }),
    [gradientMap],
  );
  const matShoe = useMemo(
    () => new THREE.MeshToonMaterial({ color: MAYA_COLORS.shoe, gradientMap }),
    [gradientMap],
  );

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    if (!groupRef.current) return;

    // Smooth position interpolation
    groupRef.current.position.set(maya.position[0], maya.position[1], maya.position[2]);
    groupRef.current.rotation.y = maya.rotation;

    // Calculate movement speed for walk cycle
    const dx = maya.position[0] - prevPos.current[0];
    const dz = maya.position[2] - prevPos.current[2];
    const speed = Math.sqrt(dx * dx + dz * dz) / dt;
    prevPos.current = [maya.position[0], maya.position[1], maya.position[2]];

    if (speed > 0.1) {
      walkCycle.current += speed * dt * 4.5;
      const swing = Math.sin(walkCycle.current) * 0.45;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.6;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.6;
    } else {
      // Idle breathing / shivering when distressed or alarmed
      const shiver =
        maya.status === "DISTRESSED" || maya.status === "ALARMED"
          ? Math.sin(Date.now() * 0.02) * 0.05
          : 0;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = shiver;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -shiver;
    }
  });

  return (
    <group ref={groupRef} position={maya.position}>
      {/* Ground contact shade */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#05070a" transparent opacity={0.3} />
      </mesh>

      {/* Overhead Status Beacon */}
      <StatusBeacon status={maya.status} />

      {/* Head */}
      <group position={[0, 1.45, 0]}>
        <mesh material={matSkin} position={[0, 0, 0]}>
          <boxGeometry args={[0.4, 0.38, 0.38]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
        {/* Hair with Ponytail */}
        <mesh material={matHair} position={[0, 0.12, -0.04]}>
          <boxGeometry args={[0.44, 0.22, 0.42]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
        <mesh material={matHair} position={[0, 0.05, -0.24]}>
          <boxGeometry args={[0.18, 0.32, 0.18]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
      </group>

      {/* Torso & Jacket */}
      <group position={[0, 0.95, 0]}>
        <mesh material={matHoodie} position={[0, 0.05, 0]}>
          <boxGeometry args={[0.44, 0.55, 0.32]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
        <mesh material={matJacket} position={[0, -0.02, -0.01]}>
          <boxGeometry args={[0.48, 0.48, 0.34]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
      </group>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.3, 1.15, 0]}>
        <mesh material={matJacket} position={[0, -0.25, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.16]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.3, 1.15, 0]}>
        <mesh material={matJacket} position={[0, -0.25, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.16]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
      </group>

      {/* Left Leg */}
      <group ref={leftLegRef} position={[-0.13, 0.65, 0]}>
        <mesh material={matPants} position={[0, -0.3, 0]}>
          <boxGeometry args={[0.16, 0.6, 0.18]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
        <mesh material={matShoe} position={[0, -0.62, 0.04]}>
          <boxGeometry args={[0.18, 0.14, 0.28]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
      </group>

      {/* Right Leg */}
      <group ref={rightLegRef} position={[0.13, 0.65, 0]}>
        <mesh material={matPants} position={[0, -0.3, 0]}>
          <boxGeometry args={[0.16, 0.6, 0.18]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
        <mesh material={matShoe} position={[0, -0.62, 0.04]}>
          <boxGeometry args={[0.18, 0.14, 0.28]} />
          <Outlines thickness={0.015} color="#150824" />
        </mesh>
      </group>
    </group>
  );
}
