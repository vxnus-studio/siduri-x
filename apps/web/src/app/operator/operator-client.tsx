"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../../components/EmptyState";
import { getJson, postJson, putJson, postAction } from "../../lib/api";
import {
  formatClaimReceipt,
  formatRuntimeEffect,
} from "../../lib/memory-display";
type View = "overview" | "memory" | "evidence" | "settings";
type Status = {
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "warn" | "bad";
};
type Proposal = {
  proposal_id: string;
  content: string;
  provenance: string;
  sensitivity: string;
  status: string;
  subject?: string;
  predicate?: string;
  value?: string;
  claim_type?: string;
};
type Claim = {
  claim_id: string;
  subject: string;
  predicate: string;
  value: string;
  claim_type: string;
  status: string;
  provenance: string;
  asserted_at: string;
  sensitivity: string;
};
type MemoryItem = {
  memory_id: string;
  content: string;
  provenance: string;
  sensitivity: string;
  created_at: string;
};
type BehavioralDirective = {
  directive_id: string;
  memory_class: string;
  domain: string;
  subject: string;
  predicate: string;
  value: string;
  activation: string;
  status: string;
  created_at: string;
  scope: any;
  behavior: any;
  confirmed_by: string;
  supersedes_id?: string;
  valid_from?: string;
  valid_until?: string;
};
type EvidenceResult = {
  title: string;
  url: string;
  revision: string;
  preview: boolean;
  endpoint: string;
};
type Observation = {
  observation_id?: string;
  observed_at?: string;
  expires_at?: string;
  source?: string;
  readings?: unknown[];
};

function shortId(value: string): string {
  return value.length > 19 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
}
function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
}

export default function OperatorClient() {
  const [view, setView] = useState<View>("overview");
  const [health, setHealth] = useState<Status>({
    label: "Orchestrator",
    value: "Checking",
    tone: "warn",
  });
  const [voice, setVoice] = useState<Status>({
    label: "Voice",
    value: "Checking",
    tone: "warn",
  });
  const [obs, setObs] = useState<Status>({
    label: "OBS capture",
    value: "Checking",
    tone: "warn",
  });
  const [version, setVersion] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [directives, setDirectives] = useState<BehavioralDirective[]>([]);
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [me, setMe] = useState("{}");
  const [message, setMessage] = useState("");
  const [responseJson, setResponseJson] = useState<unknown>(null);
  const [pendingCorrelationId, setPendingCorrelationId] = useState<
    string | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function loadStatuses(): Promise<void> {
    try {
      const [h, v, ready] = await Promise.all([
        getJson("/health"),
        getJson("/version"),
        getJson("/ready"),
      ]);
      setHealth({
        label: "Orchestrator",
        value: h.status === "ok" ? "Online" : h.status,
        detail: `v${v.version}`,
        tone: h.status === "ok" ? "good" : "warn",
      });
      setVersion(v.version);
      const modelReady = ready.dependencies?.model_provider?.ready !== false;
      if (!modelReady)
        setHealth((current) => ({
          ...current,
          detail: "Model provider degraded",
          tone: "warn",
        }));
    } catch {
      setHealth({
        label: "Orchestrator",
        value: "Offline",
        detail: "Start the Python API",
        tone: "bad",
      });
    }
    try {
      const data = await getJson("/voice/health");
      setVoice({
        label: "Voice",
        value: data.healthy ? "Ready" : "Fallback",
        detail: data.provider,
        tone: data.healthy ? "good" : "warn",
      });
    } catch {
      setVoice({
        label: "Voice",
        value: "Unavailable",
        detail: "Subtitle fallback",
        tone: "warn",
      });
    }
    try {
      const data = await getJson("/obs/health");
      setObs({
        label: "OBS capture",
        value: data.connected
          ? "Connected"
          : data.configured
            ? "Disconnected"
            : "Disabled",
        detail: data.source_name
          ? `Source: ${data.source_name}`
          : "No source configured",
        tone: data.connected ? "good" : "warn",
      });
    } catch {
      setObs({ label: "OBS capture", value: "Unavailable", tone: "bad" });
    }
  }
  async function loadMemory(): Promise<void> {
    try {
      const [proposalsData, itemsData, claimsData, behavioralData] =
        await Promise.all([
          getJson("/memory/proposals"),
          getJson("/memory"),
          getJson("/memory/claims"),
          getJson("/memory/behavioral"),
        ]);
      setProposals(
        (proposalsData.proposals ?? []).filter(
          (item: Proposal) => item.status === "pending",
        ),
      );
      setItems(itemsData.items ?? []);
      setClaims(claimsData.claims ?? []);
      setDirectives(behavioralData.directives ?? []);
    } catch {
      setProposals([]);
      setItems([]);
      setClaims([]);
      setDirectives([]);
    }
  }
  async function loadEvidence(): Promise<void> {
    try {
      const [evidenceData, observationData] = await Promise.all([
        getJson("/evidence"),
        getJson("/observations"),
      ]);
      setEvidenceResults(evidenceData.results ?? []);
      setObservations(observationData.observations ?? []);
    } catch {
      setEvidenceResults([]);
      setObservations([]);
    }
  }
  async function loadMe(): Promise<void> {
    try {
      setMe(JSON.stringify(await getJson("/me"), null, 2));
    } catch {
      setMe("Unable to load profile.");
    }
  }
  useEffect(() => {
    void loadStatuses();
    void loadMemory();
    void loadEvidence();
    void loadMe();
  }, []);

  async function triggerResponse(): Promise<void> {
    setBusy(true);
    try {
      setResponseJson(await postJson("/dev/mock-response"));
    } finally {
      setBusy(false);
    }
  }
  async function observeRespond(): Promise<void> {
    setBusy(true);
    try {
      const data = await postJson("/dev/observe-and-respond");
      setResponseJson(data);
      const id =
        typeof data?.metadata?.correlation_id === "string"
          ? data.metadata.correlation_id
          : null;
      setPendingCorrelationId(id);
    } finally {
      setBusy(false);
    }
  }
  async function approveResponse(): Promise<void> {
    if (!pendingCorrelationId) return;
    setBusy(true);
    try {
      setResponseJson(
        await postJson("/dev/approve-response", {
          correlation_id: pendingCorrelationId,
        }),
      );
      setPendingCorrelationId(null);
    } finally {
      setBusy(false);
    }
  }
  async function saveMe(): Promise<void> {
    try {
      await putJson("/me", me);
      setMessage("Profile saved");
    } catch (error) {
      setMessage(String(error));
    }
  }
  async function proposalAction(
    path: string,
    proposal: Proposal,
    content?: string,
  ): Promise<void> {
    await postAction(path, {
      id: proposal.proposal_id,
      companionId: "default",
      ...(content === undefined ? {} : { content }),
    });
    await loadMemory();
  }
  async function createObservation(): Promise<void> {
    await postAction("/dev/mock-observation");
    await loadEvidence();
  }
  async function resetMemory(): Promise<void> {
    if (
      !window.confirm(
        "Are you sure you want to completely reset all memory? This action cannot be undone.",
      )
    )
      return;
    setBusy(true);
    try {
      await postJson("/dev/memory/reset");
      await loadMemory();
      setMessage("Memory has been completely reset.");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="console-app">
      <aside className="console-sidebar">
        <a className="console-brand" href="/chat">
          <span className="console-brand-mark">S</span>
          <span>SIDURI</span>
        </a>
        <div className="console-context">
          <span className="console-context-dot" />
          Operator workspace
        </div>
        <nav className="console-nav" aria-label="Console sections">
          {(
            [
              "overview",
              "memory",
              "evidence",
              "settings",
            ] as View[]
          ).map((item) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              onClick={() => setView(item)}
            >
              <span className={`nav-glyph nav-${item}`} />
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="console-sidebar-bottom">
          <a href="/chat">← Private chat</a>
          <span>Local operator surface</span>
        </div>
      </aside>
      <section className="console-main">
        <header className="console-topbar">
          <div>
            <p className="console-eyebrow">SIDURI / OPERATOR</p>
            <h1>
              {view === "overview"
                ? "Control room"
                : view[0].toUpperCase() + view.slice(1)}
            </h1>
          </div>
          <div className="console-top-actions">
            <span className="console-version">v{version || "—"}</span>
            <button
              className="console-refresh"
              onClick={() => {
                void loadStatuses();
                void loadMemory();
                void loadEvidence();
              }}
              aria-label="Refresh dashboard"
            >
              ↻
            </button>
          </div>
        </header>
        {message && <div className="console-notice">{message}</div>}
        {view === "overview" && (
          <Overview
            health={health}
            voice={voice}
            obs={obs}
            proposals={proposals}
            responseJson={responseJson}
            pendingCorrelationId={pendingCorrelationId}
            busy={busy}
            onTrigger={triggerResponse}
            onObserve={observeRespond}
            onApprove={approveResponse}
            onNavigate={setView}
          />
        )}
        {view === "memory" && (
          <MemoryView
            proposals={proposals}
            claims={claims}
            items={items}
            directives={directives}
            onAction={proposalAction}
            onRefresh={loadMemory}
          />
        )}
        {view === "evidence" && (
          <EvidenceView
            results={evidenceResults}
            observations={observations}
            onCreate={createObservation}
            onRefresh={loadEvidence}
          />
        )}
        {view === "settings" && (
          <SettingsView onResetMemory={resetMemory} disabled={busy} />
        )}
      </section>
    </main>
  );
}

function StatusCard({ status }: { status: Status }) {
  return (
    <article className="status-card">
      <div className="status-card-top">
        <span>{status.label}</span>
        <i className={`status-dot ${status.tone ?? "warn"}`} />
      </div>
      <strong>{status.value}</strong>
      <small>{status.detail ?? "—"}</small>
    </article>
  );
}
function PanelHeader({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {action && <button onClick={onClick}>{action} →</button>}
    </div>
  );
}
function QueueRow({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <div className="queue-row">
      <span>{label}</span>
      <b className={`queue-count ${tone}`}>{count}</b>
    </div>
  );
}

function MemoryView({
  proposals,
  claims,
  items,
  directives,
  onAction,
  onRefresh,
}: {
  proposals: Proposal[];
  claims: Claim[];
  items: MemoryItem[];
  directives: BehavioralDirective[];
  onAction: (path: string, item: Proposal, content?: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  async function directiveAction(path: string, id: string) {
    await postJson(path, { id, companionId: "default" });
    await onRefresh();
  }
  return (
    <div className="console-view">
      <div className="view-intro">
        <div>
          <p className="console-eyebrow">COMPANION MEMORY</p>
          <h2>Review candidates before they become facts.</h2>
          <p>Every candidate stays isolated until you explicitly approve it.</p>
        </div>
        <span className="count-badge">{proposals.length} pending</span>
      </div>
      <section className="console-panel table-panel">
        <div className="table-toolbar">
          <strong>Pending memory</strong>
          <span>Local approval queue</span>
        </div>
        {proposals.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Provenance</th>
                  <th>Sensitivity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((item) => (
                  <ProposalRow
                    key={item.proposal_id}
                    item={item}
                    onAction={onAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No pending candidates"
            detail="Siduri memory suggestions will appear here for review."
          />
        )}
      </section>
      <section className="console-panel table-panel">
        <div className="table-toolbar">
          <strong>Behavioral Directives</strong>
          <span>Active behaviors and learned relationships</span>
        </div>
        {directives.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Directive</th>
                  <th>Scope & Activation</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {directives.map((d) => (
                  <tr key={d.directive_id}>
                    <td>
                      <strong>{formatRuntimeEffect(d)}</strong>
                      <details className="row-details">
                        <summary>{shortId(d.directive_id)}</summary>
                        <pre>{JSON.stringify(d, null, 2)}</pre>
                      </details>
                    </td>
                    <td>
                      <span className="tag">{d.activation}</span>
                    </td>
                    <td>
                      <span className="tag">
                        {d.domain} / {d.memory_class}
                      </span>
                    </td>
                    <td>
                      <span className={`tag status-${d.status}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {d.status === "pending" && (
                          <>
                            <button
                              className="tiny-button approve-button"
                              onClick={() =>
                                void directiveAction(
                                  "/memory/behavioral/approve",
                                  d.directive_id,
                                )
                              }
                            >
                              Approve
                            </button>
                            <button
                              className="tiny-button danger-button"
                              onClick={() =>
                                void directiveAction(
                                  "/memory/behavioral/reject",
                                  d.directive_id,
                                )
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {d.status === "confirmed" && (
                          <>
                            <button
                              className="tiny-button danger-button"
                              onClick={() =>
                                void directiveAction(
                                  "/memory/behavioral/revoke",
                                  d.directive_id,
                                )
                              }
                            >
                              Revoke
                            </button>
                            {d.activation !== "disabled" && (
                              <button
                                className="tiny-button"
                                onClick={() =>
                                  void directiveAction(
                                    "/memory/behavioral/disable",
                                    d.directive_id,
                                  )
                                }
                              >
                                Disable
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No behavioral directives"
            detail="Behavioral rules taught in private chat will appear here."
          />
        )}
      </section>
      <section className="console-panel table-panel">
        <div className="table-toolbar">
          <strong>Structured Claims</strong>
          <span>Queryable personal and game knowledge</span>
        </div>
        {claims.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Predicate</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {claims
                  .slice()
                  .reverse()
                  .map((claim) => (
                    <tr key={claim.claim_id}>
                      <td>
                        <strong>{claim.subject}</strong>
                        <details className="row-details">
                          <summary>{shortId(claim.claim_id)}</summary>
                          <pre>{JSON.stringify(claim, null, 2)}</pre>
                        </details>
                      </td>
                      <td>
                        <span className="tag">{claim.predicate}</span>
                      </td>
                      <td>{claim.value}</td>
                      <td>
                        <span className={`tag status-${claim.status}`}>
                          {claim.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No structured claims"
            detail="Approved teachings will become queryable claims here."
          />
        )}
      </section>
      <section className="console-panel table-panel">
        <div className="table-toolbar">
          <strong>Compatibility Memory Items</strong>
          <span>Legacy text projection</span>
        </div>
        {items.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fact</th>
                  <th>Provenance</th>
                  <th>Sensitivity</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .slice()
                  .reverse()
                  .map((item) => (
                    <tr key={item.memory_id}>
                      <td>
                        <strong>{item.content}</strong>
                        <details className="row-details">
                          <summary>{shortId(item.memory_id)}</summary>
                          <pre>{JSON.stringify(item, null, 2)}</pre>
                        </details>
                      </td>
                      <td>
                        <span className="tag">{item.provenance}</span>
                      </td>
                      <td>
                        <span className="tag">{item.sensitivity}</span>
                      </td>
                      <td>{formatDate(item.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No compatibility items"
            detail="Legacy approved memory text will appear here."
          />
        )}
      </section>
    </div>
  );
}
function ProposalRow({
  item,
  onAction,
}: {
  item: Proposal;
  onAction: (path: string, item: Proposal, content?: string) => Promise<void>;
}) {
  const [content, setContent] = useState(item.content);
  return (
    <tr>
      <td>
        <strong>{formatClaimReceipt(item)}</strong>
        <details className="row-details">
          <summary>Edit raw record · {shortId(item.proposal_id)}</summary>
          <textarea
            className="table-editor"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            aria-label={`Memory candidate ${item.proposal_id}`}
          />
          <pre>{JSON.stringify(item, null, 2)}</pre>
        </details>
      </td>
      <td>{item.provenance}</td>
      <td>
        <span className="tag">{item.sensitivity}</span>
      </td>
      <td>
        <div className="table-actions">
          <button
            className="tiny-button"
            onClick={() =>
              void onAction("/memory/proposals/update", item, content)
            }
          >
            Save
          </button>
          <button
            className="tiny-button approve-button"
            onClick={() => void onAction("/memory/proposals/approve", item)}
          >
            Approve
          </button>
          <button
            className="tiny-button danger-button"
            onClick={() => void onAction("/memory/proposals/reject", item)}
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}

function EvidenceView({
  results,
  observations,
  onCreate,
  onRefresh,
}: {
  results: EvidenceResult[];
  observations: Observation[];
  onCreate: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="console-view">
      <div className="view-intro">
        <div>
          <p className="console-eyebrow">GROUNDING</p>
          <h2>Evidence, with uncertainty intact.</h2>
          <p>
            Inspect bounded citations and short-lived observations without
            exposing raw captures.
          </p>
        </div>
        <div className="button-row">
          <button onClick={() => void onCreate()}>Create fixture</button>
          <button className="soft-button" onClick={() => void onRefresh()}>
            Refresh
          </button>
        </div>
      </div>
      <section className="console-panel table-panel">
        <div className="table-toolbar">
          <strong>Knowledge Base Citations</strong>
          <span>{results.length} results</span>
        </div>
        {results.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Revision</th>
                  <th>Preview</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.url}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.endpoint}</small>
                    </td>
                    <td>{item.revision || "—"}</td>
                    <td>
                      <span className="tag">
                        {item.preview ? "Preview" : "Published"}
                      </span>
                    </td>
                    <td>
                      <a
                        className="table-link"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No evidence loaded"
            detail="Create a fixture observation or refresh the source."
          />
        )}
      </section>
      <section className="console-panel table-panel">
        <div className="table-toolbar">
          <strong>Current observations</strong>
          <span>Raw frames are never shown here</span>
        </div>
        {observations.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Observation</th>
                  <th>Captured</th>
                  <th>Expires</th>
                  <th>Readings</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((item, index) => (
                  <tr key={item.observation_id ?? index}>
                    <td>{shortId(item.observation_id ?? "observation")}</td>
                    <td>{formatDate(item.observed_at)}</td>
                    <td>{formatDate(item.expires_at)}</td>
                    <td>
                      {Array.isArray(item.readings) ? item.readings.length : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No active observations"
            detail="Observations are bounded and expire automatically."
          />
        )}
      </section>
    </div>
  );
}

function Overview({
  health,
  voice,
  obs,
  proposals,
  responseJson,
  pendingCorrelationId,
  busy,
  onTrigger,
  onObserve,
  onApprove,
  onNavigate,
}: {
  health: Status;
  voice: Status;
  obs: Status;
  proposals: Proposal[];
  responseJson: unknown;
  pendingCorrelationId: string | null;
  busy: boolean;
  onTrigger: () => Promise<void>;
  onObserve: () => Promise<void>;
  onApprove: () => Promise<void>;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="console-view">
      <div className="status-grid">
        <StatusCard status={health} />
        <StatusCard status={voice} />
        <StatusCard status={obs} />
      </div>
      <div className="console-columns">
        <section className="console-panel approval-panel">
          <PanelHeader
            title="Response gate"
            action="Review policy"
            onClick={() => onNavigate("settings")}
          />
          <div className="gate-row">
            <span
              className={`gate-icon ${pendingCorrelationId ? "pending" : "ready"}`}
            >
              {pendingCorrelationId ? "!" : "✓"}
            </span>
            <div>
              <strong>
                {pendingCorrelationId
                  ? "Grounded response awaiting approval"
                  : "No response awaiting approval"}
              </strong>
              <p>
                {pendingCorrelationId
                  ? "Public output is held until you approve it."
                  : "Local mock responses remain private."}
              </p>
            </div>
          </div>
          <div className="button-row">
            <button onClick={() => void onTrigger()} disabled={busy}>
              Trigger mock response
            </button>
            <button
              className="soft-button"
              onClick={() => void onObserve()}
              disabled={busy}
            >
              Observe and respond
            </button>
            {pendingCorrelationId && (
              <button
                className="approve-button"
                onClick={() => void onApprove()}
              >
                Approve response
              </button>
            )}
          </div>
          {responseJson !== null && (
            <details className="technical-details">
              <summary>Technical details</summary>
              <pre>{JSON.stringify(responseJson, null, 2)}</pre>
            </details>
          )}
        </section>
        <section className="console-panel queue-panel">
          <PanelHeader
            title="Needs attention"
            action="View memory"
            onClick={() => onNavigate("memory")}
          />
          <QueueRow
            label="Memory proposals"
            count={proposals.length}
            tone={proposals.length ? "warn" : "quiet"}
          />
        </section>
      </div>
      <section className="console-panel quick-panel">
        <PanelHeader title="Quick actions" />
        <div className="quick-actions">
          <button onClick={() => onNavigate("memory")}>
            Review memory <span>→</span>
          </button>
          <button onClick={() => onNavigate("evidence")}>
            Inspect evidence <span>→</span>
          </button>
          <button onClick={() => onNavigate("settings")}>
            Identity & Directives <span>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  onResetMemory,
  disabled,
}: {
  onResetMemory: () => Promise<void>;
  disabled: boolean;
}) {
  return (
    <div className="console-view">
      <div className="view-intro">
        <div>
          <p className="console-eyebrow">RUNTIME IDENTITY</p>
          <h2>Companion Identity & Directives</h2>
          <p>
            Identity and behavioral preferences are governed dynamically through
            conversational teaching and reviewed in the Memory tab.
          </p>
        </div>
      </div>
      <section className="console-panel profile-panel">
        <div className="table-toolbar">
          <strong>Identity Directives</strong>
          <span>Governed Memory Model</span>
        </div>
        <EmptyState
          title="Dynamic identity active"
          detail="Siduri establishes preferences and boundaries dynamically through conversation. Use the Private Chat to teach preferences, and the Memory tab to approve or revoke directives."
        />
      </section>
      <section className="console-panel profile-panel mt-6">
        <div className="table-toolbar">
          <strong>Danger Zone</strong>
          <span>Irreversible actions</span>
        </div>
        <div className="p-6 bg-red-900/20 border border-red-500/20 rounded-lg">
          <h3 className="text-red-400 font-medium mb-2">Reset All Memory</h3>
          <p className="text-sm text-gray-400 mb-4">
            This will permanently delete all memory items, proposals, revisions,
            and claims from the database. The companion will forget all
            approved claims, directives, and proposals.
          </p>
          <button
            className="bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 px-4 py-2 rounded-md font-medium transition-colors"
            onClick={() => void onResetMemory()}
            disabled={disabled}
          >
            Reset Memory
          </button>
        </div>
      </section>
    </div>
  );
}
