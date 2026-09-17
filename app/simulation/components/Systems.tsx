"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  ASSEMBLY_Z,
  MARKERS,
  SCENARIO_OBJECTS,
  roomAt,
  type MarkerDef,
} from "../level";
import {
  DEFAULT_TICK_DURATION_SECONDS,
  appendSimulationEvent,
  buildSimulationSnapshot,
  createInitialSimulationState,
  createLiveScenario,
  setVentilationActive,
  startSimulation,
  stepSimulation,
  type ScenarioDefinition,
  type SimulationState as CoreSimulationState,
} from "../core";
import type { TelemetryEvent } from "../net/telemetry";
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
  const coreAccumulator = useRef(0);
  const coreState = useRef<CoreSimulationState | null>(null);
  const scenario = useRef<ScenarioDefinition | null>(null);
  const interventionState = useRef(false);
  const resetSeq = useSimulation((state) => state.resetSeq);
  const onTelemetry = useSession((state) => state.onTelemetry);

  useEffect(() => {
    coreAccumulator.current = 0;
    accumulator.current = 0;
    const room = useSession.getState().room;
    const nextScenario = createLiveScenario(room?.seed ?? 18421);
    const initial = createInitialSimulationState(
      nextScenario,
      `${room?.drillId ?? "solo"}:${resetSeq}`,
    );
    scenario.current = nextScenario;
    coreState.current = initial;
    interventionState.current = false;
    useSimulation.getState().setCoreSnapshot(buildSimulationSnapshot(initial, nextScenario));
    runtime.alert = 0;
    runtime.drillStartedAt = 0;
    runtime.hazardElapsed = 0;
    runtime.useTarget = null;
  }, [resetSeq]);

  useEffect(() => {
    return onTelemetry((event: TelemetryEvent) => {
      const current = coreState.current;
      const currentScenario = scenario.current;
      const currentDrillId = current?.runId.split(":")[0];
      if (!current || !currentScenario || (event.runId !== current.runId && event.runId !== currentDrillId)) return;

      let next = current;
      if (event.type === "GUIDE_WARNING_SENT") {
        next = appendSimulationEvent(
          current,
          "warden",
          {
            type: "message_sent",
            payload: {
              messageId: event.messageId,
              direction: event.direction,
              confidence: event.confidence,
            },
          },
          { actorId: event.actorId, actorKind: "warden", roomId: event.targetSector },
        );
      } else if (event.type === "GUIDE_WARNING_ACKNOWLEDGED") {
        next = appendSimulationEvent(
          current,
          "evacuee",
          {
            type: "message_acknowledged",
            payload: { messageId: event.messageId, acknowledged: true },
          },
          { actorId: event.actorId, actorKind: "player" },
        );
      } else if (event.type === "MAYA_ASSISTANCE_REQUESTED") {
        next = appendSimulationEvent(
          current,
          "warden",
          {
            type: "message_sent",
            payload: {
              messageId: event.messageId,
              direction: "assistance",
              confidence: "verified",
            },
          },
          { actorId: event.actorId, actorKind: "warden", roomId: event.roomId },
        );
      } else if (event.type === "MAYA_ASSISTANCE_ACKNOWLEDGED") {
        next = appendSimulationEvent(
          current,
          "evacuee",
          {
            type: "message_acknowledged",
            payload: { messageId: event.messageId, acknowledged: true },
          },
          { actorId: event.actorId, actorKind: "player" },
        );
        next = appendSimulationEvent(
          next,
          "evacuee",
          {
            type: "peer_assistance_requested",
            payload: {
              occupantId: event.occupantId,
              messageId: event.messageId,
              reason: "Navigator acknowledged the Guide request to assist Maya",
            },
          },
          { actorId: event.actorId, actorKind: "player" },
        );
      }

      if (next === current) return;
      coreState.current = next;
      useSimulation.getState().setCoreSnapshot(buildSimulationSnapshot(next, currentScenario));
    });
  }, [onTelemetry]);

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    const sim = useSimulation.getState();
    if (sim.failed || sim.assemblyConfirmed) return;
    if (sim.briefingStatus !== "complete") {
      runtime.useTarget = null;
      runtime.touchMove.x = 0;
      runtime.touchMove.y = 0;
      return;
    }

    if (sim.paused) {
      runtime.useTarget = null;
      // solo practice stops the clock; a shared drill keeps running for the warden
      if (sim.mode.kind === "solo" && runtime.drillStartedAt > 0) runtime.drillStartedAt += rawDt * 1000;
      if (sim.mode.kind === "solo") return;
    }

    const room = useSession.getState().room;
    if (room && room.phase !== "active") return;
    runtime.sector = roomAt(runtime.evacuee.x, runtime.evacuee.z);

    const currentScenario = scenario.current;
    let currentCore = coreState.current;
    if (!currentScenario || !currentCore) return;

    if (currentCore.phase === "idle") {
      currentCore = startSimulation(currentCore);
      coreState.current = currentCore;
    }

    if (sim.interventionApplied !== interventionState.current) {
      currentCore = setVentilationActive(currentCore, sim.interventionApplied);
      interventionState.current = sim.interventionApplied;
    }

    if (currentCore.phase === "running") {
      coreAccumulator.current += dt;
      const tickDuration = currentCore.clock.tickDurationSeconds || DEFAULT_TICK_DURATION_SECONDS;
      let ticks = 0;
      while (coreAccumulator.current >= tickDuration && ticks < 5 && currentCore.phase === "running") {
        currentCore = stepSimulation(currentCore, currentScenario);
        coreAccumulator.current -= tickDuration;
        ticks += 1;
      }
      coreState.current = currentCore;
      useSimulation.getState().setCoreSnapshot(buildSimulationSnapshot(currentCore, currentScenario));
    }

    const hazard = currentCore.hazards[runtime.sector];
    const elapsed = currentCore.clock.elapsedSeconds;
    const intensity = hazard?.density ?? 0;
    runtime.hazardElapsed = elapsed;
    runtime.alert = intensity * 100;
    sim.applySmokeExposure(elapsed, intensity, dt);

    let useTarget: typeof runtime.useTarget = null;
    const scenarioTarget = SCENARIO_OBJECTS
      .filter((object) => object.id === "main-exit" || !sim.scenarioProgress[object.id])
      .filter((object) => object.room === runtime.sector || (object.id === "main-exit" && (runtime.sector === "entry" || runtime.sector === "outside")))
      .map((object) => ({ object, distance: flatDistance(runtime.evacuee, new THREE.Vector3(...object.position)) }))
      .filter(({ object, distance }) => distance < object.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.object;

    if (scenarioTarget) {
      useTarget = { kind: "scenario", id: scenarioTarget.id };
    } else if (flatDistance(runtime.evacuee, assemblyPosition) < 2.8) {
      useTarget = { kind: "assembly", id: "outdoor-assembly" };
    } else if (flatDistance(runtime.evacuee, ventilationPosition) < 2.2) {
      useTarget = { kind: "intervention", id: "ventilation-panel" };
    }
    runtime.useTarget = useTarget;

    accumulator.current += dt;
    if (accumulator.current > 0.08) {
      accumulator.current = 0;
      sim.enterSector(runtime.sector);
      const scenario = useTarget?.kind === "scenario"
        ? SCENARIO_OBJECTS.find((object) => object.id === useTarget?.id)
        : null;
      const missing = scenario?.id === "main-exit"
        ? SCENARIO_OBJECTS.find((object) => object.id !== "main-exit" && !sim.scenarioProgress[object.id])
        : null;
      const prompt = scenario
        ? scenario.id === "main-exit"
          ? missing
            ? `Exit locked. Find the ${missing.label.toLowerCase()}.`
            : "Press E to leave through the marked exit"
          : scenario.kind === "pickup"
            ? `Press E to pick up the ${scenario.label.toLowerCase()}`
            : scenario.kind === "valve"
              ? "Press E to close the gas isolation valve"
              : `Press E to decode the ${scenario.label.toLowerCase()}`
        : useTarget?.kind === "assembly"
        ? "Press E to confirm assembly at the beacon"
        : useTarget?.kind === "intervention"
          ? sim.mode.kind === "solo"
            ? "Press E to apply the ventilation override"
            : "Warden authorization is required for this intervention"
          : null;
      sim.setPrompt(prompt);
    }
  });

  return null;
}
