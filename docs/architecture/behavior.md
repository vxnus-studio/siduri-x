# Behavior Organ (`@siduri-x/behavior`)

> **Status:** Legacy / Deprecated (Superseded by `@siduri-x/self`)  
> **Current Architecture:** All identity, personality, directives, and Active Self compilation have been unified into **`@siduri-x/self`**.

---

> [!NOTE]
> **MIGRATION NOTICE: MERGED INTO `@siduri-x/self`**
>
> As part of Phase 2 & 3 of the Clean Architecture Migration, `@siduri-x/behavior` was demoted from organ status and unified with the Self domain in `@siduri-x/self`.
>
> - **Canonical Implementation:** `packages/self/src/active-self-compiler.ts` implements both `ActiveSelfCompiler` and the `BehaviorOrgan` interface for backward compatibility.
> - **Package Location:** Top-level domain package `@siduri-x/self`.
> - For full details, see:
>   - [`docs/self-organ-knowledge/01-domain-architecture.md`](../self-organ-knowledge/01-domain-architecture.md)
>   - [`docs/self-organ-knowledge/02-self-asset-and-teach-mode.md`](../self-organ-knowledge/02-self-asset-and-teach-mode.md)

---

## 1. Historical Compilation Principles
- **Directive Scoping**: Evaluates channel and time validity (`validFrom` / `validUntil`) before including directives.
- **Strict Approval Isolation**: Only `ACTIVE` (or approved) directives are compiled into prompt injections. Pending directives are strictly excluded with the `pending_not_active` diagnostic.
- **Deterministic Conflict Resolution**: Resolves overlapping or conflicting behavioral directives using explicit priority levels.
- **Safety Heuristics & Guardrails**: Rejects prompt injection attempts, safety-filter disable directives, and blanket obedience commands.
- **Neutral Blank Slate**: Fresh companions contain no predeclared behavioral bias or manufactured user relationships.

## 2. Invariants & Contract
The compilation contract follows [`t3-active-self-contract.md`](../contracts/t3-active-self-contract.md) and [`t3-prompt-section-matrix.md`](../contracts/t3-prompt-section-matrix.md).
