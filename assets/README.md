# Siduri Visual Assets & Screenshots

This directory contains visual captures, demonstration screenshots, and historical debugging artifacts for Siduri.

## Directory Structure

```
assets/
└── screenshots/
    ├── avatar/
    │   ├── live2d-hooded-avatar-embodiment.jpeg
    │   └── live2d-hu-tao-embodiment.jpeg
    ├── features/
    │   ├── chat-authoritative-memory-proposals.png
    │   ├── chat-grounded-memory-retrieval.png
    │   ├── chat-knowledge-citations.png
    │   └── operator-memory-claims-and-directives.png
    └── bugs/
        └── knowledge-hallucination-version-cutoff.png
```

---

## Catalog & Content Analysis

### 1. Avatar Embodiment (`screenshots/avatar/`)

- **`live2d-hooded-avatar-embodiment.jpeg`**:
  - **Context**: Web client UI with Live2D Body Organ rendering.
  - **Details**: Full-body rendering of a hooded chibi character model integrated directly into the chat canvas with status indicators (`Presence`, `online`).

- **`live2d-hu-tao-embodiment.jpeg`**:
  - **Context**: Web client UI with Live2D Body Organ rendering.
  - **Details**: Full-body rendering of the Hu Tao Live2D Cubism character model running in the chat interface.

### 2. Feature Demonstrations (`screenshots/features/`)

- **`chat-authoritative-memory-proposals.png`**:
  - **Context**: UI Chat Session.
  - **Details**: Demonstrates Siduri proposing and committing structured claims in real-time (`Remember (preference)` and `Remember (episodic)`) marked with `APPROVED` receipts and citation links directly under the assistant's dialogue.

- **`operator-memory-claims-and-directives.png`**:
  - **Context**: Web Operator Console (`/operator`).
  - **Details**: Demonstrates the active memory layer displaying active behavioral directives (`stream_behavior`, `relationship_address`, `communication_style`) and structured semantic claims (`primary_user.genshin_account`, `primogem_balance`, `pull_target`, etc.) with action controls (`Revoke`, `Disable`).

- **`chat-grounded-memory-retrieval.png`**:
  - **Context**: Multi-turn dialogue retrieval.
  - **Details**: Shows Siduri accurately recalling previously committed episodic memories ("Citlali", "Clorinde") when asked ("What was my last character...", "What is my other character?"), grounded with evidence badges (`2 evidence links`, `5 evidence links`).

- **`chat-knowledge-citations.png`**:
  - **Context**: External / Domain Knowledge Retrieval.
  - **Details**: Shows Siduri answering a factual inquiry ("Who is Sandrone?") by retrieving external knowledge with structured evidence badges (`4 evidence links`) and bilingual Japanese/English subtitles.

---

### 3. Bug Reports & Edge Cases (`screenshots/bugs/`)

- **`knowledge-hallucination-version-cutoff.png`**:
  - **Context**: Model hallucination vs. knowledge-cutoff inspection.
  - **Details**: Shows Siduri answering questions about unreleased content ("Can I pull her though? But how about the banner itself?"), illustrating model speculative generation when factual knowledge boundaries are reached.

