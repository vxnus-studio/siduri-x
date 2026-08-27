# Persistent Memory

At the heart of Siduri is her memory system. It is the defining feature that separates her from standard stateless AI models.

## The Problem with Stateless AI
Most conversational AI systems operate statelessly. They rely entirely on a rolling window of recent messages (the context window). Once a conversation grows too long, old messages are pushed out, and the AI effectively "forgets" important facts, established boundaries, and shared history.

## The Siduri Approach
Siduri treats memory as a first-class citizen. Her memory is an authoritative, persistent database.

### 1. Versioned Claims
Memories aren't just blocks of text. When Siduri learns something new, it is processed into structured, versioned "claims". This allows her to understand not just what a fact is, but *when* she learned it and *why* it matters.

### 2. Evidence-Linked Retrieval
When you ask Siduri a question or bring up a topic, she doesn't just guess based on her training data. Her core system actively retrieves relevant claims from her persistent memory and provides them as evidence to ground her responses. If you taught her something weeks ago, she will recall it naturally.

### 3. Approval-Gated Learning
You are in control of what Siduri commits to her core memory. Important updates to relationships, behaviors, or personal facts can be routed through an approval gate, ensuring her authoritative memory is never corrupted by hallucinations or misunderstandings.
