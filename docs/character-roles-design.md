# CampusEvac Character And Role Design

**Status:** [IN PROGRESS] The role contract is defined; the current prototype still exposes
legacy role and facility terminology in executable state.

## Role Contract

CampusEvac has two active roles and one post-drill consumer:

| Role | Agency | Deliberate limitation | MVP outcome |
| --- | --- | --- | --- |
| Evacuee | Moves, observes locally, receives messages, chooses a route. | Low visibility and incomplete hazard information. | Reaches assembly or understands the failed decision. |
| Warden | Verifies sector evidence, communicates, and applies one bounded intervention. | Cannot move or steer the evacuee and cannot see every sector. | Improves the quality and timing of coordination. |
| Safety officer | Reviews the AAR and chooses the next practice scenario. | Does not control the live MVP run. | Identifies one coordination bottleneck. |

The roles must be interdependent without turning the warden into a remote controller. The
evacuee owns movement and final commitment.

## Shared Incident, Different Information

Both active participants receive the same scenario identity, phase, route topology at a general
level, and outcome rules. They do not receive the same observations.

| Information | Evacuee | Warden |
| --- | --- | --- |
| Local visibility and nearby physical cues | Yes | As sector evidence, not first-person detail. |
| Hidden smoke source or thermal evidence | No | Only in assigned sector and permitted state. |
| Route message | Yes after delivery | Yes with delivery and expiry. |
| Confidence and evidence age | Message confidence/age only | Full source, confidence, and age. |
| Complete route solution | No | No. |
| Other sector details | Only physically encountered | No unless assigned or explicitly shared. |

The boundary must exist in transport payloads and server authorization, not only in visibility
components.

## Evacuee

### Presence And Movement

The evacuee is a practical campus participant: reflective lanyard or strip, readable silhouette,
and no decorative combat identity. The connection indicator must not reveal a hidden location
through walls.

- First-person camera with pointer lock on desktop.
- Virtual movement and touch look on coarse pointers.
- Walk, optional sprint, interact, and pause.
- Walking always remains viable.
- Local prediction keeps controls responsive while the authoritative state remains server-owned.

### Evacuee HUD

Show only information the evacuee can legitimately know:

- Current sector and physical objective.
- Simple air/oxygen pressure state, without medical claims.
- Stamina while sprinting or recovering.
- Stable compass and valid route marker.
- Latest warden message with source, confidence, and expiry.
- Connection state: `connected`, `reconnecting`, or `offline`.

Never show a thermal map, hidden hazard coordinates, warden-only confidence, or a global safety
score during movement.

### Evacuee Interaction

Each prompt has a verb, target, progress state, result, and caption/audio cue. The player must
never guess whether an action was accepted.

MVP interactions:

- Read a route sign or physical clue.
- Approach an emergency door or ventilation panel.
- Receive and acknowledge a route message.
- Hold at the assembly point.

## Warden

### Sector Assignment

The warden receives one authored sector view with:

- Stable camera orientation and sector label.
- Known entrances, exits, and relevant equipment.
- Permitted evidence overlays with source and age.
- Evacuee marker only when the scenario allows it.
- A small command deck showing current actions and cooldowns.

The warden cannot orbit the entire building or solve the route from a global map.

### Watch Mode

Watch answers: `What is happening in my sector right now?`

- Current smoke/route state.
- Evidence freshness.
- Evacuee marker and heading when permitted.
- Last command acknowledgement.
- One clear route consequence.

### Discovery And Verification

Discovery answers: `What can I confirm before I tell someone to move?`

- Select a large labeled evidence target.
- See what, where, source, confidence, age, and next action.
- Verify, leave uncertain, or re-check after the world changes.
- Do not turn discovery into a trivia puzzle.

### Command Deck

At any time, show only the two or three highest-value actions:

- `Verify east route`
- `Send route west`
- `Mark east route unsafe`
- `Apply ventilation override`

Each command displays its target, reason, cooldown, delivery state, and expiry. Denied commands
explain `not your sector`, `evidence stale`, `panel offline`, or `already applied`.

## Structured Message

```text
messageId
drillId
senderId
senderSector
targetSector
direction
kind: route | hazard | wait | assembly
confidence: observed | verified
urgency: normal | urgent
createdAt
expiresAt
caption
```

The warden must be able to explain the message from evidence. The evacuee receives a compact
marker and caption, not the warden's camera feed.

## Fairness And Recovery

- The warden has at least one useful observation and one possible action.
- A warden action creates a visible world or message consequence.
- A disconnected warden loses active control but does not erase the last valid evidence.
- The evacuee retains a deterministic physical fallback route.
- Server-side cooldowns and rate limits prevent command spam.
- Multiple wardens and sector ownership are `[POST-HACKATHON]`; the MVP uses one warden.

## Onboarding

### Evacuee briefing

1. `Visibility is limited. Move toward the marked objective.`
2. `Listen for route messages and watch the air state.`
3. `You decide when to move. The warden can guide, not steer.`

### Warden briefing

1. `Watch your sector, then verify before you call.`
2. `Use a target, direction, confidence, and expiry.`
3. `An intervention changes the environment only when the panel permits it.`

## Debrief Behavior

If the evacuee fails, show the timeline of what the warden observed, verified, sent, and what the
evacuee received. Do not label a participant unsafe. Label the drill decision and offer a
focused replay.
