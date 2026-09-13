// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SqliteActionStore } from './sqlite-action-store';
import { ActionPolicyEngine } from './action-policy';
import { ActionIntent, ToolDefinition } from './action';
import { RequestContext } from './context';
import { verifyCapabilitySignature, canonicalizeJson } from './capability';

describe('SqliteActionStore Implementation & Durability', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siduri-sqlite-test-'));
    dbPath = path.join(tmpDir, 'actions.db');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('reserves execution atomically and prevents duplicate executionId', async () => {
    const store = new SqliteActionStore({ dbPath });

    const record = {
      executionId: 'exec-100',
      actionId: 'act-100',
      toolName: 'test_tool',
      providerId: 'builtin',
      parametersHash: 'hash-100',
      lifecycle: 'EXECUTING' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const first = await store.reserveExecution(record);
    expect(first).toBe(true);

    // Second reservation with same executionId fails
    const second = await store.reserveExecution({
      ...record,
      actionId: 'act-duplicate',
    });
    expect(second).toBe(false);

    // Fetch and verify contents
    const fetched = await store.getExecution('exec-100');
    expect(fetched).toBeDefined();
    expect(fetched?.executionId).toBe('exec-100');
    expect(fetched?.toolName).toBe('test_tool');

    // Update execution
    await store.updateExecution({
      ...record,
      lifecycle: 'COMPLETED',
      result: { success: true, count: 42 },
    });

    const updated = await store.getExecution('exec-100');
    expect(updated?.lifecycle).toBe('COMPLETED');
    expect(updated?.result).toEqual({ success: true, count: 42 });

    store.close();
  });

  it('persists approvals and survives process restart with a fresh instance', async () => {
    // Process 1: save approval in instance 1
    const store1 = new SqliteActionStore({ dbPath });
    await store1.saveApproval('exec-restart-test', 'operator-alice', 'Routine maintenance');
    expect(await store1.isActionApproved('exec-restart-test')).toBe(true);
    expect(await store1.isActionApproved('non-existent')).toBe(false);
    store1.close();

    // Process 2: open new instance on the same file (simulating engine reboot)
    const store2 = new SqliteActionStore({ dbPath });
    const isApprovedAfterReboot = await store2.isActionApproved('exec-restart-test');
    expect(isApprovedAfterReboot).toBe(true);
    expect(await store2.isActionApproved('non-existent')).toBe(false);
    store2.close();
  });

  it('maintains tamper-evident SHA-256 hash chaining in SQLite audit log', async () => {
    const store = new SqliteActionStore({ dbPath });

    const event1 = {
      executionId: 'exec-audit-1',
      actionId: 'act-audit-1',
      toolName: 'system/disk_clean',
      providerId: 'system',
      companionId: 'comp-1',
      actorId: 'user-1',
      riskLevel: 'LOW' as const,
      lifecycle: 'POLICY_CHECKED' as const,
      timestamp: '2026-09-09T10:00:00.000Z',
    };

    const event2 = {
      executionId: 'exec-audit-2',
      actionId: 'act-audit-2',
      toolName: 'system/disk_clean',
      providerId: 'system',
      companionId: 'comp-1',
      actorId: 'user-1',
      riskLevel: 'LOW' as const,
      lifecycle: 'COMPLETED' as const,
      timestamp: '2026-09-09T10:00:05.000Z',
    };

    await store.appendAudit(event1);
    await store.appendAudit(event2);

    const log = await store.getAuditLog();
    expect(log).toHaveLength(2);

    const initialPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    expect(log[0].previousEventHash).toBe(initialPrevHash);
    expect(log[1].previousEventHash).toBe(log[0].eventHash);

    // Verify hash computation on event 1
    const canonical1 = canonicalizeJson({
      executionId: event1.executionId,
      actionId: event1.actionId,
      toolName: event1.toolName,
      providerId: event1.providerId,
      companionId: event1.companionId,
      actorId: event1.actorId,
      sessionId: null,
      channel: null,
      correlationId: null,
      riskLevel: event1.riskLevel,
      lifecycle: event1.lifecycle,
      decision: null,
      parametersHash: null,
      resultHash: null,
      error: null,
      timestamp: event1.timestamp,
    });
    const expectedHash1 = crypto.createHash('sha256').update(`${initialPrevHash}:${canonical1}`, 'utf8').digest('hex');
    expect(log[0].eventHash).toBe(expectedHash1);

    store.close();

    // Reopen in a new instance and verify audit chain resumes seamlessly
    const storeReopened = new SqliteActionStore({ dbPath });
    const event3 = {
      executionId: 'exec-audit-3',
      actionId: 'act-audit-3',
      toolName: 'system/disk_clean',
      providerId: 'system',
      companionId: 'comp-1',
      actorId: 'user-1',
      riskLevel: 'LOW' as const,
      lifecycle: 'COMPLETED' as const,
      timestamp: '2026-09-09T10:00:10.000Z',
    };
    await storeReopened.appendAudit(event3);
    const logReopened = await storeReopened.getAuditLog();
    expect(logReopened).toHaveLength(3);
    expect(logReopened[2].previousEventHash).toBe(logReopened[1].eventHash);

    // Query specific executionId
    const filtered = await storeReopened.getAuditLog('exec-audit-2');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].executionId).toBe('exec-audit-2');

    storeReopened.close();
  });

  it('works seamlessly with ActionPolicyEngine across simulated restarts', async () => {
    const secretKey = 'test_sqlite_policy_key';
    const store1 = new SqliteActionStore({ dbPath });

    const engine1 = new ActionPolicyEngine({
      store: store1,
      secretKey,
      defaultRiskLevel: 'HIGH',
      defaultRequireApprovalForHighRisk: true,
    });

    const dangerousTool: ToolDefinition = {
      name: 'cleanup_disk',
      providerId: 'system',
      description: 'Clean up disk',
      inputSchema: {},
      riskLevel: 'HIGH',
      requiresApproval: true,
    };
    engine1.registerToolDefinition(dangerousTool);

    const context: RequestContext = {
      companionId: 'comp-local',
      actor: {
        actorId: 'local-owner',
        sessionId: 'sess-1',
        authorizationRole: 'operator',
        capabilities: ['system:manage'],
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        correlationId: 'corr-1',
      },
    };

    const action: ActionIntent = {
      actionId: 'act-danger-1',
      executionId: 'exec-danger-1',
      toolName: 'system/cleanup_disk',
      parameters: { force: true },
      context,
    };

    // 1. Initial attempt without approval -> rejected
    const eval1 = await engine1.evaluateAction(action);
    expect(eval1.decision.allowed).toBe(false);
    expect(eval1.decision.decisionCode).toBe('REJECTED_HIGH_RISK_UNAPPROVED');

    // 2. Owner approves
    await engine1.approveAction({
      executionId: 'exec-danger-1',
      approverActorId: 'local-owner',
      approverRole: 'owner',
      reason: 'Owner confirmed cleanup',
    });

    store1.close();

    // 3. Process restart: engine2 with fresh SqliteActionStore connecting to same db
    const store2 = new SqliteActionStore({ dbPath });
    const engine2 = new ActionPolicyEngine({
      store: store2,
      secretKey,
      defaultRiskLevel: 'HIGH',
      defaultRequireApprovalForHighRisk: true,
    });
    engine2.registerToolDefinition(dangerousTool);

    // 4. Evaluate after restart -> approval is retrieved from SQLite and capability granted
    const eval2 = await engine2.evaluateAction(action);
    expect(eval2.decision.allowed).toBe(true);
    expect(eval2.decision.decisionCode).toBe('ALLOWED_POLICY');
    expect(eval2.capability).toBeDefined();
    expect(verifyCapabilitySignature(eval2.capability!, secretKey)).toBe(true);

    // 5. Tampered action after restart -> rejected due to approval parameter mismatch
    const tamperedAction: ActionIntent = {
      ...action,
      parameters: { force: true, dropDatabase: true },
    };
    const evalTampered = await engine2.evaluateAction(tamperedAction);
    expect(evalTampered.decision.allowed).toBe(false);
    expect(evalTampered.decision.decisionCode).toBe('REJECTED_APPROVAL_MISMATCH');

    store2.close();
  });
});
