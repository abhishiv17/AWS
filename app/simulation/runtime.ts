import * as THREE from "three";
import { EVACUEE_SPAWN, type RoomId } from "./level";

/** Keep physics stable when a tab wakes up after a frame hitch. */
export const clampDt = (dt: number) => Math.min(dt, 0.05);

/**
 * Per-frame state shared by the R3F systems. Durable drill state belongs to the
 * room authority; this object only holds render and input values.
 */
export const runtime = {
  evacuee: new THREE.Vector3(...EVACUEE_SPAWN),
  evacueeYaw: 0,
  sector: "classroom-204" as RoomId,
  alert: 0,
  drillStartedAt: 0,
  hazardElapsed: 0,
  /** Authoritative evacuee transform received by a warden client. */
  netEvacuee: null as null | {
    x: number;
    y: number;
    z: number;
    yaw: number;
  },
  /** What the action button can do at the current position. */
  useTarget: null as null | {
    kind: "intervention" | "assembly" | "maya";
    id: string;
  },

  /* input shared by keyboard and coarse-pointer controls */
  jumpAt: -1e9,
  touchMove: { x: 0, y: 0 },
  touchLook: { dx: 0, dy: 0 },
};
