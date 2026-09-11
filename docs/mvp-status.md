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
| Two-person drill join | Current room flow exists through SpacetimeDB. | [IN PROGRESS] Replace transport with AWS contract. | Yes | Realtime | AppSync, Cognito | Yes | Deterministic local adapter for development. |
| Different role payloads | Current prototype separates views; target payload boundary is not deployed. | [PLANNED] Enforce at API and event construction. | Yes | Realtime | AppSync auth | Yes | Local role fixtures for UI work. |
| Low-visibility smoke | Current visuals are not the target hazard model. | [PLANNED] One bounded smoke field across authored sectors. | Yes | Simulation | Fargate worker | Yes | Deterministic smoke timeline. |
| Unsafe route block | Legacy route objects exist; target route authority does not. | [PLANNED] One blocked edge with visible reason. | Yes | Simulation | Authored route graph | Yes | Seeded block in local adapter. |
| Information states | No target confidence and age contract is implemented. | [PLANNED] Unknown, observed, verified, stale, expired. | Yes | Gameplay / UX | Event schema | Yes | Fixed fixture ages for demo. |
| Structured route message | Current command path exists under the legacy bridge. | [IN PROGRESS] Add target, confidence, age, expiry, and acknowledgement. | Yes | Realtime / UX | AppSync | Yes | Caption-only message if audio fails. |
| One environmental intervention | Current controls are not the target ventilation model. | [PLANNED] One server-authorized ventilation or door action. | Yes | Simulation | Fargate, Lambda validation | Yes | Deterministic intervention response. |
| Assembly success/failure | Current extraction result exists but is not the target assembly contract. | [IN PROGRESS] Assembly hold, outcome event, and failure reason. | Yes | Gameplay | Route graph, worker | Yes | Local outcome fixture. |
| Event ledger and checkpoints | Target ledger is designed, not wired. | [PLANNED] Persist meaningful events and one checkpoint. | Yes | Backend | DynamoDB | Yes | Local JSON event log for development. |
| Three-question AAR | Target AAR is designed, not wired. | [PLANNED] Safe, coordination failure, next practice. | Yes | Backend / UX | Lambda, DynamoDB | Yes | Deterministic client fixture for UI. |
| Bounded Bedrock scenario | No AWS Bedrock integration is implemented. | [PLANNED] Generate validated parameters before a drill. | Should | AI / Backend | Bedrock, schema validation | Yes, if live | Fixed seed scenario. |
| Polly operational phrase | Current prototype uses a different voice path. | [PLANNED] Cache short phrases with captions and fallback. | Should | Audio / Backend | Polly, S3, CloudFront | Yes, if live | Local Web Audio or text caption. |
| Cognito and role authorization | Current auth belongs to the legacy bridge. | [PLANNED] Authorize drill membership and role-scoped subscriptions. | Should | Security | Cognito, IAM, AppSync | Yes | Private demo token only for local development. |
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
