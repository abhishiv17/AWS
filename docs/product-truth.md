# CampusEvac - Product Truth

**Status:** [IN PROGRESS] Documentation source of truth; target product is not fully implemented.

This document resolves product scope and terminology. Other documents may add detail, but they
must not contradict this page.

## Core Problem

**Problem hypothesis:** Traditional evacuation drills can show whether people completed a route,
but may not expose how people make decisions when a route becomes uncertain or how quickly
warden information reaches the person moving through the building.

This is a hypothesis, not a validated finding. Evidence is **[VALIDATION PENDING]**. The
validation plan is in [`validation-plan.md`](validation-plan.md).

## Core User

The MVP serves one participant pair:

| User | Job during the drill | Limitation |
| --- | --- | --- |
| Evacuee | Move through a low-visibility building, evaluate guidance, and reach assembly. | Cannot see the complete hazard picture. |
| Warden | Observe bounded evidence, verify a hazard, communicate, and perform one permitted intervention. | Cannot move or directly control the evacuee. |

The safety officer is a post-drill consumer, not a live MVP role. The officer reviews the
after-action report and chooses a replay exercise.

## Core Differentiator

> One person is inside the building and cannot see the whole situation. The warden can see
> information the evacuee cannot. The quality of the evacuation depends on how effectively they
> discover, communicate, and act on incomplete information.

The product is an operational training instrument presented through a game-like interface. It
is not a military game, a generic multiplayer game, or a dashboard pretending to be an emergency
response system.

## Core Gameplay Loop

```text
OBSERVE -> VERIFY -> COMMUNICATE -> DECIDE -> ADAPT -> MEASURE -> REPLAY
```

Information asymmetry is the gameplay engine. Navigation, smoke, audio, and scoring exist to
make this loop legible and consequential.

## Hard MVP Boundary

The hackathon MVP ships only the smallest complete proof:

1. Two participants join one drill.
2. One participant becomes the evacuee and one becomes the warden.
3. The two participants receive different information.
4. The evacuee enters a compact low-visibility environment.
5. One meaningful route becomes unsafe or blocked.
6. The warden discovers and verifies the route problem.
7. The warden sends a structured route message with confidence and expiry.
8. The evacuee receives the message in real time and chooses whether to follow it.
9. One authoritative intervention changes the environment, such as a ventilation override.
10. The evacuee reaches the assembly point or produces a clear training failure.
11. The system records the important events.
12. The system produces an actionable after-action report with a replay recommendation.

The MVP has one authored block, one primary smoke scenario, one blocked route, one alternate
route, one intervention, one audio phrase family, and one deterministic fallback scenario.

## Explicitly Out Of MVP

- Fire propagation or physically accurate smoke and toxic chemistry.
- Multiple hazard types active in the same drill.
- Large maps, crowd simulation, NPC response, or advanced enemy systems.
- A 20-player mode or a full multi-warden collaboration model.
- Continuous AI conversation or free-form voice input.
- A large officer dashboard, campus trend analytics, or certification workflows.
- Persistent student ranking, attendance surveillance, or personally identifying movement history.

These belong in the cut list unless the complete MVP loop is already reliable.

## Validation Status

**[VALIDATION PENDING]** No participant counts, interviews, quotes, survey results, or outcome
percentages are claimed in this repository. The validation plan defines what to collect before
making a product or impact claim.

The question to test is:

> Do people struggle when an evacuation route becomes uncertain, and does structured
> warden-to-evacuee communication improve decision making?

## Implementation Status

| Area | Current repository | CampusEvac target |
| --- | --- | --- |
| 3D renderer and physics | [IMPLEMENTED] React Three Fiber, Three.js, and Rapier foundation. | Preserve and retarget the engine. |
| Local interaction | [IMPLEMENTED] Existing first-person, fixed-view, touch, and interaction surfaces. | Keep the input model; replace facility content. |
| Room transport | [IMPLEMENTED] SpacetimeDB bridge and generated bindings. | Replace with the AWS realtime contract. |
| Gameplay state | [IN PROGRESS] Legacy facility-shaped state remains. | Server-authoritative smoke, route, intervention, and drill state. |
| AWS services | [PLANNED] No production AppSync, Fargate, Bedrock, Polly, or DynamoDB path is wired. | Use only where each service proves a visible MVP responsibility. |
| AAR | [PLANNED] No target report pipeline is implemented. | Three-question coordination report and replay failure. |
| User evidence | [VALIDATION PENDING] | Run the documented study before claiming measured impact. |

## AWS Proof

AWS is part of the target implementation, not a claim about the current browser prototype.
The demo should prove only these responsibilities:

| Service | MVP responsibility | Judge-visible proof | Status |
| --- | --- | --- | --- |
| AppSync | Authenticated drill commands and role-scoped realtime events. | A warden command is acknowledged by the evacuee client. | [PLANNED] |
| ECS Fargate | Authority for the active room's route block and intervention state. | One command changes the shared environment for both views. | [PLANNED] |
| Lambda | Validate commands, prepare scenarios, and calculate the AAR. | Invalid command rejection or report generation trace. | [PLANNED] |
| DynamoDB | Durable drill metadata, event ledger, checkpoint, and AAR. | One drill record and ordered event sequence. | [PLANNED] |
| Bedrock | Propose bounded scenario parameters before the drill. | Valid JSON scenario or deterministic fallback. | [PLANNED] |
| Polly | Synthesize short cached operational phrases. | Captioned audio phrase with cache hit or fallback. | [PLANNED] |
| Cognito/IAM | Authenticate and authorize role and drill access. | Evacuee cannot subscribe to warden evidence. | [PLANNED] |
| Amplify/CloudFront | Deliver the web application and assets. | Public demo URL with repeatable deployment. | [PLANNED] |

## Three-Minute Demo Story

| Time | Story |
| --- | --- |
| 0:00 | State the gap: drills often measure completion, not coordination under uncertainty. |
| 0:15 | Introduce the evacuee and warden interfaces for the same incident. |
| 0:30 | Evacuee enters the compact building with limited visibility. |
| 0:45 | Smoke increases and the obvious route becomes unsafe. |
| 0:55 | Warden observes evidence and verifies the route block. |
| 1:15 | Warden sends an expiring alternate-route message. |
| 1:30 | Evacuee receives the message and decides whether to adapt. |
| 1:40 | The warden performs one ventilation or door intervention. |
| 2:05 | Evacuee reaches assembly or the drill records a focused failure. |
| 2:30 | AAR answers the three questions and recommends a replay. |
| 2:45 | Show one AWS event, one durable event record, and the deterministic fallback path. |
| 3:00 | Close: "CampusEvac turns evacuation drills into measurable coordination training." |

Every feature in the MVP must earn its place in this story.

## Post-Hackathon Features

- Multiple wardens with sector ownership, shared observations, conflicts, and acknowledgement.
- Additional authored campus blocks and scenario variants.
- More than one intervention and richer replay comparison.
- Officer history across drills with privacy-preserving aggregates.
- Bedrock-assisted report phrasing after deterministic metrics are computed.
- Production multi-room scaling, stronger availability, and institutional administration.

## Limitations

CampusEvac is a controlled training simulation. It is not a real emergency-response authority,
building safety certification tool, substitute for physical evacuation drills, physically accurate
fire or smoke simulation, or guarantee of real-world evacuation outcomes. The score is a training
metric and must never be presented as proof that a campus is safe.

## Documentation Map

### 01 - Product and hackathon strategy

- [`product-truth.md`](product-truth.md)
- [`hackathon-spec.md`](hackathon-spec.md)
- [`validation-plan.md`](validation-plan.md)
- [`mvp-status.md`](mvp-status.md)

### 02 - Gameplay and simulation

- [`system-gameplay-design.md`](system-gameplay-design.md)
- [`character-roles-design.md`](character-roles-design.md)
- [`environment-level-design.md`](environment-level-design.md)

### 03 - UX and visual system

- [`ui-ux-design.md`](ui-ux-design.md)
- [`visual-design.md`](visual-design.md)

### 04 - Technical architecture

- [`architecture-design.md`](architecture-design.md)

### 05 - AI and cloud integration

- [`ai-cloud-integration.md`](ai-cloud-integration.md)

### 06 - Validation and evidence

- [`validation-plan.md`](validation-plan.md)
- [`compliance-scoring-spec.md`](compliance-scoring-spec.md)

### 07 - Build guide and cut list

- `README.md`
- [`build-cut-list.md`](build-cut-list.md)
