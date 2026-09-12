"use client";

import { runtime } from "./runtime";
import { useGame } from "./store";

/**
 * The two evacuee actions, in one place.
 *
 * A key press and a thumb on a button have to mean exactly the same thing, so
 * neither the keyboard subscription nor the on-screen buttons own this logic -
 * they both call in here.
 */

/** `E` / the INTERACT button: a visible panel or the assembly beacon. */
export function pressUse() {
  const game = useGame.getState();
  if (game.air <= 0 || game.failed || game.assemblyConfirmed) return;
  const target = runtime.useTarget;
  if (target?.kind === "intervention") {
    if (game.mode.kind === "solo") game.applyIntervention();
    else game.push("The warden must authorize the ventilation intervention.", "info");
  } else if (target?.kind === "assembly") {
    game.confirmAssembly();
  }
}

/** `Space` / the JUMP button: a small hop for route readability. */
export function pressJump() {
  const game = useGame.getState();
  if (game.air <= 0 || game.failed || game.assemblyConfirmed) return;
  runtime.jumpAt = performance.now();
}
