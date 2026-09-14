"use client";

import { runtime } from "./runtime";
import { useSimulation } from "./store";

/**
 * The two evacuee actions, in one place.
 *
 * A key press and a thumb on a button have to mean exactly the same thing, so
 * neither the keyboard subscription nor the on-screen buttons own this logic -
 * they both call in here.
 */

/** `E` / the INTERACT button: a visible panel or the assembly beacon. */
export function pressUse() {
  const sim = useSimulation.getState();
  if (sim.air <= 0 || sim.failed || sim.assemblyConfirmed) return;
  const target = runtime.useTarget;
  if (target?.kind === "intervention") {
    if (sim.mode.kind === "solo") sim.applyIntervention();
    else sim.push("The warden must authorize the ventilation intervention.", "info");
  } else if (target?.kind === "assembly") {
    sim.confirmAssembly();
  } else if (target?.kind === "maya") {
    sim.assistMaya();
  }
}

/** `Space` / the JUMP button: a small hop for route readability. */
export function pressJump() {
  const sim = useSimulation.getState();
  if (sim.air <= 0 || sim.failed || sim.assemblyConfirmed) return;
  runtime.jumpAt = performance.now();
}
