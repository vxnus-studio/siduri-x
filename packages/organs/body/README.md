# @siduri-x/body

The canonical Body Organ for Siduri-X.

This organ acts as the embodiment state machine and experience adapter for visual avatars (such as Live2D Cubism models).

## Architecture & Responsibilities

In Siduri's decoupled organ architecture:
- **Backend / Organ layer (`@siduri-x/body`)**:
  - Serves as the state machine tracking avatar state (`idle`, `speaking`, `acting`), current facial expressions (`neutral`, `happy`, `sad`, etc.), and trigger actions.
  - Implements the `ExperienceAdapter` contract for approved `avatar` lifecycle events.
  - Maintains model references (`modelPath`, `modelUrl`) without requiring headless GPU or WebGL bindings on the backend server.
- **Frontend / Client layer (`apps/web` or custom UI)**:
  - Consumes avatar state updates and renders the actual Live2D Cubism model via WebGL (`AvatarCanvas` / `Live2DWebGLRenderer`).

## Usage

```typescript
import { NeutralBodyOrgan, Live2DAdapter } from '@siduri-x/body';

// Instantiate with model URL or path
const body = new Live2DAdapter({
  initialExpression: 'neutral',
  modelUrl: '/assets/body/companion/model.model3.json',
});

// Update expression or actions
body.setExpression('happy');
body.speak('speech-1', 'Hello world');
```
