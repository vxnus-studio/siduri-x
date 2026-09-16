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
import { postJson, fetchApi, postStream, interruptChat } from "../../lib/api";

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
  subtitle?: string;
  subtitleLanguage?: string;
  subtitles?: Record<string, string>;
  spokenJa?: string;
  evidenceIds?: string[];
  memoryProposals?: MemoryProposalData[];
  behavioralProposals?: BehavioralProposalData[];
  createdAt: number;
  interrupted?: boolean;
  interruptionReason?: string;
  error?: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

type ChatResponse = {
  response: {
    speech_id?: string;
    spoken_ja?: string;
    subtitle_en?: string;
    subtitle_ja?: string;
    subtitle?: string;
    subtitle_language?: string;
    subtitles?: Record<string, string>;
    evidence_ids: string[];
  };
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
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function sanitizeMessage(msg: ChatMessage): ChatMessage {
  if (msg.content === "[interrupted]") {
    return {
      ...msg,
      content: "",
      interrupted: true,
      interruptionReason: "interrupted",
    };
  }
  if (msg.content && msg.content.endsWith(" [interrupted]")) {
    return {
      ...msg,
      content: msg.content.slice(0, -" [interrupted]".length).trim(),
      interrupted: true,
      interruptionReason: "interrupted",
    };
  }
  if (
    msg.content &&
    msg.content.startsWith("I couldn’t reach the orchestrator. ")
  ) {
    const err = msg.content.slice("I couldn’t reach the orchestrator. ".length);
    return {
      ...msg,
      content: "",
      error: err,
    };
  }
  return msg;
}

function readConversations(): Conversation[] {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(value)) return [];
    return (value as Conversation[]).map((conv) => ({
      ...conv,
      messages: (conv.messages || []).map(sanitizeMessage),
    }));
  } catch {
    return [];
  }
}

export function getErrorDiagnosis(errorMsg?: string): { title: string; hint?: string } {
  if (!errorMsg) return { title: "Connection or service issue" };
  const lower = errorMsg.toLowerCase();

  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("api_key")) {
    return {
      title: "LLM Provider Authentication Failed",
      hint: "Your API key is invalid or missing. Please check your API key in your .env file or environment variables.",
    };
  }
  if (lower.includes("402") || lower.includes("insufficient") || lower.includes("balance") || lower.includes("credits") || lower.includes("quota")) {
    return {
      title: "LLM Credits / Quota Exhausted",
      hint: "Your LLM provider account has run out of credits or reached its usage quota.",
    };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      title: "LLM Rate Limit Reached",
      hint: "The LLM provider received too many requests. Please wait a moment before trying again.",
    };
  }
  if (lower.includes("404") || (lower.includes("model") && lower.includes("not found"))) {
    return {
      title: "LLM Model Not Found",
      hint: "The configured model could not be found or is unavailable on this provider.",
    };
  }
  if (lower.includes("context length") || lower.includes("maximum context") || lower.includes("token limit")) {
    return {
      title: "Context Window Exceeded",
      hint: "The conversation exceeded the model's token limit. Consider starting a new chat.",
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("deadline")) {
    return {
      title: "LLM Request Timed Out",
      hint: "The AI provider took too long to generate a response (wall-clock deadline exceeded).",
    };
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("bad gateway")) {
    return {
      title: "LLM Provider Service Outage",
      hint: "The AI provider is temporarily unavailable or overloaded.",
    };
  }
  return {
    title: "Connection or service issue",
    hint: undefined,
  };
}

export function getInterruptionExplanation(reason?: string): { label: string; text: string; hint?: string } {
  switch (reason) {
    case "client_disconnect":
      return {
        label: "Disconnected",
        text: "Response stopped due to connection close.",
        hint: "The connection to the companion service closed prematurely.",
      };
    case "user_stop":
      return {
        label: "Stopped",
        text: "Response stopped by user.",
        hint: "Generation was manually cancelled via the stop control.",
      };
    case "user_barge_in":
      return {
        label: "Interrupted",
        text: "Response interrupted by new message.",
        hint: "Generation was cancelled because a new prompt was submitted.",
      };
    case "timeout":
      return {
        label: "Timed Out",
        text: "Response timed out.",
        hint: "The request exceeded the allotted time limit before finishing.",
      };
    default:
      return {
        label: "Interrupted",
        text: "Response was interrupted.",
        hint: reason && reason !== "interrupted" ? `Reason: ${reason}` : undefined,
      };
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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isPresenceOpen, setIsPresenceOpen] = useState(false);
  const [activeAvatarEvent, setActiveAvatarEvent] = useState<ActiveAvatarEvent | null>(null);
  const [avatarModelUrl, setAvatarModelUrl] = useState<string | undefined>(undefined);
  const [selectedMode, setSelectedMode] = useState<'casual' | 'teach' | 'hybrid'>('hybrid');
  const [effectiveMode, setEffectiveMode] = useState<'casual' | 'teach' | 'hybrid'>('hybrid');
  const [subtitleLanguage, setSubtitleLanguage] = useState<string>("off");
  const messagesRef = useRef<HTMLDivElement>(null);
  const avatarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [activeId, conversations],
  );

  useEffect(() => {
    return () => {
      if (avatarTimerRef.current) {
        clearTimeout(avatarTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort("unmounted");
      }
    };
  }, []);

  useEffect(() => {
    const stored = readConversations();
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
    try {
      const savedLang = localStorage.getItem("siduri.chat.subtitleLanguage");
      if (savedLang) {
        setSubtitleLanguage(savedLang);
      }
    } catch {}
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

  function interruptCurrentChat(): void {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("user_stop");
      abortControllerRef.current = null;
    }
    interruptChat("default", "user_stop");
    setBusy(false);
    setStatus("online");
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const content = message.trim();
    if (!content) return;
    if (/\[[^\]]+\]/.test(content)) {
      setStatus("replace the blanks first");
      return;
    }

    // Barge-in: if currently generating/streaming, cancel existing request
    if (busy && abortControllerRef.current) {
      abortControllerRef.current.abort("user_barge_in");
      abortControllerRef.current = null;
      interruptChat("default", "user_barge_in");
    }

    let conversation = activeConversation;
    if (!conversation) {
      conversation = createConversation();
      setConversations((current) => [conversation as Conversation, ...current]);
      setActiveId(conversation.id);
    }

    // Filter out unstarted assistant placeholder from previous interrupted turn so it doesn't leave an empty ghost bubble
    const cleanedMessages = conversation.messages.filter(
      (m) => !(m.role === "assistant" && !m.content.trim() && !m.error && !m.interrupted),
    );

    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content,
      createdAt: Date.now(),
    };

    const assistantId = newId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    const nextMessages = [...cleanedMessages, userMessage, assistantPlaceholder];
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
    setStatus("streaming");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await postStream(
        `/chat/stream`,
        {
          id: "default",
          message: content,
          medium: "web",
          mode: selectedMode,
          subtitleLanguage: subtitleLanguage !== "off" ? subtitleLanguage : undefined,
          history: conversation.messages.slice(-20).map((item) => ({
            role: item.role,
            content: item.content,
          })),
        },
        {
          onStaged: (stagedData) => {
            if (stagedData?.mode && (stagedData.mode === "casual" || stagedData.mode === "teach" || stagedData.mode === "hybrid")) {
              setEffectiveMode(stagedData.mode);
            }
          },
          onAvatar: (latest) => {
            const speechId = (latest as any).speech_id;
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
          },
          onChunk: (chunk) => {
            if (chunk.deltaText) {
              updateConversation(conversation.id, (current) => ({
                ...current,
                messages: current.messages.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content + chunk.deltaText }
                    : msg,
                ),
              }));
            }
            if (chunk.expression || chunk.action) {
              setActiveAvatarEvent((current) =>
                current
                  ? {
                      ...current,
                      expression: (chunk.expression as AvatarExpression) || current.expression,
                      action: (chunk.action as AvatarAction) || current.action,
                    }
                  : null,
              );
            }
          },
          onDone: (data) => {
            if (data?.metadata?.mode && (data.metadata.mode === "casual" || data.metadata.mode === "teach" || data.metadata.mode === "hybrid")) {
              setEffectiveMode(data.metadata.mode);
            }
            const plan = data.response || {};
            const proposals = data.metadata?.memory_proposals;
            const behavioralProposals = data.metadata?.behavioral_proposals;

            updateConversation(conversation.id, (current) => ({
              ...current,
              messages: current.messages.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: msg.content || plan.subtitle_en || plan.subtitle_ja || "",
                      subtitle: plan.subtitle,
                      subtitleLanguage: plan.subtitle_language || (subtitleLanguage !== "off" ? subtitleLanguage : undefined),
                      subtitles: plan.subtitles,
                      spokenJa: plan.spoken_ja,
                      evidenceIds: plan.evidence_ids,
                      memoryProposals: proposals,
                      behavioralProposals,
                    }
                  : msg,
              ),
              updatedAt: Date.now(),
            }));
            setStatus("online");
          },
          onInterrupted: (data) => {
            const reason = data?.reason || abortController.signal.reason || "interrupted";
            updateConversation(conversation.id, (current) => {
              const target = current.messages.find((m) => m.id === assistantId);
              // If barge-in happened before Siduri spoke anything, remove the empty placeholder
              if (reason === "user_barge_in" && (!target || !target.content.trim())) {
                return {
                  ...current,
                  messages: current.messages.filter((msg) => msg.id !== assistantId),
                  updatedAt: Date.now(),
                };
              }
              return {
                ...current,
                messages: current.messages.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        interrupted: true,
                        interruptionReason: typeof reason === "string" ? reason : "interrupted",
                      }
                    : msg,
                ),
                updatedAt: Date.now(),
              };
            });
            setStatus("online");
          },
          onError: (err) => {
            const errorMessage = err?.message || String(err) || "Unknown error";
            updateConversation(conversation.id, (current) => ({
              ...current,
              messages: current.messages.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      error: errorMessage,
                    }
                  : msg,
              ),
              updatedAt: Date.now(),
            }));
            setStatus("offline");
          },
        },
        abortController.signal,
      );
    } catch (error) {
      if (!abortController.signal.aborted) {
        const errorMessage = (error as any)?.message || String(error) || "Connection error";
        updateConversation(conversation.id, (current) => ({
          ...current,
          messages: current.messages.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  error: errorMessage,
                }
              : msg,
          ),
          updatedAt: Date.now(),
        }));
        setStatus("offline");
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
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
      const updatedStatus = action === "approve" ? "active" : "rejected";
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
    <div
      className={`chat-app ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${
        isMobileDrawerOpen ? "mobile-drawer-open" : ""
      }`}
    >
      {isMobileDrawerOpen && (
        <div
          className="chat-backdrop"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
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
          <button
            className="mobile-drawer-close"
            type="button"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-label="Close conversation drawer"
          >
            ✕
          </button>
        </div>
        <button
          className="new-chat-button"
          type="button"
          onClick={() => {
            startNewChat();
            setIsMobileDrawerOpen(false);
          }}
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
                    onClick={() => {
                      setActiveId(conversation.id);
                      setIsMobileDrawerOpen(false);
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      removeConversation(conversation.id);
                    }}
                    aria-label={`Delete ${conversation.title}`}
                  >
                    ×
                  </button>
                </div>
              ))
          )}
        </div>
        <div className="sidebar-footer">
          <button
            type="button"
            onClick={() => {
              setIsMobileDrawerOpen(false);
              setIsMobileSettingsOpen(true);
            }}
            className="sidebar-settings-btn md:hidden"
          >
            <span>⚙</span>
            <span className="truncate">Preferences ({selectedMode}{subtitleLanguage !== "off" ? ` · ${subtitleLanguage.toUpperCase()}` : ""})</span>
          </button>
          <a className="sidebar-console" href="/operator">
            <span>⌘</span>
            <span>Operator console</span>
            <b>↗</b>
          </a>
        </div>
      </aside>

      <main className="chat-workspace">
        <header className="chat-header">
          <div className="chat-header-brand-group">
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Open conversation menu"
            >
              <span className="hamburger-icon">☰</span>
            </button>
            <a href="/chat" className="chat-header-title">
              <span className="chat-brand-mark">S</span>
              <span className="font-bold tracking-widest text-xs hidden xs:inline">SIDURI</span>
            </a>
          </div>

          <div className="chat-header-actions flex items-center gap-1.5 sm:gap-2.5">
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
              <span className="text-xs">Presence</span>
            </button>

            {/* Mobile Options Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileSettingsOpen(true)}
              className={`connection-pill cursor-pointer transition-all md:hidden flex items-center gap-1.5 ${
                subtitleLanguage !== "off" || selectedMode !== "hybrid"
                  ? "border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-med)] text-[var(--siduri-ember-highlight)]"
                  : "hover:border-[var(--siduri-border-ember)] text-[var(--siduri-text-secondary)]"
              }`}
              aria-label="Open chat preferences"
              title="Preferences & Subtitles"
            >
              <span className="text-xs">⚙</span>
              <span className="text-xs font-mono font-medium tracking-wide">
                {selectedMode !== "hybrid" && subtitleLanguage !== "off"
                  ? `${selectedMode.slice(0, 4)}·${subtitleLanguage.slice(0, 2).toUpperCase()}`
                  : selectedMode !== "hybrid"
                  ? selectedMode
                  : subtitleLanguage !== "off"
                  ? `CC:${subtitleLanguage.slice(0, 2).toUpperCase()}`
                  : "Options"}
              </span>
            </button>

            {/* Desktop Subtitles Selector */}
            <div
              className={`connection-pill hidden md:flex items-center gap-1 sm:gap-1.5 transition-all focus-within:ring-1 focus-within:ring-[var(--siduri-border-ember)] ${
                subtitleLanguage !== "off"
                  ? "border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-med)] text-[var(--siduri-ember-highlight)]"
                  : "hover:border-[var(--siduri-border-ember)] text-[var(--siduri-text-secondary)]"
              }`}
              title="Subtitle translation language"
            >
              <span className={`status-light ${subtitleLanguage !== "off" ? "online" : ""}`} />
              <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Subtitles:</span>
              <select
                value={["off", "en", "ja", "id", "es", "zh", "ko", "fr", "de"].includes(subtitleLanguage) ? subtitleLanguage : "custom-selected"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "custom") {
                    const custom = prompt("Enter subtitle language code or name (e.g. it, ru, de, pt, vi):");
                    if (custom && custom.trim()) {
                      const clean = custom.trim().toLowerCase();
                      setSubtitleLanguage(clean);
                      try {
                        localStorage.setItem("siduri.chat.subtitleLanguage", clean);
                      } catch {}
                    }
                  } else if (val !== "custom-selected") {
                    setSubtitleLanguage(val);
                    try {
                      localStorage.setItem("siduri.chat.subtitleLanguage", val);
                    } catch {}
                  }
                }}
                className="bg-transparent text-xs text-[var(--siduri-text-primary)] font-medium outline-none cursor-pointer border-none p-0"
                aria-label="Select subtitle language"
              >
                <option value="off" className="bg-[#121214] text-white">Subtitles: Off</option>
                <option value="en" className="bg-[#121214] text-white">English (EN)</option>
                <option value="ja" className="bg-[#121214] text-white">Japanese (JA)</option>
                <option value="id" className="bg-[#121214] text-white">Indonesian (ID)</option>
                <option value="es" className="bg-[#121214] text-white">Spanish (ES)</option>
                <option value="zh" className="bg-[#121214] text-white">Chinese (ZH)</option>
                <option value="ko" className="bg-[#121214] text-white">Korean (KO)</option>
                <option value="fr" className="bg-[#121214] text-white">French (FR)</option>
                <option value="de" className="bg-[#121214] text-white">German (DE)</option>
                {!["off", "en", "ja", "id", "es", "zh", "ko", "fr", "de"].includes(subtitleLanguage) && (
                  <option value="custom-selected" className="bg-[#121214] text-white">
                    {subtitleLanguage.toUpperCase()}
                  </option>
                )}
                <option value="custom" className="bg-[#121214] text-white">Other...</option>
              </select>
            </div>
            <span className="connection-pill hidden lg:inline-flex" title={`Status: ${status}`}>
              <span
                className={`status-light ${status === "online" ? "online" : ""}`}
              />
              <span className="text-xs">{status}</span>
            </span>
            {/* Desktop Mode Selector */}
            <div className="connection-pill hidden md:flex items-center gap-1 sm:gap-1.5" title="Operating interaction mode">
              <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Mode:</span>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as any)}
                className="bg-transparent text-xs text-[var(--siduri-text-primary)] font-medium outline-none cursor-pointer border-none p-0"
                aria-label="Select interaction mode"
              >
                <option value="hybrid" className="bg-[#121214] text-white">Hybrid (Default)</option>
                <option value="teach" className="bg-[#121214] text-white">Teach</option>
                <option value="casual" className="bg-[#121214] text-white">Casual</option>
              </select>
            </div>
          </div>
        </header>

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
                        {item.role === "assistant" && !item.content && !item.error && !item.interrupted && busy ? (
                          <span className="thinking-label">thinking</span>
                        ) : (
                          <time>{formatTime(item.createdAt)}</time>
                        )}
                        {item.interrupted && (() => {
                          const info = getInterruptionExplanation(item.interruptionReason);
                          return (
                            <span className="interrupted-pill" title={info.hint || info.text}>
                              {info.label}
                            </span>
                          );
                        })()}
                        {item.error && (
                          <span className="error-pill" title="An error occurred during response">
                            error
                          </span>
                        )}
                      </div>
                      {item.error ? (() => {
                        const diagnosis = getErrorDiagnosis(item.error);
                        return (
                          <div className="message-error-container">
                            {item.content ? (
                              <p className="message-primary">{item.content}</p>
                            ) : (
                              <p className="message-primary text-[var(--siduri-text-muted)] italic">
                                I couldn&apos;t complete the response.
                              </p>
                            )}
                            <div className="message-error-callout">
                              <div className="error-callout-header">
                                <span className="error-icon" aria-hidden="true">⚠️</span>
                                <span className="error-text">{diagnosis.title}</span>
                              </div>
                              {diagnosis.hint && (
                                <p className="error-hint text-xs text-[var(--siduri-text-secondary)] mt-1 mb-1">
                                  {diagnosis.hint}
                                </p>
                              )}
                              <details className="error-details">
                                <summary>View technical details</summary>
                                <pre className="error-trace">{item.error}</pre>
                              </details>
                            </div>
                          </div>
                        );
                      })() : item.interrupted && !item.content ? (() => {
                        const info = getInterruptionExplanation(item.interruptionReason);
                        return (
                          <div className="message-cancelled-container">
                            <p className="message-cancelled">{info.text}</p>
                            {info.hint && (
                              <p className="message-cancelled-hint text-xs text-[var(--siduri-text-dim)] mt-0.5">
                                {info.hint}
                              </p>
                            )}
                          </div>
                        );
                      })() : item.role === "assistant" && !item.content && busy ? (
                        <div className="thinking-dots">
                          <i />
                          <i />
                          <i />
                        </div>
                      ) : (
                        <>
                          <p className="message-primary">{item.content}</p>
                          {item.interrupted && (
                            <p className="message-interrupted-footnote text-xs text-[var(--siduri-text-dim)] italic mt-1">
                              — {getInterruptionExplanation(item.interruptionReason).text.toLowerCase()}
                            </p>
                          )}
                        </>
                      )}
                      {subtitleLanguage !== "off" && item.role === "assistant" && (() => {
                        const sub =
                          item.subtitles?.[subtitleLanguage] ||
                          (item.subtitleLanguage === subtitleLanguage ? item.subtitle : undefined) ||
                          (subtitleLanguage === "ja" && item.spokenJa && item.spokenJa !== item.content ? item.spokenJa : undefined) ||
                          (item.subtitle && item.subtitle !== item.content ? item.subtitle : undefined);

                        if (sub && sub.trim() !== item.content.trim()) {
                          return (
                            <p className="message-translation" title={`Subtitle: ${subtitleLanguage.toUpperCase()}`}>
                              <span className="text-[10px] font-mono uppercase tracking-wider opacity-60 mr-1.5 not-italic">
                                [{subtitleLanguage}]:
                              </span>
                              {sub}
                            </p>
                          );
                        }
                        return null;
                      })()}
                      {item.evidenceIds && item.evidenceIds.length > 0 && (
                        <span className="evidence-chip">
                          {item.evidenceIds.length} evidence link
                          {item.evidenceIds.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {item.memoryProposals &&
                        item.memoryProposals.length > 0 && (
                          <div className="memory-receipts">
                            {item.memoryProposals.map((p) => {
                              const pStatus = (p.status || "pending").toLowerCase().replace(/_/g, "-");
                              const isPending = pStatus === "pending";
                              return (
                                <div
                                  key={p.proposal_id}
                                  className={`memory-receipt status-${pStatus}`}
                                >
                                  <strong>
                                    Remember
                                    {p.claim_type ? ` (${p.claim_type.toLowerCase()})` : ""}:
                                  </strong>{" "}
                                  {formatClaimReceipt(p)}
                                  <div className="receipt-actions">
                                    {isPending ? (
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
                                      <span>{pStatus.toUpperCase()}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      {item.behavioralProposals &&
                        item.behavioralProposals.length > 0 && (
                          <div className="memory-receipts">
                            {item.behavioralProposals.map((p) => {
                              const bStatus = (p.status || "pending").toLowerCase().replace(/_/g, "-");
                              const isPending = bStatus === "pending";
                              return (
                                <div
                                  key={p.directive_id}
                                  className={`memory-receipt status-${bStatus}`}
                                >
                                  <strong>
                                    Runtime effect [{((p.knowledge_domain ?? p.domain) || "").toLowerCase()}{" "}
                                    → {((p.runtime_effect ?? p.memory_class) || "").toLowerCase()}]:
                                  </strong>{" "}
                                  {formatRuntimeEffect(p)}
                                  <div className="receipt-actions">
                                    {isPending ? (
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
                                      <span>{bStatus.toUpperCase()}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </article>
                ))
              )}
              {busy && !isPresenceOpen && (!messages.length || messages[messages.length - 1]?.role !== "assistant") && (
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
              />
              <div className="composer-bottom">
                <span>
                  Private local session ·{" "}
                  {evidenceCount
                    ? `${evidenceCount} evidence link${evidenceCount === 1 ? "" : "s"}`
                    : "No evidence attached"}
                </span>
                {busy && !message.trim() ? (
                  <button
                    type="button"
                    onClick={interruptCurrentChat}
                    aria-label="Stop generation"
                    title="Stop generation"
                  >
                    ■
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!message.trim()}
                    aria-label="Send message"
                  >
                    ↑
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
        <p className="chat-disclaimer">
          Siduri can be uncertain. Verify important details against the
          evidence.
        </p>
      </main>

      {/* Mobile Preferences Bottom Sheet */}
      {isMobileSettingsOpen && (
        <div className="mobile-settings-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:hidden">
          <div
            className="mobile-settings-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileSettingsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="mobile-settings-sheet relative z-10 w-full max-w-lg bg-[#141418] border border-[var(--siduri-border-subtle)] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-slide-up flex flex-col gap-5 text-[#eee8df]"
            role="dialog"
            aria-modal="true"
            aria-label="Chat preferences"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--siduri-border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-wide text-[#eee8df]">Chat Preferences</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[var(--siduri-tint-med)] text-[var(--siduri-ember-highlight)] border border-[var(--siduri-border-ember)]">
                  Mobile
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSettingsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-[var(--siduri-text-muted)] hover:text-[var(--siduri-text-primary)] hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-[var(--siduri-border-subtle)]"
                aria-label="Close preferences"
              >
                ✕
              </button>
            </div>

            {/* Interaction Mode */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--siduri-text-secondary)]">
                Interaction Mode
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "hybrid", label: "Hybrid", desc: "Balanced (Default)" },
                  { id: "teach", label: "Teach", desc: "Establishing teaching" },
                  { id: "casual", label: "Casual", desc: "Zero drift chat" },
                ].map((m) => {
                  const isSelected = selectedMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMode(m.id as any)}
                      className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-[var(--siduri-border-ember)] bg-[var(--siduri-tint-med)] text-[var(--siduri-ember-highlight)] ring-1 ring-[var(--siduri-border-ember)]"
                          : "border-[var(--siduri-border-subtle)] bg-[#19191e]/60 text-[var(--siduri-text-secondary)] hover:border-[var(--siduri-border-ember)]/50 hover:text-[var(--siduri-text-primary)]"
                      }`}
                    >
                      <span className="text-xs font-bold">{m.label}</span>
                      <span className="text-[10px] opacity-75 mt-0.5 line-clamp-1">{m.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtitles */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--siduri-text-secondary)]">
                  Subtitle Translation
                </span>
                {subtitleLanguage !== "off" && (
                  <span className="text-[10px] font-mono uppercase text-[var(--siduri-ember-highlight)]">
                    Active: {subtitleLanguage.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-[#101014] rounded-xl border border-[var(--siduri-border-subtle)]">
                {[
                  { code: "off", label: "Off" },
                  { code: "en", label: "English (EN)" },
                  { code: "ja", label: "Japanese (JA)" },
                  { code: "id", label: "Indonesian (ID)" },
                  { code: "es", label: "Spanish (ES)" },
                  { code: "zh", label: "Chinese (ZH)" },
                  { code: "ko", label: "Korean (KO)" },
                  { code: "fr", label: "French (FR)" },
                  { code: "de", label: "German (DE)" },
                ].map((lang) => {
                  const isSelected = subtitleLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setSubtitleLanguage(lang.code);
                        try {
                          localStorage.setItem("siduri.chat.subtitleLanguage", lang.code);
                        } catch {}
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[var(--siduri-ember)] text-[#19151a] font-semibold shadow"
                          : "bg-[#18181d] text-[var(--siduri-text-secondary)] hover:text-[var(--siduri-text-primary)] hover:bg-[#222228]"
                      }`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const custom = prompt("Enter subtitle language code (e.g. it, ru, pt, vi):");
                    if (custom && custom.trim()) {
                      const clean = custom.trim().toLowerCase();
                      setSubtitleLanguage(clean);
                      try {
                        localStorage.setItem("siduri.chat.subtitleLanguage", clean);
                      } catch {}
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#18181d] text-[var(--siduri-text-secondary)] hover:text-[var(--siduri-text-primary)] hover:bg-[#222228] cursor-pointer"
                >
                  Custom...
                </button>
              </div>
            </div>

            {/* Avatar Presence Toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-semibold text-[#eee8df] block">Live2D Avatar Presence</span>
                <span className="text-[11px] text-[var(--siduri-text-muted)]">Render animated companion in chat</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPresenceOpen((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isPresenceOpen ? "bg-[var(--siduri-ember)]" : "bg-[#282830]"
                }`}
                role="switch"
                aria-checked={isPresenceOpen}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPresenceOpen ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Done Button & Status */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--siduri-border-subtle)]">
              <div className="flex items-center gap-2">
                <span className={`status-light ${status === "online" ? "online" : ""}`} />
                <span className="text-xs text-[var(--siduri-text-muted)] capitalize">{status}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--siduri-tint-med)] border border-[var(--siduri-border-ember)] text-[var(--siduri-ember-highlight)] text-xs font-semibold hover:bg-[var(--siduri-border-ember)] hover:text-[#19151a] transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
