import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-page">
      {/* Top Header Navigation */}
      <header className="home-nav">
        <div className="home-container home-nav-inner">
          <Link href="/" className="brand-link" aria-label="Siduri Home">
            <span className="siduri-glyph">✦</span>
            <span>SIDURI</span>
          </Link>

          <nav className="nav-links" aria-label="Main Navigation">
            <Link href="/chat">Chat</Link>
            <Link href="/operator">Operator Console</Link>
          </nav>

          <div>
            <Link href="/chat" className="nav-cta">
              Open Chat <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-24 md:py-32 border-b border-[var(--siduri-border-subtle)] relative overflow-hidden">
          <div className="home-container relative z-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-low)] text-[var(--siduri-ember-light)] text-[10px] font-mono tracking-widest uppercase mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--siduri-online)] shadow-[0_0_8px_rgba(127,199,154,0.6)]" />
                Local-First Companion · Explicit Architecture
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-serif text-[var(--siduri-text-primary)] tracking-tight leading-[1.15] mb-6">
                A companion designed to remember deliberately.
              </h1>

              <p className="text-base sm:text-lg text-[var(--siduri-text-secondary)] font-sans leading-relaxed mb-10 max-w-2xl font-light">
                Local-first context, inspectable memory governance, grounded
                evidence, and optional visual presence — engineered with explicit
                boundaries between identity and presentation.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-[var(--siduri-ember)] text-[#1b1619] font-sans font-semibold text-sm tracking-wide transition-all hover:brightness-110 shadow-[0_4px_20px_rgba(217,154,104,0.2)]"
                >
                  Launch Private Chat
                  <span className="font-mono text-base">→</span>
                </Link>
                <Link
                  href="/operator"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] text-[var(--siduri-text-primary)] font-sans font-medium text-sm transition-all hover:border-[var(--siduri-border-ember)] hover:bg-[var(--siduri-tint-low)]"
                >
                  <span>⌘</span>
                  Inspect Runtime
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Core Pillars / Features */}
        <section className="py-20 md:py-28 border-b border-[var(--siduri-border-subtle)] bg-[#0e0e12]">
          <div className="home-container">
            <div className="mb-14">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--siduri-ember)] mb-2">
                Core Principles
              </p>
              <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[var(--siduri-text-primary)]">
                Governed intelligence with verifiable state.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Feature 1 */}
              <div className="p-8 rounded-2xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] transition-all hover:border-[rgba(255,255,255,0.15)]">
                <div className="w-10 h-10 rounded-xl border border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-low)] text-[var(--siduri-ember)] grid place-items-center font-serif text-lg mb-6">
                  ✦
                </div>
                <h3 className="text-lg font-medium text-[var(--siduri-text-primary)] mb-3">
                  Explicit Memory Governance
                </h3>
                <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed">
                  Memory is never silently accumulated. Facts, preferences, and
                  behavioral directives are proposed in conversation and become
                  permanent only upon explicit receipt approval.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-2xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] transition-all hover:border-[rgba(255,255,255,0.15)]">
                <div className="w-10 h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 grid place-items-center font-mono text-sm mb-6">
                  [#]
                </div>
                <h3 className="text-lg font-medium text-[var(--siduri-text-primary)] mb-3">
                  Grounded Knowledge & Citations
                </h3>
                <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed">
                  Assertions remain tethered to source evidence. Claims carry
                  verifiable citations with intact uncertainty indicators rather
                  than fabricating authority.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-2xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] transition-all hover:border-[rgba(255,255,255,0.15)]">
                <div className="w-10 h-10 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-elevated)] text-[var(--siduri-text-primary)] grid place-items-center font-mono text-sm mb-6">
                  ◈
                </div>
                <h3 className="text-lg font-medium text-[var(--siduri-text-primary)] mb-3">
                  Local-First Runtime Boundaries
                </h3>
                <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed">
                  A modular monolith with strict domain boundaries. Identity,
                  semantic memory, observation capture, and response gating run
                  in your environment with no external leakage.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-8 rounded-2xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] transition-all hover:border-[rgba(255,255,255,0.15)]">
                <div className="w-10 h-10 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 grid place-items-center font-serif text-lg mb-6">
                  S
                </div>
                <h3 className="text-lg font-medium text-[var(--siduri-text-primary)] mb-3">
                  On-Demand Visual Presence
                </h3>
                <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed">
                  Presentation is decoupled from core reasoning. Interact in
                  pure text, or activate in-browser Live2D embodiment rendered
                  reactively via WebGL when desired.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture Pipeline / Philosophy Section */}
        <section className="py-20 md:py-28 border-b border-[var(--siduri-border-subtle)]">
          <div className="home-container">
            <div className="max-w-2xl mb-14">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--siduri-ember)] mb-2">
                Execution Pipeline
              </p>
              <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[var(--siduri-text-primary)] mb-4">
                Transparent from input to experience.
              </h2>
              <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed">
                Every user utterance flows through an inspectable pipeline
                enforcing strict policy gating before generating speech or avatar
                expressions.
              </p>
            </div>

            {/* Pipeline Visual Diagram */}
            <div className="p-8 md:p-10 rounded-2xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative">
                {/* Step 1 */}
                <div className="p-5 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-elevated)] flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-[var(--siduri-ember)] tracking-widest block mb-2">
                      01 / INPUT
                    </span>
                    <strong className="text-sm font-medium text-[var(--siduri-text-primary)] block mb-1">
                      User Context
                    </strong>
                    <p className="text-xs text-[var(--siduri-text-muted)] leading-normal">
                      Channel & role-validated interaction.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-5 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-elevated)] flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-[var(--siduri-ember)] tracking-widest block mb-2">
                      02 / RETRIEVAL
                    </span>
                    <strong className="text-sm font-medium text-[var(--siduri-text-primary)] block mb-1">
                      Active Self & Memory
                    </strong>
                    <p className="text-xs text-[var(--siduri-text-muted)] leading-normal">
                      Approved facts, directives & evidence.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-5 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-elevated)] flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-[var(--siduri-ember)] tracking-widest block mb-2">
                      03 / REASONING
                    </span>
                    <strong className="text-sm font-medium text-[var(--siduri-text-primary)] block mb-1">
                      Structured Planning
                    </strong>
                    <p className="text-xs text-[var(--siduri-text-muted)] leading-normal">
                      Candidate speech, proposals & actions.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-5 rounded-xl border border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-low)] flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-[var(--siduri-ember-highlight)] tracking-widest block mb-2">
                      04 / GATE
                    </span>
                    <strong className="text-sm font-medium text-[var(--siduri-text-primary)] block mb-1">
                      Security & Disclosure
                    </strong>
                    <p className="text-xs text-[var(--siduri-text-secondary)] leading-normal">
                      Explicit staging & boundary approval.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-5 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-elevated)] flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-[var(--siduri-online)] tracking-widest block mb-2">
                      05 / OUTPUT
                    </span>
                    <strong className="text-sm font-medium text-[var(--siduri-text-primary)] block mb-1">
                      Experience Event
                    </strong>
                    <p className="text-xs text-[var(--siduri-text-muted)] leading-normal">
                      Voice, subtitles & optional Live2D.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Memory Receipt Preview Section */}
        <section className="py-20 md:py-28 border-b border-[var(--siduri-border-subtle)] bg-[#0e0e12]">
          <div className="home-container grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--siduri-ember)] mb-2">
                Governed State
              </p>
              <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[var(--siduri-text-primary)] mb-5">
                Every memory is an auditable receipt.
              </h2>
              <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed mb-6">
                When you share preferences or rules with Siduri, they are staged
                as structured candidates. You decide what enters long-term
                memory with explicit single-click approval.
              </p>
              <ul className="space-y-3 text-xs text-[var(--siduri-text-muted)] font-mono">
                <li className="flex items-center gap-2.5">
                  <span className="text-[var(--siduri-online)]">✓</span>
                  Structured subject / predicate / value storage
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[var(--siduri-online)]">✓</span>
                  Full revocation and override controls
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[var(--siduri-online)]">✓</span>
                  Session-isolated candidate staging
                </li>
              </ul>
            </div>

            {/* Receipt Card Mockup */}
            <div className="p-6 sm:p-8 rounded-2xl border border-[var(--siduri-border-ember)] bg-[var(--siduri-surface)] shadow-[0_10px_35px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between border-b border-[var(--siduri-border-subtle)] pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--siduri-warning)] shadow-[0_0_8px_rgba(226,179,110,0.6)]" />
                  <span className="text-[11px] font-mono tracking-wider text-[var(--siduri-text-primary)] uppercase">
                    Memory Proposal #prp-842
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                  Pending Review
                </span>
              </div>

              <div className="space-y-3.5 mb-6 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-[rgba(255,255,255,0.04)]">
                  <span className="text-[var(--siduri-text-muted)]">Subject</span>
                  <span className="text-[var(--siduri-text-primary)]">User / Preference</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[rgba(255,255,255,0.04)]">
                  <span className="text-[var(--siduri-text-muted)]">Directive</span>
                  <span className="text-[var(--siduri-text-primary)] font-sans">
                    Keep technical explanations concise and evidence-grounded
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[rgba(255,255,255,0.04)]">
                  <span className="text-[var(--siduri-text-muted)]">Provenance</span>
                  <span className="text-[var(--siduri-text-secondary)]">Direct chat teaching</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--siduri-text-muted)]">Sensitivity</span>
                  <span className="text-[var(--siduri-online)]">Private / Operator</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg bg-[var(--siduri-online)] text-[#16251a] text-xs font-semibold tracking-wide cursor-default transition-all"
                >
                  Approve Receipt
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg border border-[var(--siduri-border-subtle)] bg-[var(--siduri-elevated)] text-[var(--siduri-text-muted)] text-xs font-medium cursor-default"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Presence Section */}
        <section className="py-20 md:py-28 border-b border-[var(--siduri-border-subtle)]">
          <div className="home-container text-center max-w-2xl mx-auto">
            <div className="inline-grid w-14 h-14 place-items-center rounded-2xl border border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-low)] text-[var(--siduri-ember-highlight)] font-serif text-2xl mb-6 mx-auto shadow-[0_0_30px_rgba(217,154,104,0.15)]">
              ✦
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--siduri-ember)] mb-2">
              Embodied Experience
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-[var(--siduri-text-primary)] mb-5">
              Presence, when wanted.
            </h2>
            <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed mb-8">
              Keep the conversation text-only for quiet focus, or activate an
              on-demand Live2D companion surface directly in your browser.
              Rendering runs locally via WebGL with zero background software
              dependencies.
            </p>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] text-[10px] font-mono text-[var(--siduri-text-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--siduri-ember)]" />
              Cubism Web Runtime · Browser-Isolated · On-Demand
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-14 bg-[#09090c]">
        <div className="home-container flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="siduri-glyph w-6 h-6 text-xs">✦</span>
            <span className="font-bold tracking-widest text-xs text-[var(--siduri-text-primary)]">
              SIDURI
            </span>
            <span className="text-[10px] font-mono text-[var(--siduri-text-muted)]">
              v0.2.0-y
            </span>
          </div>

          <p className="text-xs text-[var(--siduri-text-dim)] font-sans text-center sm:text-left">
            Local-first AI companion runtime with inspectable boundaries.
          </p>

          <div className="flex items-center gap-5 text-xs text-[var(--siduri-text-muted)]">
            <Link href="/chat" className="hover:text-[var(--siduri-text-primary)]">
              Chat
            </Link>
            <Link href="/operator" className="hover:text-[var(--siduri-text-primary)]">
              Operator
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
