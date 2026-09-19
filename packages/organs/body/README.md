# @sidurijs/body

The canonical Body Organ for Siduri-X.

This organ acts as the embodiment state machine and experience adapter for visual avatars, supporting 2D Live2D Cubism (`.model3.json`) and 3D humanoid VRM (`.vrm`) models.

## Architecture & Responsibilities

In Siduri's decoupled organ architecture:
- **Backend / Organ layer (`@sidurijs/body`)**:
  - Serves as the state machine tracking avatar state (`idle`, `speaking`, `acting`), current facial expressions (`neutral`, `happy`, `sad`, etc.), format detection (`live2d` / `vrm`), and trigger actions.
  - Implements the `ExperienceAdapter` contract for approved `avatar` lifecycle events.
  - Maintains model references (`modelPath`, `modelUrl`, `vrmOptions`) without requiring headless GPU or WebGL bindings on the backend server.
- **Frontend / Client layer (`apps/web` or custom UI)**:
  - Consumes avatar state updates and renders either Live2D Cubism models or 3D humanoid VRM avatars via WebGL / Three.js (`AvatarCanvas`, `VRMRenderer`).

## Usage

### Live2D

```typescript
import { NeutralBodyOrgan, Live2DAdapter } from '@sidurijs/body';

// Instantiate with Live2D model URL or path
const body = new Live2DAdapter({
  initialExpression: 'neutral',
  modelUrl: '/assets/body/companion/model.model3.json',
});

// Update expression or actions
body.setExpression('happy');
body.speak('speech-1', 'Hello world');
```

### VRM (3D Humanoid / VRoid)

```typescript
import { VRMAdapter } from '@sidurijs/body';

const body = new VRMAdapter({
  modelUrl: '/assets/body/companion/avatar.vrm',
  vrm: {
    specVersion: '1.0',
    lookAtMode: 'camera',
  },
});
```

## Third-Party Licensing & Runtime Downloads

### Live2D Cubism Notice
- **Proprietary Core**: Live2D Cubism Core (`live2dcubismcore.min.js`) is proprietary software of Live2D Inc. and cannot be bundled into public npm packages or git repositories under open-source licenses.
- **Runtime Downloading**: Clients download the official binary directly at runtime from Live2D's verified CDN. You can also programmatically acquire and verify the binary on the host via `downloadCubismCore({ targetDir: './public/live2d', verifyChecksum: true })`.
- **Indie vs. Commercial Use**: Royalty-free for indie / small-scale entities with annual revenue < 10,000,000 JPY (~$67,000 USD). Commercial publishers exceeding this threshold require a Publication License Agreement directly with Live2D Inc.

For details across all organs, see [Third-Party Organ Licensing Documentation](../../docs/third-party-organ-licensing.md).
