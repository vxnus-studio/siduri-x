"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../../components/EmptyState";
import { getJson, postJson, putJson, postAction } from "../../lib/api";
import {
  formatClaimReceipt,
  formatRuntimeEffect,
} from "../../lib/memory-display";
import {
  CheckIcon,
  PackageIcon,
  ClockIcon,
  CalendarIcon,
  CloseIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  DownloadIcon,
  RefreshIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "../../components/icons";
type View = "overview" | "memory" | "lifedb" | "evidence" | "logs" | "settings";
type SystemLog = {
  id: string;
  companionId?: string;
  level: "info" | "warn" | "error" | "debug";
  subsystem: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
type LifeEntity = {
  id: string;
  companionId?: string;
  entityType: string;
  domain: string;
  name: string;
  properties: Record<string, unknown>;
  updatedAt?: string;
};
type LifeEvent = {
  id: string;
  companionId?: string;
  stream: string;
  timestamp?: string;
  metricValue?: number;
  metadata?: Record<string, unknown>;
};
type LifeTask = {
  id: string;
  companionId?: string;
  title: string;
  status: string;
  priority?: number;
  targetDate?: string;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
};
type LifeScheduleItem = {
  id: string;
  companionId?: string;
  title: string;
  startTime: string;
  endTime?: string;
  isRecurring?: boolean;
  status?: string;
};
type Status = {
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "warn" | "bad";
};
type Proposal = {
  id?: string;
  proposal_id?: string;
  content?: string;
  provenance?: string;
  sensitivity?: string;
  status: string;
  subject?: string;
  predicate?: string;
  value?: string;
  claim_type?: string;
};
type Claim = {
  id?: string;
  claim_id?: string;
  subject: string;
  predicate: string;
  value: string;
  claim_type?: string;
  status: string;
  provenance?: string;
  asserted_at?: string;
  assertedAt?: string;
  sensitivity?: string;
};
type MemoryItem = {
  id?: string;
  memory_id?: string;
  content?: string;
  subject?: string;
  predicate?: string;
  value?: string;
  provenance?: string;
  sensitivity?: string;
  created_at?: string;
  assertedAt?: string;
};
type BehavioralDirective = {
  id?: string;
  directive_id?: string;
  memory_class?: string;
  category?: string;
  domain?: string;
  subject?: string;
  predicate?: string;
  value?: string;
  directive?: string;
  activation?: string;
  status: string;
  created_at?: string;
  createdAt?: string;
  scope?: any;
  behavior?: any;
  confirmed_by?: string;
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

function shortId(value?: string | null): string {
  if (!value) return "—";
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
  const [entities, setEntities] = useState<LifeEntity[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [schedule, setSchedule] = useState<LifeScheduleItem[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [logsFilterLevel, setLogsFilterLevel] = useState<string>("all");
  const [logsFilterSubsystem, setLogsFilterSubsystem] = useState<string>("all");
  const [logsSearch, setLogsSearch] = useState<string>("");
  const [logsAutoRefresh, setLogsAutoRefresh] = useState<boolean>(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [me, setMe] = useState("{}");
  const [message, setMessage] = useState("");
  const [responseJson, setResponseJson] = useState<unknown>(null);
  const [pendingCorrelationId, setPendingCorrelationId] = useState<
    string | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function loadLogs(): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (logsFilterLevel !== "all") params.set("level", logsFilterLevel);
      if (logsFilterSubsystem !== "all") params.set("subsystem", logsFilterSubsystem);
      if (logsSearch.trim()) params.set("q", logsSearch.trim());
      params.set("limit", "150");
      const res = await getJson<{ logs: SystemLog[] }>(`/system/logs?${params.toString()}`);
      setLogs(res.logs || []);
    } catch (err) {
      console.error("Failed to load system logs:", err);
    }
  }

  function toggleExpandLog(id: string) {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function clearAllLogs(): Promise<void> {
    if (!window.confirm("Are you sure you want to clear all system logs?")) return;
    try {
      await postJson("/system/logs/clear", {});
      setLogs([]);
      setMessage("Logs cleared.");
    } catch (err: any) {
      setMessage(`Failed to clear logs: ${err.message}`);
    }
  }

  function exportLogsAsJson() {
    try {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `siduri-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(`Export failed: ${err.message}`);
    }
  }

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
          (item: Proposal) => (item.status || "").toLowerCase().replace(/_/g, "-") === "pending",
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

  async function loadLifeDb(): Promise<void> {
    try {
      const [entData, evtData, taskData, schedData] = await Promise.all([
        getJson<{ entities: LifeEntity[] }>("/knowledge/entities").catch(() => ({ entities: [] })),
        getJson<{ events: LifeEvent[] }>("/knowledge/events").catch(() => ({ events: [] })),
        getJson<{ tasks: LifeTask[] }>("/knowledge/tasks").catch(() => ({ tasks: [] })),
        getJson<{ items: LifeScheduleItem[] }>("/knowledge/schedule").catch(() => ({ items: [] })),
      ]);
      setEntities(entData?.entities || []);
      setEvents(evtData?.events || []);
      setTasks(taskData?.tasks || []);
      setSchedule(schedData?.items || []);
    } catch {
      // ignore
    }
  }

  async function saveEntity(entity: Partial<LifeEntity>): Promise<void> {
    setBusy(true);
    try {
      await postJson("/knowledge/entities", entity);
      setMessage(`Saved entity "${entity.name}"`);
      await loadLifeDb();
    } catch (e: any) {
      setMessage(`Error saving entity: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntity(id: string): Promise<void> {
    setBusy(true);
    try {
      await postJson("/knowledge/entities/delete", { id });
      setMessage("Entity deleted");
      await loadLifeDb();
    } catch (e: any) {
      setMessage(`Error deleting entity: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(task: Partial<LifeTask>): Promise<void> {
    setBusy(true);
    try {
      await postJson("/knowledge/tasks", task);
      setMessage(`Saved task "${task.title}"`);
      await loadLifeDb();
    } catch (e: any) {
      setMessage(`Error saving task: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTaskStatus(task: LifeTask): Promise<void> {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    await saveTask({ ...task, status: nextStatus });
  }

  async function deleteTask(id: string): Promise<void> {
    setBusy(true);
    try {
      await postJson("/knowledge/tasks/delete", { id });
      setMessage("Task deleted");
      await loadLifeDb();
    } catch (e: any) {
      setMessage(`Error deleting task: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function addLifeEvent(event: Partial<LifeEvent>): Promise<void> {
    setBusy(true);
    try {
      await postJson("/knowledge/events", event);
      setMessage(`Logged event on stream "${event.stream}"`);
      await loadLifeDb();
    } catch (e: any) {
      setMessage(`Error logging event: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule(item: Partial<LifeScheduleItem>): Promise<void> {
    setBusy(true);
    try {
      await postJson("/knowledge/schedule", item);
      setMessage(`Saved schedule item "${item.title}"`);
      await loadLifeDb();
    } catch (e: any) {
      setMessage(`Error saving schedule: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSchedule(id: string): Promise<void> {
    setBusy(true);
    try {
      await postJson("/knowledge/schedule/delete", { id });
      setMessage("Schedule item deleted");
      await loadLifeDb();
    } catch (e: any) {
      setMessage(`Error deleting schedule item: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadStatuses();
    void loadMemory();
    void loadLifeDb();
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
      id: proposal.id || proposal.proposal_id,
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
        <div className="console-sidebar-header flex items-center justify-between w-full">
          <a className="console-brand" href="/chat">
            <span className="console-brand-mark">S</span>
            <span>SIDURI</span>
          </a>
          <a href="/chat" className="console-mobile-back inline-flex items-center gap-1" aria-label="Back to chat">
            <ArrowLeftIcon size={12} />
            Chat
          </a>
        </div>
        <div className="console-context">
          <span className="console-context-dot" />
          Operator workspace
        </div>
        <nav className="console-nav" aria-label="Console sections">
          {(
            [
              "overview",
              "memory",
              "lifedb",
              "evidence",
              "logs",
              "settings",
            ] as View[]
          ).map((item) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              onClick={() => setView(item)}
            >
              <span className={`nav-glyph nav-${item}`} />
              {item === "lifedb" ? "Life DB" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="console-sidebar-bottom">
          <a href="/chat" className="inline-flex items-center gap-1">
            <ArrowLeftIcon size={12} />
            Private chat
          </a>
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
                : view === "lifedb"
                ? "Life Database (Sovereign Reality)"
                : view === "logs"
                ? "System Logs & Diagnostics"
                : view[0].toUpperCase() + view.slice(1)}
            </h1>
          </div>
          <div className="console-top-actions">
            <a href="/chat" className="console-back-link inline-flex items-center gap-1" title="Return to Private Chat">
              <ArrowLeftIcon size={12} />
              Chat
            </a>
            <span className="console-version">v{version || "—"}</span>
            <button
              type="button"
              className="console-refresh"
              onClick={() => {
                void loadStatuses();
                void loadMemory();
                void loadLifeDb();
                void loadEvidence();
                if (view === "logs") void loadLogs();
              }}
              aria-label="Refresh dashboard"
            >
              <RefreshIcon size={14} />
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
        {view === "lifedb" && (
          <LifeDbView
            entities={entities}
            events={events}
            tasks={tasks}
            schedule={schedule}
            busy={busy}
            onSaveEntity={saveEntity}
            onDeleteEntity={deleteEntity}
            onSaveTask={saveTask}
            onToggleTask={toggleTaskStatus}
            onDeleteTask={deleteTask}
            onAddEvent={addLifeEvent}
            onSaveSchedule={saveSchedule}
            onDeleteSchedule={deleteSchedule}
            onRefresh={loadLifeDb}
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
        {view === "logs" && (
          <LogsView
            logs={logs}
            filterLevel={logsFilterLevel}
            filterSubsystem={logsFilterSubsystem}
            searchQuery={logsSearch}
            autoRefresh={logsAutoRefresh}
            expandedIds={expandedLogIds}
            onToggleExpand={toggleExpandLog}
            onChangeLevel={setLogsFilterLevel}
            onChangeSubsystem={setLogsFilterSubsystem}
            onChangeSearch={setLogsSearch}
            onToggleAutoRefresh={() => setLogsAutoRefresh((prev) => !prev)}
            onRefresh={loadLogs}
            onClear={clearAllLogs}
            onExport={exportLogsAsJson}
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
      {action && (
        <button onClick={onClick} className="inline-flex items-center gap-1">
          {action} <ArrowRightIcon size={12} />
        </button>
      )}
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
                    key={item.id || item.proposal_id}
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
                {directives.map((d) => {
                  const directiveId = d.id || d.directive_id || "";
                  return (
                    <tr key={directiveId}>
                      <td>
                        <strong>{formatRuntimeEffect(d)}</strong>
                        <details className="row-details">
                          <summary>{shortId(directiveId)}</summary>
                          <pre>{JSON.stringify(d, null, 2)}</pre>
                        </details>
                      </td>
                      <td>
                        <span className="tag">{d.activation || "active"}</span>
                      </td>
                      <td>
                        <span className="tag">
                          {d.domain || d.category || "general"} / {d.memory_class || d.category || "directive"}
                        </span>
                      </td>
                      <td>
                        <span className={`tag status-${(d.status || "").toLowerCase().replace(/_/g, "-")}`}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {(d.status || "").toLowerCase() === "pending" && (
                            <>
                              <button
                                className="tiny-button approve-button"
                                onClick={() =>
                                  void directiveAction(
                                    "/memory/behavioral/approve",
                                    directiveId,
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
                                    directiveId,
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {((d.status || "").toLowerCase() === "active" || (d.status || "").toLowerCase() === "confirmed") && (
                            <>
                              <button
                                className="tiny-button danger-button"
                                onClick={() =>
                                  void directiveAction(
                                    "/memory/behavioral/revoke",
                                    directiveId,
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
                                      directiveId,
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
                  );
                })}
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
                  .map((claim) => {
                    const claimId = claim.id || claim.claim_id || "";
                    return (
                      <tr key={claimId}>
                        <td>
                          <strong>{claim.subject}</strong>
                          <details className="row-details">
                            <summary>{shortId(claimId)}</summary>
                            <pre>{JSON.stringify(claim, null, 2)}</pre>
                          </details>
                        </td>
                        <td>
                          <span className="tag">{claim.predicate}</span>
                        </td>
                        <td>{claim.value}</td>
                        <td>
                          <span className={`tag status-${(claim.status || "").toLowerCase().replace(/_/g, "-")}`}>
                            {claim.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
                  .map((item) => {
                    const itemId = item.id || item.memory_id || "";
                    const factContent =
                      item.content ||
                      (item.subject && item.predicate
                        ? `${item.subject} ${item.predicate} ${item.value}`
                        : item.value || "—");
                    return (
                      <tr key={itemId}>
                        <td>
                          <strong>{factContent}</strong>
                          <details className="row-details">
                            <summary>{shortId(itemId)}</summary>
                            <pre>{JSON.stringify(item, null, 2)}</pre>
                          </details>
                        </td>
                        <td>
                          <span className="tag">{item.provenance || "conversation"}</span>
                        </td>
                        <td>
                          <span className="tag">{item.sensitivity || "normal"}</span>
                        </td>
                        <td>{formatDate(item.created_at || item.assertedAt)}</td>
                      </tr>
                    );
                  })}
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
  const proposalId = item.id || item.proposal_id || "";
  const [content, setContent] = useState(item.content || "");
  return (
    <tr>
      <td>
        <strong>{formatClaimReceipt(item)}</strong>
        <details className="row-details">
          <summary>Edit raw record · {shortId(proposalId)}</summary>
          <textarea
            className="table-editor"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            aria-label={`Memory candidate ${proposalId}`}
          />
          <pre>{JSON.stringify(item, null, 2)}</pre>
        </details>
      </td>
      <td>{item.provenance || "conversation"}</td>
      <td>
        <span className="tag">{item.sensitivity || "normal"}</span>
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
                        className="table-link inline-flex items-center gap-1"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open <ExternalLinkIcon size={12} />
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
              className={`gate-icon flex items-center justify-center ${pendingCorrelationId ? "pending" : "ready"}`}
            >
              {pendingCorrelationId ? "!" : <CheckIcon size={14} className="shrink-0" />}
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
          <button onClick={() => onNavigate("memory")} className="inline-flex items-center justify-between">
            Review memory <span><ArrowRightIcon size={12} /></span>
          </button>
          <button onClick={() => onNavigate("lifedb")} className="inline-flex items-center justify-between">
            Inspect Life DB <span><ArrowRightIcon size={12} /></span>
          </button>
          <button onClick={() => onNavigate("evidence")} className="inline-flex items-center justify-between">
            Inspect evidence <span><ArrowRightIcon size={12} /></span>
          </button>
          <button onClick={() => onNavigate("settings")} className="inline-flex items-center justify-between">
            Identity & Directives <span><ArrowRightIcon size={12} /></span>
          </button>
        </div>
      </section>
    </div>
  );
}

function LifeDbView({
  entities,
  events,
  tasks,
  schedule,
  busy,
  onSaveEntity,
  onDeleteEntity,
  onSaveTask,
  onToggleTask,
  onDeleteTask,
  onAddEvent,
  onSaveSchedule,
  onDeleteSchedule,
  onRefresh,
}: {
  entities: LifeEntity[];
  events: LifeEvent[];
  tasks: LifeTask[];
  schedule: LifeScheduleItem[];
  busy: boolean;
  onSaveEntity: (entity: Partial<LifeEntity>) => Promise<void>;
  onDeleteEntity: (id: string) => Promise<void>;
  onSaveTask: (task: Partial<LifeTask>) => Promise<void>;
  onToggleTask: (task: LifeTask) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onAddEvent: (event: Partial<LifeEvent>) => Promise<void>;
  onSaveSchedule: (item: Partial<LifeScheduleItem>) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"tasks" | "entities" | "events" | "schedule">("tasks");
  const [taskFilter, setTaskFilter] = useState<string>("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewEntity, setShowNewEntity] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("1");
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [newTaskTargetDate, setNewTaskTargetDate] = useState("");

  // New entity form state
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityType, setNewEntityType] = useState("item");
  const [newEntityDomain, setNewEntityDomain] = useState("general");
  const [newEntityProps, setNewEntityProps] = useState("{}");

  // New event form state
  const [newEventStream, setNewEventStream] = useState("finance:expense");
  const [newEventMetric, setNewEventMetric] = useState("");
  const [newEventMeta, setNewEventMeta] = useState("{}");

  // New schedule form state
  const [newSchedTitle, setNewSchedTitle] = useState("");
  const [newSchedStart, setNewSchedStart] = useState("");
  const [newSchedEnd, setNewSchedEnd] = useState("");

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "all") return true;
    if (taskFilter === "active") return t.status !== "completed" && t.status !== "cancelled";
    return t.status === taskFilter;
  });

  return (
    <div className="console-view">
      <div className="view-intro">
        <div>
          <p className="console-eyebrow">LIFE DATABASE</p>
          <h2>Sovereign Reality & Structured Primitives</h2>
          <p>
            Inspect and mutate your concrete user reality: actionable tasks, static entities, telemetry events, and temporal schedules.
          </p>
        </div>
        <div className="button-row">
          <button className="soft-button" onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      {/* Subtab navigation */}
      <div className="lifedb-nav">
        <button
          className={`lifedb-tab-btn flex items-center gap-1.5 ${activeTab === "tasks" ? "active" : ""}`}
          onClick={() => setActiveTab("tasks")}
        >
          <CheckIcon size={13} className="shrink-0" />
          <span>Tasks & Goals ({tasks.length})</span>
        </button>
        <button
          className={`lifedb-tab-btn flex items-center gap-1.5 ${activeTab === "entities" ? "active" : ""}`}
          onClick={() => setActiveTab("entities")}
        >
          <PackageIcon size={13} className="shrink-0" />
          <span>Entities & Items ({entities.length})</span>
        </button>
        <button
          className={`lifedb-tab-btn flex items-center gap-1.5 ${activeTab === "events" ? "active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          <ClockIcon size={13} className="shrink-0" />
          <span>Telemetry & Events ({events.length})</span>
        </button>
        <button
          className={`lifedb-tab-btn flex items-center gap-1.5 ${activeTab === "schedule" ? "active" : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          <CalendarIcon size={13} className="shrink-0" />
          <span>Schedule & Calendar ({schedule.length})</span>
        </button>
      </div>

      {/* TASKS TAB */}
      {activeTab === "tasks" && (
        <section className="console-panel table-panel">
          <div className="table-toolbar">
            <div className="flex items-center gap-3">
              <strong>Actionable Tasks</strong>
              <div className="flex gap-1">
                {["all", "active", "todo", "in_progress", "completed"].map((f) => (
                  <button
                    key={f}
                    className={`px-2 py-0.5 rounded text-[10px] ${taskFilter === f ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-gray-400 hover:text-gray-200"}`}
                    onClick={() => setTaskFilter(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="tiny-button flex items-center gap-1"
              onClick={() => setShowNewTask(!showNewTask)}
            >
              {showNewTask ? (
                <>
                  <CloseIcon size={12} className="shrink-0" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <PlusIcon size={12} className="shrink-0" />
                  <span>New Task</span>
                </>
              )}
            </button>
          </div>

          {showNewTask && (
            <div className="lifedb-form-card m-4">
              <h4 className="text-xs font-semibold text-amber-300 mb-2">Create New Task</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Task title (e.g. Order fresh coffee)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="lifedb-input md:col-span-2"
                />
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value)}
                  className="lifedb-input"
                >
                  <option value="todo">To-Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input
                  type="number"
                  placeholder="Priority (1-5)"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="lifedb-input"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="tiny-button" onClick={() => setShowNewTask(false)}>
                  Cancel
                </button>
                <button
                  className="tiny-button approve-button"
                  disabled={!newTaskTitle.trim() || busy}
                  onClick={async () => {
                    await onSaveTask({
                      title: newTaskTitle.trim(),
                      status: newTaskStatus,
                      priority: Number(newTaskPriority) || 1,
                      targetDate: newTaskTargetDate || undefined,
                    });
                    setNewTaskTitle("");
                    setShowNewTask(false);
                  }}
                >
                  Save Task
                </button>
              </div>
            </div>
          )}

          {filteredTasks.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>Done</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Target Date</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t) => {
                    const isDone = t.status === "completed";
                    return (
                      <tr key={t.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => void onToggleTask(t)}
                            className="cursor-pointer accent-amber-500"
                          />
                        </td>
                        <td>
                          <span className={isDone ? "line-through text-gray-500" : "font-medium text-gray-200"}>
                            {t.title}
                          </span>
                        </td>
                        <td>
                          <span className={`lifedb-pill lifedb-pill-${t.status || "todo"}`}>
                            {t.status || "todo"}
                          </span>
                        </td>
                        <td>
                          <span className="tag font-mono">P{t.priority ?? 1}</span>
                        </td>
                        <td>{formatDate(t.targetDate)}</td>
                        <td>{formatDate(t.updatedAt)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="tiny-button"
                              onClick={() => void onToggleTask(t)}
                            >
                              {isDone ? "Reopen" : "Complete"}
                            </button>
                            <button
                              className="tiny-button danger-button"
                              onClick={() => void onDeleteTask(t.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No tasks match filter"
              detail="Tasks learned through conversation or created above will appear here."
            />
          )}
        </section>
      )}

      {/* ENTITIES TAB */}
      {activeTab === "entities" && (
        <section className="console-panel table-panel">
          <div className="table-toolbar">
            <div>
              <strong>Static Entities & Inventory</strong>
              <span>Nouns, devices, gaming items, and contacts</span>
            </div>
            <button
              className="tiny-button flex items-center gap-1"
              onClick={() => setShowNewEntity(!showNewEntity)}
            >
              {showNewEntity ? (
                <>
                  <CloseIcon size={12} className="shrink-0" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <PlusIcon size={12} className="shrink-0" />
                  <span>New Entity</span>
                </>
              )}
            </button>
          </div>

          {showNewEntity && (
            <div className="lifedb-form-card m-4">
              <h4 className="text-xs font-semibold text-amber-300 mb-2">Create New Entity</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Entity Name (e.g. MacBook Pro M3)"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  className="lifedb-input"
                />
                <input
                  type="text"
                  placeholder="Type (e.g. hardware, contact, item)"
                  value={newEntityType}
                  onChange={(e) => setNewEntityType(e.target.value)}
                  className="lifedb-input"
                />
                <input
                  type="text"
                  placeholder="Domain (e.g. workstation, gaming, home)"
                  value={newEntityDomain}
                  onChange={(e) => setNewEntityDomain(e.target.value)}
                  className="lifedb-input"
                />
              </div>
              <div className="mb-3">
                <textarea
                  placeholder='Properties JSON (e.g. {"model": "16-inch", "ram": "36GB"})'
                  value={newEntityProps}
                  onChange={(e) => setNewEntityProps(e.target.value)}
                  className="lifedb-input w-full font-mono text-xs"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="tiny-button" onClick={() => setShowNewEntity(false)}>
                  Cancel
                </button>
                <button
                  className="tiny-button approve-button"
                  disabled={!newEntityName.trim() || busy}
                  onClick={async () => {
                    let parsedProps = {};
                    try { parsedProps = JSON.parse(newEntityProps || "{}"); } catch {}
                    await onSaveEntity({
                      name: newEntityName.trim(),
                      entityType: newEntityType.trim() || "item",
                      domain: newEntityDomain.trim() || "general",
                      properties: parsedProps,
                    });
                    setNewEntityName("");
                    setShowNewEntity(false);
                  }}
                >
                  Save Entity
                </button>
              </div>
            </div>
          )}

          {entities.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Domain</th>
                    <th>Properties</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((ent) => (
                    <tr key={ent.id}>
                      <td className="font-medium text-gray-200">{ent.name}</td>
                      <td>
                        <span className="tag font-mono">{ent.entityType}</span>
                      </td>
                      <td>
                        <span className="tag">{ent.domain}</span>
                      </td>
                      <td>
                        <pre className="text-[10px] text-gray-400 font-mono max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {JSON.stringify(ent.properties || {})}
                        </pre>
                      </td>
                      <td>{formatDate(ent.updatedAt)}</td>
                      <td>
                        <button
                          className="tiny-button danger-button"
                          onClick={() => void onDeleteEntity(ent.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No entities recorded"
              detail="Hardware, game characters, contacts, and items stored in Life DB will appear here."
            />
          )}
        </section>
      )}

      {/* EVENTS TAB */}
      {activeTab === "events" && (
        <section className="console-panel table-panel">
          <div className="table-toolbar">
            <div>
              <strong>Time-Series Events & Telemetry</strong>
              <span>Biometrics, finances, workout telemetry, and logs</span>
            </div>
            <button
              className="tiny-button flex items-center gap-1"
              onClick={() => setShowNewEvent(!showNewEvent)}
            >
              {showNewEvent ? (
                <>
                  <CloseIcon size={12} className="shrink-0" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <PlusIcon size={12} className="shrink-0" />
                  <span>Log Event</span>
                </>
              )}
            </button>
          </div>

          {showNewEvent && (
            <div className="lifedb-form-card m-4">
              <h4 className="text-xs font-semibold text-amber-300 mb-2">Log New Event</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Stream (e.g. finance:expense, health:heartrate)"
                  value={newEventStream}
                  onChange={(e) => setNewEventStream(e.target.value)}
                  className="lifedb-input"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Metric Value (optional, e.g. 25.5)"
                  value={newEventMetric}
                  onChange={(e) => setNewEventMetric(e.target.value)}
                  className="lifedb-input"
                />
              </div>
              <div className="mb-3">
                <textarea
                  placeholder='Metadata JSON (optional, e.g. {"category": "coffee", "currency": "USD"})'
                  value={newEventMeta}
                  onChange={(e) => setNewEventMeta(e.target.value)}
                  className="lifedb-input w-full font-mono text-xs"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="tiny-button" onClick={() => setShowNewEvent(false)}>
                  Cancel
                </button>
                <button
                  className="tiny-button approve-button"
                  disabled={!newEventStream.trim() || busy}
                  onClick={async () => {
                    let parsedMeta = {};
                    try { parsedMeta = JSON.parse(newEventMeta || "{}"); } catch {}
                    await onAddEvent({
                      stream: newEventStream.trim(),
                      metricValue: newEventMetric !== "" ? Number(newEventMetric) : undefined,
                      metadata: parsedMeta,
                    });
                    setNewEventMetric("");
                    setShowNewEvent(false);
                  }}
                >
                  Log Event
                </button>
              </div>
            </div>
          )}

          {events.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stream</th>
                    <th>Metric Value</th>
                    <th>Timestamp</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => (
                    <tr key={evt.id}>
                      <td className="font-mono text-amber-400 text-xs">{evt.stream}</td>
                      <td className="font-mono text-xs">
                        {evt.metricValue !== undefined && evt.metricValue !== null
                          ? <strong>{evt.metricValue}</strong>
                          : "—"}
                      </td>
                      <td>{formatDate(evt.timestamp)}</td>
                      <td>
                        <pre className="text-[10px] text-gray-400 font-mono max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {JSON.stringify(evt.metadata || {})}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No events logged"
              detail="Telemetry and time-series events will be displayed here."
            />
          )}
        </section>
      )}

      {/* SCHEDULE TAB */}
      {activeTab === "schedule" && (
        <section className="console-panel table-panel">
          <div className="table-toolbar">
            <div>
              <strong>Calendar Commitments & Routines</strong>
              <span>Upcoming time intervals and schedule items</span>
            </div>
            <button
              className="tiny-button flex items-center gap-1"
              onClick={() => setShowNewSchedule(!showNewSchedule)}
            >
              {showNewSchedule ? (
                <>
                  <CloseIcon size={12} className="shrink-0" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <PlusIcon size={12} className="shrink-0" />
                  <span>New Schedule Item</span>
                </>
              )}
            </button>
          </div>

          {showNewSchedule && (
            <div className="lifedb-form-card m-4">
              <h4 className="text-xs font-semibold text-amber-300 mb-2">Create Schedule Item</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Title (e.g. Flight to Tokyo)"
                  value={newSchedTitle}
                  onChange={(e) => setNewSchedTitle(e.target.value)}
                  className="lifedb-input"
                />
                <input
                  type="text"
                  placeholder="Start Time (e.g. 2026-09-20T14:00:00Z)"
                  value={newSchedStart}
                  onChange={(e) => setNewSchedStart(e.target.value)}
                  className="lifedb-input"
                />
                <input
                  type="text"
                  placeholder="End Time (optional)"
                  value={newSchedEnd}
                  onChange={(e) => setNewSchedEnd(e.target.value)}
                  className="lifedb-input"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="tiny-button" onClick={() => setShowNewSchedule(false)}>
                  Cancel
                </button>
                <button
                  className="tiny-button approve-button"
                  disabled={!newSchedTitle.trim() || !newSchedStart.trim() || busy}
                  onClick={async () => {
                    await onSaveSchedule({
                      title: newSchedTitle.trim(),
                      startTime: newSchedStart.trim(),
                      endTime: newSchedEnd.trim() || undefined,
                      status: "active",
                    });
                    setNewSchedTitle("");
                    setNewSchedStart("");
                    setNewSchedEnd("");
                    setShowNewSchedule(false);
                  }}
                >
                  Save Schedule
                </button>
              </div>
            </div>
          )}

          {schedule.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium text-gray-200">{item.title}</td>
                      <td>{formatDate(item.startTime)}</td>
                      <td>{formatDate(item.endTime)}</td>
                      <td>
                        <span className="tag font-mono">{item.status || "active"}</span>
                      </td>
                      <td>
                        <button
                          className="tiny-button danger-button"
                          onClick={() => void onDeleteSchedule(item.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No upcoming schedule items"
              detail="Calendar commitments and schedule intervals will appear here."
            />
          )}
        </section>
      )}
    </div>
  );
}

function LogsView({
  logs,
  filterLevel,
  filterSubsystem,
  searchQuery,
  autoRefresh,
  expandedIds,
  onToggleExpand,
  onChangeLevel,
  onChangeSubsystem,
  onChangeSearch,
  onToggleAutoRefresh,
  onRefresh,
  onClear,
  onExport,
}: {
  logs: SystemLog[];
  filterLevel: string;
  filterSubsystem: string;
  searchQuery: string;
  autoRefresh: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onChangeLevel: (lvl: string) => void;
  onChangeSubsystem: (sub: string) => void;
  onChangeSearch: (q: string) => void;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
  onClear: () => void;
  onExport: () => void;
}) {
  const errorCount = useMemo(() => logs.filter((l) => l.level === "error").length, [logs]);
  const warnCount = useMemo(() => logs.filter((l) => l.level === "warn").length, [logs]);

  return (
    <div className="console-view">
      <div className="view-intro">
        <div>
          <p className="console-eyebrow">DIAGNOSTICS & AUDIT</p>
          <h2>System Logs & Diagnostics</h2>
          <p>Real-time audit trail of perception cycles, LLM calls, Truth Gate decisions, and tool executions.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button className="tiny-button flex items-center gap-1" onClick={onExport} title="Download current logs as JSON">
            <DownloadIcon size={12} className="shrink-0" />
            <span>Export JSON</span>
          </button>
          <button className="tiny-button danger-button flex items-center gap-1" onClick={onClear} title="Purge stored logs">
            <TrashIcon size={12} className="shrink-0" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      <section className="console-panel">
        <div className="logs-toolbar">
          <div className="logs-toolbar-left">
            <input
              type="text"
              placeholder="Search logs, metadata..."
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
              className="logs-search-input"
            />
            <select
              value={filterSubsystem}
              onChange={(e) => onChangeSubsystem(e.target.value)}
              className="logs-select"
            >
              <option value="all">All Subsystems</option>
              <option value="perception">Perception</option>
              <option value="brain">Brain / LLM</option>
              <option value="truth_gate">Truth Gate</option>
              <option value="memory">Memory</option>
              <option value="hands">Hands / Tools</option>
              <option value="server">Server</option>
            </select>
          </div>

          <div className="logs-toolbar-right">
            <div className="logs-level-pills">
              {(["all", "error", "warn", "info", "debug"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`log-pill ${filterLevel === lvl ? "active" : ""} ${lvl === "error" && errorCount > 0 ? "has-errors" : ""}`}
                  onClick={() => onChangeLevel(lvl)}
                >
                  {lvl.toUpperCase()}
                  {lvl === "error" && errorCount > 0 && <span className="pill-badge">{errorCount}</span>}
                  {lvl === "warn" && warnCount > 0 && <span className="pill-badge">{warnCount}</span>}
                </button>
              ))}
            </div>

            <label className="logs-live-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={onToggleAutoRefresh}
              />
              <span className={`live-indicator ${autoRefresh ? "active" : ""}`} />
              Live (3s)
            </label>

            <button type="button" className="tiny-button inline-flex items-center justify-center" onClick={onRefresh} title="Fetch latest logs">
              <RefreshIcon size={12} />
            </button>
          </div>
        </div>

        {logs.length > 0 ? (
          <div className="logs-container">
            {logs.map((log) => {
              const isExpanded = expandedIds.has(log.id);
              const hasMetadata = Boolean(log.metadata && Object.keys(log.metadata).length > 0);
              const formattedTime = new Date(log.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                fractionalSecondDigits: 3,
              });

              return (
                <div
                  key={log.id}
                  className={`log-entry log-entry-${log.level} ${isExpanded ? "expanded" : ""}`}
                >
                  <div
                    className="log-header"
                    onClick={() => hasMetadata && onToggleExpand(log.id)}
                    style={{ cursor: hasMetadata ? "pointer" : "default" }}
                  >
                    <span className="log-time" title={log.createdAt}>
                      {formattedTime}
                    </span>
                    <span className={`log-badge log-badge-${log.level}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="log-subsystem">[{log.subsystem}]</span>
                    <span className="log-message">{log.message}</span>
                    {hasMetadata && (
                      <span className="log-expand-icon flex items-center justify-center" title="Toggle JSON metadata">
                        {isExpanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
                      </span>
                    )}
                  </div>

                  {isExpanded && hasMetadata && (
                    <div className="log-metadata-card">
                      {Boolean(log.metadata?.stack) && (
                        <div className="log-stack-trace">
                          <strong>Stack trace:</strong>
                          <pre>{String(log.metadata?.stack)}</pre>
                        </div>
                      )}
                      <div className="log-json-block">
                        <strong>Payload / Metadata:</strong>
                        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No system logs found"
            detail={
              searchQuery || filterLevel !== "all" || filterSubsystem !== "all"
                ? "No logs match the current filters. Try resetting the search or level filter."
                : "No logs have been recorded yet. New perception cycles, Truth Gate decisions, and model queries will appear here."
            }
          />
        )}
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
