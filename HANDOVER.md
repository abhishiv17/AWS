# CampusEvac — Project Handover & Roadmap

This document serves as the project status, architecture breakdown, and implementation roadmap for teammates picking up development on **CampusEvac**.

> **Note**: Do not copy this into `README.md`. Keep this as the dedicated team handover reference.

---

## Executive Summary

```
                    CAMPUS EVAC ROADMAP

PHASE 1  ── Map & exits                    ✓ COMPLETED
PHASE 2  ── Navigation & A*                ✓ COMPLETED
PHASE 3  ── Fire & smoke                   ✓ COMPLETED
PHASE 4  ── Maya / vulnerable peer         ✓ COMPLETED
                    │
                    ▼
PHASE 5  ── Guide / Overwatch              ← NEXT MILESTONE
PHASE 6  ── Scoring & AAR
PHASE 7  ── Scenario Engine
PHASE 8  ── Multiplayer Hardening
PHASE 9  ── Multi-floor / Campus
PHASE 10 ── Instructor Training Platform
```

The core simulation engine is now fully functional and verified: **physical world → navigation graph → dynamic hazard engine → human/NPC evacuation behavior**.

The next step is to make the second human player—the **Guide / Overwatch**—an active, gameplay-critical participant who can materially improve or worsen the Navigator's evacuation outcome.

---

## Completed Phases

### Phase 1 — Map Foundation & Two-Exit Geometry ✓
- Level 2 Science & Engineering Building architecture.
- 12 distinct rooms with verified bounding boxes (`app/simulation/level.ts`, `Building.tsx`, `Rooms.tsx`).
- Player spawn set inside Classroom 204 ($[-15, 1.1, -6]$).
- Dual independent evacuation exits:
  - **Assembly Area A** (West Courtyard via West Stairwell)
  - **Assembly Area B** (East Quad via East Stairwell)
- Completely eliminated the old single-exit circular cul-de-sac trap.

### Phase 2 — Navigation Graph & Dynamic $A^*$ ✓
- 25 spatial navigation nodes (`app/simulation/nav/nodes.ts`).
- 24 weighted edges with width and smoke density attributes (`app/simulation/nav/edges.ts`).
- $A^*$ dynamic pathfinding algorithm (`app/simulation/nav/pathfinding.ts`).
- Nearest-node player localization mapping arbitrary $(x, y, z)$ to graph vertices.
- Quadratic smoke penalty cost formula:
  $$\text{Cost} = L \cdot (1 + 8S^2) + \text{StatusPenalty}$$
- Live dynamic route calculation and polyline rendering on Minimap and HUD.
- Dynamic rerouting when an exit or stairwell becomes unavailable.
- Automated tests: `tests/navGraph.test.ts` (6/6 passing).

### Phase 3 — Dynamic Hazard Engine ✓
- Fire origin in Lab 202 (Organic Chemistry) igniting at $t = 15\text{s}$.
- Continuous differential smoke propagation across connected spaces:
  $$\frac{dS_i}{dt} = \sum_{j \in \text{adj}(i)} C_{ij}(S_j - S_i) + G_i - D_i$$
- Smoke affects navigation edge state across 4 distinct stages:
  $$\text{CLEAR} \longrightarrow \text{CAUTION} \longrightarrow \text{DANGEROUS} \longrightarrow \text{BLOCKED}$$
- Automatic $A^*$ rerouting when East Stairwell crosses blocked threshold ($S \ge 0.50$).
- Physiological air quality degradation scaling with smoke density ($1.8\times$ to $5.2\times$).
- 3D visual smoke particles and haze volumes (`SmokeHaze.tsx`) plus responsive screen vignette.
- Ventilation intervention mechanics: cuts generation by 80% (`VENTILATION_SMOKE_FACTOR = 0.20`), verified to reduce Lab 202 smoke from $0.764$ to $0.133$.
- Real-time hazard telemetry snapshots exposed for the Guide.
- Completely removed the old hardcoded timed route-blocking system.
- Automated tests: `tests/hazardEngine.test.ts` (7/7 passing).

### Phase 4 — Maya / Vulnerable Peer System ✓
- Maya deterministic spawn inside Classroom 205 ($[15, 1.0, -6]$).
- Full NPC state machine:
  $$\text{CALM} \xrightarrow{\text{alarm}} \text{ALARMED} \xrightarrow{\text{approach}} \text{WAITING\_FOR\_HELP} \xrightarrow{\text{assist}} \text{FOLLOWING} \xrightarrow{\text{exit}} \text{SAFE}$$
  With exception branches: `REASSESSING`, `LOST`, `DISTRESSED`, `ABANDONED`, `INCAPACITATED`.
- Player can assist Maya using proximity `[E]` key or deliberately leave her behind `[X]`.
- Maya uses the Navigation Graph with waypoint steering (`stepMayaAgent`).
- Dynamic hazard refusal & automatic $A^*$ rerouting: refuses paths where $S \ge 0.50$ or status is blocked.
- Smoke exposure causes distress dialogue, coughing, and $50\%$ speed slowdown.
- Abandonment is permanently logged with timestamp, coordinates, and dialogue response.
- Maya outcome (`saved`, `abandoned`, `in-transit`, `incapacitated`, `unmet`) logged for scoring.
- Maya state broadcast to the Guide console in real time.
- No hardcoded paths; completely dynamic graph steering.
- Automated tests: `tests/mayaSystem.test.ts` (7/7 passing).

---

## Current Test Suite & Verification

All **20 cumulative tests** are passing cleanly:

```bash
npm test
```

Suite breakdown:
1. `tests/navGraph.test.ts` (6 tests) — Connectivity, $A^*$, nearest node, smoke penalty, rerouting.
2. `tests/hazardEngine.test.ts` (7 tests) — Ignition, differential flow, 4-stage transitions, automatic reroute, air drain, ventilation mitigation, snapshot export.
3. `tests/mayaSystem.test.ts` (7 tests) — Spawn, state transitions, nav graph steering, hazard refusal, distress slowdown, abandonment logging, safe muster arrival.

### Quality Checks
```bash
npm run typecheck   # 0 errors
npm run lint        # 0 errors, 0 warnings
npm run build       # successful production bundle
```

---

## Remaining Phases (Roadmap for Next Sprints)

### Phase 5 — Guide / Overwatch (Next Immediate Milestone)
Make the second human player capable of materially improving or worsening the Navigator's evacuation outcome through asymmetric information.

1. **Asymmetric Information Boundaries**:
   - **Navigator**: Ground-level fog of war, smoke haze, immediate room visibility, no god-mode map.
   - **Guide**: Full tactical building view, 12-sector smoke heatmap, 24 edge statuses, Navigator and Maya locations, algorithmic $A^*$ recommendations.
2. **Four Core Guide Responsibilities**:
   - **Observe**: Fire origin (Lab 202), smoke densities, Navigator position, Maya status, exit/route conditions.
   - **Interpret**: Dynamic safest exit calculation (Exit A clear vs Exit B dangerous), Maya distressed/waiting.
   - **Communicate**: Dispatch tactical directives (`ROUTE_DIVERT_WEST`, `PEER_ASSIST_MAYA`, `ROUTE_CLEAR_CONFIRMED`, `HALT_HAZARD_AHEAD`). Navigator acknowledges with `[Q]`.
   - **Intervene**: Trigger HVAC ventilation override to purge smoke corridors, preserving egress paths.
3. **Telemetry Event Stream**:
   - Structured logging of drill events: `ALARM_RECEIVED`, `MAYA_DISCOVERED`, `MAYA_ASSISTED`, `MAYA_ABANDONED`, `GUIDE_WARNING_SENT`, `GUIDE_WARNING_ACKNOWLEDGED`, `ROUTE_CHANGED`, `ENTERED_DANGEROUS_ZONE`, `EXIT_REACHED`, `MUSTER_REACHED`, `VENTILATION_ACTIVATED`.

### Phase 6 — Scoring & After-Action Review (AAR)
Transform the simulation into an evaluative training platform:
- Calculate evacuation time ($t_{\text{muster}} - t_{\text{alarm}}$).
- Route efficiency score ($D_{\text{optimal\_safe}} / D_{\text{actual}}$).
- Coordination metrics: Guide warning sent $\rightarrow$ Navigator acknowledged $\rightarrow$ route adapted.
- Assistance scoring: Maya saved ($+300$), Maya abandoned ($-500$), Maya distressed ($-100$).
- Visual replay: side-by-side overlay of actual path taken vs optimal hazard-free path.
- Post-drill performance report card with exportable training metrics.

### Phase 7 — Scenario & Drill Engine
Transition from a single fixed fire drill into a configurable drill engine:
- Configurable emergency origin (Lab 202, Chem Store, Workshop 203, Electrical Closet).
- Multiple hazard types (chemical spill, electrical fire, dense smoke, active obstacle).
- Variable NPC configurations (single peer, multiple students, mobility-impaired peer).
- Configurable difficulty and dynamic intervention options.

### Phase 8 — Multiplayer Hardening
Solidify real-time 2-player synchronization:
- Authority and role reconciliation across AWS AppSync Events.
- Graceful disconnect and reconnect handling.
- Deterministic state interpolation and recovery.
- Robust room lifecycle management.

### Phase 9 — Multi-Floor & Campus Expansion
Scale beyond Level 2:
- Multi-floor vertical egress (stairwells, fire escapes, elevator lockouts).
- Outdoor courtyard and multi-building navigation.
- Multiple muster points with capacity constraints.

### Phase 10 — Instructor / Training Platform
Enterprise-grade training capabilities:
- Instructor dashboard for launching and monitoring live drills.
- Multi-team concurrent drill sessions.
- Session recording and automated After-Action Review (AAR) generation.
- Cohort and longitudinal team performance analytics.
