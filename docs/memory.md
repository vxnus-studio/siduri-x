# Memory

Status: Implemented

The Memory organ uses PostgreSQL.
- Isolation: Every table enforces `companion_id`.
- Tables: `claims` and `directives`.
- Scope: `OWNER`, `VIEWER`, `OPERATOR`. Replaces hardcoded Siduri scopes.
