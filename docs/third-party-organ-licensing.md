# Third-Party Organ & Asset Licensing Guide

> **Scope:** Guidelines, legal compliance, and distribution policies for third-party upstream runtimes, character assets, voice weights, and embodiment engines across Siduri-X companions.

---

## 1. Executive Summary & Policy

Siduri-X is licensed under the permissive [Apache License, Version 2.0](../LICENSE).

However, embodied and spoken AI companions frequently interface with third-party proprietary runtimes, character IP, voice models, and rendering SDKs. To preserve the legal integrity of the open-source repository and protect developers and end-users from liability:

1. **No Bundling of Restricted Upstream Binaries**: Siduri never vendors, bundles, or commits restricted proprietary binaries or character model weights directly into public git repositories or npm packages.
2. **Runtime Acquisition**: Third-party assets governed by separate licenses (e.g. Live2D Cubism Core, VOICEVOX engine binaries) are fetched directly on the user's host machine at runtime from the upstream vendor's official distribution channels with cryptographic integrity checks.
3. **Informed Consent via CLI Warnings**: The `siduri` CLI actively warns operators when selecting providers with upstream commercial revenue caps or attribution covenants.
4. **Clean-License Alternatives**: For every subsystem with proprietary restrictions, Siduri provides or supports a 100% royalty-free, open-source alternative (e.g., VRM/glTF for embodiment; Piper/Kokoro for voice).

---

## 2. Organ-by-Organ Licensing Breakdown

### 2.1 Body Organ (`@sidurijs/body` & Web Canvas)

The Body organ manages companion presence, facial expressions, and animation synchronization.

| Provider / Asset | Upstream Vendor | License Type | Terms & Commercial Thresholds |
|---|---|---|---|
| **Live2D Cubism** (`.model3.json`, `.moc3`) | Live2D Inc. | **Live2D Proprietary Software License** (Core) + Open Software License (Framework) | • **Indie / Small-Scale**: Free & royalty-free for entities with annual revenue `< 10,000,000 JPY` (~$67,000 USD).<br>• **Mid-to-Large Enterprise**: Requires a paid Publication License Agreement directly with Live2D Inc.<br>• **Distribution**: `live2dcubismcore.min.js` cannot be distributed on npm; web clients fetch directly from Live2D's CDN. |
| **VRM 3D Humanoid** (`.vrm`, VRoid) | Khronos Group & Pixiv Inc. | **MIT License** / glTF 2.0 Standard | • **Fully Open & Royalty-Free**: Permissive MIT license for runtime libraries (`three`, `@pixiv/three-vrm`).<br>• **No Revenue Caps**: Unrestricted commercial deployment.<br>• **Distribution**: Distributed natively via standard npm packages. |

#### Live2D Runtime Downloading
In `@sidurijs/body`, developers can automate the acquisition of the official Cubism Core binary on the host without committing it to git:
```typescript
import { downloadCubismCore } from '@sidurijs/body';

await downloadCubismCore({
  targetDir: './public/live2d',
  verifyChecksum: true,
});
```

---

### 2.2 Voice Organ (`@sidurijs/voice`)

The Voice organ handles text-to-speech (TTS) queuing and voice conversion (RVC).

| Provider / Model | Upstream Author | License Type | Terms & Obligations |
|---|---|---|---|
| **VOICEVOX Engine** | Hiroshiba Kazuyuki / VOICEVOX Contributors | **LGPL v3** | • **Engine Binary**: Downloaded directly from GitHub Releases into `~/.voicevox/engine/` (~1.5GB). Verified via SHA-256.<br>• Allowed for commercial and non-commercial application integration. |
| **VOICEVOX Character Voices** (Zundamon, Shikoku Metan, etc.) | Individual Character Rightsholders | **Individual Character Terms of Service** | • **Attribution Requirement**: Public audio or applications must display character credit (e.g., *"VOICEVOX: 四国めたん"*).<br>• **Use Case Boundaries**: Strictly prohibit defamatory, political, religious, or illegal content. Some characters require individual commercial permission. |
| **Piper / Kokoro** | Rhasspy / Hexgrad | **MIT / Apache-2.0** | • **Fully Open & Royalty-Free**: Lightweight neural models with permissive commercial rights and no revenue caps. |
| **Edge-TTS** | Microsoft | Cloud Service Terms | • Free service endpoint intended for non-commercial or personal testing; subject to Microsoft service terms. |
| **RVC (`.pth`, `.index`)** | Model Creators | Model-specific | • Pre-trained voice weights (`.pth`) reflect the voice owner's consent. Operators must ensure they have rights to the cloned voice. |

---

### 2.3 Brain Organ (`@sidurijs/brain`)

The Brain organ orchestrates LLM inference via OpenRouter or OpenAI-compatible endpoints.

* **API Endpoints**: Terms of Service are dictated by your inference provider (e.g., OpenRouter, OpenAI, Anthropic, or local Ollama/vLLM).
* **Zero Host Licensing Baggage**: `@sidurijs/brain` contains no model weights; it is a pure HTTP client protocol.

---

### 2.4 Knowledge & Memory Organs (`@sidurijs/memory`, `@sidurijs/knowledge`)

* **Database Engine**: Uses standard embedded **SQLite** (Public Domain) with WAL mode and built-in FTS5 full-text indexing.
* **Content Provenance**: Sovereign Life Database data belongs exclusively to the single owner. Optional third-party knowledge packs (E-Packs) carry their own creator terms as stated in their `pack.json` manifest.

---

## 3. Compliance Checklist for Companion Creators

When publishing or distributing a Siduri-X companion instance:

- [ ] **Check Revenue Thresholds**: If deploying Live2D commercially, verify whether your organization's annual revenue exceeds `10,000,000 JPY` (~$67k USD). If so, sign a Publication License Agreement with Live2D Inc., or migrate to VRM.
- [ ] **Provide Character Attribution**: If using VOICEVOX character banks, display the required attribution string prominently in your UI or companion documentation.
- [ ] **Verify Voice Cloning Rights**: If using RVC voice conversion, verify that trained voice weights (`.pth`) were generated with proper artist/actor consent.
- [ ] **Maintain Clean Git Trees**: Ensure proprietary binaries (`live2dcubismcore.min.js`, `.voicevox/engine/`) are in `.gitignore` and downloaded via setup scripts or runtime fetchers.
- [ ] **Respect Content Boundaries**: Observe character guidelines regarding prohibited content (e.g. hate speech, explicit content) set by third-party voice and avatar creators.
