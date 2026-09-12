# CampusEvac

CampusEvac is an asymmetric, collaborative 3D evacuation drill simulator. One evacuee moves
through a low-visibility campus block with incomplete information. One warden verifies bounded
evidence, communicates a route, and applies one permitted intervention. The drill ends in an
actionable after-action report.

> CampusEvac is a controlled training simulation, not live emergency guidance, a safety
> certification system, or proof of real-world evacuation outcomes.

**Status:** [IN PROGRESS] The engine, deterministic local drill, AppSync boundary, and AWS CDK
scaffold exist; the production room worker and deployment proof are still pending.

## Current Status

**Repository state:** The renderer, physics, input surfaces, CampusEvac scenario model, local
network adapter, AppSync adapter, and AWS integration scaffold are present. The production room
worker and deployed AWS proof path are still pending.

| Area | Status |
| --- | --- |
| React Three Fiber, Three.js, Rapier | `[IMPLEMENTED]` Existing engine foundation. |
| Local first-person/fixed-view/touch interaction | `[IMPLEMENTED]` Existing interaction surfaces. |
| Deterministic local drill adapter | `[IMPLEMENTED]` Browser-local two-seat fallback using role-scoped events. |
| CampusEvac smoke/route/intervention state | `[IMPLEMENTED]` One authored smoke scenario and bounded intervention. |
| AppSync adapter and CDK scaffold | `[IN PROGRESS]` Contracts, schema, Lambda, DynamoDB, Bedrock, and Polly boundaries exist; not deployed. |
| Fargate active room worker | `[PLANNED]` Required before treating AWS as authoritative for live room state. |
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

### Configure the local adapter

```bash
copy .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead. The browser defaults to the deterministic
local adapter. Set `NEXT_PUBLIC_NETWORK_MODE=appsync` only after the deployed Cognito and AppSync
configuration is ready.

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
npx tsc --noEmit
npm run build
```

The infrastructure package has its own checks; run `npm run build` and `npm run synth` from
`infra/`. There is no `npm test` script yet.

## Deployment

The repository contains a committed AWS CDK scaffold, but it is not a production deployment and
does not yet include the authoritative Fargate room worker.

For a local/self-hosted build:

```bash
npm run build
npm run start
```

For the AWS scaffold:

1. Run `npm install` and `npm run build` inside `infra/`.
2. Run `npm run synth`, review the generated template, then deploy with an approved AWS role.
3. Inject target environment variables through the deployment system, not the browser bundle.
4. Configure Cognito, AppSync, the Fargate room worker, Lambda, and DynamoDB according to
   [`docs/architecture-design.md`](docs/architecture-design.md).
5. Configure Bedrock and Polly fallbacks before enabling either provider in a live drill.
6. Verify role-scoped subscriptions, command denial, reconnect behavior, durable events, and the
   three-question AAR before calling the target path operational.

Until those steps are complete, describe the AWS deployment as `[IN PROGRESS]` and use the local
adapter for the browser prototype.

## Environment Variables

| Variable | Current use | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_NETWORK_MODE` | `mock` by default; `appsync` selects the target adapter. | `[IMPLEMENTED]` |
| `NEXT_PUBLIC_APPSYNC_URL` | Target AppSync GraphQL endpoint. | `[IN PROGRESS]` |
| `NEXT_PUBLIC_APPSYNC_EVENTS_URL` | Target AppSync Events endpoint. | `[PLANNED]` |
| `AWS_REGION` | Target AWS region, preferably `us-east-1` or `us-west-2`. | `[IN PROGRESS]` |
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
| `/rooms` | Create or join a two-seat room using the local adapter or AppSync adapter. |
| `/room/[code]` | Room lobby and multiplayer game shell. |
| `/play` | Solo training sandbox using the deterministic local game shell. |

Historical role translations remain in the design dossiers for migration context; executable
routes and state use CampusEvac terminology.

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

The current browser fallback is `MockNet`. The target AWS path is AppSync for commands/events, a small
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

- The former generated room bindings and server module have been removed from the executable tree.
- The local environment template contains no long-lived AWS credentials.
- AWS work must follow the status labels above and update `docs/mvp-status.md` with evidence.
