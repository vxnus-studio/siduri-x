# Configuration

Status: Implemented

The `siduri.config.json` determines the composition of the companion.

```json
{
  "name": "Ganyu",
  "brain": { "provider": "openrouter", "model": "gpt-4" },
  "voice": { "provider": "voicevox", "speakerId": 1 },
  "memory": { "provider": "postgres" },
  "knowledge": { "provider": "e-teyvat" },
  "behavior": { "preset": "Calm" },
  "vision": { "provider": "openrouter" },
  "body": { "provider": "live2d" }
}
```
