# Siduri-X Hardening Program

## Overview

This directory contains the authoritative documentation for the **Siduri-X Hardening & Correctness Remediation Program**.

The objective of this program is to ensure that Siduri-X functions in accordance with its personal companion product model and strict architectural invariants, resolving all audit findings and eliminating architectural drift.

---

## Documentation Structure

* [**ROADMAP.md**](./ROADMAP.md) — Phased remediation roadmap, work package status, and verification milestones.
* [**INVARIANTS.md**](./INVARIANTS.md) — Core architectural invariants that must never be violated.
* [**ARCHITECTURE.md**](./ARCHITECTURE.md) — Concrete system architecture, data flows, and organ boundaries.
* [**THREAT-MODEL.md**](./THREAT-MODEL.md) — Single-owner local companion threat model, trusted vs untrusted boundaries, and security properties.
* [**FINDINGS.md**](./FINDINGS.md) — Comprehensive register of audit findings (`SIDURI-AUDIT-001` through `009`) and their resolutions.
* [**VERIFICATION.md**](./VERIFICATION.md) — Test suites, automated proofs, and verification procedures.
* [**HANDOFF.md**](./HANDOFF.md) — State handoff guide for subsequent development sessions.

---

## Summary of Findings & Remediation Status

| Finding ID | Subsystem | Severity | Status | Remediated In |
|---|---|---|---|---|
| `SIDURI-AUDIT-001` | CLI Generator | CRITICAL | RESOLVED | `cli/src/generator.ts` |
| `SIDURI-AUDIT-002` | Memory Organ | HIGH | RESOLVED | `packages/organs/memory/src/index.ts` |
| `SIDURI-AUDIT-003` | API Context Authority | HIGH | RESOLVED | `apps/api/src/app.ts` |
| `SIDURI-AUDIT-004` | Capability / Action Store | HIGH | RESOLVED | `packages/core/src/capability.ts` |
| `SIDURI-AUDIT-005` | API Endpoints | MEDIUM | RESOLVED | `apps/api/src/app.ts` |
| `SIDURI-AUDIT-006` | Response Gating | MEDIUM | RESOLVED | `packages/core/src/gating.ts` |
| `SIDURI-AUDIT-007` | Core Runtime Degradation | HIGH | RESOLVED | `packages/core/src/runtime.ts` |
| `SIDURI-AUDIT-008` | Knowledge SafeFetch | MEDIUM | RESOLVED | `packages/organs/knowledge/src/index.ts` |
| `SIDURI-AUDIT-009` | Audit Trail Hashing | MEDIUM | RESOLVED | `packages/core/src/capability.ts` |
