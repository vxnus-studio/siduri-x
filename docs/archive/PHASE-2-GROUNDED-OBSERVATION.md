# Siduri-Y Parity Handoff: Grounded Observation Foundation

Status: in progress

## Implemented

The new `@siduri-x/observation` organ provides a provider-independent boundary
for screen/image evidence:

- accepts an in-memory frame and never persists raw bytes;
- passes a temporary data URL to the decoupled `VisionOrgan`;
- parses bounded readings with confidence values;
- assigns an observation ID and evidence ID;
- expires observations after a configurable TTL;
- suppresses duplicate frames within the retained window;
- bounds retained observations by frame count;
- reports empty frames, provider failures, malformed readings, and duplicates;
- exposes copied current observations without mutable internal state.

The API currently exposes:

```text
GET  /observations
POST /dev/mock-observation
```

The mock endpoint is fixture-first. It does not yet generate a response or
publish anything to the public overlay.

## Verification

```bash
pnpm --filter @siduri-x/api build
cd packages/organs/observation && pnpm exec jest --config jest.config.json
```

The observation organ tests cover evidence creation, no raw-frame retention,
duplicate suppression, expiry, and malformed provider output.

## Next implementation slice

Add grounded response assembly without bypassing approval:

```text
current observation -> knowledge search -> bounded citations -> response plan
```

The response must include the observation evidence ID and knowledge citation
IDs. It must remain private/staged until an explicit operator approval path is
implemented. No automatic voice, overlay, or platform send should be added in
this slice.
