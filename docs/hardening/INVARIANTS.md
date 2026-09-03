# Core Architectural Invariants

These invariants represent non-negotiable principles of the Siduri-X architecture. Any change violating these invariants is considered a defect.

---

### Invariant 1: Single Runtime Path
Generated companion instances (`cli/src/generator.ts`) and API servers (`apps/api/src/app.ts`) must execute the canonical `SiduriRuntime.handleUserMessage` pipeline. No generated code or API route may bypass the perception, active self compilation, response gating (T4), or deterministic action policy engines.

---

### Invariant 2: Brain Proposes; Policy Layer Authorizes; Hands Executes
The LLM/Brain organ generates candidate plans and proposals, but has **zero execution authority**.
1. **Brain** proposes candidate speech and action intents.
2. **ActionPolicyEngine** strictly evaluates whether the action is permitted under the caller's verified capabilities, channel, and risk tier.
3. If approved, the policy engine issues a cryptographically signed `AuthorizationCapability`.
4. **Hands** executes the action **only** upon verifying the valid capability signature.
5. **ActionStore** records an append-only, tamper-evident audit trail chained with SHA-256.

---

### Invariant 3: Server-Governed Authority
Caller authorization roles (`OWNER`, `OPERATOR`, `VIEWER`) and associated capabilities are determined strictly by server authentication (tokens/local environment). Unauthenticated or lower-privileged clients cannot elevate privileges via JSON request bodies.

---

### Invariant 4: Memory Temporal Validity & Confidence
Claims retrieved from the Memory organ must be temporally valid at query time (`valid_from <= NOW()`, `valid_until >= NOW()`) and meet the caller's confidence threshold (`confidence >= minConfidence`). Stale, superseded, or low-confidence claims are excluded from context compilation.

---

### Invariant 5: Safe Network Fetching
All outgoing HTTP requests from knowledge retrieval or external organs must pass through `safeFetch` / `validateSafeUrl`:
- Protocol restricted strictly to `http:` and `https:`.
- Complete blacklist blocking private, loopback, CGNAT, link-local, and cloud metadata IP ranges (`169.254.169.254`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`).
- Bounded response byte limits and manual redirect re-validation.

---

### Invariant 6: Truthful Endpoints
API endpoints must never return mock success (`{ success: true }`) for operations that were not executed. Endpoints perform authentic persistence mutations or return standard HTTP error codes (`400`, `403`, `404`, `501`).
