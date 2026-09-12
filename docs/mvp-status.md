# CampusEvac MVP Status

**Status:** [IN PROGRESS] This is the single feature-status register for the hackathon build.

Do not infer target implementation from architecture diagrams. The `Current evidence` column
describes the repository today; `Target status` describes work required for the CampusEvac MVP.

## Status Definitions

- `[IMPLEMENTED]` - verified in the current repository or by a repeatable test.
- `[IN PROGRESS]` - partially present, being migrated, or missing a required contract.
- `[PLANNED]` - designed but not implemented.
- `[POST-HACKATHON]` - intentionally outside the hackathon boundary.
- `[VALIDATION PENDING]` - requires participant or staff evidence before a claim is made.

## Feature Register

| Feature | Current evidence | Target status | MVP? | Owner | Dependency | Demo-critical? | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R3F, Three.js, and Rapier foundation | Existing renderer and physics components run. | [IMPLEMENTED] Preserve and retarget. | Yes | Engine | None | Yes | None; keep the current renderer. |
| Evacuee first-person controls | Existing keyboard, pointer, and touch paths exist, but content is legacy. | [IN PROGRESS] Retarget copy and interactions. | Yes | Gameplay | Engine | Yes | Desktop keyboard path. |
| Warden fixed sector view | Existing spectator-style view exists. | [IN PROGRESS] Add bounded evidence and information age. | Yes | UX / Gameplay | Engine, role contract | Yes | One authored fixed camera. |
| Two-person drill join | Current room flow exists through the deterministic local adapter. | [IN PROGRESS] Deploy the AWS contract. | Yes | Realtime | AppSync, Cognito | Yes | Deterministic local adapter for development. |
| Different role payloads | Local adapter constructs separate evacuee and warden payloads. | [IN PROGRESS] Enforce at deployed API and event construction. | Yes | Realtime | AppSync auth | Yes | Local role fixtures for UI work. |
| Low-visibility smoke | Authored deterministic smoke timeline is implemented locally. | [IN PROGRESS] Move authority to the room worker. | Yes | Simulation | Fargate worker | Yes | Deterministic smoke timeline. |
| Unsafe route block | Local adapter exposes one blocked edge with a visible reason. | [IN PROGRESS] Move route authority to the room worker. | Yes | Simulation | Authored route graph | Yes | Seeded block in local adapter. |
| Information states | Unknown, observed, verified, stale, and expired contract exists locally. | [IN PROGRESS] Enforce event/API state transitions. | Yes | Gameplay / UX | Event schema | Yes | Fixed fixture ages for demo. |
| Structured route message | Local adapter includes target, confidence, expiry, and acknowledgement. | [IN PROGRESS] Add deployed realtime delivery and replay. | Yes | Realtime / UX | AppSync | Yes | Caption-only message if audio fails. |
| One environmental intervention | Local adapter supports one bounded ventilation action. | [IN PROGRESS] Make the room worker authoritative. | Yes | Simulation | Fargate, Lambda validation | Yes | Deterministic intervention response. |
| Assembly success/failure | Current extraction result exists but is not the target assembly contract. | [IN PROGRESS] Assembly hold, outcome event, and failure reason. | Yes | Gameplay | Route graph, worker | Yes | Local outcome fixture. |
| Event ledger and checkpoints | CDK table and Lambda event scaffold exists; local events are not durable. | [IN PROGRESS] Persist meaningful events and one checkpoint. | Yes | Backend | DynamoDB | Yes | Local adapter snapshot. |
| Three-question AAR | Deterministic Lambda report scaffold exists; browser report UI is pending. | [IN PROGRESS] Safe, coordination failure, next practice. | Yes | Backend / UX | Lambda, DynamoDB | Yes | Deterministic client fixture for UI. |
| Bounded Bedrock scenario | Lambda fallback and bounded Bedrock proposal scaffold exists. | [IN PROGRESS] Deploy and prove validated parameters. | Should | AI / Backend | Bedrock, schema validation | Yes, if live | Fixed seed scenario. |
| Polly operational phrase | Lambda Polly/S3 fallback scaffold exists; local Web Audio remains active. | [IN PROGRESS] Deploy and prove cached phrases. | Should | Audio / Backend | Polly, S3, CloudFront | Yes, if live | Local Web Audio or text caption. |
| Cognito and role authorization | CDK user pool scaffold exists; browser auth is not wired. | [IN PROGRESS] Authorize drill membership and role-scoped subscriptions. | Should | Security | Cognito, IAM, AppSync | Yes | Pseudonymous local membership. |
| Mobile warden action deck | Existing touch surface exists; target commands are different. | [IN PROGRESS] Keep 48px targets and clear delivery states. | Yes | UX | Role command contract | Yes | Desktop keyboard fallback. |
| Officer console | No target console is implemented. | [POST-HACKATHON] Use a compact post-drill report instead. | No | UX / Backend | AAR | No | Three-question AAR. |
| Multiple wardens | Current prototype supports more seats but not target collaboration. | [POST-HACKATHON] Add sector ownership and conflict resolution after two-user loop. | No | Gameplay / Realtime | Shared observation model | No | One warden MVP. |
| User and staff validation | No evidence is recorded yet. | [VALIDATION PENDING] Run the study before impact claims. | Yes for evidence | Research | Validation plan | Yes for credibility | Label every claim as a hypothesis. |

## MVP Acceptance Gate

The MVP is not complete until a fresh participant pair can complete the following without a
facilitator narrating the interface:

1. Join and understand the two roles.
2. See different information in the same incident.
3. Notice the route becoming unsafe.
4. Verify or question the warden evidence.
5. Send and receive one structured message.
6. Observe one authoritative environmental change.
7. Reach assembly or understand the failure.
8. Read the AAR and start the recommended replay.

## Time-Constraint Rule

If any row marked `MVP? = Yes` is unstable, cut all `Should` and `Post-Hackathon` rows before
adding polish. A complete two-user information loop is more valuable than a larger map or a
larger AWS service diagram.
