# CampusEvac AI And Cloud Integration

**Status:** [IN PROGRESS] The repository contains the target schema, CDK resources, and Lambda
fallbacks. Deployment, Cognito client wiring, and the authoritative room worker remain pending.

## Integration Rule

AWS services are included only when they have a visible product responsibility. A service is
not evidence of technical depth until the demo proves its input, output, failure behavior, and
relationship to the drill.

## MVP Responsibilities

| Service | Why it exists | Data handled | Demo proof |
| --- | --- | --- | --- |
| AppSync | Authenticated commands and role-scoped realtime events. | Drill membership, command intent, acknowledgement, snapshots, captions. | Warden command arrives at the evacuee and is acknowledged. |
| ECS Fargate | Maintain authoritative state for the active drill. | Route block, smoke level, intervention state, phase, checkpoint. | One accepted intervention changes both views. |
| Lambda | Stateless validation and bounded jobs. | Scenario request, command validation, AAR calculation, Polly/Bedrock orchestration. | Invalid command is rejected or AAR is generated. |
| DynamoDB | Durable drill history without frame-by-frame writes. | Drill metadata, event ledger, checkpoint, AAR. | An ordered event record can be inspected after the run. |
| Bedrock | Propose a bounded scenario variation before the drill. | Structured scenario parameters and briefing text. | Schema-valid scenario or deterministic fallback. |
| Polly | Produce short operational phrases. | Normalized phrase, voice settings, cached audio object. | Captioned phrase plays from cache or falls back locally. |
| Cognito/IAM | Authenticate and authorize access. | User identity, drill membership, role claims. | An evacuee cannot subscribe to warden evidence. |
| S3/CloudFront | Cache audio and static assets. | Polly audio objects and application assets. | A repeated phrase is served from cache. |

## Bedrock Scenario Pipeline

Bedrock proposes. The simulation engine decides.

### Allowed MVP output

```json
{
  "scenarioVersion": "campus-block-v1",
  "seed": 18421,
  "smokeOriginSector": "utility-control",
  "blockedRoute": "east-route",
  "smokeIntensity": 0.55,
  "intervention": "ventilation-override",
  "briefing": "Confirm the east route before sending the evacuee there."
}
```

The example is a schema illustration, not a generated or validated result.

### Validation sequence

1. Send a constrained prompt requesting JSON only and bounded enum values.
2. Parse the response in Lambda.
3. Validate the shape with Zod or an equivalent runtime schema.
4. Validate all IDs against the authored topology and interaction catalog.
5. Reject scenarios with no valid route, multiple simultaneous route failures, unsupported
   interactions, or a smoke intensity outside the permitted range.
6. Run a deterministic route check using the supplied seed.
7. Store the approved scenario, model metadata, schema version, and seed.
8. Use the fixed fallback scenario when Bedrock is unavailable, slow, invalid, or rate-limited.

Bedrock must never decide live movement, expose hidden hazard data, or alter an active drill
without a server-authorized command.

## Polly Phrase Policy

Polly generates short operational phrases, not continuous conversation:

- `Route east is blocked.`
- `Proceed to the west route.`
- `Ventilation restored.`
- `Assembly point ahead.`

The backend normalizes a phrase and keys its cache by voice, language, engine, and phrase text.
The audio is stored in S3 and served through CloudFront. The event always includes caption text
and a semantic action so audio failure does not block the decision.

Do not synthesize every frame, every movement update, or free-form radio chatter during the MVP.
Repeated short phrases are cheaper, clearer, easier to caption, and safer to retry.

## Realtime And Data Boundary

- AppSync carries intent, commands, acknowledgements, and role-scoped events.
- Fargate owns the active drill's authoritative route and smoke transitions.
- DynamoDB stores meaningful events, checkpoints, and AAR inputs, not rendered frames.
- The evacuee payload excludes thermal cells, hidden hazard coordinates, and warden confidence.
- The warden payload includes only its assigned sector and evidence allowed by the scenario.
- Lambda validates command role, target, phase, cooldown, version, and idempotency key.

## Failure Behavior

| Failure | Required behavior |
| --- | --- |
| Bedrock timeout or invalid JSON | Reject response, log reason, start the deterministic scenario. |
| Polly timeout | Show caption and local deterministic cue; retry cached phrase later. |
| AppSync reconnect | Preserve the seat, show stale state, replay from the last acknowledged version. |
| Fargate worker loss | Mark the drill recoverable or incomplete; never silently report success. |
| DynamoDB write failure | Keep the live drill state in the worker, retry checkpoint/event writes, and mark the AAR incomplete if durability is not restored. |
| Unauthorized command | Return a visible denial with no environment change. |

## Future Integrations

These are [POST-HACKATHON] unless the MVP is already reliable:

- Additional scenario families with human-reviewed authored constraints.
- Bedrock-assisted wording for one or two deterministic AAR insights.
- Multiple active rooms with autoscaled Fargate workers.
- API Gateway WebSockets if measured routing or custom framing requires it.
- Cross-region durability, institutional history, and more advanced governance.

## Proof Checklist

- [ ] The live demo shows a real AWS event crossing the role boundary.
- [ ] The live demo shows a real durable drill event or report record.
- [ ] The live demo shows a schema-valid Bedrock response or documented fallback.
- [ ] The live demo shows Polly audio with a visible caption and fallback behavior.
- [ ] The browser never contains an AWS secret or long-lived access key.
- [ ] A failed provider does not make the drill impossible to finish or understand.
