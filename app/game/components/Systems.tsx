"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DOORS, ESCAPE_Z, MARKERS, roomAt, type MarkerDef } from "../level";
import {
  getSectorSmoke,
  isRouteBlocked,
  VENTILATION_SMOKE_FACTOR,
} from "../smoke";
import { clampDt, runtime } from "../runtime";
import { useSession } from "../session";
import { useGame } from "../store";

const pos = (id: string) =>
  new THREE.Vector3(...(MARKERS.find((m) => m.id === id) as MarkerDef).position);

const keypadPos = pos("keypad");
const alarmPos = pos("alarm");
const ventPos = pos("vault-vent");

const flat = (a: THREE.Vector3, b: THREE.Vector3) =>
  Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Everything the world knows: the smoke clock, air pressure, route state, which
 * sector the evacuee is in, and what pressing E would do. None of this is
 * view-specific - the views only decide what gets drawn.
 */
export default function Systems() {
  const acc = useRef(0);
  const hazardAcc = useRef(0);
  const resetSeq = useGame((s) => s.resetSeq);

  useEffect(() => {
    hazardAcc.current = 0;
    runtime.alert = 0;
    runtime.drillStartedAt = 0;
    runtime.hazardElapsed = 0;
    runtime.lastSeen = -100;
    runtime.lastTrapHit = -10;
    runtime.useTarget = null;
    runtime.seenBy.clear();
  }, [resetSeq]);

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    const store = useGame.getState();
    if (store.escaped) return;

    const sessionRoom = useSession.getState().room;
    if (sessionRoom && sessionRoom.phase !== "playing") return;
    if (runtime.drillStartedAt <= 0) runtime.drillStartedAt = Date.now();
    const elapsed = Math.max(
      0,
      (Date.now() - runtime.drillStartedAt) / 1000,
    );
    runtime.hazardElapsed = elapsed;

    /* --- which room are we in --------------------------------------- */
    runtime.room = roomAt(runtime.thief.x, runtime.thief.z);

    /* --- smoke and air pressure ------------------------------------ */
    const smoke =
      getSectorSmoke(runtime.room, elapsed) *
      (store.alarmDisabled ? VENTILATION_SMOKE_FACTOR : 1);
    runtime.alert = smoke * 100;
    hazardAcc.current += dt;
    if (hazardAcc.current >= 0.08) {
      const tickDt = hazardAcc.current;
      hazardAcc.current = 0;
      store.applySmokeExposure(elapsed, smoke, tickDt);
    }

    /* --- what would E (or Space) do right now ------------------------ */
    // released by the keypad, or found early by a spectator scanning for it
    const ventFound = store.ventOpen || !!store.discovered["vault-vent"];
    let useTarget: typeof runtime.useTarget = null;
    if (ventFound && flat(runtime.thief, ventPos) < 2.6)
      useTarget = { kind: "vent", id: "vault-vent" };
    else if (flat(runtime.thief, keypadPos) < 2.2 && !store.vaultOpen)
      useTarget = { kind: "keypad", id: "keypad" };
    else if (flat(runtime.thief, alarmPos) < 2.2 && !store.alarmDisabled)
      useTarget = { kind: "alarm", id: "alarm" };
    runtime.useTarget = useTarget;

    /* --- locked doors ----------------------------------------------- */
    let lockedNear: string | null = null;
    for (const d of DOORS) {
      if (!d.lock || store.keycard || store.doorsOpen[d.id]) continue;
      if (Math.hypot(runtime.thief.x - d.at[0], runtime.thief.z - d.at[2]) < 2.4)
        lockedNear = d.label;
    }

    /* --- getting out ------------------------------------------------ */
    const gotLoot = !!store.collected["vault-loot"];
    if (gotLoot && runtime.thief.z > ESCAPE_Z && store.hp > 0) store.escape();

    /* --- push to react at ~12hz ------------------------------------- */
    acc.current += dt;
    if (acc.current > 0.08) {
      acc.current = 0;
      store.enterRoom(runtime.room);

      const prompt = store.escaped
        ? null
        : useTarget?.kind === "vent"
          ? gotLoot
            ? "Press Space to jump into the vent - you have the loot"
            : "Press Space to jump into the vent and get out"
          : useTarget?.kind === "keypad"
            ? store.keycard || store.codeFound
              ? "Press E to use the keypad - it opens the vault and the vent"
              : "Press E - the keypad needs the keycard from the security room"
              : useTarget?.kind === "alarm"
                ? "Press E to activate the ventilation override"
                : isRouteBlocked("lobby", "vault", elapsed) &&
                    (runtime.room === "lobby" || runtime.room === "ecorr")
                  ? "East route is unsafe — use the west route"
                : lockedNear
                ? `${lockedNear} is locked - the keycard is in the security room`
                : ventFound
                  ? gotLoot
                    ? "Vent is open on the east wall - jump in (Space) to get out"
                    : "Vault is open. Grab the contents, then jump into the vent on the east wall"
                  : gotLoot
                    ? "Get back out through the entrance"
                    : null;
      store.setPrompt(prompt);
    }
  });

  return null;
}
