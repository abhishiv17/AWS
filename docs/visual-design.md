# CampusEvac Visual Design

**Status:** [IN PROGRESS] The visual language is defined; implementation is still a mix of
legacy facility visuals and the target campus scenario.

## Visual Thesis

CampusEvac should feel like a calm operational training instrument viewed through a human game
interface. It is not a neon stealth game, a military command console, or a realistic disaster
simulator. Surfaces, signage, smoke, and restrained evidence overlays exist to make decisions
legible under pressure.

## Visual Priorities

1. Make the next safe-enough action readable.
2. Make uncertainty and information age visible.
3. Let the evacuee and warden feel like they share one incident without sharing one map.
4. Make the environment change visibly after an authoritative intervention.
5. Preserve mobile readability before adding atmosphere.

## Tokens

Color is never the only signal. Every state also uses text, shape, pattern, or motion.

| Token | Hex | Use | Companion signal |
| --- | --- | --- | --- |
| `safety-amber` | `#f59e0b` | Attention and pending action. | Triangle, `CHECK` label. |
| `siren-red` | `#ef4444` | Active hazard or blocked route. | Hatched band and reason text. |
| `exit-green` | `#10b981` | Verified route and assembly. | Chevron and `VERIFIED` label. |
| `thermal-yellow` | `#facc15` | Recent evidence. | Square marker and timestamp. |
| `signal-blue` | `#38bdf8` | Communication and unknown state. | Dashed ring and source. |
| `smoke-slate` | `#334155` | Smoke, disabled, and stale surfaces. | Hollow cross or broken line. |
| `paper` | `#f8fafc` | Briefing and AAR surfaces. | Ink border and calm spacing. |
| `ink` | `#0f172a` | Background and structural outlines. | Visible borders. |

## Information States

| State | Shape | Color | Text |
| --- | --- | --- | --- |
| `UNKNOWN` | Dashed ring | Signal blue | `UNKNOWN` |
| `OBSERVED` | Square marker | Thermal yellow | `OBSERVED 8s AGO` |
| `VERIFIED` | Exit chevron | Exit green | `VERIFIED` |
| `STALE` | Broken line | Safety amber | `STALE: CHECK AGAIN` |
| `EXPIRED` | Hollow cross | Smoke slate | `EXPIRED` |
| `BLOCKED` | Hatched band | Siren red | `ROUTE BLOCKED: REASON` |

These states must remain distinguishable in grayscale and high-contrast mode.

## Surface Language

- **Evacuee world:** matte concrete, practical painted doors, floor strips, emergency signs,
  and motivated pools of overhead or exit light.
- **Warden view:** neutral cutaway architecture, restrained thermal bands, sector labels, and
  timestamped evidence markers. It is an evidence layer, not a second game world.
- **Briefing/AAR:** paper-white cards, ink borders, amber index marks, and slower spacing.
- Avoid floating sci-fi panels, decorative glitch, arbitrary emissive geometry, and effects that
  do not encode state.

## Lighting And Smoke

### Evacuee

- Keep collision geometry, doors, and floor edges readable at mobile brightness.
- Use smoke to reduce distance and detail, not to create an unreadable black screen.
- Use amber near uncertainty and green only after a route is verified.
- Represent urgency with breathing rhythm and contrast reduction, not a constant red wash.

### Warden

- Use one stable camera per assigned sector.
- Keep enough architecture visible to explain left/right orientation.
- Add evidence as overlays with source, age, and confidence.
- Show the evacuee marker only where the role contract permits it.

### First implementation

Use a cheap layered fog/noise effect driven by the authoritative sector intensity:

1. Sample low-frequency world-space noise.
2. Modulate density by the local smoke state.
3. Fade with distance so the next interaction remains readable.
4. Disable detail noise in reduced-effects mode.

Do not add full volumetric ray marching to the MVP.

## Camera Effects

Optional sensor treatment is limited to the warden viewport:

- Very low-opacity scanline or sensor texture.
- Sector identifier and server timestamp.
- Short transition cue when evidence changes.
- No persistent shake or glitch that interferes with route reading.

Accessible mode removes scanlines and noise while retaining labels, patterns, and timestamps.

## Typography And Copy

- Use the existing Geist family for explanatory text.
- Use Geist Mono for timestamps, sector IDs, and telemetry values.
- Use sentence case for instructions and uppercase only for compact state labels.
- Target at least 14px body text on phones and 16px for primary instructions.
- Commands use `VERB + TARGET`, for example `Mark west route unsafe`.
- Avoid punitive copy such as `You lost`; use `Training outcome recorded`.

## Animation Rules

- Anticipation: show a route marker before its state becomes active.
- Impact: give a door, smoke, or message change one clear transition.
- Recovery: settle the effect before the next signal arrives.
- Keep UI transitions around 150-300ms and environment changes around 500-900ms.
- Never make a critical status depend on animation completion.
- Honor reduced motion for camera, breathing, scanline, and smoke-detail effects.

## Engine Mapping

| Existing component | CampusEvac use |
| --- | --- |
| `Building.tsx` | Campus walls, openings, doors, and cutaway boundaries. |
| `Rooms.tsx` | Foyer, dorm, utility, junction, service, and stair landmarks. |
| `Furniture.tsx` | Lockers, beds, racks, panels, signs, and benches. |
| `Exterior.tsx` | Outdoor assembly point and campus edge. |
| `ViewRig.tsx` | Evacuee first-person and fixed warden sector framing. |
| `Minimap.tsx` | Lightweight route, evidence, and assembly layer. |
| `Markers.tsx` | Equipment, hazard, route, and state overlays. |
| `TouchControls.tsx` | Mobile movement, look, and action controls. |

## Asset And Scope Policy

The MVP needs readable geometry, lighting, signs, effects, and captions more than imported
character models. Limit new assets to emergency signs, neutral campus decals, and small audio
phrase sets. If an effect does not improve comprehension, cut it before cutting accessibility.
