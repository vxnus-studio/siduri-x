# RFC: Siduri-X Performance & Reliability Benchmarking Framework

> **Status:** Draft / Proposal  
> **RFC Number:** 0004  
> **Target Systems:** `@siduri-x/core`, `@siduri-x/memory`, `@siduri-x/gating`, `@siduri-x/hands`, `@siduri-x/brain`, `packages/benchmarks`  
> **Authors:** Siduri Architecture & Runtime Engineering  
> **Related Documents:**  
> - [The Truth Gate & Anchor Architecture](../architecture/truth-gate.md)  
> - [Persistent Memory Subsystem](../architecture/memory.md)  
> - [Safety & Release Evidence Contract (T7)](../contracts/t7-release-evidence-contract.md)  
> - [Evidence Chain Contract (T4)](../contracts/t4-evidence-chain-contract.md)  

---

## 1. Executive Summary

As Siduri-X expands its decoupled organ architecture, maintaining low latency, high throughput, and strict safety gating on single-owner local hardware is critical. Without dedicated benchmarking harnesses, performance regressions in database query lookups, prompt compilation, cryptographic policy verifications, or audio perception pipelines can silently degrade companion interactivity.

This RFC defines the **Siduri-X Benchmarking Framework (`packages/benchmarks`)**, detailing:
1. **The Four Pillars of Benchmarking**: Engine Microbenchmarks, Memory & Database Scaling, E2E Perception Latency, and Safety/Gating Stress.
2. **Standard Metrics & Latency Budgets**: Establishing SLA boundaries for TTFC (Time to First Chunk), Gate Evaluation, and Memory Retrieval.
3. **Workspace Architecture & Tooling**: Integration using TypeScript, `tinybench` / `mitata`, and synthetic fixture datasets.
4. **Continuous Integration & Diagnostic Integration**: Automating regression checks in CI and surfacing diagnostics in `siduri doctor`.

---

## 2. Motivation & Architectural Latency Budgets

Siduri's universal perception loop in `packages/core/src/runtime.ts` coordinates multiple asynchronous stages. To ensure near real-time conversational responsiveness on consumer hardware, each component is assigned a target **Latency Budget**:

```text
Incoming Input / Sensory Perception
  │
  ├─► [Stage 1: Normalization & Classification]   < 5ms
  │
  ├─► [Stage 2: Memory & Knowledge Retrieval]     < 25ms (at 10k claims)
  │
  ├─► [Stage 3: Prompt Compilation]               < 2ms
  │
  ├─► [Stage 4: Brain Inference (LLM / TTFT)]     < 300-800ms (provider dependent)
  │
  ├─► [Stage 5: Response Gating & Policy Engine]  < 3ms
  │
  ├─► [Stage 6: Experience Dispatch / Stream]     < 10ms to first audio/SSE packet
  │
  └─► [Stage 7: Asynchronous Memory Settlement]   < 40ms (non-blocking)
```

---

## 3. What Must Be Benchmarked

### 3.1. Microbenchmarks (Subsystem Throughput)
- **Response Gating Engine (`@siduri-x/core` - `gating.ts`)**:
  - `stageResponse()` and `evaluateGate()` evaluation throughput (operations/second) across varying evidence chain depths ($N = 1$ to $N = 50$).
  - Sensitivity filtering performance (`PUBLIC` vs. `PRIVATE` data restrictions).
- **Action Policy & Capability Engine (`@siduri-x/hands` / `action-policy.ts`)**:
  - HMAC/cryptographic capability token verification speed.
  - Rate of tool argument schema validation against JSON schema bounds.
- **Perception Deduplication (`@siduri-x/observation`)**:
  - SHA-256 visual frame hashing, temporal sliding window queries, and deduplication speed on high-frequency frame streams.
- **Prompt Compiler (`@siduri-x/core` - `prompt-compiler.ts`)**:
  - Dynamic directive merging and markdown context rendering overhead.

### 3.2. Memory Subsystem & Database Scaling (`@siduri-x/memory`)
- **Dataset Scaling Curves**: Measure p50, p95, and p99 query latency across simulated database sizes:
  - Small ($1,000$ claims / $500$ messages)
  - Medium ($10,000$ claims / $5,000$ messages)
  - Large ($100,000$ claims / $50,000$ messages)
  - Extreme ($1,000,000$ claims)
- **Hybrid Retrieval Performance**:
  - Full-Text Search (FTS) vs. Vector cosine similarity queries vs. relational scope filtering (`sensitivity`, `valid_until`).
- **Memory Settlement Throughput**:
  - Batch insertion and statement execution times for `settleMemoryProposals()`.

### 3.3. End-to-End Pipeline & Streaming Performance
- **Time to First Chunk (TTFC)**:
  - User text input to first SSE token chunk emission via `@siduri-x/mouth`.
- **Speech Synthesis Pipeline Latency (`@siduri-x/voice`)**:
  - End-to-end latency from text token receipt $\to$ TTS synthesis (Piper / VOICEVOX / Edge-TTS) $\to$ RVC post-processing $\to$ PCM audio playback buffer.
- **Audio Sensory Transcribe Cycle (`@siduri-x/ear`)**:
  - Audio chunk buffer ingestion $\to$ STT transcription $\to$ intent normalization.

### 3.4. Security, Gate Stress & Adversarial Load
- **Adversarial Gate Rejection Rate**: High-concurrency throughput testing for rejection of policy violations without touching the underlying LLM.
- **Audience & Context Boundary Verification**: Verification that zero unauthorized memory leaks occur across $10,000$ randomized multi-session queries.

---

## 4. Proposed Package Structure (`packages/benchmarks`)

```text
packages/
└── benchmarks/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── src/
    │   ├── common/
    │   │   ├── mock-organs.ts          # Zero-latency mock organs for isolating engine overhead
    │   │   ├── fixture-generator.ts    # Synthetic dataset generator for claims & directives
    │   │   └── reporters.ts            # Markdown table & JSON exporters for CI/CD
    │   ├── micro/
    │   │   ├── gating.bench.ts         # ResponseGatingEngine benchmarks
    │   │   ├── action-policy.bench.ts  # Capability verification benchmarks
    │   │   ├── prompt-compiler.bench.ts# Prompt assembly overhead
    │   │   └── observation-dedup.bench.ts
    │   ├── memory/
    │   │   ├── pg-retrieval.bench.ts   # Postgres / SQLite retrieval latency vs scale
    │   │   └── settlement.bench.ts     # Proposal commit latency
    │   └── e2e/
    │       ├── perception-cycle.bench.ts # Complete perceive() loop
    │       └── mouth-stream.bench.ts   # Streaming chunk throughput
```

---

## 5. Implementation Specifications & Examples

### 5.1. Microbenchmark Example (`gating.bench.ts`)
Using `tinybench`:

```typescript
import { Bench } from 'tinybench';
import { ResponseGatingEngine, StagedResponsePlan, EvidenceRecord } from '@siduri-x/core';

export async function runGatingBenchmark() {
  const bench = new Bench({ time: 1000 });
  const gating = new ResponseGatingEngine();

  const stagedPlan: StagedResponsePlan = {
    responseId: 'resp_bench_001',
    companionId: 'siduri_test',
    timestamp: new Date().toISOString(),
    requestContext: {
      actor: { actorId: 'owner-user', sessionId: 'sess_01', authenticated: true },
      conversation: { channel: 'direct', correlationId: 'corr_01' }
    } as any,
    candidateSpeech: 'Hello world, this is a benchmark verification test.',
    candidateLanguage: 'en',
    evidenceRecords: [
      { evidenceId: 'ev_1', source: 'memory', sensitivity: 'PUBLIC', claimRef: 'c1' }
    ],
    status: 'STAGED'
  };

  const evidence: EvidenceRecord[] = stagedPlan.evidenceRecords;

  bench
    .add('gating#stageResponse', () => {
      gating.stageResponse(stagedPlan as any);
    })
    .add('gating#evaluateGate', () => {
      gating.evaluateGate(stagedPlan, evidence);
    });

  await bench.run();
  return bench.table();
}
```

### 5.2. Memory Scaling Benchmark Example (`pg-retrieval.bench.ts`)

```typescript
import { Bench } from 'tinybench';
import { generateSyntheticClaims } from '../common/fixture-generator';
import { MemoryDatabaseAdapter } from '@siduri-x/memory';

export async function runMemoryScaleBenchmark(adapter: MemoryDatabaseAdapter) {
  const counts = [1_000, 10_000, 100_000];
  const results = [];

  for (const count of counts) {
    await adapter.reset();
    const fixtures = generateSyntheticClaims(count);
    await adapter.bulkInsertClaims(fixtures);

    const bench = new Bench({ iterations: 100 });
    bench.add(`Memory Query (${count} claims) - Semantic Match`, async () => {
      await adapter.queryClaims({ text: 'favorite food preferences' });
    });

    await bench.run();
    results.push({ count, stats: bench.tasks[0].result });
  }

  return results;
}
```

---

## 6. Integration with CI & `siduri doctor`

1. **Continuous Regression Testing (`.github/workflows/benchmark.yml`)**:
   - Executes microbenchmarks on pull requests.
   - Fails the build if gating or prompt compiler latency regresses by $> 15\%$ against `main`.
2. **CLI Performance Diagnostics (`siduri doctor --perf`)**:
   - Integrates local DB latency checks into the existing CLI diagnostics command to help users troubleshoot disk/database bottlenecks on their specific machines.

---

## 7. Next Steps & Rollout Plan

- [ ] **Phase 1**: Add `packages/benchmarks` to `pnpm-workspace.yaml` and install `tinybench`.
- [ ] **Phase 2**: Implement core microbenchmarks (`gating`, `prompt-compiler`, `action-policy`).
- [ ] **Phase 3**: Implement synthetic memory dataset fixtures and PostgreSQL scaling benchmarks.
- [ ] **Phase 4**: Add GitHub Actions benchmark tracking and CLI diagnostic probes.
