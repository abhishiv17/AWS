# CampusEvac

CampusEvac is an asymmetric, collaborative 3D evacuation drill simulator. One evacuee moves
through a low-visibility campus block with incomplete information. One warden verifies bounded
evidence, communicates a route, and applies one permitted intervention. The drill ends in an
actionable after-action report.

> CampusEvac is a controlled training simulation, not live emergency guidance, a safety
> certification system, or proof of real-world evacuation outcomes.

**Status:** [IN PROGRESS] The engine foundation exists; the CampusEvac scenario and AWS target
are still being migrated.

## Current Status

**Repository state:** The renderer, physics, input surfaces, and legacy SpacetimeDB room bridge
are present. The CampusEvac scenario model, AWS realtime adapter, and AAR pipeline are still in
migration.

| Area | Status |
| --- | --- |
| React Three Fiber, Three.js, Rapier | `[IMPLEMENTED]` Existing engine foundation. |
| Local first-person/fixed-view/touch interaction | `[IMPLEMENTED]` Existing interaction surfaces. |
| SpacetimeDB room bridge | `[IMPLEMENTED]` Current migration bridge, not target architecture. |
| CampusEvac smoke/route/intervention state | `[IN PROGRESS]` Legacy facility-shaped state remains. |
| AWS AppSync, Fargate, DynamoDB, Bedrock, Polly | `[PLANNED]` No production path is wired. |
| Validation evidence | `[VALIDATION PENDING]` See `docs/validation-plan.md`. |

The scope, terminology, demo story, and limitations are defined in [`docs/product-truth.md`](docs/product-truth.md).

## MVP Loop

```text
OBSERVE -> VERIFY -> COMMUNICATE -> DECIDE -> ADAPT -> MEASURE -> REPLAY
```

The hackathon MVP is deliberately small:

- One evacuee and one warden in one drill.
- One compact authored campus block.
- One primary smoke scenario.
- One blocked route and one validated alternate.
- One structured route message with confidence and expiry.
- One ventilation or emergency-door intervention.
- One assembly outcome and three-question AAR.

Fire propagation, multiple active hazards, large maps, NPCs, continuous AI voice, multi-warden
coordination, and institutional dashboards are outside the MVP.

## Quickstart

### Prerequisites

- Node.js 20 or newer.
- npm.
- A browser with WebGL support for the 3D routes.

### Install

```bash
npm install
```

### Configure the current local bridge

```bash
copy .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead. The current browser prototype uses the
SpacetimeDB variables. The AWS variables are placeholders for the planned adapter.

Do not put long-lived AWS access keys in `.env`, the browser bundle, or source control. Use IAM
roles, AWS SSO, or deployment-provided credentials.

### Run

```bash
npm run dev
```

Open `http://localhost:3000`.

### Verify

```bash
npm run lint
npm run build
```

There is no `npm test` script in the current package. The deterministic scenario, event ledger,
and AAR tests are part of the planned migration gates.

## Deployment

The current repository has no committed AWS infrastructure or production AWS adapter.

For a local/self-hosted build:

```bash
npm run build
npm run start
```

For the planned AWS deployment:

1. Deploy the Next.js app through Amplify Hosting or the approved CloudFront/origin path.
2. Inject target environment variables through the deployment system, not the browser bundle.
3. Configure Cognito, AppSync, the Fargate room worker, Lambda, and DynamoDB according to
   [`docs/architecture-design.md`](docs/architecture-design.md).
4. Configure Bedrock and Polly fallbacks before enabling either provider in a live drill.
5. Verify role-scoped subscriptions, command denial, reconnect behavior, durable events, and the
   three-question AAR before calling the target path operational.

Until those steps are complete, describe the deployment as `[PLANNED]` and use the current
SpacetimeDB bridge for the browser prototype.

## Environment Variables

| Variable | Current use | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_SPACETIME_HOST` | Current room/landing bridge endpoint. | `[IMPLEMENTED]` |
| `NEXT_PUBLIC_SPACETIME_MODULE_NAME` | Current bridge module identifier. | `[IMPLEMENTED]` |
| `NEXT_PUBLIC_SITE_URL` | Local/public site URL. | `[IMPLEMENTED]` |
| `NEXT_PUBLIC_SPACETIME_AUTH_CLIENT_ID` | Optional current bridge auth client. | `[IMPLEMENTED]` |
| `AWS_REGION` | Target AWS region. | `[PLANNED]` |
| `NEXT_PUBLIC_APPSYNC_URL` | Target AppSync GraphQL endpoint. | `[PLANNED]` |
| `NEXT_PUBLIC_APPSYNC_EVENTS_URL` | Target AppSync Events endpoint. | `[PLANNED]` |
| `COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID` | Target identity configuration. | `[PLANNED]` |
| `BEDROCK_MODEL_ID` | Target bounded scenario generator. | `[PLANNED]` |
| `POLLY_VOICE_ID` / `POLLY_ENGINE` | Target short phrase synthesis. | `[PLANNED]` |
| `DYNAMODB_DRILL_TABLE` | Target event/AAR table. | `[PLANNED]` |

See [`.env.example`](.env.example) for the complete template. Empty target variables do not mean
the AWS integration is active.

## Routes

| Route | Current behavior |
| --- | --- |
| `/` | Mission brief, product framing, and entry points. |
| `/rooms` | Create or join a room using the current bridge flow. |
| `/room/[code]` | Room lobby and current multiplayer game shell. |
| `/play` | Solo training sandbox using the current game shell. |
| `/api/voice` | Existing voice helper endpoint; not the planned Polly path. |
| `/api/puzzle` | Existing puzzle helper endpoint; not part of the CampusEvac MVP contract. |

Legacy route/state identifiers may remain in executable code during migration. They are not the
CampusEvac product terminology.

## Controls

### Desktop

- `W A S D`: move.
- `Shift`: sprint.
- `Space`: jump/step.
- `E`: interact.
- Mouse: look after pointer lock.

### Mobile/tablet

- Left virtual control: move.
- Right touch surface: look.
- Action buttons: interact and jump/step.

## Architecture Boundary

The current bridge is SpacetimeDB. The target AWS path is AppSync for commands/events, a small
Fargate worker for active mutable room state, Lambda for validation/AAR jobs, DynamoDB for
meaningful events and checkpoints, Bedrock for bounded pre-drill proposals, and Polly for short
cached phrases with captions.

Read [`docs/architecture-design.md`](docs/architecture-design.md) before adding cloud code. The
browser must never become authoritative for role permissions, route validity, intervention state,
or drill outcome.

## Documentation

### Product and strategy

- [`docs/product-truth.md`](docs/product-truth.md): source of truth for scope, terminology, and claims.
- [`docs/hackathon-spec.md`](docs/hackathon-spec.md): demo, submission, and judge-evidence contract.
- [`docs/validation-plan.md`](docs/validation-plan.md): study design and evidence discipline.
- [`docs/mvp-status.md`](docs/mvp-status.md): feature status, ownership, dependencies, and fallbacks.
- [`docs/build-cut-list.md`](docs/build-cut-list.md): what must ship, should ship, and must be cut.

### Product design

- [`docs/system-gameplay-design.md`](docs/system-gameplay-design.md): loop, scenario, and authority rules.
- [`docs/character-roles-design.md`](docs/character-roles-design.md): evacuee and warden contracts.
- [`docs/environment-level-design.md`](docs/environment-level-design.md): compact block and route graph.
- [`docs/ui-ux-design.md`](docs/ui-ux-design.md): role interfaces, recovery, and accessibility.
- [`docs/visual-design.md`](docs/visual-design.md): visual states, smoke, evidence, and asset scope.

### Cloud and evidence

- [`docs/architecture-design.md`](docs/architecture-design.md): current bridge and target AWS boundary.
- [`docs/ai-cloud-integration.md`](docs/ai-cloud-integration.md): Bedrock, Polly, realtime, persistence, and fallbacks.
- [`docs/compliance-scoring-spec.md`](docs/compliance-scoring-spec.md): event ledger, Drill Coordination Score, and AAR.

## Repository Notes

- The current generated SpacetimeDB binding is kept only as migration support.
- The local environment template contains no long-lived AWS credentials.
- AWS work must follow the status labels above and update `docs/mvp-status.md` with evidence.
