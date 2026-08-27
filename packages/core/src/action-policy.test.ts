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
        audienceId: 'audience-direct',
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
});
