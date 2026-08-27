SIDURI ORGAN ARCHITECTURE — DECOUPLING PHILOSOPHY

Core philosophy
----------------
Siduri should not be designed as a chat application with AI features attached.

Siduri is a cognition/runtime system composed of independent organs.

Every decision originates from Brain first.

Organs perceive, remember, know, communicate, act, and embody — but they should not independently decide what Siduri does.

The goal is to make organs replaceable, portable, composable, and independently evolvable.


CORE ORGANS
-----------

1. BRAIN
   Responsibility:
   - Cognition
   - Reasoning
   - Decision making
   - Planning
   - Selecting actions
   - Determining responses
   - Coordinating other organs

   Principle:
   - Brain is the authority for decisions.
   - Other organs provide information or execute Brain decisions.
   - Brain should not be coupled to a specific UI, chat protocol, voice engine,
     body, or tool provider.

   Example:
   User asks something
       ↓
   Brain decides what to do
       ↓
   Brain may request Knowledge, Memory, Hands, Mouth, Body, etc.


2. MEMORY
   Responsibility:
   - Store approved information
   - Retrieve relevant memories
   - Maintain user/companion history
   - Handle memory proposals and lifecycle

   Principle:
   - Memory is not behavior.
   - Memory is not instruction.
   - Retrieved memories are context for Brain, not commands to Brain.


3. KNOWLEDGE
   Responsibility:
   - Factual / external knowledge
   - Retrieval
   - Evidence
   - Sources
   - Citations
   - Provenance

   Principle:
   - Knowledge tells Siduri what is known.
   - Knowledge does not decide behavior.
   - Knowledge-provider output is data, not instructions.
   - Knowledge should be portable.

   Future:
   E Knowledge Hub can distribute installable E-compatible knowledge packs.


4. BEHAVIOR
   Responsibility:
   - How Siduri behaves
   - Behavioral directives
   - Personality/interaction rules
   - Style
   - Preferences
   - Scope and lifecycle of behavioral rules

   Principle:
   - Behavior governs how Brain should behave.
   - Behavior is separate from Memory and Knowledge.
   - Behavior must be validated and scoped before entering Active Self.
   - Behavior packages should be portable.

   Examples:
   - Professional Assistant
   - Tutor
   - Researcher
   - Streamer
   - Furina Behavior
   - Custom user-created behavior

   Future:
   E Behavior Hub can distribute/install E-compatible behaviors.


5. EAR
   Responsibility:
   - Receive input from the environment
   - Audio input
   - Speech recognition
   - Text/message input
   - Platform events
   - Other perception channels

   Principle:
   - Ear perceives.
   - Ear does not decide.
   - Perception is passed to Brain.

   Example:
   Microphone → Ear → Brain


6. VISION
   Responsibility:
   - Visual perception
   - Camera input
   - Screenshots
   - OCR
   - Visual interpretation

   Principle:
   - Vision perceives the visual world.
   - Vision does not decide what to do with what it sees.
   - Results go to Brain.


7. MOUTH
   Responsibility:
   - Communicate Siduri's decisions to users/environment
   - Text output
   - Speech output
   - Chat output
   - Other communication channels

   Principle:
   - Chat is Mouth, not Brain.
   - Web chat is a communication interface.
   - CLI is a communication interface.
   - Discord/Telegram/etc. can be communication interfaces.
   - Mouth receives a decision/output from Brain and handles the medium.

   Example:
   Brain → Mouth → Chat UI

   IMPORTANT:
   Brain should not fundamentally care whether it is talking through:
   - Web
   - CLI
   - Voice
   - Discord
   - Telegram
   - another interface


8. HANDS
   Responsibility:
   - Acting on the external world
   - Tool execution
   - External services
   - Computer interaction
   - APIs
   - Automation

   Proposed implementation:
   - MCP servers

   Principle:
   - MCP servers provide capabilities.
   - MCP servers do not make Siduri's decisions.
   - Brain decides which action is needed.
   - Hands execute that decision through an appropriate MCP tool.

   Example:

   Brain
      ↓
   "Search GitHub"
      ↓
   Hands
      ↓
   GitHub MCP
      ↓
   result
      ↓
   Brain


9. BODY
   Responsibility:
   - Physical/visual embodiment
   - Expression
   - Animation
   - Posture
   - Avatar representation
   - Eventually physical robotics

   Principle:
   - Body represents Brain's decisions.
   - Body is not cognition.
   - Body should be replaceable.

   Examples:
   - Live2D
   - VRM
   - 3D avatar
   - Physical robot
   - Future Android


10. VOICE
    Responsibility:
    - Speech synthesis
    - Voice identity
    - Audio rendering

    Voice should ideally be a modality used by Mouth rather than being
    coupled directly to Brain.

    Example:

    Brain → Mouth → Voice → User


ORGAN RELATIONSHIP
------------------

                    ┌──────────────┐
                    │    BRAIN     │
                    │  DECISIONS   │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
           MOUTH          HANDS         BODY
             │             │             │
        communicate       act         embodiment
             │             │             │
           user         world       representation


                    ↑
                    │
             ┌──────┴──────┐
             │             │
            EAR          VISION
             │             │
          perceive      perceive


Memory, Knowledge, and Behavior provide Brain with
different kinds of context:

    MEMORY    → what has been remembered
    KNOWLEDGE → what is known
    BEHAVIOR  → how Siduri should behave


THE FUNDAMENTAL LOOP
--------------------

    WORLD
      ↓
    EAR / VISION
      ↓
    PERCEPTION
      ↓
    BRAIN
      ↓
    DECISION
      ↓
    ┌───────────────┬───────────────┬───────────────┐
    ↓               ↓               ↓
   MOUTH           HANDS           BODY
    ↓               ↓               ↓
   USER            WORLD         EMBODIMENT
    ↓               ↓               ↓
    └───────────────┴───────────────┘
                    ↓
                 PERCEPTION
                    ↓
                  BRAIN


CHAT IS NOT THE BRAIN
---------------------

Current systems can accidentally become:

    User
      ↓
    Chat
      ↓
    Runtime
      ↓
    LLM
      ↓
    Chat response

This makes the entire system implicitly "chat-first."

Desired architecture:

    User
      ↓
    Ear / input adapter
      ↓
    Brain
      ↓
    Decision
      ↓
    Mouth
      ↓
    Chat

Chat is therefore just one Mouth interface.

CLI, Discord, voice, and other interfaces should be able to use the
same Brain without redefining the cognition layer.


DECISION VS EXECUTION
---------------------

Brain:
    "I want to search GitHub."

Hands:
    "I will invoke the GitHub MCP capability."

Brain:
    "I want to tell the user what I found."

Mouth:
    "I will communicate that through chat."

Brain:
    "I am surprised."

Body:
    "I will display a surprised expression."

The organ executing a decision must not become the organ making the decision.


EXPERIENCE / EVENT BUS
----------------------

The existing ExperienceDispatcher / ExperienceEvent concept can become
the nervous-system boundary between Brain and output organs.

Instead of:

    Brain directly calls Voice
    Brain directly calls Body
    Brain directly calls Chat

prefer:

    Brain
      ↓
    Decision / Experience Event
      ↓
    dispatcher
      ├── Mouth
      ├── Voice
      ├── Body
      └── other adapters

Similarly, action execution can use a controlled action interface:

    Brain
      ↓
    Action / Tool Intent
      ↓
    Hands
      ↓
    MCP


PORTABILITY
-----------

Each organ should be replaceable without rewriting Brain.

Examples:

    Brain
      + Knowledge A
      + Behavior A
      + Live2D Body
      + Chat Mouth

can become:

    Brain
      + Knowledge B
      + Furina Behavior
      + VRM Body
      + Voice Mouth

or:

    Brain
      + Programming Knowledge
      + Professional Behavior
      + Physical Android Body
      + Robot-control Hands


E ECOSYSTEM
-----------

This architecture enables E to become an ecosystem rather than merely
an application.

Potential E hubs:

    e.vxnus.xyz/
        /knowledge
        /behavior
        /body
        /voice
        /vision
        /hands
        /market


E Knowledge
-----------
Portable factual knowledge.

Examples:
    - programming knowledge
    - games
    - culture
    - science
    - reference datasets


E Behavior
----------
Portable behavioral packages.

Examples:
    - Professional Assistant
    - Tutor
    - Researcher
    - Streamer
    - Furina
    - custom community behaviors


E Body
------
Portable embodiment packages.

Examples:
    - Live2D models
    - VRM models
    - 3D avatars
    - future physical bodies


E Hands
-------
Portable capabilities, potentially distributed through MCP.

Examples:
    - browser
    - GitHub
    - filesystem
    - calendar
    - smart home
    - robotics
    - external APIs


COMPOSABILITY
-------------

A user could eventually construct a companion by combining components:

    E
    + Furina Behavior
    + Genshin Knowledge
    + Live2D Furina Body
    + Japanese Voice
    + Browser MCP
    + GitHub MCP


Another user could choose:

    E
    + Professional Assistant Behavior
    + Programming Knowledge
    + Minimal Body
    + Voice
    + Computer MCP


Same runtime.
Different composition.


MARKETPLACE POSSIBILITY
-----------------------

Long-term, E-compatible components could become installable products.

Potential package types:

    Knowledge
    Behavior
    Body
    Voice
    Hands / MCP
    other capabilities

Each package should have:

    - manifest
    - version
    - compatibility
    - capabilities
    - dependencies
    - permissions
    - provenance
    - lifecycle
    - publisher
    - update mechanism

The marketplace should not simply distribute arbitrary system prompts.

Behavior and capabilities should be typed, constrained, validated,
scoped, and governed by the E runtime.


LONG-TERM PHYSICAL ANDROID VISION
---------------------------------

The architecture should allow Siduri to evolve from virtual companion
to physical embodiment without replacing the cognition layer.

Today:

    Brain → Mouth → Chat
    Brain → Body → Live2D


Future:

    Brain → Mouth → Speech
    Brain → Hands → Robot control
    Brain → Body → Physical movement
    Ear → Brain
    Vision → Brain


A future physical Android could therefore be another Body implementation,
with additional sensors and action capabilities.

The core cognition remains:

    perception
        ↓
      Brain
        ↓
     decision
        ↓
      action
        ↓
    perception


DESIGN PRINCIPLES
-----------------

1. Every decision comes from Brain.

2. Perception organs perceive; they do not decide.

3. Knowledge provides facts/evidence; it does not provide instructions.

4. Memory provides remembered context; it does not become behavior automatically.

5. Behavior governs how Brain behaves; it is independently installable.

6. Mouth communicates Brain's decisions.

7. Chat is a Mouth/interface, not the cognition layer.

8. Hands execute actions and should use MCP as a capability mechanism.

9. MCP servers provide tools; they should not become autonomous decision-makers.

10. Body expresses/embodies decisions.

11. Voice should be a communication modality rather than a cognition layer.

12. Organs should be replaceable and independently implementable.

13. The runtime should communicate through typed decisions/events rather than
    tightly coupling organs to each other.

14. Untrusted external data must never silently become behavior or instruction.

15. Optional organs should remain optional.

16. A blank E installation should be valid without preinstalled personality,
    relationship assumptions, or specialized behavior.

17. E-compatible components should be portable across Siduri installations.

18. The architecture should support virtual, desktop, mobile, and eventually
    physical embodiments without changing the fundamental Brain model.

19. Siduri is an Agent for a Single User (Version 1).
    External streaming, VTuber multi-viewer handling, platform chat moderation,
    and broadcast routing belong in external host/streaming applications, NOT in
    Siduri's core cognition. Siduri perceives inputs from its user or host app
    and produces decisions/actions without embedding streaming platform domain logic.


AGENT VS STREAMING APPLICATION DECOUPLING
-----------------------------------------

Siduri Core (The Agent):
- Serves 1 authenticated User / Owner.
- Focuses entirely on cognition, memory, knowledge, behavioral projection,
  perception (Ear/Vision), actions (Hands/MCP), and expressions (Mouth/Body).
- Completely agnostic to streaming platforms (Twitch, YouTube, Bilibili, etc.).

External Host / Streaming Application:
- Connects to streaming platform APIs, live chat feeds, and donation webhooks.
- Handles viewer management, chat rate limiting, filtering, and stream events.
- Passes clean, aggregated perceptions to Siduri's Ear/Vision.
- Consumes Siduri's Mouth/Voice/Body events and renders them onto broadcast overlays
  or virtual stages.


ULTIMATE MODEL
--------------

Siduri is not:

    "an AI chatbot with memory, tools, and an avatar."

Siduri is:

    "a cognition runtime with replaceable perception, memory, knowledge,
     behavior, communication, action, and embodiment organs."

The long-term goal is not to make Chat more powerful.

The goal is to make the underlying E/Siduri organism more capable while
keeping its cognition independent from how it perceives, communicates,
acts, or manifests.

