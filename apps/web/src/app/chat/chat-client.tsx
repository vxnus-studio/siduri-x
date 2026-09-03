"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  formatClaimReceipt,
  formatRuntimeEffect,
} from "../../lib/memory-display";
import PreferencesStarter from "../../components/PreferencesStarter";
import {
  AvatarCanvas,
  type ActiveAvatarEvent,
  type AvatarExpression,
  type AvatarAction,
} from "../../components/live2d";
import { postJson, fetchApi } from "../../lib/api";

type MemoryProposalData = {
  proposal_id: string;
  content: string;
  status: string;
  subject?: string;
  predicate?: string;
  value?: string;
  claim_type?: string;
};

type BehavioralProposalData = {
  directive_id: string;
  memory_class: string;
  domain: string;
  knowledge_domain?: string;
  runtime_effect?: string;
  subject: string;
  predicate: string;
  value: string;
  status: string;
  behavior: {
    instruction: string;
    frequency: string;
    preferred_positions: string[];
  };
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  spokenJa?: string;
  evidenceIds?: string[];
  memoryProposals?: MemoryProposalData[];
  behavioralProposals?: BehavioralProposalData[];
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

type ChatResponse = {
  response: { speech_id?: string; spoken_ja: string; subtitle_en: string; evidence_ids: string[] };
  metadata?: {
    memory_proposals?: MemoryProposalData[];
    behavioral_proposals?: BehavioralProposalData[];
    citations?: Array<{
      evidence_id: string;
      source_id?: string;
      document_id?: string;
      chunk_id?: string;
      revision?: string;
      provenance?: string;
      preview?: string;
    }>;
    events?: Array<{
      event_id: string;
      kind: string;
      lifecycle: string;
      approval?: string;
      expression?: string;
      action?: string;
      durationMs?: number;
    }>;
  };
};

const STORAGE_KEY = "siduri.chat.conversations.v1";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function readConversations(): Conversation[] {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(value) ? (value as Conversation[]) : [];
  } catch {
    return [];
  }
}

export default function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("connecting");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPresenceOpen, setIsPresenceOpen] = useState(false);
  const [activeAvatarEvent, setActiveAvatarEvent] = useState<ActiveAvatarEvent | null>(null);
  const [avatarModelUrl, setAvatarModelUrl] = useState<string | undefined>(undefined);
  const messagesRef = useRef<HTMLDivElement>(null);
  const avatarTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [activeId, conversations],
  );

  useEffect(() => {
    return () => {
      if (avatarTimerRef.current) {
        clearTimeout(avatarTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const stored = readConversations();
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
    setReady(true);
    fetchApi(`/health`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setStatus("online");
          if (data.organs?.body?.modelUrl) {
            setAvatarModelUrl(data.organs.body.modelUrl);
          } else {
            // Check discovered models from /api/models/body
            fetchApi(`/api/models/body`)
              .then(async (mRes) => {
                if (mRes.ok) {
                  const mData = await mRes.json().catch(() => ({}));
                  const models: string[] = mData.models || [];
                  const customModel = models.find((m) => m !== "default");
                  if (customModel) {
                    setAvatarModelUrl(`/assets/body/${customModel}/model.model3.json`);
                  } else if (models.length > 0 && models[0] !== "default") {
                    setAvatarModelUrl(`/assets/body/${models[0]}/model.model3.json`);
                  }
                }
              })
              .catch(() => {});
          }
        } else {
          setStatus("online");
        }
      })
      .catch(() => setStatus("offline"));
  }, []);

  useEffect(() => {
    if (ready)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations, ready]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeId, activeConversation?.messages.length, busy]);

  function createConversation(): Conversation {
    return {
      id: newId(),
      title: "New conversation",
      messages: [],
      updatedAt: Date.now(),
    };
  }

  function updateConversation(
    id: string,
    update: (conversation: Conversation) => Conversation,
  ): void {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id ? update(conversation) : conversation,
      ),
    );
  }

  function startNewChat(): void {
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setMessage("");
    setStatus("online");
  }

  function removeConversation(id: string): void {
    setConversations((current) =>
      current.filter((conversation) => conversation.id !== id),
    );
    if (activeId === id) {
      const next = conversations.find((conversation) => conversation.id !== id);
      setActiveId(next?.id ?? null);
    }
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const content = message.trim();
    if (!content || busy) return;
    if (/\[[^\]]+\]/.test(content)) {
      setStatus("replace the blanks first");
      return;
    }

    let conversation = activeConversation;
    if (!conversation) {
      conversation = createConversation();
      setConversations((current) => [conversation as Conversation, ...current]);
      setActiveId(conversation.id);
    }

    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content,
      createdAt: Date.now(),
    };
    const nextMessages = [...conversation.messages, userMessage];
    const title =
      conversation.messages.length === 0
        ? content.slice(0, 42)
        : conversation.title;
    updateConversation(conversation.id, (current) => ({
      ...current,
      title,
      messages: nextMessages,
      updatedAt: Date.now(),
    }));
    setMessage("");
    setBusy(true);
    setStatus("thinking");

    try {
      const data = await postJson<ChatResponse | { error: string }>(`/chat`, {
        id: "default", // hardcoded default companion for now
        message: content,
        role: "VIEWER",
        history: conversation.messages.slice(-20).map((item) => ({
          role: item.role,
          content: item.content,
        })),
      });
      if ("error" in data) throw new Error(data.error);
      const plan = data.response;
      const proposals = data.metadata?.memory_proposals;
      const behavioralProposals = data.metadata?.behavioral_proposals;
      const assistant: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: plan.subtitle_en,
        spokenJa: plan.spoken_ja,
        evidenceIds: plan.evidence_ids,
        memoryProposals: proposals,
        behavioralProposals,
        createdAt: Date.now(),
      };
      updateConversation(conversation.id, (current) => ({
        ...current,
        messages: [...current.messages, assistant],
        updatedAt: Date.now(),
      }));

      // Process approved avatar events if present
      const avatarEvents = data.metadata?.events?.filter(
        (e) => e.kind === "avatar" && (e.approval === "APPROVED" || !e.approval),
      );
      if (avatarEvents && avatarEvents.length > 0) {
        const latest = avatarEvents[avatarEvents.length - 1];
        const speechId = data.response?.speech_id;

        if (avatarTimerRef.current) {
          clearTimeout(avatarTimerRef.current);
        }

        setActiveAvatarEvent({
          eventId: latest.event_id,
          expression: (latest.expression as AvatarExpression) || "neutral",
          action: (latest.action as AvatarAction) || "talk",
          state: "speaking",
          speechId,
          durationMs: latest.durationMs,
        });

        const duration = latest.durationMs || 4500;
        avatarTimerRef.current = setTimeout(() => {
          setActiveAvatarEvent((current) =>
            current
              ? {
                  ...current,
                  state: "idle",
                  action: "idle",
                }
              : null,
          );
        }, duration);
      }

      setStatus("online");
    } catch (error) {
      const assistant: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: `I couldn’t reach the orchestrator. ${String(error)}`,
        createdAt: Date.now(),
      };
      updateConversation(conversation.id, (current) => ({
        ...current,
        messages: [...current.messages, assistant],
        updatedAt: Date.now(),
      }));
      setStatus("offline");
    } finally {
      setBusy(false);
    }
  }

  const messages = activeConversation?.messages ?? [];
  const evidenceCount = messages.at(-1)?.evidenceIds?.length ?? 0;

  async function handleProposal(
    messageId: string,
    proposalId: string,
    action: "approve" | "reject",
  ) {
    if (!activeConversation) return;
    try {
      await postJson<{ item?: any; proposal?: any }>(
        `/memory/proposals/${action}`,
        { id: proposalId, companionId: "default" },
      );
      const updatedStatus = action === "approve" ? "approved" : "rejected";
      updateConversation(activeConversation.id, (conv) => ({
        ...conv,
        messages: conv.messages.map((msg) =>
          msg.id === messageId && msg.memoryProposals
            ? {
                ...msg,
                memoryProposals: msg.memoryProposals.map((p) =>
                  p.proposal_id === proposalId
                    ? { ...p, status: updatedStatus }
                    : p,
                ),
              }
            : msg,
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleBehavioralProposal(
    messageId: string,
    directiveId: string,
    action: "approve" | "reject",
  ) {
    if (!activeConversation) return;
    try {
      await postJson(`/memory/behavioral/${action}`, {
        id: directiveId,
        companionId: "default",
      });
      const updatedStatus = action === "approve" ? "confirmed" : "rejected";
      updateConversation(activeConversation.id, (conv) => ({
        ...conv,
        messages: conv.messages.map((msg) =>
          msg.id === messageId && msg.behavioralProposals
            ? {
                ...msg,
                behavioralProposals: msg.behavioralProposals.map((p) =>
                  p.directive_id === directiveId
                    ? { ...p, status: updatedStatus }
                    : p,
                ),
              }
            : msg,
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className={`chat-app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="chat-sidebar" aria-label="Conversation history">
        <div className="chat-sidebar-top">
          <a className="chat-brand" href="/chat">
            <span className="chat-brand-mark">S</span>
            <span>SIDURI</span>
          </a>
          <button
            className="sidebar-collapse"
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>
        <button
          className="new-chat-button"
          type="button"
          onClick={startNewChat}
        >
          <span>＋</span> New conversation
        </button>
        <div className="history-heading">
          <span>Recent conversations</span>
          <span>{conversations.length}</span>
        </div>
        <div className="conversation-list">
          {!ready ? (
            <p className="history-empty">Loading history…</p>
          ) : conversations.length === 0 ? (
            <p className="history-empty">
              Your private conversations will appear here.
            </p>
          ) : (
            conversations
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((conversation) => (
                <div
                  className={`conversation-row ${conversation.id === activeId ? "selected" : ""}`}
                  key={conversation.id}
                >
                  <button
                    type="button"
                    className="conversation-select"
                    onClick={() => setActiveId(conversation.id)}
                  >
                    <span className="conversation-title">
                      {conversation.title}
                    </span>
                    <span className="conversation-date">
                      {formatTime(conversation.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="conversation-delete"
                    onClick={() => removeConversation(conversation.id)}
                    aria-label={`Delete ${conversation.title}`}
                  >
                    ×
                  </button>
                </div>
              ))
          )}
        </div>
        <div className="sidebar-footer">
          <a className="sidebar-console" href="/operator">
            <span>⌘</span>
            <span>Operator console</span>
            <b>↗</b>
          </a>
        </div>
      </aside>

      <main className="chat-workspace">
        <div className="chat-top-status flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPresenceOpen((prev) => !prev)}
            className={`connection-pill cursor-pointer transition-all focus-visible:ring-1 focus-visible:ring-[var(--siduri-border-ember)] outline-none ${
              isPresenceOpen
                ? "border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-med)] text-[var(--siduri-ember-highlight)]"
                : "hover:border-[var(--siduri-border-ember)] text-[var(--siduri-text-secondary)]"
            }`}
            aria-label="Toggle avatar presence"
            aria-expanded={isPresenceOpen}
            title={isPresenceOpen ? "Disable Avatar Presence" : "Enable Avatar Presence"}
          >
            <span className={`status-light ${isPresenceOpen ? "online" : ""}`} />
            <span>Presence</span>
          </button>
          <span className="connection-pill">
            <span
              className={`status-light ${status === "online" ? "online" : ""}`}
            />
            {status}
          </span>
        </div>

        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden relative">
          <section className="conversation-surface" aria-label="Private chat">
            <div
              ref={messagesRef}
              className={`conversation-scroll ${isPresenceOpen ? "presence-active" : ""}`}
              aria-live="polite"
            >
              {isPresenceOpen ? (
                <div className="avatar-presence-area" data-testid="avatar-presence-area">
                  <AvatarCanvas
                    modelUrl={avatarModelUrl}
                    expression={activeAvatarEvent?.expression || "neutral"}
                    action={activeAvatarEvent?.action || "idle"}
                    state={activeAvatarEvent?.state || "idle"}
                    speechId={activeAvatarEvent?.speechId}
                    lipSyncValue={activeAvatarEvent?.lipSyncValue}
                    durationMs={activeAvatarEvent?.durationMs}
                    className="w-full h-full"
                  />
                </div>
              ) : messages.length === 0 ? (
                <PreferencesStarter onSelectPrompt={(text) => setMessage(text)} />
              ) : (
                messages.map((item) => (
                  <article
                    className={`platform-message ${item.role}`}
                    key={item.id}
                  >
                    <div className="message-avatar">
                      {item.role === "user" ? "U" : "S"}
                    </div>
                    <div className="message-body">
                      <div className="message-meta">
                        <span>{item.role === "user" ? "You" : "Siduri"}</span>
                        <time>{formatTime(item.createdAt)}</time>
                      </div>
                      <p className="message-primary">
                        {item.role === "assistant"
                          ? (item.spokenJa ?? item.content)
                          : item.content}
                      </p>
                      {item.role === "assistant" && item.spokenJa && (
                        <p className="message-translation">{item.content}</p>
                      )}
                      {item.evidenceIds && item.evidenceIds.length > 0 && (
                        <span className="evidence-chip">
                          {item.evidenceIds.length} evidence link
                          {item.evidenceIds.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {item.memoryProposals &&
                        item.memoryProposals.length > 0 && (
                          <div className="memory-receipts">
                            {item.memoryProposals.map((p) => (
                              <div
                                key={p.proposal_id}
                                className={`memory-receipt status-${p.status}`}
                              >
                                <strong>
                                  Remember
                                  {p.claim_type ? ` (${p.claim_type})` : ""}:
                                </strong>{" "}
                                {formatClaimReceipt(p)}
                                <div className="receipt-actions">
                                  {p.status === "pending" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleProposal(
                                            item.id,
                                            p.proposal_id,
                                            "approve",
                                          )
                                        }
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleProposal(
                                            item.id,
                                            p.proposal_id,
                                            "reject",
                                          )
                                        }
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <span>{p.status.toUpperCase()}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      {item.behavioralProposals &&
                        item.behavioralProposals.length > 0 && (
                          <div className="memory-receipts">
                            {item.behavioralProposals.map((p) => (
                              <div
                                key={p.directive_id}
                                className={`memory-receipt status-${p.status}`}
                              >
                                <strong>
                                  Runtime effect [{p.knowledge_domain ?? p.domain}{" "}
                                  → {p.runtime_effect ?? p.memory_class}]:
                                </strong>{" "}
                                {formatRuntimeEffect(p)}
                                <div className="receipt-actions">
                                  {p.status === "pending" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleBehavioralProposal(
                                            item.id,
                                            p.directive_id,
                                            "approve",
                                          )
                                        }
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleBehavioralProposal(
                                            item.id,
                                            p.directive_id,
                                            "reject",
                                          )
                                        }
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <span>{p.status.toUpperCase()}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </article>
                ))
              )}
              {busy && !isPresenceOpen && (
                <div className="platform-message assistant thinking-message">
                  <div className="message-avatar">S</div>
                  <div className="message-body">
                    <div className="message-meta">
                      <span>Siduri</span>
                      <span className="thinking-label">thinking</span>
                    </div>
                    <div className="thinking-dots">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <form className="platform-composer" onSubmit={submit}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Message Siduri…"
                rows={1}
                maxLength={4000}
                aria-label="Message Siduri"
                disabled={busy}
              />
              <div className="composer-bottom">
                <span>
                  Private local session ·{" "}
                  {evidenceCount
                    ? `${evidenceCount} evidence link${evidenceCount === 1 ? "" : "s"}`
                    : "No evidence attached"}
                </span>
                <button
                  type="submit"
                  disabled={busy || !message.trim()}
                  aria-label="Send message"
                >
                  {busy ? "" : "↑"}
                </button>
              </div>
            </form>
          </section>
        </div>
        <p className="chat-disclaimer">
          Siduri can be uncertain. Verify important details against the
          evidence.
        </p>
      </main>
    </div>
  );
}
