---
name: campusevac-game-design
description: Use when researching, reviewing, designing, or implementing CampusEvac evacuation drills, AWS multiplayer, safety gameplay, audio, roles, environments, command decks, UI/UX, maps, or mobile interaction.
---

# CampusEvac Game Design Skill

## Purpose

Use this skill to keep CampusEvac a credible emergency-evacuation training
simulation rather than a generic action game. Every mechanic should improve
shared situational awareness, decision quality, accessibility, or drill
readiness.

## Product Contract

- CampusEvac is a browser-based, asymmetric, collaborative 3D evacuation drill.
- The evacuee navigates a changing campus with incomplete hazard information.
- Wardens and observers interpret map data, verify reports, and issue bounded
  guidance without directly controlling the evacuee.
- The target production platform is AWS: AppSync or API Gateway WebSockets,
  Lambda, optional ECS Fargate room workers, Bedrock, Polly, DynamoDB,
  CloudFront, Amplify, Cognito, and CloudWatch.
- The current browser build contains a legacy room bridge and client simulation.
  Treat it as a migration baseline, not as the product contract.

## Source Of Truth

Read the relevant dossier before changing behavior:

- `docs/hackathon-spec.md` defines event alignment, judging, and demo scope.
- `docs/architecture-design.md` defines service boundaries and migration order.
- `docs/system-gameplay-design.md` defines the drill loop and state machine.
- `docs/visual-design.md` defines the visual language and safety color tokens.
- `docs/character-roles-design.md` defines evacuee and warden responsibilities.
- `docs/environment-level-design.md` defines campus sectors, hazards, and routes.
- `docs/ui-ux-design.md` defines role-specific desktop and mobile interaction.
- `docs/compliance-scoring-spec.md` defines readiness scoring and telemetry.

Executable code still establishes the migration baseline:

- `app/game/level.ts` is the current map source of truth.
- `app/game/store.ts` and `app/game/runtime.ts` own local state and simulation.
- `app/game/GameShell.tsx` owns current HUD, onboarding, and end-state policy.
- `app/game/components/TouchControls.tsx` owns coarse-pointer controls.
- `app/game/net/spacetimeNet.ts` is the temporary network adapter.
- `spacetime/src/index.ts` and generated bindings are the temporary room backend.

## Design Principles

1. Make information asymmetry useful. Each role must receive evidence the
   other role cannot safely obtain alone.
2. Keep all roles active. An observer must interpret, prioritize, confirm, or
   communicate; passive spectating is not a finished role.
3. Treat hazards as readable systems. Show source, direction, confidence,
   urgency, and recommended action instead of relying on surprise.
4. Preserve agency. Guidance creates a decision; it never silently moves a
   player or removes a meaningful choice.
5. Use realistic emergency priorities: life safety, route verification,
   accountability, accessibility, and clear communication before score chasing.
6. Make every space legible through landmarks, lighting, signage, sound, and
   route affordances.
7. Provide redundant feedback through at least two of text, sound, shape,
   motion, haptics, and color. Never use color alone.
8. Build the smallest reliable vertical slice before adding more sectors,
   hazards, progression, or procedural complexity.
9. Avoid combat, loot, stealth, and threat fantasies that undermine the
   training purpose. Pressure should come from time, uncertainty, congestion,
   and competing safety decisions.

## Character And Role Rules

- Evacuees need readable movement, objective, stamina, injury, and route state.
- Wardens need a command deck that exposes evidence and uncertainty, not a
  direct-control view of the evacuee.
- Role identity must use silhouette, posture, equipment, and typography in
  addition to color.
- Commands must have context, acknowledgement, cooldown, and a visible result.
- A disconnected participant needs a visible recovery path and a safe state.

## Environment Rules

- Each campus sector needs a landmark, an assembly relationship, a safe route,
  a fast route, and a route with a meaningful risk or information tradeoff.
- Hazards must have cause, propagation, mitigation, and recovery states.
- Use doors, stairs, signage, lighting, alarms, and furniture as navigation
  grammar rather than decoration.
- Keep sightlines and map disclosures intentional so the command deck informs
  decisions without turning the drill into a solved diagram.

## Audio And Accessibility Rules

- Define the meaning of an audio event before selecting its sound or voice.
- Prioritize directional hazard, route, acknowledgement, injury, and assembly
  cues over background music.
- Polly output must have a deterministic visual transcript and local fallback.
- Captions, readable contrast, keyboard controls, touch controls, reduced
  motion, and non-audio alerts are required parts of the experience.
- Microphone or voice input must never be required to complete a drill.

## AWS And State Rules

- Do not put AWS long-lived credentials in browser configuration.
- Keep high-frequency movement separate from durable room state and telemetry.
- AppSync or API Gateway carries validated commands and event distribution;
  DynamoDB stores durable room, identity, checkpoint, and audit records.
- Bedrock generates or validates scenario content before a drill, not during a
  latency-sensitive movement decision.
- Polly generation is server-side, cached through S3 and CloudFront, and
  accompanied by text fallback.
- A room worker must be replaceable from a checkpoint and event sequence.
- Do not remove the temporary bridge until the AWS path covers room creation,
  role assignment, reconnect, command acknowledgement, drill completion, and
  telemetry integrity.

## Implementation Workflow

1. State the player problem, safety consequence, rule, and smallest vertical
   slice before editing code.
2. Verify whether the behavior exists in executable code, only in a document,
   or only in a generated artifact.
3. Preserve the current R3F, Rapier, camera, touch, and multi-view foundation
   unless a measured product requirement justifies replacing it.
4. Keep visibility and role permissions centralized; do not expose hidden
   hazard state through a public payload and hide it only in a renderer.
5. Test one evacuee and one warden on separate devices, then test reconnect,
   room end, rematch, provider failure, mobile input, and reduced motion.
6. Prefer one complete feedback loop over several partial features.

## Review Checklist

- Does the change use CampusEvac terminology and safety framing?
- Does every role have a meaningful decision?
- Is the next action clear without relying on color alone?
- Does the change preserve the mobile and low-end browser path?
- Is the network authority and recovery behavior explicit?
- Does telemetry support a defensible readiness score?
- Does the demo remain reliable on four devices and without external voice?
