# Threat Model & Security Architecture

## 1. Product Assumptions & Operating Context
- **Single Owner / Local PC**: Siduri is a personal AI companion run on the owner's PC.
- **Threat Boundary**: Untrusted input may originate from external network content (Knowledge fetch, web browsing), prompt injection via chat messages, or unauthorized network probes to local endpoints.

---

## 2. Threat Categories & Defenses

### Threat A: Privilege Escalation via Request Body
- **Vulnerability**: Attacker sending `{ role: "OWNER" }` in public chat or API request.
- **Defense**: Server-side `resolveIdentity` inspects bearer tokens or `DEV_LOCAL_AUTH_ROLE`. In `apps/api/src/app.ts`, `identity.role` strictly dictates the mapped actor authorization role; client-supplied roles in request bodies are ignored.

### Threat B: Confused Deputy / Brain Action Hijack
- **Vulnerability**: Prompt injection in user chat or retrieved knowledge inducing the LLM Brain to request sensitive tools (e.g. file deletion, arbitrary shell commands).
- **Defense**: The LLM Brain has no direct execution power. Actions are submitted as intents to `ActionPolicyEngine`. High-risk actions require explicit operator approval; unauthorized actions are rejected deterministically before reaching Hands.

### Threat C: Server-Side Request Forgery (SSRF) & Metadata Exfiltration
- **Vulnerability**: Malicious knowledge pack URLs pointing to internal services (`http://localhost:8080`, `http://169.254.169.254`).
- **Defense**: `validateSafeUrl` and `safeFetch` block loopback, private RFC-1918, CGNAT, link-local, and cloud metadata IPs, and enforce strict redirect validation.

### Threat D: Memory Leakage Across Audiences
- **Vulnerability**: Viewer in a public channel querying private memory claims.
- **Defense**: PostgreSQL queries in `searchClaims` strictly enforce sensitivity filters (`sensitivity = 'public'`) and audience array intersections (`allowed_audiences @> $audience`).

### Threat E: Action Replay & Tamper Attack
- **Vulnerability**: Replaying old capability tokens or altering past action audit logs.
- **Defense**: Capabilities are signed with HMAC-SHA256 and bound to a specific `executionId`. Audit trail records are cryptographically chained with SHA-256 covering all security-critical event fields.
