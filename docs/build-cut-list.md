# CampusEvac Build Cut List

**Status:** [PLANNED] This list protects the three-minute demo from feature creep.

## MUST SHIP

These items form the complete, judge-visible product loop:

- Two participants join one drill: one evacuee and one warden.
- Same incident, two bounded interfaces with different information.
- One compact authored campus block with readable landmarks and assembly.
- Low-visibility smoke that affects comprehension without requiring physical fire simulation.
- One route becomes unsafe or blocked for a meaningful decision.
- Warden observes and verifies the route state with confidence and information age.
- Warden sends one structured route message with target, urgency, confidence, and expiry.
- Evacuee receives the message in real time and retains final movement agency.
- One authoritative ventilation or emergency-door intervention changes the environment.
- Assembly success or a clearly explained training failure.
- Ordered event telemetry for observation, verification, communication, intervention, and outcome.
- Three-question AAR with one or two deterministic replay recommendations.
- One short operational audio phrase family with captions and a deterministic local fallback.
- Mobile-readable controls, captions, non-color state cues, and reconnection behavior.
- At least one real AWS path proven in the demo, without claiming unimplemented services.

## SHOULD SHIP

Ship these only after every `MUST SHIP` item is stable:

- Bedrock-generated bounded scenario with schema and topology validation.
- Polly phrase cache with a local caption/audio fallback.
- Cognito role authorization and AppSync subscription filters.
- A second warden with sector ownership, shared observations, and acknowledgement.
- One controlled conflicting or stale observation state.
- QR join flow and a compact officer-facing AAR view.
- Reduced-motion and high-contrast visual modes.
- Reconnect demonstration with last acknowledged command state.

## CUT WITHOUT REGRET

Remove these immediately when they threaten the core loop:

- Fire physics, toxic chemistry, spreading flames, or realistic smoke fluid simulation.
- More than one primary hazard in the MVP scenario.
- Large maps, procedural geometry catalogs, crowds, NPCs, guards, or combat systems.
- Oxygen physiology, medical simulation, or a stamina model that makes walking impossible.
- More than one intervention before the first intervention is reliable.
- Continuous AI voice, microphone speech, or free-form generated radio dialogue.
- A full officer command center, live trend dashboard, or institutional ranking system.
- Multi-region AWS deployment, active-active rooms, global tables, or production HA claims.
- Cosmetics, progression, achievements, lore, inventory, or collectible systems.
- Dozens of AWS services without a specific demo proof.
- A score that sounds like a campus safety certification.

## Cut Rule

If a feature does not improve information asymmetry, realtime communication, authoritative
environmental change, the evacuee decision, the warden decision, the AAR, or validation
evidence, it does not belong in the hackathon build.
