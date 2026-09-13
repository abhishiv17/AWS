"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ASSEMBLY_Z, MARKERS, roomAt, type MarkerDef } from "../level";
import { getSectorSmoke, VENTILATION_SMOKE_FACTOR } from "../smoke";
import { clampDt, runtime } from "../runtime";
import { useSession } from "../session";
import { useSimulation } from "../store";

const markerPosition = (id: string) =>
  new THREE.Vector3(...(MARKERS.find((marker) => marker.id === id) as MarkerDef).position);

const ventilationPosition = markerPosition("ventilation-panel");
const assemblyPosition = new THREE.Vector3(0, 0, ASSEMBLY_Z + 2);

const flatDistance = (a: THREE.Vector3, b: THREE.Vector3) =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** Local fallback simulation for movement, bounded smoke, and physical prompts. */
export default function Systems() {
  const accumulator = useRef(0);
  const hazardAccumulator = useRef(0);
  const resetSeq = useSimulation((state) => state.resetSeq);

  useEffect(() => {
    hazardAccumulator.current = 0;
    runtime.alert = 0;
    runtime.drillStartedAt = 0;
    runtime.hazardElapsed = 0;
    runtime.useTarget = null;
  }, [resetSeq]);

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    const sim = useSimulation.getState();
    if (sim.failed || sim.assemblyConfirmed) return;

    const room = useSession.getState().room;
    if (room && room.phase !== "active") return;
    if (runtime.drillStartedAt <= 0) runtime.drillStartedAt = Date.now();
    const elapsed = Math.max(0, (Date.now() - runtime.drillStartedAt) / 1000);
    runtime.hazardElapsed = elapsed;
    runtime.sector = roomAt(runtime.evacuee.x, runtime.evacuee.z);

    const intensity =
      getSectorSmoke(runtime.sector, elapsed) *
      (sim.interventionApplied ? VENTILATION_SMOKE_FACTOR : 1);
    runtime.alert = intensity * 100;
    hazardAccumulator.current += dt;
    if (hazardAccumulator.current >= 0.08) {
      const tickDt = hazardAccumulator.current;
      hazardAccumulator.current = 0;
      sim.applySmokeExposure(elapsed, intensity, tickDt);
    }

    let useTarget: typeof runtime.useTarget = null;
    if (flatDistance(runtime.evacuee, assemblyPosition) < 2.8) {
      useTarget = { kind: "assembly", id: "outdoor-assembly" };
    } else if (flatDistance(runtime.evacuee, ventilationPosition) < 2.2) {
      useTarget = { kind: "intervention", id: "ventilation-panel" };
    }
    runtime.useTarget = useTarget;

    accumulator.current += dt;
    if (accumulator.current > 0.08) {
      accumulator.current = 0;
      sim.enterSector(runtime.sector);
      const prompt = useTarget?.kind === "assembly"
        ? "Press E to confirm assembly at the beacon"
        : useTarget?.kind === "intervention"
          ? sim.mode.kind === "solo"
            ? "Press E to apply the ventilation override"
            : "Warden authorization is required for this intervention"
          : sim.routeBlocked
            ? "East route is unsafe. Choose the west stair."
            : "Move toward the corridor junction and watch for route guidance.";
      sim.setPrompt(prompt);
    }
  });

  return null;
}
