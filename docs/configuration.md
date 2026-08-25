# Configuration

Status: configuration baseline; extraction parity incomplete

The `siduri.config.json` determines the composition of the companion. The API
loads it from the current directory, or from the path in `SIDURI_CONFIG`.
Brain and memory are required; optional organs use `{ "provider": "none" }`.

Configuration defines the companion and its organs, not a predeclared user
relationship. Public/private channels, audiences, and learned subjects must
follow the neutral contract rather than personal defaults.

```json
{
  "name": "My Companion",
  "brain": {
    "provider": "openai-compatible",
    "baseUrl": "http://127.0.0.1:1234/v1",
    "model": "local-model",
    "apiKeyEnv": "OPENAI_COMPATIBLE_API_KEY"
  },
  "voice": { "provider": "voicevox", "speakerId": 1 },
  "memory": { "provider": "postgres", "deployment": "local" },
  "knowledge": {
    "provider": "e-knowledge",
    "packPath": "/path/to/installed/knowledge-pack"
  },
  "behavior": { "preset": "Calm" },
  "vision": { "provider": "openrouter" },
  "body": {
    "provider": "live2d",
    "vtsUrl": "ws://127.0.0.1:8001"
  }
}
```

VTube Studio authentication is handled through the local plugin permission
flow. Set `VTS_AUTH_TOKEN` only if a previously approved token is being reused;
otherwise Siduri requests permission when it connects.
