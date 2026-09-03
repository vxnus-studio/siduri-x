import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-page bg-[#09090c] min-h-screen text-[var(--siduri-text-primary)] font-sans">
      {/* Top Header Navigation */}
      <header className="home-nav">
        <div className="home-container home-nav-inner flex items-center justify-between py-4">
          <Link href="/" className="brand-link flex items-center gap-2" aria-label="Siduri Home">
            <span className="siduri-glyph text-[var(--siduri-ember)]">✦</span>
            <span className="font-bold tracking-widest text-sm">SIDURI-X</span>
          </Link>

          <nav className="nav-links flex gap-6 text-sm text-[var(--siduri-text-muted)]" aria-label="Main Navigation">
            <Link href="/chat" className="hover:text-[var(--siduri-text-primary)] transition-colors">Chat</Link>
            <Link href="/operator" className="hover:text-[var(--siduri-text-primary)] transition-colors">Operator Console</Link>
          </nav>

          <div>
            <Link href="/chat" className="nav-cta inline-flex items-center gap-2 text-xs font-mono border border-[var(--siduri-border-subtle)] px-4 py-2 rounded-full hover:bg-[var(--siduri-surface)] transition-all">
              Open Chat <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-24 md:py-32 border-b border-[var(--siduri-border-subtle)] relative overflow-hidden">
          <div className="home-container relative z-10 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-low)] text-[var(--siduri-ember-light)] text-[10px] font-mono tracking-widest uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--siduri-online)] shadow-[0_0_8px_rgba(127,199,154,0.6)]" />
              Standalone Companion Framework · Version 1.0
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-serif text-[var(--siduri-text-primary)] tracking-tight leading-[1.15] mb-6 max-w-4xl">
              A companion grown from memory, powered by modular cognition.
            </h1>

            <p className="text-base sm:text-lg text-[var(--siduri-text-secondary)] font-sans leading-relaxed mb-10 max-w-2xl font-light">
              Siduri-X is an intelligent companion designed with authoritative memory, atomic behavioral gating, and a strict 10-organ architecture. She starts as a blank slate and forms her identity entirely through your interactions.
            </p>

            <div className="flex flex-wrap justify-center items-center gap-4">
              <Link
                href="/chat"
                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-[var(--siduri-ember)] text-[#1b1619] font-sans font-semibold text-sm tracking-wide transition-all hover:brightness-110 shadow-[0_4px_20px_rgba(217,154,104,0.2)]"
              >
                Launch Companion
                <span className="font-mono text-base">→</span>
              </Link>
              <Link
                href="/operator"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] text-[var(--siduri-text-primary)] font-sans font-medium text-sm transition-all hover:border-[var(--siduri-border-ember)] hover:bg-[var(--siduri-tint-low)]"
              >
                <span>⌘</span>
                Operator Console
              </Link>
            </div>
          </div>
        </section>

        {/* 10 Organ Architecture Section */}
        <section className="py-20 md:py-28 border-b border-[var(--siduri-border-subtle)] bg-[#0e0e12]">
          <div className="home-container">
            <div className="mb-14 text-center max-w-3xl mx-auto">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--siduri-ember)] mb-2">
                Decoupled Philosophy
              </p>
              <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[var(--siduri-text-primary)] mb-4">
                The 10-Organ Architecture
              </h2>
              <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed">
                Siduri is not a chatbot. She is a cognition runtime composed of independent organs. 
                Every decision originates from the Brain, while other organs perceive, remember, act, and embody.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { name: "Brain", desc: "Cognition, planning, and authoritative decision making." },
                { name: "Memory", desc: "PostgreSQL-backed authoritative storage of claims and preferences." },
                { name: "Behavior", desc: "Atomic directive state machine and personality projection." },
                { name: "Knowledge", desc: "External factual context and verifiable E-compatible packs." },
                { name: "Hands", desc: "Tool execution and strict cryptographic action policy capabilities." },
                { name: "Ear", desc: "Audio transcription, perception, and sensory input ingestion." },
                { name: "Vision", desc: "Visual observation, cropping, and OCR interpretation." },
                { name: "Voice", desc: "Queued speech synthesis (Edge-TTS, Piper, VOICEVOX) and auditory expression." },
                { name: "Body", desc: "Renderer-agnostic avatar expression (Live2D) and embodiment." },
                { name: "Observation", desc: "Event frame deduplication and real-time evidence extraction." }
              ].map((organ) => (
                <div key={organ.name} className="p-5 rounded-xl border border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)] transition-all hover:border-[var(--siduri-border-ember)]">
                  <h3 className="text-sm font-bold font-mono text-[var(--siduri-ember-light)] mb-2">{organ.name}</h3>
                  <p className="text-xs text-[var(--siduri-text-secondary)] leading-relaxed">{organ.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 md:py-28 border-b border-[var(--siduri-border-subtle)]">
          <div className="home-container grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--siduri-ember)] mb-2">
                Authoritative State
              </p>
              <h2 className="text-3xl font-serif font-normal text-[var(--siduri-text-primary)] mb-5">
                Blank Slate Identity
              </h2>
              <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed mb-6">
                Unlike standard conversational agents, Siduri starts with no pre-baked persona. She learns, remembers, and adapts over time. When you share preferences, they are staged as structured candidates. You decide what enters her long-term memory with explicit single-click approval.
              </p>
              <ul className="space-y-3 text-xs text-[var(--siduri-text-muted)] font-mono">
                <li className="flex items-center gap-2.5">
                  <span className="text-[var(--siduri-online)]">✓</span>
                  No hidden relationship assumptions
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[var(--siduri-online)]">✓</span>
                  Structured episodic and semantic memory
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[var(--siduri-online)]">✓</span>
                  Full revocation and override controls
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-2xl border border-[var(--siduri-border-ember)] bg-[var(--siduri-surface)] shadow-[0_10px_35px_rgba(0,0,0,0.4)] relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-[var(--siduri-bg)] px-3 text-[10px] font-mono text-[var(--siduri-ember)] tracking-widest uppercase">
                Operator View
              </div>
              <div className="space-y-4 font-mono text-xs">
                <div className="p-3 border border-[var(--siduri-border-subtle)] rounded bg-[#13131a]">
                  <div className="text-[var(--siduri-text-muted)] mb-1">Incoming Claim</div>
                  <div className="text-[var(--siduri-online)] font-bold">"User prefers concise, technical explanations."</div>
                  <div className="flex gap-2 mt-3">
                    <span className="bg-[var(--siduri-online)] text-black px-2 py-0.5 rounded font-bold cursor-pointer">APPROVE</span>
                    <span className="border border-[var(--siduri-border-subtle)] text-[var(--siduri-text-muted)] px-2 py-0.5 rounded cursor-pointer">REJECT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Local Installation Section */}
        <section className="py-20 md:py-28 bg-[#09090c]">
          <div className="home-container text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-[var(--siduri-text-primary)] mb-5">
              Private, local, and yours.
            </h2>
            <p className="text-sm text-[var(--siduri-text-secondary)] leading-relaxed mb-8">
              Siduri is designed for local-first operations and explicit consent. The CLI dynamically generates a standalone companion instance leveraging only the organ packages you need. Run it completely on your own machine.
            </p>
            <div className="bg-[#13131a] p-4 rounded-xl border border-[var(--siduri-border-subtle)] inline-block text-left text-sm font-mono text-[var(--siduri-text-primary)] shadow-lg mx-auto">
              <span className="text-emerald-400">$</span> npx @vxnus/siduri create my-companion
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-14 border-t border-[var(--siduri-border-subtle)] bg-[#0e0e12]">
        <div className="home-container flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="siduri-glyph w-6 h-6 text-xs text-[var(--siduri-ember)]">✦</span>
            <span className="font-bold tracking-widest text-xs text-[var(--siduri-text-primary)]">
              SIDURI-X
            </span>
          </div>

          <p className="text-xs text-[var(--siduri-text-dim)] font-sans text-center sm:text-left">
            Local-first AI companion framework.
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
