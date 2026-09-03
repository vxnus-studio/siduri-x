# @siduri-x/voice

The canonical Voice Synthesis organ for Siduri-X.

This organ provides queued, bounded, and decoupled speech synthesis. Instead of directly compiling TTS engines into the application, this organ orchestrates standard REST/HTTP payloads or WebSocket streams, abstracting away the heavy lifting.

## Capabilities

- **Lightweight TTS Base Engines**: Out-of-the-box support for Edge-TTS (Cloud API), VOICEVOX (Local), Piper (Local), and Kokoro (Local).
- **RVC Middleware Pipeline**: Allows dynamic pipeline wrapping of any Base TTS Engine. The Base TTS generates the target dialect and intonation, which is then fed into an RVC headless microservice over HTTP to change the timbre in real-time.
- **Auto-Download Runtime**: For VOICEVOX, this organ detects the host OS and Architecture and securely downloads the official `voicevox_engine` runtime binary automatically on initialization. No bulky Docker containers or complicated setups required.

## Quick Start

You can generate a companion instance using the Siduri CLI:

```bash
npx @vxnus/siduri create my-siduri
```

When prompted, select `voice` and choose your TTS provider (`edge-tts`, `voicevox`, etc.). 

## Manual Usage (Siduri Runtime Integration)

If you are programmatically bootstrapping a Siduri instance:

```typescript
import { VoiceAdapter } from '@siduri-x/voice';

// 1. Instantiate the Voice Adapter with your preferred TTS Provider
const voice = new VoiceAdapter({
  provider: 'edge-tts', // 'voicevox' | 'edge-tts' | 'piper' | 'kokoro'
  rvc: {
    enabled: true,
    serviceUrl: 'http://localhost:50055', // Connects to RVC headless docker container
    modelName: 'my-companion-model'
  }
});

// 2. Wire into the core engine
const companion = new SiduriRuntime({
  voice: voice,
  // ... other organs
});
```

### VOICEVOX Auto-Download Note
If you select `voicevox` but do not pass a `baseUrl` representing a pre-existing server, the `VoiceAdapter` will automatically fetch the ~3GB zip/tarball from GitHub Releases on its first boot, extract it, and spawn it detached on port `50021`.

