# Siduri Memory Architecture & Drivers Guide

Persistent, authoritative memory is the foundational pillar of Siduri. Unlike standard stateless AI systems that forget context when a session ends or context window overflows, Siduri persists structured, versioned knowledge claims across sessions.

---

## 1. Core Memory Concepts

### 1.1 Structured Claims
Memories in Siduri are structured as **versioned claims** rather than raw unbounded text dumps:
- **Subject**: The entity or concept (`user`, `siduri`, `project_x`).
- **Predicate**: The relational property (`favorite_color`, `birthday`, `role`).
- **Value**: The current asserted truth (`teal`, `March 14`, `software_engineer`).
- **Metadata**: Provenance, confidence score (`0.0` - `1.0`), privacy/sensitivity level (`public`, `private`, `system`), and creation/validity timestamps.

### 1.2 Companion Isolation
Every memory table strictly enforces `companion_id`. This guarantees multi-tenant safety and complete isolation between different companion instances sharing the same database.

### 1.3 Full-Text Search (FTS)
Claims are indexed using PostgreSQL Full-Text Search (`tsvector`) and GIN indexes for sub-millisecond retrieval of relevant context during cognitive planning loops.

---

## 2. Current Implementation: Native PostgreSQL (`pg`)

### Overview
The canonical `@siduri-x/memory` organ is built directly on native **`pg` (`node-postgres`)** with SQL migration scripts.

### Why Native `pg` is the Default
1. **Zero ORM Overhead**: Keeps `@siduri-x/memory` ultralight and dependency-minimal.
2. **Postgres-Native Features**: Direct use of generated columns (`to_tsvector`) and GIN indexes without ORM translation layers.
3. **Universal Portability**: SQL migration files (`migrations/*.sql`) work with `npx @vxnus/siduri db push`, `psql`, Supabase, Neon, AWS RDS, and Docker.

### Schema Structure (`001_initial_schema.sql`)
- `memory_claims`: Authoritative semantic and episodic claims.
- `memory_directives`: Active self personality rules and gating directives.
- `memory_source_events`: Raw sensory evidence input records.
- `memory_claim_history`: Audit trail for claim updates and superseding.
- `_siduri_migrations`: Checksum-verified migration history.

### Pushing Migrations
```bash
npx @vxnus/siduri db push
```

---

## 3. Database Driver Roadmap

To accommodate different developer workflows, Siduri's memory architecture is designed around an abstract `MemoryOrgan` interface. Future releases will offer multiple ORM and database driver choices:

```text
                        ┌──────────────────────────────┐
                        │   MemoryOrgan Core Protocol  │
                        │   (@siduri-x/core)           │
                        └──────────────┬───────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│  Native PG (pg)  │          │   Drizzle ORM    │          │      Prisma      │
│  (Default / Lite)│          │   (TypeScript)   │          │ (High-level ORM) │
├──────────────────┤          ├──────────────────┤          ├──────────────────┤
│ • Zero ORM bloat │          │ • Schema-as-code │          │ • Prisma Client  │
│ • Direct SQL FTS │          │ • Type-safe SQL  │          │ • Prisma Studio  │
│ • Fast & minimal │          │ • drizzle-kit    │          │ • Schema engine  │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

---

### 3.1 Option A: Native PostgreSQL (`pg`) — *Current Default*
- **Best For**: Lightweight instances, embedded deployments, clean-machine CLI scaffolding, Docker setups.
- **Key Advantages**: Fastest cold start, zero compilation step, minimal memory footprint.

---

### 3.2 Option B: Drizzle ORM — *Roadmap*
- **Best For**: TypeScript-first codebases, monorepos, and developers who prefer schema-in-code.
- **Planned Features**:
  - TypeScript schema definitions (`schema.ts`) using `drizzle-orm/pg-core`.
  - Type-safe relational queries and migrations via `drizzle-kit`.
  - Built-in helper for tsvector search.
- **Example Future Schema**:
  ```typescript
  import { pgTable, uuid, varchar, jsonb, real, timestamp, customType } from 'drizzle-orm/pg-core';

  const tsvector = customType<{ data: string }>({
    dataType() { return 'tsvector'; },
  });

  export const memoryClaims = pgTable('memory_claims', {
    id: uuid('id').defaultRandom().primaryKey(),
    companionId: varchar('companion_id').notNull(),
    subject: varchar('subject').notNull(),
    predicate: varchar('predicate').notNull(),
    value: varchar('value').notNull(),
    status: varchar('status').notNull(),
    evidence: jsonb('evidence'),
    confidence: real('confidence').default(1.0),
    assertedAt: timestamp('asserted_at', { withTimezone: true }).defaultNow(),
    searchDocument: tsvector('search_document'),
  });
  ```

---

### 3.3 Option C: Prisma — *Roadmap*
- **Best For**: Enterprise projects, teams already using Prisma across their stack, and rapid visual inspection via Prisma Studio.
- **Planned Features**:
  - Declarative `schema.prisma` file.
  - Generated type-safe Prisma client.
  - Visual memory claim management using `npx prisma studio`.
- **Example Future Schema**:
  ```prisma
  model MemoryClaim {
    id           String   @id @default(uuid()) @db.Uuid
    companionId  String   @map("companion_id")
    subject      String
    predicate    String
    value        String
    status       String
    evidence     Json?
    confidence   Float    @default(1.0)
    assertedAt   DateTime @default(now()) @map("asserted_at")

    @@index([companionId])
    @@map("memory_claims")
  }
  ```

---

## 4. Planned Configuration Experience

In future releases, the memory driver can be selected during `siduri create` or specified in `siduri.config.json`:

```json
{
  "organs": {
    "memory": {
      "provider": "postgres",
      "driver": "pg", // Options: "pg" | "drizzle" | "prisma"
      "connectionString": "env:DATABASE_URL"
    }
  }
}
```

The CLI `db push` command will automatically route to the corresponding migration tool:
- `pg` $\rightarrow$ Built-in checksum runner (`siduri db push`)
- `drizzle` $\rightarrow$ `drizzle-kit push`
- `prisma` $\rightarrow$ `prisma db push`
