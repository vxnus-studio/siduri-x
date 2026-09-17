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
    ├── logs/
    │   ├── teach-mode-session1-identity-and-supersession.png
    │   └── teach-mode-session2-fresh-chat-recall.png
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

### 3. Teach Mode Onboarding Logs & Supersession (`screenshots/logs/`)

- **`teach-mode-session1-identity-and-supersession.png`**:
  - **Context**: Interactive Teach Mode Onboarding (Session 1).
  - **Details**: Captures the foundational teaching sequence:
    1. Turn 1: Companion identity acceptance (`"Your name is Siduri"` $\to$ `"My name is Siduri"`).
    2. Turn 2: Creator relationship declaration (`"i am Kur Zagin, your creator"` $\to$ `"Understood, Kur Zagin. You are my creator"`).
    3. Turn 3: Form of address refinement (`"you may address me as Master Zagin"` $\to$ `"Understood, Master Zagin. I’ll address you as Master Zagin"`).
    4. Displays real-time proposal approval receipts (`Remember: User role is creator` [APPROVED], `Runtime effect [behavioral]: Address actor:user as Master Zagin` [ACTIVE]) and the fixed Attach `.self` SVG action button in the composer footer.

- **`teach-mode-session2-fresh-chat-recall.png`**:
  - **Context**: Zero-Amnesia Memory Recall in Fresh Chat Session (Session 2).
  - **Details**: Captures fresh session continuation immediately respecting persisted memory:
    1. Turn 1: Greeting automatically using preferred address (`"hey"` $\to$ `"Hey, Master Zagin. How can I help?"`).
    2. Turn 2: Grounded identity recall without hallucination (`"who are you?"` $\to$ `"I’m Siduri, Master Zagin—a companion created by you. I’m here to assist, learn your preferences, and communicate with you directly"`).
  - **Specification**: Cross-referenced in [`docs/rfc/rfc-semantic-supersession-and-teaching.md`](../docs/rfc/rfc-semantic-supersession-and-teaching.md).

---

### 4. Bug Reports & Edge Cases (`screenshots/bugs/`)

- **`knowledge-hallucination-version-cutoff.png`**:
  - **Context**: Model hallucination vs. knowledge-cutoff inspection.
  - **Details**: Shows Siduri answering questions about unreleased content ("Can I pull her though? But how about the banner itself?"), illustrating model speculative generation when factual knowledge boundaries are reached.

