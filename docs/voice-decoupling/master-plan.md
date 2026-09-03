# Voice Architecture Decoupling (Master Plan)

## Objective
To restructure the Siduri-X Voice Organ architecture by decoupling VOICEVOX from the RVC (Retrieval-based Voice Conversion) pipeline, removing Docker as a hard dependency, and migrating to a runtime-download strategy for external engines. This ensures license compliance, drastically reduces download bloat, and provides a frictionless, language-agnostic user experience.

## Core Architectural Changes

### 1. Separation of Concerns: Final Output vs. Base TTS
The system will now distinguish between the **Voice Organ** (the final voice identity presented to the user) and the **Base TTS Engine** (the generator of the initial audio and prosody).

### 2. VOICEVOX Runtime Downloading
VOICEVOX will no longer be bundled in the generated `docker-compose.yml` nor included in the NPM package dependencies. Instead:
- If a user chooses VOICEVOX as their Voice Organ, the application runtime will automatically download the official headless Voicevox Engine (`.zip`/`.7z`/`.tar.gz`) for their specific OS.
- The runtime extracts and spawns the Voicevox binary on an open port (e.g., `50021`) as a child process.
- **Benefit**: Avoids license overlapping/violations and removes a mandatory ~3GB Docker footprint.

### 3. Excluding VOICEVOX from the RVC Pipeline
RVC requires a Base TTS Engine to generate the foundational audio. Previously, VOICEVOX was hardcoded for this. Moving forward, VOICEVOX will be **strictly excluded** as an option for RVC base generation.
- **Why**: VOICEVOX is ~1.5GB+, strictly optimized for Japanese, and complete overkill for a "mute base actor" whose voice will be overwritten anyway.
- **Benefit**: A vastly cleaner UX where RVC users only download small (or zero) dependencies.

### 4. Lightweight Base Engines for RVC
When configuring RVC, the CLI will prompt users to select a lightweight Base TTS Engine:
- **Edge-TTS**: 0MB (Cloud API). Multi-language, perfect prosody, zero download.
- **Piper TTS**: ~20MB (Local). Blazingly fast, runs on local CPU.
- **Kokoro TTS**: ~80MB (Local). Extremely high quality, offline.

## New CLI Configuration Flow
```text
1. Select Voice Organ
   ├── VOICEVOX (Stock Anime Voices) -> Triggers Voicevox Engine runtime download.
   └── RVC (Custom Voice Cloning) -> Skips Voicevox entirely.

2. If RVC is selected -> Select Base TTS Engine
   ├── Edge-TTS (Cloud, 0MB)
   ├── Piper TTS (Local, ~20MB)
   └── Kokoro TTS (Local, ~80MB)
```
