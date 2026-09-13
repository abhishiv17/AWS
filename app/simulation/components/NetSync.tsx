"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { runtime } from "../runtime";
import { useSession } from "../session";
import { useSimulation, useIsSimulationOwner } from "../store";
import type { EvacueeState } from "../net/types";

const PUBLISH_HZ = 12;

/** Converts local prediction into the small role-scoped state sent to the room. */
function readEvacueeState(version: number): EvacueeState {
  const sim = useSimulation.getState();
  return {
    kind: "evacuee",
    t: Date.now(),
    hazardElapsed: runtime.hazardElapsed,
    stateVersion: version,
    eventSequence: version,
    position: [
      runtime.evacuee.x,
      runtime.evacuee.y,
      runtime.evacuee.z,
      runtime.evacueeYaw,
    ],
    sectorId: runtime.sector,
    air: sim.air,
    smokeIntensity: sim.smokeIntensity,
    stamina: sim.stamina,
    routeStatus: sim.routeStatus,
    interventionApplied: sim.interventionApplied,
    assemblyProgress: sim.assemblyProgress,
    assemblyConfirmed: sim.assemblyConfirmed,
    failed: sim.failed,
    routeMessage: sim.latestMessage,
    log: sim.log,
  };
}

export default function NetSync() {
  const ownsSimulation = useIsSimulationOwner();
  const inRoom = useSimulation((state) => state.mode.kind !== "solo");
  const publish = useSession((state) => state.publish);
  const onEvacueeState = useSession((state) => state.onEvacueeState);
  const onWardenState = useSession((state) => state.onWardenState);
  const acc = useRef(0);
  const version = useRef(0);

  useEffect(() => {
    if (!ownsSimulation || !inRoom) return;
    return onEvacueeState((state) => {
      if (useSimulation.getState().mode.kind === "evacuee")
        useSimulation.getState().applyEvacueeState(state);
    });
  }, [inRoom, onEvacueeState, ownsSimulation]);

  useEffect(() => {
    if (ownsSimulation || !inRoom) return;
    return onWardenState((state) => {
      if (state.evacuee) {
        runtime.netEvacuee = {
          x: state.evacuee.position[0],
          y: state.evacuee.position[1],
          z: state.evacuee.position[2],
          yaw: state.evacuee.position[3],
        };
        runtime.sector = state.evacuee.sectorId;
        runtime.evacueeYaw = state.evacuee.position[3];
      } else {
        runtime.netEvacuee = null;
      }
      runtime.alert = state.smokeIntensity * 100;
      useSimulation.getState().applyWardenState(state);
    });
  }, [inRoom, onWardenState, ownsSimulation]);

  useFrame((_, dt) => {
    if (!ownsSimulation || !inRoom) return;
    acc.current += dt;
    if (acc.current < 1 / PUBLISH_HZ) return;
    acc.current = 0;
    version.current += 1;
    publish(readEvacueeState(version.current));
  });

  return null;
}
