# @siduri-x/mouth

Output communication and presentation decoupling organ in the Siduri cognitive architecture.

## Overview

The **Mouth** organ decouples Siduri's cognitive decisions (`Brain`) from downstream presentation layers (`UI`). 

Rather than having `Brain` emit UI-specific widgets or tightly coupling reasoning to transport protocols, `Brain` emits pure cognitive plans and utterances. `Mouth` adapts these utterances for the active presentation medium (`web`), generates phonetic viseme cues for Live2D avatar lip-sync, synthesizes SSML with emotional prosody modulation, coordinates speech playback with `Voice`, handles real-time token streaming, and manages channel sinks.

## Dataflow

```
Brain → Staged Response → Mouth → Formatted Output / Stream → Web UI / Channels
                            │
                      ┌─────┴──────┐
                      ↓            ↓
                  VoiceOrgan  Live2D Visemes
```

## Features

- **Strict Medium Typing**: Focused strictly on the `web` presentation medium.
- **Lip-Sync & Viseme Alignment**: Computes syllable- and vowel-aligned [`MouthVisemeCue`](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/packages/core/src/mouth-types.ts) (`timeMs`, `durationMs`, `mouthOpenY`, `mouthForm`, `phoneme`) compatible with Live2D parameter systems (`ParamMouthOpenY`, `ParamMouthForm`).
- **SSML Prosody Formatting**: Synthesizes W3C SSML (`<speak><prosody>`) with XML escaping and pitch/rate modulation tailored to companion emotional expressions (e.g. `excited`, `happy`, `sad`, `thinking`, `surprised`).
- **Real-Time Token Streaming**: Provides `stream(utterance)` yielding [`MouthStreamChunk`](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/packages/core/src/mouth-types.ts) items with per-chunk delta text, visemes, and expressions.
- **Barge-In & Interruption Handling**: Direct cancellation support via `mouth.interrupt()` and standard `AbortSignal` propagation.
- **Concrete Channel Sinks**:
  - `BufferedMouthChannel`: In-memory bounded sink tracking deliveries, streams, and interruptions for diagnostics or batch consumption.
  - `EventEmitterMouthChannel`: Event-driven sink emitting `output`, `chunk`, `complete`, and `interrupted` events.
- **ExperienceAdapter Integration**: Implements the `ExperienceAdapter` contract to ingest approved `caption` events from `ExperienceDispatcher`.

## Core Interface

```typescript
import {
  DefaultMouthOrgan,
  BufferedMouthChannel,
  EventEmitterMouthChannel,
} from '@siduri-x/mouth';

const mouth = new DefaultMouthOrgan({
  voice: voiceOrganInstance, // optional VoiceOrgan coordination
});

// Format an utterance
const output = mouth.format({
  utteranceId: 'utt-1',
  companionId: 'siduri',
  text: 'こんにちは！',
  expression: 'happy',
});

// Real-time streaming
for await (const chunk of mouth.stream(utterance)) {
  console.log(chunk.deltaText, chunk.visemes);
}

// Barge-in interruption
mouth.interrupt('user_barge_in');
```
