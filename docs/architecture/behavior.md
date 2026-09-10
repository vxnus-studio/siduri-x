# Behavior Organ (`@siduri-x/behavior`)

Status: Implemented and Verified (`ActiveSelfCompiler`)

The Behavior organ compiles dynamic persona directives into system prompt injections. It enforces strict boundary separation between companion identity, relationship models, and user memory:

## 1. Compilation Principles
- **Directive Scoping**: Evaluates channel and time validity (`validFrom` / `validUntil`) before including directives.
- **Strict Approval Isolation**: Only `ACTIVE` (or approved) directives are compiled into prompt injections. Pending directives are strictly excluded with the `pending_not_active` diagnostic.
- **Deterministic Conflict Resolution**: Resolves overlapping or conflicting behavioral directives using explicit priority levels.
- **Safety Heuristics & Guardrails**: Rejects prompt injection attempts, safety-filter disable directives, and blanket obedience commands.
- **Neutral Blank Slate**: Fresh companions contain no predeclared behavioral bias or manufactured user relationships.

## 2. Invariants & Contract
The compilation contract follows [`t3-active-self-contract.md`](../contracts/t3-active-self-contract.md) and [`t3-prompt-section-matrix.md`](../contracts/t3-prompt-section-matrix.md).


