# CampusEvac Hackathon Specification

**Status:** [PLANNED] Submission strategy and demo contract. Event-specific facts marked for
verification are not validated by this repository.

## Submission Position

CampusEvac is an asymmetric collaborative 3D emergency evacuation drill simulator. One
evacuee moves through a low-visibility building without the complete hazard picture. A warden
sees bounded evidence the evacuee cannot, verifies what is trustworthy, and communicates a
route or intervention. The drill turns that coordination into a replayable training report.

The central claim is a product hypothesis until the validation study is complete:

> CampusEvac trains the coordination problem that traditional evacuation drills often fail to
> expose: one person has incomplete information, another has partial situational awareness,
> and safety depends on how quickly they turn that information into the right decision.

## What Is Proven Versus Hypothesized

| Statement | Classification |
| --- | --- |
| The repository has a React Three Fiber and Rapier foundation. | [IMPLEMENTED] |
| The current browser prototype has a legacy SpacetimeDB room bridge. | [IMPLEMENTED] |
| Students and wardens need a better way to practice coordination under route uncertainty. | [VALIDATION PENDING] Problem hypothesis. |
| Structured information with confidence and age will improve route decisions. | [VALIDATION PENDING] Product hypothesis. |
| AWS services can support the target role-scoped drill. | [PLANNED] Architecture proposal until deployed and tested. |
| Bedrock, Polly, AppSync, Fargate, and DynamoDB are live in the current app. | False; do not claim this. |

## Problem Hypothesis

Scheduled drills may teach a memorized path without measuring how people respond to uncertainty,
communication delay, route changes, or conflicting information. CampusEvac tests whether a
controlled simulation can make those coordination decisions observable without pretending to be
a live emergency system.

The evidence plan, target participants, interview questions, prototype procedure, and decision
rules are in [`validation-plan.md`](validation-plan.md). No results are claimed yet.

## Users And MVP

The MVP is intentionally two-person:

| User | Demonstrated need | Interface |
| --- | --- | --- |
| Evacuee | Decide and move when the familiar route changes. | First-person low-visibility view. |
| Warden | Verify bounded evidence and deliver a useful instruction. | Fixed sector view and command deck. |

The safety officer is represented by the post-drill AAR, not a large live dashboard.

The full MVP boundary is maintained in [`product-truth.md`](product-truth.md) and the status
register in [`mvp-status.md`](mvp-status.md). The submission cannot add multiple hazards,
large maps, NPC systems, or extra AI features until the two-person loop is reliable.

## Core Demonstration

```text
OBSERVE -> VERIFY -> COMMUNICATE -> DECIDE -> ADAPT -> MEASURE -> REPLAY
```

The demo must show:

1. Two participants join one drill and receive different views.
2. Smoke reduces visibility and the obvious route becomes unsafe.
3. The warden sees evidence first, verifies it, and communicates with confidence and expiry.
4. The evacuee receives the message and retains the final route decision.
5. One authoritative ventilation or emergency-door action changes the environment.
6. The evacuee reaches assembly or receives an explained training failure.
7. The AAR identifies the coordination failure and offers a replay.

## Three-Minute Run Of Show

| Time | Story beat | Proof |
| --- | --- | --- |
| 0:00 | Traditional drills often measure completion, not coordination under uncertainty. | Mission brief. |
| 0:15 | Introduce one evacuee and one warden sharing the same incident. | Two devices, two interfaces. |
| 0:30 | Evacuee enters the compact block. | First-person view and captions. |
| 0:45 | Smoke increases; the normal route is blocked. | Environment change and route reason. |
| 0:55 | Warden verifies the evidence. | Confidence and information age. |
| 1:15 | Warden sends an alternate route message. | AppSync event and acknowledgement. |
| 1:30 | Evacuee adapts. | Message, route choice, and real-time response. |
| 1:40 | Warden triggers one bounded intervention. | Authoritative environment change. |
| 2:05 | Evacuee reaches assembly. | Outcome event. |
| 2:30 | Report answers safe evacuation, coordination failure, and next practice. | AAR. |
| 2:45 | Show one AWS proof and the deterministic fallback. | Event record, scenario, or cached audio. |
| 3:00 | Close with the product sentence. | CampusEvac identity. |

## Judge Mapping

The organizer's exact weights must be verified before submission. This matrix maps likely judge
questions to evidence without claiming official scoring:

| Judge concern | CampusEvac proof | Avoid |
| --- | --- | --- |
| Real problem | Validation plan, participant evidence when collected, and a concrete coordination loop. | Calling assumptions established facts. |
| Differentiation | Same incident shown through asymmetric evacuee and warden interfaces. | A generic multiplayer map or dashboard. |
| Technical execution | Role-scoped events, authoritative route/intervention state, ordered telemetry. | Calling client visuals authoritative. |
| AWS depth | One real AppSync path, one durable event/AAR record, and bounded AI/audio proof. | Listing unused services or screenshots. |
| UI quality | Immediate evacuee action, warden evidence age, captions, and mobile targets. | Dense controls and color-only alerts. |
| Presentation | A single crisis decision followed by replay. | A feature tour or architecture monologue. |

## AWS Proof Contract

The target AWS architecture is described in [`architecture-design.md`](architecture-design.md)
and [`ai-cloud-integration.md`](ai-cloud-integration.md). The current browser prototype still
uses the legacy SpacetimeDB bridge.

Minimum credible proof:

- An authenticated AppSync command or subscription crosses the role boundary.
- The warden cannot receive or request the evacuee-hidden hazard payload.
- One accepted command changes authoritative route or ventilation state.
- One meaningful event is durable in DynamoDB or the target AAR path.
- Bedrock either returns a validated bounded scenario or the demo visibly uses the fallback.
- Polly supplies a short cached phrase with an always-present caption, or the documented local
  fallback is shown.

## Event Facts

The following facts came from the team mission brief and are not independently verified here:

- Bharat Builds Tour 2026, AWS Builder Center x WeMakeDevs.
- Event 01: First Commit.
- Dates stated in the brief: September 17-20, 2026.
- Format stated in the brief: hybrid India with Bangalore in-person participation.
- Tracks stated in the brief: Best UI, Build It, Ship It.

Recheck dates, organizer rules, prizes, eligibility, and judging weights against the official
event page before publishing a submission. Do not use unverified prize or event claims as proof
of product impact.

## Submission Acceptance Gates

- [ ] A fresh two-person pair understands the role split without a facilitator.
- [ ] The blocked route is visible to the warden before it is obvious to the evacuee.
- [ ] A verified message includes target, confidence, and expiry.
- [ ] The environment changes only after an authoritative command is accepted.
- [ ] The evacuee can succeed without being remotely steered.
- [ ] The AAR produces one or two replay actions, not a metric wall.
- [ ] The demo shows current implementation honestly and labels target AWS work.
- [ ] The validation plan contains no invented participant evidence.

## Constraints And Limitations

CampusEvac is a controlled training simulation. It is not live emergency guidance, building
safety certification, a physically accurate fire or smoke model, or a guarantee of real-world
outcomes. Its score is a training coordination metric, not an institutional safety grade.

## References

- AWS AppSync realtime data: https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-data.html
- API Gateway WebSocket overview: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html
- Amazon Bedrock: https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html
- Amazon Polly: https://docs.aws.amazon.com/polly/latest/dg/what-is.html
- Amazon DynamoDB: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
- AWS Amplify Hosting: https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html
