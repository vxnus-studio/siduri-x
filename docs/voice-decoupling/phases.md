# Implementation Phases: Voice Decoupling

## Phase 1: CLI Configuration Wizard Overhaul
- **Objective**: Update the CLI to reflect the new Voice Organ vs. Base TTS Engine paradigm.
- **Tasks**:
  - Update `cli/src/configurators/voice.ts` to separate the VOICEVOX and RVC choice paths distinctly.
  - Remove VOICEVOX as the underlying base provider for RVC.
  - Add the new Base TTS Engine selection prompt (Edge-TTS, Piper, Kokoro) under the RVC path.
  - Display expected download sizes to the user next to each option (e.g., `0MB`, `~20MB`).
  - Update the generated summary to reflect the user's choices.

## Phase 2: Implement Lightweight TTS Adapters
- **Objective**: Create standalone adapter classes for the new Base TTS Engines.
- **Tasks**:
  - Create `EdgeTtsAdapter`: Implement using a lightweight wrapper like `node-edge-tts` (makes WebSocket requests to MS endpoints).
  - Create `PiperAdapter` / `KokoroAdapter`: Implement bindings for local ONNX inference.
  - Ensure all adapters implement a standard `Synthesizer` interface with a `synthesize(text: string) => Promise<Uint8Array>` method.

## Phase 3: The RVC Middleware Architecture
- **Objective**: Decouple RVC from the `VoicevoxAdapter` and make it a standalone wrapper.
- **Tasks**:
  - Refactor `applyRvc()` out of `packages/organs/voice/src/index.ts` (currently tightly coupled to `VoicevoxAdapter`).
  - Create a generic `RvcPostProcessor` class.
  - The `RvcPostProcessor` should accept raw audio buffers from *any* `Synthesizer` (Edge, Piper) and send it to the RVC headless microservice.
  - Wire the CLI-generated codebase to pipe the selected Base TTS Engine's output into the `RvcPostProcessor`.

## Phase 4: VOICEVOX Runtime Downloader (License Compliance)
- **Objective**: Remove the Docker dependency and fetch the engine securely at runtime.
- **Tasks**:
  - Remove `voicevox/voicevox_engine` from the Docker Compose generation logic in `cli/src/generator.ts`.
  - Create a `VoicevoxEngineManager` utility in the runtime package.
  - Detect the host OS (Windows, macOS, Linux).
  - Fetch the latest standalone executable zip/tarball from the `voicevox/voicevox_engine` GitHub Releases page.
  - Extract to a hidden local directory (e.g., `.voicevox`).
  - Add process management logic (spawn child process, manage PID, health check) to start the engine on port `50021` before allowing TTS requests.

## Phase 5: Documentation & Testing
- **Objective**: Ensure the decoupling is robust and the user experience is fully documented.
- **Tasks**:
  - Write unit tests for `EdgeTtsAdapter` and the decoupled `RvcPostProcessor`.
  - Mock the Voicevox GitHub Release downloader for testing environments.
  - Update user-facing `README.md` and `docs/` to explain the new lightweight RVC setup and the automated VOICEVOX runtime downloads.
