"use client";

import { MARKERS, type MarkerDef } from "../level";
import { useGame, useSectorVisible } from "../store";
import { Label, MarkerOverlay } from "./Markers";

const byId = (id: string) => MARKERS.find((marker) => marker.id === id) as MarkerDef;

function EvidenceTarget({ def }: { def: MarkerDef }) {
  const [x, y, z] = def.position;
  const visible = useSectorVisible(def.room);
  const status = useGame((state) => state.evidence[def.id]?.status ?? "UNKNOWN");
  if (!visible) return null;
  return (
    <group>
      <mesh position={[x, y, z]} castShadow>
        <boxGeometry args={[0.5, 0.36, 0.3]} />
        <meshStandardMaterial
          color={status === "VERIFIED" ? "#10b981" : def.color}
          emissive={def.color}
          emissiveIntensity={0.25}
          roughness={0.65}
        />
      </mesh>
      <MarkerOverlay def={def} size={[0.8, 0.55, 0.55]} />
    </group>
  );
}

function VentilationPanel() {
  const def = byId("ventilation-panel");
  const [x, y, z] = def.position;
  const visible = useSectorVisible(def.room);
  const applied = useGame((state) => state.interventionApplied);
  if (!visible) return null;
  return (
    <group>
      <group position={[x, y, z]} rotation={[0, def.rotationY ?? 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.58, 0.14]} />
          <meshStandardMaterial color={applied ? "#334155" : "#1e647e"} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.11, 0.08]}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial
            color={applied ? "#10b981" : "#38bdf8"}
            emissive={applied ? "#10b981" : "#38bdf8"}
            emissiveIntensity={applied ? 0.4 : 1.4}
          />
        </mesh>
        <mesh position={[0, -0.13, 0.08]}>
          <boxGeometry args={[0.22, 0.13, 0.03]} />
          <meshStandardMaterial color="#e6e4de" />
        </mesh>
      </group>
      <MarkerOverlay def={def} size={[0.5, 0.72, 0.32]} />
    </group>
  );
}

function WestRouteSign() {
  const def = byId("west-route-sign");
  const [x, y, z] = def.position;
  const visible = useSectorVisible(def.room);
  if (!visible) return null;
  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[3, 0.7, 0.06]} />
        <meshStandardMaterial color="#17231e" roughness={0.6} />
      </mesh>
      <mesh position={[-0.7, 0, 0.04]}>
        <planeGeometry args={[1.1, 0.16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      <Label position={[0, 0, 0.08]} color="#10b981" text="WEST ROUTE" sub="verified alternate" />
      <MarkerOverlay def={def} size={[3, 0.7, 0.12]} />
    </group>
  );
}

export default function Interactables() {
  return (
    <>
      {MARKERS.filter((marker) => marker.kind === "evidence").map((marker) => (
        <EvidenceTarget key={marker.id} def={marker} />
      ))}
      <VentilationPanel />
      <WestRouteSign />
    </>
  );
}
