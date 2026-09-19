# RFC: VRM (`.vrm`) Body Support & 3D Embodiment Specification

> **Status:** Accepted / Implemented (Core, Body Organ, Manifests & CLI)  
> **Target Subsystems:** `packages/organs/body` (`@sidurijs/body`), `packages/core` (`@sidurijs/core`), `cli` (`builtin-manifests.ts`), Client WebGL Renderers  
> **Authors:** Kur Zagin & Siduri Architecture Team  

---

## 1. Executive Summary & Context

Siduri-X decouples the companion's embodiment state machine from the physical or graphical rendering client. Under this clean architecture:
- **Backend / Organ Layer (`@sidurijs/body`)**: Headless embodiment state machine tracking companion presence, expression state, speech synchronization, and trigger actions while managing model references and metadata without requiring GPU or native OpenGL/WebGL runtime bindings.
- **Frontend / Client Layer (`apps/web` or external render client)**: Visual presentation layer that interprets embodiment snapshots and lifecycle events, rendering avatars inside an interactive canvas.

Currently, `@sidurijs/body` is tailored specifically for Live2D Cubism (`.model3.json`) models through `provider: 'live2d'`. However, humanoid 3D avatars adhering to the open **VRM 3D Avatar Standard** (`.vrm`, based on glTF 2.0) are widely adopted across VTubing, metaverses, and conversational AI agents.

This RFC defines the architectural design, configuration schemas, state mappings, and lifecycle integration necessary to support VRM avatars as first-class citizens in Siduri-X.

---

## 2. Problem Statement

### 2.1 Format Monoculture in `@sidurijs/body`
`organ-manifest.json` and `builtin-manifests.ts` currently restrict the body organ provider to:
```json
"provider": {
  "type": "string",
  "enum": ["live2d", "none"]
}
```
Furthermore, model references and documentation explicitly target `.model3.json` files. Attempting to deploy a 3D VRM avatar requires custom forks or ad-hoc workarounds.

### 2.2 Differences in Embodiment Dynamics: Live2D vs. VRM
While Live2D operates primarily with 2D parameter channels (`PARAM_ANGLE_X`, `PARAM_MOUTH_OPEN_Y`), VRM operates within a 3D scene graph with:
- **BlendShape / Expression Presets**: Standardized humanoid blendshapes (e.g., VRM 0.x `happy`, `angry`, `sad`, `relaxed`, `blink`, `a`, `i`, `u`, `e`, `o`; VRM 1.0 `happy`, `angry`, `sad`, `relaxed`, `blink`, `aa`, `ih`, `ou`, `ee`, `oh`, etc.).
- **Humanoid Skeletal Poses & Bone Rotations**: Standardized humanoid bone maps (Hips, Spine, Head, Arms, Fingers).
- **LookAt Target Dynamics**: First-person gaze tracking (camera or cursor tracking) with eye bone/morph targets.
- **SpringBone Dynamics**: Hair, clothing, and accessory physics calculated client-side.

The Body organ must provide a unified, renderer-agnostic representation capable of conveying expressions, gestures, and gaze intentions to both 2D and 3D renderers without coupling the core runtime to 3D rendering engines (such as Three.js or Babylon.js).

---

## 3. Architectural Design

```text
┌──────────────────────────────────────────────────────────────────┐
│                   Siduri-X Brain & Dispatcher                    │
│   Produces approved ExperienceEvent (kind: 'avatar')             │
│   { expression: 'happy', action: 'wave_hand', speechId: 'sp-1' } │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                   @sidurijs/body (Backend Organ)                 │
│                                                                  │
│  • Headless state machine (idle, speaking, acting)               │
│  • Provider & format abstraction ('live2d' | 'vrm' | 'none')     │
│  • Standard expression & action normalization                    │
│  • Model reference provider (modelPath, modelUrl, format: 'vrm') │
│  • Exports: NeutralBodyOrgan, Live2DAdapter, VRMAdapter          │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  │ HTTP / WebSocket Snapshot
                                  │ Event Stream
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Frontend / Client Presentation                  │
│                                                                  │
│  • Inspects body snapshot format:                                │
│    - If 'live2d' -> Instantiate Live2DWebGLRenderer (Cubism SDK) │
│    - If 'vrm'    -> Instantiate VRMRenderer (Three.js + three-vrm)│
│  • Drives blendshapes, visemes, and skeletal animations          │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Preserving Headless Decoupling
Consistent with the Siduri Clean Architecture:
- `@sidurijs/body` remains **100% headless and JavaScript/TypeScript runtime compatible** (Node.js / Bun).
- No WebGL, Three.js, Canvas, or GPU dependencies are introduced into `@sidurijs/body` or `@sidurijs/core`.
- The Body organ is responsible for semantic intent (e.g., "be happy", "look at user", "nod"), while the presentation layer handles vertex deformation, shaders, and bone transformation matrices.

---

## 4. Proposed Specification Changes

### 4.1 Body Organ Configuration (`packages/organs/body`)

Update `NeutralBodyOrganConfig` to support format discrimination and VRM-specific parameters:

```typescript
export type AvatarFormat = 'live2d' | 'vrm' | 'auto';

export interface VRMModelOptions {
  /** Target VRM standard specification version */
  specVersion?: '0.x' | '1.0' | 'auto';
  /** Default camera lookAt target behavior */
  lookAtMode?: 'camera' | 'cursor' | 'head' | 'none';
  /** Default resting humanoid pose identifier */
  defaultPose?: string;
  /** Custom blendshape preset map overrides */
  expressionMapping?: Record<string, string>;
}

export interface NeutralBodyOrganConfig {
  /** Avatar rendering provider */
  provider?: 'live2d' | 'vrm' | 'none';
  /** Explicit format override (defaults to auto-detection from modelUrl/modelPath extension) */
  format?: AvatarFormat;
  /** Initial expression name */
  initialExpression?: string;
  /** Local filesystem path to avatar asset (.model3.json or .vrm) */
  modelPath?: string;
  /** Public HTTP / CDN URL to avatar asset (.model3.json or .vrm) */
  modelUrl?: string;
  /** VRM-specific embodiment options */
  vrm?: VRMModelOptions;
  [key: string]: unknown;
}
```

### 4.2 Body Snapshot Contract (`BodySnapshot`)

Extend `BodySnapshot` returned by `body.getSnapshot()` so clients know how to mount the appropriate canvas:

```typescript
export interface BodySnapshot {
  state: BodyState;
  currentExpression: string;
  format: 'live2d' | 'vrm' | 'unknown';
  modelPath?: string;
  modelUrl?: string;
  lastSpeechId: string | null;
  lastAction: string | null;
  lastText?: string;
  lastLanguage?: string;
  vrmOptions?: VRMModelOptions;
  updatedAt: number;
}
```

### 4.3 Adapter Exports
Maintain backward compatibility while introducing the dedicated VRM adapter alias:

```typescript
// packages/organs/body/src/index.ts

export class NeutralBodyOrgan implements BodyOrgan, ExperienceAdapter {
  // Common state machine implementation
}

/** Backward-compatible alias for Live2D models */
export const Live2DAdapter = NeutralBodyOrgan;

/** Specialized alias/factory configured for VRM 3D models */
export class VRMAdapter extends NeutralBodyOrgan {
  constructor(config: NeutralBodyOrganConfig = {}) {
    super({
      provider: 'vrm',
      format: 'vrm',
      ...config,
    });
  }
}
```

### 4.4 Organ Manifest Update (`organ-manifest.json` & `cli/src/builtin-manifests.ts`)

Update the manifest to declare `vrm` as a valid provider and expand descriptions:

```json
{
  "name": "@sidurijs/body",
  "organType": "body",
  "version": "2.1.0",
  "displayName": "Body (Live2D & VRM Avatar State)",
  "description": "Renderer-agnostic avatar expression and embodiment event adapter supporting Live2D (.model3.json) and VRM (.vrm)",
  "entrypoint": "./dist/index.js",
  "factory": "NeutralBodyOrgan",
  "configKey": "body",
  "configSchema": {
    "type": "object",
    "required": ["provider"],
    "properties": {
      "provider": {
        "type": "string",
        "enum": ["live2d", "vrm", "none"]
      },
      "format": {
        "type": "string",
        "enum": ["live2d", "vrm", "auto"],
        "default": "auto"
      },
      "initialExpression": {
        "type": "string",
        "default": "neutral"
      },
      "modelPath": {
        "type": "string",
        "description": "Path to local Live2D Cubism (.model3.json) or VRM (.vrm) model file"
      },
      "modelUrl": {
        "type": "string",
        "description": "Relative or remote URL to Live2D Cubism (.model3.json) or VRM (.vrm) model file"
      },
      "vrm": {
        "type": "object",
        "properties": {
          "specVersion": {
            "type": "string",
            "enum": ["0.x", "1.0", "auto"],
            "default": "auto"
          },
          "lookAtMode": {
            "type": "string",
            "enum": ["camera", "cursor", "head", "none"],
            "default": "camera"
          }
        }
      }
    }
  }
}
```

---

## 5. Expression & Action Normalization

To ensure Brain reasoning prompts do not need to know whether the physical companion is 2D or 3D, Siduri standardizes expressions into canonical emotion tokens:

| Canonical Emotion | Live2D Target | VRM 0.x Preset | VRM 1.0 Preset |
|---|---|---|---|
| `neutral` | Baseline pose / default parameters | `neutral` | `neutral` |
| `happy` / `joy` | Expression JSON / smile params | `happy` | `happy` |
| `angry` | Anger expression JSON | `angry` | `angry` |
| `sad` / `sorrow` | Sadness expression JSON | `sad` | `sad` |
| `surprised` | Eye wide open & mouth O | `surprised` (or custom) | `surprised` (or custom) |
| `relaxed` | Relaxed eyes & soft brow | `relaxed` | `relaxed` |
| `blink` | Eye blink parameter | `blink` | `blink` |

### Viseme / Speech Syncing
When `speaking`, visemes generated or derived from audio analysis or phonemes map to VRM standard vowel blendshapes:
- `aa` (ah)
- `ih` (ee)
- `ou` (oh / oo)
- `ee`
- `oh`

---

## 6. Client Rendering Strategy (`@sidurijs/client` / Web)

When the client layer receives a `BodySnapshot` indicating `format: 'vrm'`:
1. Dynamically load the 3D pipeline (`three` + `@pixiv/three-vrm`).
2. Load the `.vrm` binary from `modelUrl`.
3. Mount a Three.js WebGL canvas and attach spring bone / lookAt controllers.
4. React to `ExperienceEvent` (`kind: 'avatar'`):
   - Smoothly interpolate blendshapes towards target expression weights.
   - Trigger humanoid gesture animations (e.g., waving, nodding, bowing) via glTF AnimationClips.
   - Synchronize lip sync visemes while `state === 'speaking'`.

---

## 7. Migration & Compatibility

- **100% Backward Compatible**: Existing companion configurations specifying `provider: 'live2d'` and using `Live2DAdapter` remain unaltered.
- **Zero Breaking API Changes**: `NeutralBodyOrgan` preserves its existing signature and simply supports new optional configuration fields.
- **Format Auto-Detection**: If `format` is omitted or set to `'auto'`, the organ will inspect `.modelUrl` or `.modelPath`:
  - Ends in `.vrm` → format is `'vrm'`.
  - Ends in `.model3.json` or `.json` → format is `'live2d'`.

---

## 8. Next Steps & Implementation Plan

1. **Step 1: Core / Body Types (`packages/organs/body`)**:
   - Implement updated `NeutralBodyOrganConfig`, `BodySnapshot`, and export `VRMAdapter`.
   - Add auto-detection logic based on file extension.
2. **Step 2: Manifest Updates**:
   - Update `organ-manifest.json` in `@sidurijs/body`.
   - Update `cli/src/builtin-manifests.ts` and CLI schemas.
3. **Step 3: Verification**:
   - Add unit tests in `packages/organs/body/src/index.test.ts` validating VRM configurations, auto-detection, and snapshots.
4. **Step 4: Client Reference Implementation (`apps/web`)**:
   - Add VRM canvas viewer component utilizing Three.js and `@pixiv/three-vrm`.
