# CampusEvac UI And UX Design

**Status:** [IN PROGRESS] The target surfaces are defined; the current app still contains legacy
room and role flows.

## UX Promise

The evacuee knows what they can do next without receiving hidden information. The warden knows
what is confirmed, what is uncertain, and which bounded action may improve the route. The AAR
turns the run into one clear next practice step.

## MVP Surfaces

| Surface | User | Job | Scope |
| --- | --- | --- | --- |
| Mission brief | Everyone | Explain the training contract and safety disclaimer. | MVP |
| Drill lobby | Pair | Join, see roles, and wait for the seeded scenario. | MVP |
| Evacuee view | Evacuee | Move, observe locally, receive a route message, reach assembly. | MVP |
| Warden station | Warden | Observe evidence, verify, communicate, and apply one intervention. | MVP |
| AAR | Pair and safety officer | Answer three questions and choose a replay. | MVP |
| Officer console | Safety officer | Create and compare many institutional drills. | [POST-HACKATHON] |

## Evacuee HUD

```text
 +------------------------------------------------------------+
 | SECTOR: JUNCTION                 SIGNAL: CONNECTED         |
 |                                                            |
 |                         3D VIEW                            |
 |                                                            |
 | [captioned route message]                    [marker]      |
 |                                                            |
 | AIR: GETTING THIN     STAMINA: 58     OBJECTIVE: ASSEMBLY  |
 | [move] [look]                                  [use]       |
 +------------------------------------------------------------+
```

Required:

- Simple air/oxygen pressure state without medical claims.
- Stamina visible while sprinting or recovering.
- Current sector, stable compass, and physical objective.
- Latest valid route message with source, confidence, and expiry.
- Interaction prompt outside the look surface.
- Captions for route, door, ventilation, and critical pressure cues.
- Connection state: `connected`, `reconnecting`, or `offline`.

Never show a thermal map, hidden hazard coordinates, warden confidence, or global score during
movement.

## Warden Station

```text
 +------------------------------------------------------------+
 | SECTOR: JUNCTION        SIGNAL: FRESH 0.2s                 |
 | [fixed camera with sector evidence]                        |
 |                                                            |
 | EVIDENCE: EAST ROUTE BLOCKED / OBSERVED / 8s AGO           |
 | [VERIFY] [SEND WEST ROUTE] [MARK BLOCK] [INTERVENE]        |
 | delivery: pending          cooldown: ready                 |
 +------------------------------------------------------------+
```

### Watch mode

- Sector name and connection freshness.
- Route state and evidence age.
- Evacuee marker when permitted.
- Last three events with source and age.
- Text alternative for every visual evidence overlay.

### Discovery mode

- Large labeled evidence targets.
- A card showing `what`, `where`, `source`, `confidence`, `age`, and `next action`.
- Actions to verify, leave uncertain, or re-check.
- Persistent age marker after discovery so old evidence does not look live.

### Command card

Every command card contains:

```text
VERB + TARGET
why it is available
confidence and evidence age
cooldown
delivery state
expiry
```

Example:

```text
SEND WEST ROUTE
East route is verified unsafe; west route remains available.
verified | ready | expires in 12s
```

## AAR Surface

The first view is not a dashboard. It is a calm three-card report:

1. `Did we evacuate safely?` Show outcome, route, exposure bucket, and assembly state.
2. `Where did coordination fail?` Show the largest evidence, message, or route delay.
3. `What should we practice next?` Show one replay button with a focused scenario change.

An optional details drawer can expose event timestamps, score components, and rules version.

## Responsive Rules

| Device | Layout | Interaction rule |
| --- | --- | --- |
| Small phone portrait | Full-screen evacuee or one warden sector feed with bottom rail. | One-thumb reach and 48px targets. |
| Phone landscape | Wider view and two-row warden actions. | Preserve captions and safe-area padding. |
| Tablet | Sector feed with persistent evidence rail. | Support two-handed operation. |
| Desktop | 3D view plus command/telemetry panel. | Keyboard shortcuts are discoverable, not required. |

Use `env(safe-area-inset-*)` for controls. The look surface must not cover captions, actions,
or browser back gestures.

## State And Recovery UX

| State | Message | User action |
| --- | --- | --- |
| Joining | `Connecting to drill...` | Wait or cancel. |
| Waiting | `Waiting for the other role` | Review role briefing. |
| Preparing | `Preparing a safe, solvable scenario` | Continue with the deterministic fallback if needed. |
| Reconnecting | `Signal lost. Holding your seat.` | Retry automatically; show freshness. |
| Command pending | `Sending west-route message` | Avoid duplicate action; show sequence. |
| Command denied | `Panel offline` or `Not your sector` | Explain why. |
| Complete | `Assembly confirmed` | Open AAR or replay. |
| Failed | `Training outcome recorded` | Review the decision timeline. |

Stale state is visible and actionable. The interface must not silently present the last known
route as current.

## Accessibility

- Never use color as the only hazard or delivery signal.
- Keep keyboard focus order through lobby, warden actions, and AAR.
- Give canvas controls an adjacent DOM label or text action.
- Captions are on by default for emergency audio.
- Provide reduced motion and reduced effects preferences.
- Provide high-contrast thermal/evidence patterns and labels.
- Keep targets at least 48 CSS pixels with useful separation.
- Keep text readable over smoke and sensor treatments.
- Offer a practice mode with no failure for control learning.

## Copy System

| Avoid | Prefer |
| --- | --- |
| `You are dying` | `Air is getting thin. Move toward clear air.` |
| `Wrong!` | `Evidence is not confirmed. Check the route.` |
| `Power-up` | `Emergency control` |
| `Spectator` | `Warden` |
| `Game over` | `Training outcome recorded` |
| `You lost` | `The route was not completed. Review the decision.` |

## Join Flow

1. Show the mission and safety disclaimer.
2. Open a role-neutral join page.
3. Explain that the host assigns the role.
4. Confirm the role, sector, controls, and connection state.
5. Preserve only a short-lived reconnect token in session storage.
6. Offer a manual room code when QR scanning is unavailable.

## Privacy And Safety

- Do not request a real building address or personal movement history.
- Use pseudonymous display names in the drill.
- Make it clear that the simulation is not live emergency guidance.
- Let participants exit or pause during practice.
