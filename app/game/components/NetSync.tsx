"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MARKERS, type RoomId } from "../level";
import { runtime } from "../runtime";
import { useSession } from "../session";
import { useGame, useIsHost } from "../store";
import type { Snapshot } from "../net/types";

const PUBLISH_HZ = 12;

const keys = (m: Record<string, boolean>) =>
  Object.keys(m).filter((k) => m[k]);

/**
 * The wire between clients. The thief's client owns the simulation and pushes a
 * snapshot 12 times a second; spectators fold what they receive back into the
 * same runtime + store the renderers already read from.
 */
export default function NetSync() {
  const isHost = useIsHost();
  const inRoom = useGame((s) => s.mode.kind !== "solo");
  const publish = useSession((s) => s.publish);
  const onSnapshot = useSession((s) => s.onSnapshot);
  const onDiscover = useSession((s) => s.onDiscover);
  const acc = useRef(0);

  // host: apply scans coming in from spectators
  useEffect(() => {
    if (!isHost || !inRoom) return;
    return onDiscover((itemId) => {
      const def = MARKERS.find((m) => m.id === itemId);
      useGame.getState().discover(itemId, def?.label ?? itemId);
    });
  }, [isHost, inRoom, onDiscover]);

  // spectator: fold snapshots into the local world
  useEffect(() => {
    if (isHost || !inRoom) return;
    return onSnapshot((snap: Snapshot) => {
      runtime.netThief = {
        x: snap.thief[0],
        y: snap.thief[1],
        z: snap.thief[2],
        yaw: snap.thief[3],
      };
      runtime.thiefYaw = snap.thief[3];
      runtime.hazardElapsed = snap.hazardElapsed ?? runtime.hazardElapsed;
      runtime.room = snap.room;
      runtime.alert = snap.alarm;
      useGame.getState().applySnapshot(snap);
    });
  }, [isHost, inRoom, onSnapshot]);

  useFrame((_, dt) => {
    if (!isHost || !inRoom) return;
    acc.current += dt;
    if (acc.current < 1 / PUBLISH_HZ) return;
    acc.current = 0;

    const s = useGame.getState();
    publish({
      t: Date.now(),
      hazardElapsed: runtime.hazardElapsed,
      thief: [
        runtime.thief.x,
        runtime.thief.y,
        runtime.thief.z,
        runtime.thiefYaw,
      ],
      room: runtime.room,
      hp: s.hp,
      alarm: s.alarm,
      spotted: s.spotted,
      guards: {},
      cams: {},
      keycard: s.keycard,
      codeFound: s.codeFound,
      vaultOpen: s.vaultOpen,
      ventOpen: s.ventOpen,
      alarmDisabled: s.alarmDisabled,
      escaped: s.escaped,
      down: s.hp <= 0,
      loot: s.loot,
      score: s.score,
      collected: keys(s.collected),
      discovered: keys(s.discovered),
      doorsOpen: keys(s.doorsOpen),
      explored: keys(s.explored as Record<string, boolean>) as RoomId[],
      log: s.log,
    });
  });

  return null;
}
