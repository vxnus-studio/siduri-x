import { ActionPolicyEngine } from './action-policy';
import { ActionIntent, ToolDefinition } from './action';
import { RequestContext } from './context';
import { verifyCapabilitySignature } from './capability';

describe('ActionPolicyEngine Boundary', () => {
  let engine: ActionPolicyEngine;
  let sampleContext: RequestContext;

  beforeEach(() => {
    engine = new ActionPolicyEngine({
      defaultRiskLevel: 'HIGH',
      defaultRequireApprovalForHighRisk: true,
      secretKey: 'test_secret_key',
    });

    sampleContext = {
      companionId: 'companion-1',
      actor: {
        actorId: 'user-1',
        sessionId: 'sess-1',
        authorizationRole: 'operator',
        capabilities: ['web:search', 'calc:basic'],
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        correlationId: 'corr-1',
      },
    };

    const searchTool: ToolDefinition = {
      name: 'search_web',
      providerId: 'builtin',
      description: 'Search the web',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      riskLevel: 'LOW',
      requiredCapabilities: ['web:search'],
      allowedChannels: ['direct', 'public', 'private'],
    };

    const deleteTool: ToolDefinition = {
      name: 'delete_database',
      providerId: 'admin',
      description: 'Delete entire database',
      inputSchema: { type: 'object' },
      riskLevel: 'CRITICAL',
      requiredCapabilities: ['admin:delete'],
      allowedRoles: ['administrator'],
      requiresApproval: true,
    };

    engine.registerToolDefinition(searchTool);
    engine.registerToolDefinition(deleteTool);
  });

  it('approves an authorized low-risk action and issues a signed AuthorizationCapability', async () => {
    const action: ActionIntent = {
      actionId: 'act-1',
      toolName: 'builtin/search_web',
      parameters: { query: 'Antigravity' },
      context: sampleContext,
    };

    const { decision, capability } = await engine.evaluateAction(action);
    expect(decision.allowed).toBe(true);
    expect(decision.decisionCode).toBe('ALLOWED_POLICY');
    expect(decision.riskLevel).toBe('LOW');

    expect(capability).toBeDefined();
    expect(capability?.allowed).toBe(true);
    expect(capability?.toolName).toBe('builtin/search_web');
    expect(capability?.actionId).toBe('act-1');
    expect(capability?.signature).toBeDefined();
    expect(verifyCapabilitySignature(capability!, 'test_secret_key')).toBe(true);
  });

  it('rejects an unknown tool/action by default and issues no capability', async () => {
    const action: ActionIntent = {
      actionId: 'act-2',
      toolName: 'unregistered_tool',
      parameters: {},
      context: sampleContext,
    };

    const { decision, capability } = await engine.evaluateAction(action);
    expect(decision.allowed).toBe(false);
    expect(decision.decisionCode).toBe('REJECTED_UNKNOWN_TOOL');
    expect(decision.riskLevel).toBe('CRITICAL');
    expect(capability).toBeUndefined();
  });

  it('rejects action if request context is missing', async () => {
    const action: ActionIntent = {
      actionId: 'act-3',
      toolName: 'builtin/search_web',
      parameters: { query: 'test' },
      // No context provided
    };

    const { decision, capability } = await engine.evaluateAction(action);
    expect(decision.allowed).toBe(false);
    expect(decision.decisionCode).toBe('REJECTED_UNAUTHORIZED');
    expect(decision.reason).toContain('Missing RequestContext');
    expect(capability).toBeUndefined();
  });

  it('rejects action when actor lacks required capability', async () => {
    const action: ActionIntent = {
      actionId: 'act-4',
      toolName: 'admin/delete_database',
      parameters: {},
      context: sampleContext, // has 'web:search' and 'calc:basic', not 'admin:delete'
    };

    const { decision, capability } = await engine.evaluateAction(action);
    expect(decision.allowed).toBe(false);
    expect(decision.decisionCode).toBe('REJECTED_UNAUTHORIZED'); // operator is not administrator
    expect(capability).toBeUndefined();
  });

  it('rejects high/critical risk action requiring explicit approval before approval is granted, and allows after approval', async () => {
    const adminContext: RequestContext = {
      ...sampleContext,
      actor: {
        ...sampleContext.actor,
        authorizationRole: 'administrator',
        capabilities: ['admin:delete'],
      },
    };

    const action: ActionIntent = {
      actionId: 'act-5',
      toolName: 'admin/delete_database',
      parameters: {},
      context: adminContext,
      executionId: 'exec-admin-delete-1',
    };

    // First attempt: unapproved
    const res1 = await engine.evaluateAction(action);
    expect(res1.decision.allowed).toBe(false);
    expect(res1.decision.decisionCode).toBe('REJECTED_HIGH_RISK_UNAPPROVED');
    expect(res1.capability).toBeUndefined();

    // Grant explicit approval
    engine.approveAction({
      executionId: 'exec-admin-delete-1',
      approverActorId: 'admin-super-user',
    });

    // Second attempt: approved
    const res2 = await engine.evaluateAction(action);
    expect(res2.decision.allowed).toBe(true);
    expect(res2.decision.decisionCode).toBe('ALLOWED_POLICY');
    expect(res2.capability).toBeDefined();
    expect(verifyCapabilitySignature(res2.capability!, 'test_secret_key')).toBe(true);
  });

  it('records structured tamper-evident audit log entries with hash chaining', async () => {
    const action: ActionIntent = {
      actionId: 'act-audit',
      toolName: 'builtin/search_web',
      parameters: { query: 'Audit Test' },
      context: sampleContext,
    };

    await engine.evaluateAction(action);
    const auditLogs = await engine.getAuditLog();
    expect(auditLogs.length).toBeGreaterThan(0);
    const log = auditLogs.find((l) => l.actionId === 'act-audit');
    expect(log).toBeDefined();
    expect(log?.actorId).toBe('user-1');
    expect(log?.toolName).toBe('builtin/search_web');
    expect(log?.parametersHash).toBeDefined();
    expect(log?.resultHash).toBeDefined();
  });

  it('supports single-owner role parity between owner and administrator', async () => {
    const ownerTool: ToolDefinition = {
      name: 'builtin/owner_tool',
      description: 'Owner only tool',
      inputSchema: {},
      riskLevel: 'LOW',
      allowedRoles: ['owner'],
    };
    engine.registerToolDefinition(ownerTool);

    // Context with authorizationRole: 'administrator'
    const adminContext: RequestContext = {
      ...sampleContext,
      actor: {
        ...sampleContext.actor,
        authorizationRole: 'administrator',
      },
    };
    const actionWithAdmin: ActionIntent = {
      actionId: 'act-owner-admin',
      toolName: 'builtin/owner_tool',
      parameters: {},
      context: adminContext,
    };

    const res = await engine.evaluateAction(actionWithAdmin);
    expect(res.decision.allowed).toBe(true);
    expect(res.capability).toBeDefined();

    // Context with authorizationRole: 'operator' (non-owner) is rejected
    const operatorAction: ActionIntent = {
      actionId: 'act-owner-op',
      toolName: 'builtin/owner_tool',
      parameters: {},
      context: sampleContext, // has authorizationRole: 'operator'
    };
    const resOp = await engine.evaluateAction(operatorAction);
    expect(resOp.decision.allowed).toBe(false);
    expect(resOp.decision.decisionCode).toBe('REJECTED_UNAUTHORIZED');
  });

  describe('Approval Authorization Semantics', () => {
    const criticalAction: ActionIntent = {
      actionId: 'act-sec-auth-1',
      toolName: 'admin/delete_database',
      parameters: {},
      context: {
        companionId: 'companion-1',
        actor: {
          actorId: 'admin-1',
          sessionId: 'sess-1',
          authorizationRole: 'administrator',
          capabilities: ['admin:delete'],
          authenticated: true,
        },
        conversation: { channel: 'direct', correlationId: 'corr-1' },
      },
      executionId: 'exec-sec-auth-1',
    };

    it('rejects action approval when approverActorId is empty', async () => {
      await engine.evaluateAction(criticalAction);
      const res = await engine.approveAction({
        executionId: 'exec-sec-auth-1',
        approverActorId: '',
      });
      expect(res.approved).toBe(false);
      expect(res.decisionCode).toBe('REJECTED_MISSING_APPROVER_ID');
    });

    it('rejects action approval from unauthenticated approver context', async () => {
      await engine.evaluateAction(criticalAction);
      const res = await engine.approveAction({
        executionId: 'exec-sec-auth-1',
        approverActorId: 'fake-admin',
        context: {
          companionId: 'companion-1',
          actor: {
            actorId: 'fake-admin',
            sessionId: 'sess-fake',
            authorizationRole: 'administrator',
            capabilities: ['admin:delete'],
            authenticated: false, // Unauthenticated!
          },
          conversation: { channel: 'direct', correlationId: 'corr-fake' },
        },
      });
      expect(res.approved).toBe(false);
      expect(res.decisionCode).toBe('REJECTED_UNAUTHENTICATED');
    });

    it('rejects action approval from viewer role', async () => {
      await engine.evaluateAction(criticalAction);
      const res = await engine.approveAction({
        executionId: 'exec-sec-auth-1',
        approverActorId: 'viewer-user',
        approverRole: 'viewer',
      });
      expect(res.approved).toBe(false);
      expect(res.decisionCode).toBe('REJECTED_UNAUTHORIZED');
    });

    it('rejects approval when approver role does not match tool requirements (operator cannot approve admin tool)', async () => {
      // 1. Initial evaluation stages pending execution
      const eval1 = await engine.evaluateAction(criticalAction);
      expect(eval1.decision.allowed).toBe(false);
      expect(eval1.decision.decisionCode).toBe('REJECTED_HIGH_RISK_UNAPPROVED');

      // 2. Operator attempts to approve an administrator-only tool
      const approvalRes = await engine.approveAction({
        executionId: 'exec-sec-auth-1',
        approverActorId: 'operator-alice',
        approverRole: 'operator',
      });
      expect(approvalRes.approved).toBe(false);
      expect(approvalRes.decisionCode).toBe('REJECTED_ROLE_MISMATCH');

      // 3. Action re-evaluation remains unapproved and denied
      const eval2 = await engine.evaluateAction(criticalAction);
      expect(eval2.decision.allowed).toBe(false);
      expect(eval2.decision.decisionCode).toBe('REJECTED_HIGH_RISK_UNAPPROVED');
    });

    it('authorizes approval and emits capability when approver is administrator or owner', async () => {
      await engine.evaluateAction(criticalAction);

      const approvalRes = await engine.approveAction({
        executionId: 'exec-sec-auth-1',
        approverActorId: 'admin-bob',
        approverRole: 'administrator',
        reason: 'Authorized scheduled database purge',
      });
      expect(approvalRes.approved).toBe(true);
      expect(approvalRes.decisionCode).toBe('APPROVED');

      const evalApproved = await engine.evaluateAction(criticalAction);
      expect(evalApproved.decision.allowed).toBe(true);
      expect(evalApproved.decision.decisionCode).toBe('ALLOWED_POLICY');
      expect(evalApproved.capability).toBeDefined();
    });

    it('records structured tamper-evident audit logs for approval decisions', async () => {
      await engine.evaluateAction(criticalAction);

      await engine.approveAction({
        executionId: 'exec-sec-auth-1',
        approverActorId: 'viewer-tamper',
        approverRole: 'viewer',
      });

      const auditLogs = await engine.getAuditLog();
      const rejectionEvent = auditLogs.find(
        (l) => l.executionId === 'exec-sec-auth-1' && l.lifecycle === 'REJECTED' && l.toolName === 'action:approve'
      );
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.actorId).toBe('viewer-tamper');
      expect(rejectionEvent?.decision?.decisionCode).toBe('REJECTED_UNAUTHORIZED');
    });
  });
});
