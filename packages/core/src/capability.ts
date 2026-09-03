// Standard cryptographic implementations avoiding runtime ambient type dependencies
// using node's built-in crypto module dynamically or via require for universal CommonJS compatibility

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

import { ActionRiskLevel, ActionLifecycleState, ActionAuditEvent, ActionPolicyDecision } from './action';

export interface AuthorizationCapability {
  executionId: string;
  actionId: string;
  toolName: string;
  providerId: string;
  parametersHash: string;
  companionId: string;
  actorId?: string;
  sessionId?: string;
  channel?: string;
  correlationId?: string;
  riskLevel: ActionRiskLevel;
  issuedAt: string;
  expiresAt: string;
  allowed: true;
  signature: string;
}

export interface PersistentExecutionRecord {
  executionId: string;
  actionId: string;
  toolName: string;
  providerId: string;
  parametersHash: string;
  lifecycle: ActionLifecycleState;
  decision?: ActionPolicyDecision;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionStore {
  // Concurrency-safe execution reservation: returns true if reservation succeeded, false if executionId already exists
  reserveExecution(record: PersistentExecutionRecord): Promise<boolean>;
  updateExecution(record: PersistentExecutionRecord): Promise<void>;
  getExecution(executionId: string): Promise<PersistentExecutionRecord | undefined>;
  
  // Append-only tamper-evident audit log
  appendAudit(event: ActionAuditEvent): Promise<void>;
  getAuditLog(executionId?: string): Promise<ActionAuditEvent[]>;
}

export class InMemoryActionStore implements ActionStore {
  private readonly executions = new Map<string, PersistentExecutionRecord>();
  private readonly auditLog: ActionAuditEvent[] = [];
  private lastAuditHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  async reserveExecution(record: PersistentExecutionRecord): Promise<boolean> {
    if (this.executions.has(record.executionId)) {
      return false;
    }
    this.executions.set(record.executionId, { ...record });
    return true;
  }

  async updateExecution(record: PersistentExecutionRecord): Promise<void> {
    this.executions.set(record.executionId, { ...record });
  }

  async getExecution(executionId: string): Promise<PersistentExecutionRecord | undefined> {
    const rec = this.executions.get(executionId);
    return rec ? { ...rec } : undefined;
  }

  async appendAudit(event: ActionAuditEvent): Promise<void> {
    // Tamper-evident hash chaining over all security-critical event fields
    const eventPayload = {
      executionId: event.executionId,
      actionId: event.actionId,
      toolName: event.toolName,
      providerId: event.providerId || null,
      companionId: event.companionId,
      actorId: event.actorId || null,
      sessionId: event.sessionId || null,
      channel: event.channel || null,
      correlationId: event.correlationId || null,
      riskLevel: event.riskLevel,
      lifecycle: event.lifecycle,
      decision: event.decision ? {
        allowed: event.decision.allowed,
        reason: event.decision.reason,
        riskLevel: event.decision.riskLevel,
        decisionCode: event.decision.decisionCode,
      } : null,
      parametersHash: event.parametersHash || null,
      error: event.error || null,
      timestamp: event.timestamp,
    };
    const canonical = canonicalizeJson(eventPayload);
    const eventHash = crypto
      .createHash('sha256')
      .update(`${this.lastAuditHash}:${canonical}`, 'utf8')
      .digest('hex');
    this.lastAuditHash = eventHash;

    const recordWithHash: ActionAuditEvent = {
      ...event,
      resultHash: event.resultHash || eventHash,
    };
    this.auditLog.push(recordWithHash);
  }

  async getAuditLog(executionId?: string): Promise<ActionAuditEvent[]> {
    if (executionId) {
      return this.auditLog.filter((e) => e.executionId === executionId).map((e) => ({ ...e }));
    }
    return this.auditLog.map((e) => ({ ...e }));
  }
}

export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalizeJson).join(',')}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => `"${k}":${canonicalizeJson((obj as Record<string, unknown>)[k])}`);
  return `{${pairs.join(',')}}`;
}

export function computeParametersHash(params: unknown): string {
  const canonical = canonicalizeJson(params || {});
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function signCapabilityPayload(
  payload: Record<string, unknown>,
  secretKey: string = 'siduri_y_action_policy_secret'
): string {
  const canonicalStr = canonicalizeJson(payload);
  return crypto.createHmac('sha256', secretKey).update(canonicalStr, 'utf8').digest('hex');
}

export function verifyCapabilitySignature(
  capability: AuthorizationCapability,
  secretKey: string = 'siduri_y_action_policy_secret'
): boolean {
  if (!capability || capability.allowed !== true || typeof capability.signature !== 'string') {
    return false;
  }
  const { signature, allowed, ...rest } = capability;
  const canonicalStr = canonicalizeJson(rest);
  const expectedSigHex = crypto.createHmac('sha256', secretKey).update(canonicalStr, 'utf8').digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const sigBuffer = (globalThis as any).Buffer
      ? (globalThis as any).Buffer.from(signature, 'hex')
      : new Uint8Array(signature.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
    const expectedBuffer = (globalThis as any).Buffer
      ? (globalThis as any).Buffer.from(expectedSigHex, 'hex')
      : new Uint8Array(expectedSigHex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);

    if (sigBuffer.length !== expectedBuffer.length || sigBuffer.length === 0) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
