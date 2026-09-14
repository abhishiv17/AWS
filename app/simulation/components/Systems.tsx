"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ASSEMBLY_A_POS, ASSEMBLY_B_POS, MARKERS, roomAt, type MarkerDef, type Vec3 } from "../level";
import { getSectorSmoke, VENTILATION_SMOKE_FACTOR } from "../smoke";
import { stepMayaAgent } from "../maya";
import { clampDt, runtime } from "../runtime";
import { useSession } from "../session";
import { useSimulation } from "../store";

const markerPosition = (id: string) =>
  new THREE.Vector3(...(MARKERS.find((marker) => marker.id === id) as MarkerDef).position);

const ventilationPosition = markerPosition("ventilation-panel");
const assemblyAPosition = new THREE.Vector3(...ASSEMBLY_A_POS);
const assemblyBPosition = new THREE.Vector3(...ASSEMBLY_B_POS);

const flatDistance = (a: THREE.Vector3, b: THREE.Vector3) =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** Local fallback simulation for movement, bounded smoke, and physical prompts. */
export default function Systems() {
  const accumulator = useRef(0);
  const hazardAccumulator = useRef(0);
  const mayaAccumulator = useRef(0);
  const resetSeq = useSimulation((state) => state.resetSeq);

  useEffect(() => {
    hazardAccumulator.current = 0;
    mayaAccumulator.current = 0;
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

    /* Maya Autonomous Agent Loop */
    mayaAccumulator.current += dt;
    if (mayaAccumulator.current >= 0.08) {
      const mayaDt = mayaAccumulator.current;
      mayaAccumulator.current = 0;
      const playerPos: Vec3 = [runtime.evacuee.x, runtime.evacuee.y, runtime.evacuee.z];
      const stepResult = stepMayaAgent(
        sim.maya,
        mayaDt,
        playerPos,
        sim.navEdges,
        elapsed,
        sim.interventionApplied,
      );
      sim.updateMaya(() => stepResult.nextState);
      for (const log of stepResult.logs) {
        sim.push(log, "info");
      }
    }

    /* Proximity Target Evaluation */
    let useTarget: typeof runtime.useTarget = null;
    const distA = flatDistance(runtime.evacuee, assemblyAPosition);
    const distB = flatDistance(runtime.evacuee, assemblyBPosition);
    const mayaPos = new THREE.Vector3(sim.maya.position[0], sim.maya.position[1], sim.maya.position[2]);
    const distMaya = flatDistance(runtime.evacuee, mayaPos);

    if (distA < 3.5 || distB < 3.5) {
      useTarget = { kind: "assembly", id: distA < distB ? "assembly-a" : "assembly-b" };
    } else if (
      distMaya < 3.5 &&
      (sim.maya.status === "WAITING_FOR_HELP" ||
        sim.maya.status === "ALARMED" ||
        sim.maya.status === "LOST")
    ) {
      useTarget = { kind: "maya", id: "maya-peer" };
    } else if (flatDistance(runtime.evacuee, ventilationPosition) < 2.2) {
      useTarget = { kind: "intervention", id: "ventilation-panel" };
    }
    runtime.useTarget = useTarget;

    accumulator.current += dt;
    if (accumulator.current > 0.08) {
      accumulator.current = 0;
      sim.enterSector(runtime.sector);
      sim.updateNavPosition([runtime.evacuee.x, runtime.evacuee.y, runtime.evacuee.z]);
      const prompt = useTarget?.kind === "assembly"
        ? sim.mayaAssisted && sim.maya.status === "SAFE"
          ? "Press E to confirm assembly (Maya rescued!)"
          : "Press E to confirm assembly at the beacon"
        : useTarget?.kind === "maya"
          ? "Press E to assist Maya (Escort to safety)"
          : useTarget?.kind === "intervention"
            ? sim.mode.kind === "solo"
              ? "Press E to apply the ventilation override"
              : "Warden authorization is required for this intervention"
            : sim.mayaAssisted && sim.maya.status === "FOLLOWING"
              ? `Escorting Maya: Guide to ${sim.targetExit === "assembly-a" ? "Exit A" : "Exit B"} [${sim.optimalEgressDistance.toFixed(0)}m remaining]`
              : sim.routeBlocked
                ? "East route compromised. Follow West Exit A route."
                : sim.targetExit === "assembly-a"
                  ? `Optimal egress: Fire Exit A (West) [${sim.optimalEgressDistance.toFixed(0)}m remaining]`
                  : `Optimal egress: Fire Exit B (East) [${sim.optimalEgressDistance.toFixed(0)}m remaining]`;
      sim.setPrompt(prompt);
    }
  });

  return null;
}
