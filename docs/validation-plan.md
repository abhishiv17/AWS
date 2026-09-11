# CampusEvac Validation Plan And Evidence

**Status:** [VALIDATION PENDING] This document defines a study; it contains no participant
results and makes no validated impact claim.

## Evidence Discipline

Use the following distinction in every pitch, report, and README:

| Label | Meaning |
| --- | --- |
| Problem hypothesis | A belief that must be tested with students or safety personnel. |
| Validation method | How the team will collect evidence without leading the participant. |
| Evidence collected | A dated observation, measure, interview note, or test result. |
| Product decision | A change made because of the evidence. |
| Remaining assumption | A claim still not tested. |

Never invent participant counts, percentages, interviews, quotes, survey results, or
conclusions. Empty fields remain `Validation pending`.

## Core Hypothesis

> When an evacuation route becomes uncertain, people struggle to choose an alternative; a
> structured warden-to-evacuee message with evidence, confidence, and expiry should improve
> decision quality and reduce coordination delay.

Secondary hypotheses:

- H2: People understand two different interfaces for the same incident without a facilitator.
- H3: Confidence and information age help a warden decide whether to communicate or verify first.
- H4: A short AAR with one replay recommendation is more useful than a large metric dashboard.
- H5: Campus safety personnel consider route and communication telemetry useful for planning a
  future drill.

## Target Participants

**Target, not recruited evidence:**

- 20-30 students or hostel residents for the interactive prototype test.
- 3-5 campus safety, hostel, security, facilities, or administrative personnel for interviews
  and report review.

Recruitment status: **Validation pending.** Record the actual count, role, date, and consent
status only after recruitment.

## Study Part A: Student Interviews

Run short, semi-structured interviews before the prototype test. Do not teach the product before
asking about current behavior.

Questions:

1. Tell us about the last emergency drill or evacuation instruction you experienced.
2. What information did you receive, and what information was missing?
3. If the familiar route was blocked, how would you decide where to go?
4. Who would you expect to provide route guidance?
5. What would make a warning feel trustworthy or untrustworthy?
6. What would make a simulated drill feel useful rather than like a game?
7. Which device would you use during a short drill: phone, laptop, or both?
8. What accessibility or language support would you need?

Observation questions for the researcher:

- Does the participant describe a decision, or only following a remembered route?
- Do they mention uncertainty, conflicting instructions, or route verification without prompting?
- Do they distinguish information source, confidence, and age?
- Which terms are misunderstood: hazard, warden, assembly, verified, stale?

## Study Part B: Prototype Test

Use a controlled, fictional scenario. Do not ask participants to enter or imitate a real
hazard. Obtain consent, explain that the simulation is not emergency guidance, and allow a
no-failure practice run before recording.

### Procedure

1. Brief the participant pair: one evacuee and one warden.
2. Give both participants the same incident briefing but role-limited views.
3. Run a short baseline route with no route block, only to establish controls and comprehension.
4. Reset to a seeded scenario where the obvious route becomes unsafe.
5. Let the warden observe an evidence cue before the evacuee can see the hazard.
6. Require the warden to verify or mark the evidence, then send a structured message.
7. Trigger one intervention, such as a ventilation override, only through the authorized control.
8. End at assembly or the defined training failure state.
9. Show the AAR and ask the pair to choose the next replay.
10. Conduct a five-minute debrief without defending the design.

Use the same seed and route topology for comparable pairs. Counterbalance message wording or
interface order where practical. Record any facilitator assistance separately.

## Measures

### Behavioral metrics

- Time from route block to first alternate-route choice.
- Correct versus incorrect route decisions against the validated scenario graph.
- Time from hazard observation to warden verification.
- Time from verification to message sent.
- Time from message sent to evacuee acknowledgement or route change.
- Number of communication errors: wrong target, missing confidence, stale message, or conflict.
- Hazard recognition accuracy.
- Response to conflicting or stale information.
- Time from intervention request to authoritative environment change.
- Assembly outcome and route deviation count.

### Experience metrics

Ask after the run on a 1-5 scale, while recording the exact question:

- I understood what I was allowed to see.
- I knew what to do next.
- The warden message contained enough information to act.
- The information felt believable and appropriately uncertain.
- The drill felt useful for practicing coordination.
- The AAR made the next practice step clear.

These ratings are not results until collected. Do not write a percentage or average in the
documentation before the study is complete.

### Staff metrics

Ask safety or administrative personnel:

- Which current drill decisions are difficult to observe or measure?
- Which route or communication evidence would change the next training session?
- Would the three-question AAR support a debrief? Why or why not?
- Which data should never be retained or shown to an officer?
- What would make a simulation misleading or unsafe to use?

## Sample Recording Format

Use one row per run. Replace every placeholder with a real value or `not recorded`.

| Field | Value |
| --- | --- |
| Run ID | `pending` |
| Participant type | `student pair` / `staff review` |
| Date and consent | `pending` |
| Scenario seed/version | `pending` |
| Route blocked | `pending` |
| Hazard observed at | `pending` |
| Hazard verified at | `pending` |
| Message sent at | `pending` |
| Message acknowledged at | `pending` |
| Intervention applied at | `pending` |
| Alternate route chosen at | `pending` |
| Assembly/failure outcome | `pending` |
| Route decision correctness | `pending` |
| Communication errors | `pending` |
| Facilitator assistance | `pending` |
| Participant comprehension notes | `pending` |
| Staff usefulness notes | `pending` |
| Product decision | `pending` |

## Decision Criteria

These are pre-registered decision rules, not expected results:

- **Comprehension:** If most observed participants cannot identify their role or next action
  without facilitator help, simplify onboarding before adding features.
- **Information value:** If confidence or age is not used in observed decisions, reduce the
  information model to the smallest signal participants understand.
- **Coordination signal:** If the structured-message condition does not show a directional
  improvement in route decisions or communication delay, do not claim the product improves
  evacuation decisions; revise the message model and retest.
- **AAR usefulness:** If staff cannot name a next practice action from the report, remove
  metrics before adding more analytics.
- **Safety and realism:** If participants interpret the simulation as live emergency advice,
  strengthen the framing and stop the test until the distinction is clear.

## Evidence Log

| Date | Source | Evidence | Decision | Status |
| --- | --- | --- | --- | --- |
| `pending` | `pending` | No evidence recorded yet. | No product decision made. | [VALIDATION PENDING] |

## Privacy And Safety

- Obtain informed consent and let participants stop without penalty.
- Use pseudonymous run IDs; do not retain names in gameplay telemetry.
- Do not record real building layouts, personal movement patterns, or live emergency details.
- Explain that the simulation is controlled training, not evacuation instructions.
- Store raw observations only as long as needed to support the product decision.
