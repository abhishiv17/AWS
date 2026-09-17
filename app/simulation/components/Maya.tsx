"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useSimulation } from "../store";
import { Label } from "./Markers";
import Student from "./Student";

/** The active compact scenario projects Maya from the deterministic core. */
export default function Maya() {
  const occupant = useSimulation((state) => state.coreSnapshot?.occupants.maya ?? null);
  const group = useRef<THREE.Group>(null);

  useFrame((_, rawDt) => {
    if (!group.current || !occupant) return;
    const dt = Math.min(rawDt, 0.05);
    const target = new THREE.Vector3(...occupant.position);
    target.y -= 0.85;
    group.current.position.lerp(target, 1 - Math.exp(-dt * 8));
  });

  if (!occupant || occupant.status === "missing") return null;

  return (
    <group ref={group} position={[occupant.position[0], occupant.position[1] - 0.85, occupant.position[2]]}>
      <Student hasBackpack />
      <Label
        position={[0, 2.35, 0]}
        color={occupant.status === "needs-assistance" || occupant.status === "distressed" ? "#ef4444" : "#a78bfa"}
        text="Maya"
        sub={occupant.status.replaceAll("-", " ")}
      />
    </group>
  );
}
