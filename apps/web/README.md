# Siduri Web Client (`apps/web`)

The official local-first web interface for **Siduri-X**, built with [Next.js](https://nextjs.org) (App Router, Turbopack, React 19, Tailwind CSS v4).

The web client provides a sovereign, private interface for interacting with your local companion, auditing memories, and monitoring runtime health.

---

## Features

### 1. Conversational Chat Surface (`/chat`)
* **Local-First Communication**: Directly communicates with your local Siduri runtime (`127.0.0.1:3000` / `/api`).
* **Mobile-First Responsive Layout**:
  * **Off-Canvas Navigation Drawer**: Slide-over drawer for browsing and managing conversation history with backdrop dismiss and touch-friendly targets (WCAG compliant).
  * **Streamlined Mobile Topbar & Preferences Sheet**: Compact, uncluttered header on small viewports with dedicated sliding preferences sheet for interaction modes, subtitle languages, avatar presence, and connection status.
  * **Virtual Keyboard Adaptation**: Utilizes Next.js `interactiveWidget: "resizes-content"` and viewport safe-area insets (`env(safe-area-inset-*)`) for iOS Safari and Android Chrome.
  * **Interaction Mode Switcher**: Easily switch between **Auto** (inferred), **Casual** (zero drift), **Teach** (human-in-the-loop proposals), and **Hybrid** (default).
  * **Inline Memory & Behavioral Receipts**: Staged claim receipts rendered inline with single-tap **Approve** and **Reject** controls.

### 2. Live2D Avatar Presence
* **Renderer-Agnostic Embodiment**: Live2D Cubism WebGL canvas (`AvatarCanvas`) rendering dynamic expressions, lip-sync, and idle motions.
* **Presence Mode Toggle**: Switch between clean minimal chat and embodied avatar presence.

### 3. Operator Console (`/operator`)
* **Control Room**: Real-time status cards for Orchestrator, Voice synthesis, OBS capture, and model provider latency.
* **Memory Approval Queue**: Review and verify pending candidate claims before they become persistent facts in SQLite.
* **Behavioral Directives**: Inspect active personality directives, scope activations, and learned relational postures.
* **Evidence & Grounding**: Review bounded observation frames and external citations without exposing raw captures.
* **Mobile Operator Navigation**: Responsive tab bar with persistent back-to-chat links.

---

## Static Export & CLI Bundling

This Next.js app is configured with static output (`output: 'export'`, `distDir: 'out'`).

When built via `pnpm build`:
1. Static HTML, JS, CSS, and SVG assets are exported to `apps/web/out/`.
2. The `@vxnus/siduri` CLI build script (`copy-web-dist.cjs`) copies `apps/web/out` into `cli/dist/web-dist`.
3. When users run `npx @vxnus/siduri create <name>`, the CLI embeds this pre-built web client into the newly scaffolded companion's `public/` directory, serving the full UI locally with zero external build dependencies.

---

## Development & Scripts

```bash
# Run local Next.js development server
pnpm dev

# Run unit and mobile layout tests
pnpm test

# Run ESLint validation
pnpm lint

# Generate optimized static production export
pnpm build
```
