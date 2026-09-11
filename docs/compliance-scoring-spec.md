# CampusEvac Drill Coordination Score And After-Action Report

**Status:** [PLANNED] The event contract and report shape are defined; no participant results or
institutional score claims exist.

## Purpose And Boundary

The score is a training coordination signal for one simulated drill. It is not a safety
certification, medical assessment, student ranking, attendance system, or proof that a campus is
safe during a real emergency.

Use the product phrase **Drill Coordination Score**. Avoid institutional safety-score wording in
the MVP because it implies a broader claim than the evidence supports.

## AAR Questions

Every completed or failed run answers three questions in plain language:

1. **Did we evacuate safely?**
2. **Where did coordination fail?**
3. **What should we practice next?**

The report should show one or two evidence-backed insights and one replay recommendation. It is
not a large live dashboard.

## Event Principles

- The authoritative room worker emits server-timestamped events.
- Events have a monotonic sequence, drill ID, event type, actor role, sector, and rules version.
- Client timestamps are retained only for latency comparison and clock-skew context.
- Store meaningful transitions and route buckets, not identifying video of every keystroke.
- Participant names are optional display metadata; reports default to pseudonymous IDs.
- Corrections append a new event instead of silently rewriting history.

## Event Envelope

```json
{
  "drillId": "drill_pending",
  "eventId": "evt_pending",
  "sequence": 0,
  "serverTime": "pending",
  "eventType": "route_message_delivered",
  "actorRole": "warden",
  "actorPseudonym": "p_pending",
  "sectorId": "corridor-junction",
  "targetId": "west-route",
  "payload": {
    "messageId": "msg_pending",
    "confidence": "verified",
    "expiresAt": "pending"
  },
  "rulesVersion": "score-v1"
}
```

The values above are placeholders, not recorded evidence.

## Required Events

| Event | Why it matters |
| --- | --- |
| `drill_started` | Establishes the timing window. |
| `role_joined` / `role_reconnected` | Explains participation and recovery. |
| `evidence_observed` | Starts the observation-to-action timeline. |
| `evidence_verified` | Separates seeing from trusting. |
| `route_blocked` | Establishes the meaningful decision. |
| `route_message_sent` / `delivered` / `acknowledged` | Measures communication quality. |
| `intervention_requested` / `accepted` / `completed` / `denied` | Shows authoritative change. |
| `sector_entered` | Supports route and hesitation analysis without raw movement history. |
| `assembly_confirmed` / `drill_failed` | Closes the outcome. |

## MVP Metrics

| Metric | Definition | Use in AAR |
| --- | --- | --- |
| Safe outcome | Assembly confirmed without a critical route violation. | Answers safe evacuation. |
| Decision delay | Route block to first valid alternate-route decision. | Finds hesitation. |
| Verification delay | Evidence observed to verified. | Finds uncertainty handling. |
| Communication delay | Verified message sent to acknowledgement. | Finds coordination friction. |
| Useful message rate | Delivered messages containing valid target, direction, confidence, and expiry. | Finds message quality. |
| Exposure bucket | Time in the bounded smoke state, reported as a training bucket. | Adds context without medical claims. |
| Intervention result | Accepted intervention changed the authored state or was explicitly denied. | Explains environment response. |
| Route deviation | Chosen route versus valid route graph after the block. | Explains route quality. |

Do not optimize solely for speed. A fast route through an unsafe state must not outperform a
slightly slower safe decision.

## Score Model

The score is `[PLANNED]` and must be versioned. A simple MVP model can combine normalized
components:

```text
coordinationScore = 100 * (
  0.30 * safeOutcome
  + 0.25 * messageQuality
  + 0.20 * verificationQuality
  + 0.15 * routeDecision
  + 0.10 * interventionHandling
)
```

Guardrails:

- A critical route violation caps the score and is shown explicitly.
- Missing telemetry produces `incomplete`, not a zero disguised as failure.
- A successful assembly cannot erase unsafe exposure or a contradictory message.
- Faster-than-target completion does not create a score above 100.
- Components and rules version are visible in the report.

Do not publish grade bands or campus-wide trends until the validation and governance work exists.
If a presentation needs a visual summary, use `Strong`, `Needs attention`, or `Incomplete` and
show the evidence behind it.

## AAR Shape

```json
{
  "drillId": "drill_pending",
  "scenarioVersion": "campus-block-v1",
  "rulesVersion": "score-v1",
  "outcome": "pending",
  "coordinationScore": null,
  "status": "incomplete",
  "answers": {
    "safeEvacuation": "pending",
    "coordinationFailure": "pending",
    "nextPractice": "pending"
  },
  "metrics": {
    "decisionDelayMs": null,
    "verificationDelayMs": null,
    "communicationDelayMs": null,
    "usefulMessageRate": null,
    "exposureBucket": null,
    "routeDeviation": null
  },
  "insights": [],
  "replayRecommendation": "pending",
  "generatedAt": "pending"
}
```

The report generator should produce deterministic insights from the ledger. Bedrock may help
word a bounded explanation later, but it cannot invent an insight that is absent from the
events.

## Training Loop

```text
DRILL -> MEASURE -> IDENTIFY FAILURE -> REPLAY -> IMPROVE
```

The replay button should name a focused change, such as `Replay with east route blocked` or
`Replay after verifying before messaging`. `Try again` without a reason is not an AAR.

## Privacy And Governance

- Use pseudonymous participant IDs by default.
- Do not retain live building layouts, real personal movement histories, or microphone streams.
- Keep raw event telemetry only for the approved training retention period.
- Allow deletion/export of identifiable account data where accounts exist.
- Do not use the score for discipline, ranking, attendance, or employment decisions without
  explicit institutional governance and consent.
- Restrict report access by campus and role, and audit report reads/exports.

## Integrity And Acceptance Checks

- Duplicate event or command IDs are rejected.
- Event sequence is monotonic per drill.
- Replaying the same seed and fixture produces the same score and insights.
- A disconnected client cannot create false zero-latency commands.
- A worker loss marks the report incomplete.
- Every insight links to one or more event types and a human-readable explanation.
