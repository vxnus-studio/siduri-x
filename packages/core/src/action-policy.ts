import { RequestContext } from './context';
import {
  ActionIntent,
  ActionPolicyDecision,
  ActionAuditEvent,
  ToolDefinition,
  ActionRiskLevel,
  ActionLifecycleState,
} from './action';
import {
  AuthorizationCapability,
  ActionStore,
  InMemoryActionStore,
  ActionApprovalRecord,
  computeParametersHash,
  canonicalizeJson,
  signCapabilityPayload,
  getOrGenerateLocalActionPolicySecret,
} from './capability';

export interface ActionPolicyRule {
  toolNamePattern: string | RegExp;
  riskLevel?: ActionRiskLevel;
  requiredCapabilities?: string[];
  allowedRoles?: string[];
  allowedChannels?: string[];
  requiresExplicitApproval?: boolean;
}

export interface ActionPolicyEngineOptions {
  rules?: ActionPolicyRule[];
  defaultRiskLevel?: ActionRiskLevel;
  defaultRequireApprovalForHighRisk?: boolean;
  store?: ActionStore;
  secretKey?: string;
  allowedApproverRoles?: string[];
  requiredApproverCapabilities?: string[];
}

export type ActionApprovalDecisionCode =
  | 'APPROVED'
  | 'REJECTED_UNAUTHORIZED'
  | 'REJECTED_UNAUTHENTICATED'
  | 'REJECTED_ROLE_MISMATCH'
  | 'REJECTED_MISSING_APPROVER_ID'
  | 'REJECTED_MISSING_CAPABILITY';

export interface ActionApprovalResult {
  approved: boolean;
  decisionCode: ActionApprovalDecisionCode;
  reason: string;
  executionId: string;
  approverActorId: string;
}

export interface ApproveActionOptions {
  executionId: string;
  approverActorId: string;
  reason?: string;
  /**
   * Optional RequestContext of the approver establishing authenticated identity.
   */
  context?: RequestContext;
  /**
   * Optional role of the approver (e.g. 'owner', 'administrator', 'operator').
   */
  approverRole?: string;
  /**
   * Optional capabilities held by the approver.
   */
  approverCapabilities?: string[];
}

export function normalizeApproverRole(role?: string, actorId?: string): string {
  if (role && role.trim() !== '') {
    const lower = role.trim().toLowerCase();
    if (lower === 'administrator' || lower === 'admin') return 'administrator';
    return lower;
  }
  if (actorId) {
    const lower = actorId.toLowerCase();
    if (lower.includes('admin')) return 'administrator';
    if (lower.includes('owner')) return 'owner';
    if (lower.includes('operator')) return 'operator';
    if (lower.includes('viewer') || lower.includes('guest') || lower.includes('visitor')) return 'viewer';
  }
  return 'owner'; // Default to single-owner role
}

export class ActionPolicyEngine {
  private readonly toolRegistry = new Map<string, ToolDefinition>();
  private readonly rules: ActionPolicyRule[] = [];
  private readonly store: ActionStore;
  private readonly defaultRiskLevel: ActionRiskLevel;
  private readonly defaultRequireApprovalForHighRisk: boolean;
  private readonly secretKey: string;
  private readonly allowedApproverRoles: string[];
  private readonly requiredApproverCapabilities: string[];
  private readonly approvedExecutions = new Map<string, ActionApprovalRecord>();
  private readonly pendingActions = new Map<
    string,
    { action: ActionIntent; context?: RequestContext; toolDef: ToolDefinition }
  >();

  constructor(options: ActionPolicyEngineOptions = {}) {
    this.rules = options.rules ?? [];
    this.defaultRiskLevel = options.defaultRiskLevel ?? 'HIGH';
    this.defaultRequireApprovalForHighRisk = options.defaultRequireApprovalForHighRisk ?? true;
    this.store = options.store ?? new InMemoryActionStore();
    this.secretKey = getOrGenerateLocalActionPolicySecret(options.secretKey);
    this.allowedApproverRoles = (
      options.allowedApproverRoles ?? ['owner', 'administrator', 'admin', 'operator']
    ).map((r) => r.toLowerCase());
    this.requiredApproverCapabilities = options.requiredApproverCapabilities ?? [];
  }

  registerToolDefinition(tool: ToolDefinition): void {
    const key = tool.providerId ? `${tool.providerId}/${tool.name}` : tool.name;
    this.toolRegistry.set(key, tool);
    // Also index by bare name if unique
    if (!this.toolRegistry.has(tool.name)) {
      this.toolRegistry.set(tool.name, tool);
    }
  }

  unregisterToolDefinition(toolName: string): boolean {
    return this.toolRegistry.delete(toolName);
  }

  getRegisteredTools(): ToolDefinition[] {
    const set = new Set(this.toolRegistry.values());
    return Array.from(set);
  }

  findToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.toolRegistry.get(toolName);
  }

  async evaluateAction(
    action: ActionIntent,
    context?: RequestContext
  ): Promise<{ decision: ActionPolicyDecision; capability?: AuthorizationCapability }> {
    const effectiveContext = action.context || context;
    const executionId = action.executionId || `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    action.executionId = executionId;

    const toolDef = this.findToolDefinition(action.toolName);
    const paramsHash = computeParametersHash(action.parameters);

    // Rule: Unknown tools/actions must not be implicitly authorized
    if (!toolDef) {
      const decision: ActionPolicyDecision = {
        allowed: false,
        reason: `Tool "${action.toolName}" is not registered or known in action policy`,
        riskLevel: 'CRITICAL',
        executionId,
        decisionCode: 'REJECTED_UNKNOWN_TOOL',
      };
      await this.recordAudit(action, effectiveContext, decision, 'REJECTED');
      return { decision };
    }

    const riskLevel: ActionRiskLevel = toolDef.riskLevel || this.defaultRiskLevel;
    const requiredCaps = toolDef.requiredCapabilities || [];

    // Check request context presence
    if (!effectiveContext) {
      const decision: ActionPolicyDecision = {
        allowed: false,
        reason: 'Missing RequestContext: Actions cannot be authorized without request context',
        riskLevel,
        requiredCapabilities: requiredCaps,
        executionId,
        decisionCode: 'REJECTED_UNAUTHORIZED',
      };
      await this.recordAudit(action, undefined, decision, 'REJECTED');
      return { decision };
    }

    // Role check if tool restricts roles (supports administrator/owner role parity)
    if (toolDef.allowedRoles && toolDef.allowedRoles.length > 0) {
      const actorRole = (effectiveContext.actor.authorizationRole as string) || (effectiveContext.actor as any).role || 'owner';
      const normalizedActorRoles = new Set<string>([actorRole.toLowerCase()]);
      if (actorRole.toLowerCase() === 'administrator' || actorRole.toLowerCase() === 'owner') {
        normalizedActorRoles.add('administrator');
        normalizedActorRoles.add('owner');
        normalizedActorRoles.add('admin');
      }

      const isAuthorizedRole = toolDef.allowedRoles.some((r) => normalizedActorRoles.has(r.toLowerCase()));
      if (!isAuthorizedRole) {
        const decision: ActionPolicyDecision = {
          allowed: false,
          reason: `Actor role "${actorRole}" is not authorized to execute tool "${action.toolName}"`,
          riskLevel,
          requiredCapabilities: requiredCaps,
          executionId,
          decisionCode: 'REJECTED_UNAUTHORIZED',
        };
        await this.recordAudit(action, effectiveContext, decision, 'REJECTED');
        return { decision };
      }
    }

    // Channel check if tool restricts channels
    if (toolDef.allowedChannels && toolDef.allowedChannels.length > 0) {
      const channel = effectiveContext.conversation.channel || 'direct';
      if (!toolDef.allowedChannels.includes(channel)) {
        const decision: ActionPolicyDecision = {
          allowed: false,
          reason: `Tool "${action.toolName}" cannot be executed in channel "${channel}"`,
          riskLevel,
          requiredCapabilities: requiredCaps,
          executionId,
          decisionCode: 'REJECTED_CHANNEL_RESTRICTED',
        };
        await this.recordAudit(action, effectiveContext, decision, 'REJECTED');
        return { decision };
      }
    }

    // Capability check
    const actorCaps = effectiveContext.actor.capabilities || [];
    const missingCaps = requiredCaps.filter((cap) => !actorCaps.includes(cap));
    if (missingCaps.length > 0) {
      const decision: ActionPolicyDecision = {
        allowed: false,
        reason: `Actor is missing required capabilities: [${missingCaps.join(', ')}]`,
        riskLevel,
        requiredCapabilities: requiredCaps,
        executionId,
        decisionCode: 'REJECTED_MISSING_CAPABILITY',
      };
      await this.recordAudit(action, effectiveContext, decision, 'REJECTED');
      return { decision };
    }

    // Risk level approval check
    const requiresExplicitApproval =
      toolDef.requiresApproval ??
      (this.defaultRequireApprovalForHighRisk && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL'));

    let approvalRecord = this.approvedExecutions.get(executionId);
    if (!approvalRecord && typeof this.store.getApproval === 'function') {
      approvalRecord = await this.store.getApproval(executionId);
      if (approvalRecord) {
        this.approvedExecutions.set(executionId, approvalRecord);
      }
    }

    let isApproved = Boolean(approvalRecord);
    if (!isApproved && typeof this.store.isActionApproved === 'function') {
      isApproved = await this.store.isActionApproved(executionId);
    }

    if (requiresExplicitApproval && isApproved && approvalRecord) {
      const approverRole = (
        approvalRecord.approverRole || normalizeApproverRole(undefined, approvalRecord.approverActorId)
      ).toLowerCase();
      const isOwnerOrAdmin =
        approverRole === 'owner' || approverRole === 'administrator' || approverRole === 'admin';
      if (toolDef.allowedRoles && toolDef.allowedRoles.length > 0 && !isOwnerOrAdmin) {
        const allowed = toolDef.allowedRoles.map((r) => r.toLowerCase());
        if (!allowed.includes(approverRole)) {
          const decision: ActionPolicyDecision = {
            allowed: false,
            reason: `Approver "${approvalRecord.approverActorId}" with role "${approverRole}" is not authorized to approve tool "${action.toolName}"`,
            riskLevel,
            requiredCapabilities: requiredCaps,
            executionId,
            decisionCode: 'REJECTED_UNAUTHORIZED',
          };
          await this.recordAudit(action, effectiveContext, decision, 'REJECTED');
          return { decision };
        }
      }
    }

    if (requiresExplicitApproval && !isApproved) {
      this.pendingActions.set(executionId, { action, context: effectiveContext, toolDef });
      const decision: ActionPolicyDecision = {
        allowed: false,
        reason: `Action "${action.toolName}" has risk level ${riskLevel} and requires explicit approval`,
        riskLevel,
        requiredCapabilities: requiredCaps,
        executionId,
        decisionCode: 'REJECTED_HIGH_RISK_UNAPPROVED',
      };
      await this.recordAudit(action, effectiveContext, decision, 'POLICY_CHECKED');
      return { decision };
    }

    const decision: ActionPolicyDecision = {
      allowed: true,
      reason: 'Action authorized by policy',
      riskLevel,
      requiredCapabilities: requiredCaps,
      executionId,
      decisionCode: 'ALLOWED_POLICY',
    };

    // Issue cryptographic/structural AuthorizationCapability
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const providerId = toolDef.providerId || 'builtin';

    const capabilityPayload = {
      executionId,
      actionId: action.actionId,
      toolName: action.toolName,
      providerId,
      parametersHash: paramsHash,
      companionId: effectiveContext.companionId,
      actorId: effectiveContext.actor.actorId,
      sessionId: effectiveContext.actor.sessionId,
      channel: effectiveContext.conversation.channel,
      correlationId: effectiveContext.conversation.correlationId,
      riskLevel,
      issuedAt,
      expiresAt,
    };

    const signature = signCapabilityPayload(capabilityPayload, this.secretKey);

    const capability: AuthorizationCapability = {
      ...capabilityPayload,
      allowed: true,
      signature,
    };

    await this.recordAudit(action, effectiveContext, decision, 'APPROVED');
    return { decision, capability };
  }

  async approveAction(options: ApproveActionOptions): Promise<ActionApprovalResult> {
    const actorId = (options.context?.actor.actorId || options.approverActorId || '').trim();
    if (!actorId) {
      return {
        approved: false,
        decisionCode: 'REJECTED_MISSING_APPROVER_ID',
        reason: 'approverActorId is required to approve an action execution',
        executionId: options.executionId,
        approverActorId: '',
      };
    }

    // 1. Authenticated boundary check
    if (options.context && options.context.actor.authenticated === false) {
      const result: ActionApprovalResult = {
        approved: false,
        decisionCode: 'REJECTED_UNAUTHENTICATED',
        reason: `Approver "${actorId}" is unauthenticated and cannot approve actions`,
        executionId: options.executionId,
        approverActorId: actorId,
      };
      await this.recordApprovalAudit(options.executionId, actorId, 'unauthenticated', false, result.reason);
      return result;
    }

    // 2. Resolve effective approver role & capabilities
    const rawRole =
      options.context?.actor.authorizationRole || (options.context?.actor as any)?.role || options.approverRole;
    const approverRole = normalizeApproverRole(rawRole, actorId);
    const capabilities = options.context?.actor.capabilities || options.approverCapabilities || [];

    const isOwnerOrAdmin = approverRole === 'owner' || approverRole === 'administrator' || approverRole === 'admin';
    const isRoleAllowed = isOwnerOrAdmin || this.allowedApproverRoles.includes(approverRole);

    // Reject non-allowed roles or explicit viewer/guest role
    if (!isRoleAllowed || approverRole === 'viewer') {
      const result: ActionApprovalResult = {
        approved: false,
        decisionCode: 'REJECTED_UNAUTHORIZED',
        reason: `Actor "${actorId}" with role "${approverRole}" is not authorized to approve actions`,
        executionId: options.executionId,
        approverActorId: actorId,
      };
      await this.recordApprovalAudit(options.executionId, actorId, approverRole, false, result.reason);
      return result;
    }

    // 3. Tool-specific authorization check if pending action is registered
    const pending = this.pendingActions.get(options.executionId);
    if (pending) {
      const { toolDef } = pending;
      if (toolDef.allowedRoles && toolDef.allowedRoles.length > 0 && !isOwnerOrAdmin) {
        const normalizedToolRoles = new Set(toolDef.allowedRoles.map((r) => r.toLowerCase()));
        if (!normalizedToolRoles.has(approverRole)) {
          const result: ActionApprovalResult = {
            approved: false,
            decisionCode: 'REJECTED_ROLE_MISMATCH',
            reason: `Approver role "${approverRole}" is not authorized to approve tool "${toolDef.name}" (requires: ${toolDef.allowedRoles.join(', ')})`,
            executionId: options.executionId,
            approverActorId: actorId,
          };
          await this.recordApprovalAudit(options.executionId, actorId, approverRole, false, result.reason, toolDef.name);
          return result;
        }
      }

      if (this.requiredApproverCapabilities.length > 0 && !isOwnerOrAdmin) {
        const missing = this.requiredApproverCapabilities.filter((c) => !capabilities.includes(c));
        if (missing.length > 0) {
          const result: ActionApprovalResult = {
            approved: false,
            decisionCode: 'REJECTED_MISSING_CAPABILITY',
            reason: `Approver is missing required approval capabilities: [${missing.join(', ')}]`,
            executionId: options.executionId,
            approverActorId: actorId,
          };
          await this.recordApprovalAudit(options.executionId, actorId, approverRole, false, result.reason, toolDef.name);
          return result;
        }
      }
    }

    // 4. Record verified approval
    const record: ActionApprovalRecord = {
      executionId: options.executionId,
      approverActorId: actorId,
      reason: options.reason,
      approverRole,
      approvedAt: new Date().toISOString(),
    };
    this.approvedExecutions.set(options.executionId, record);

    if (typeof this.store.saveApproval === 'function') {
      await this.store.saveApproval(options.executionId, actorId, options.reason, approverRole);
    }

    const reason = options.reason || 'Action approved by authorized policy approver';
    await this.recordApprovalAudit(options.executionId, actorId, approverRole, true, reason, pending?.toolDef.name);

    return {
      approved: true,
      decisionCode: 'APPROVED',
      reason,
      executionId: options.executionId,
      approverActorId: actorId,
    };
  }

  private async recordApprovalAudit(
    executionId: string,
    approverActorId: string,
    approverRole: string,
    approved: boolean,
    reason?: string,
    toolName?: string
  ): Promise<void> {
    const event: ActionAuditEvent = {
      executionId,
      actionId: executionId,
      toolName: toolName || 'action:approve',
      companionId: 'system',
      actorId: approverActorId,
      riskLevel: 'HIGH',
      lifecycle: approved ? 'APPROVED' : 'REJECTED',
      decision: {
        allowed: approved,
        reason: reason || (approved ? 'Approval granted' : 'Approval rejected'),
        riskLevel: 'HIGH',
        executionId,
        decisionCode: approved ? 'ALLOWED_POLICY' : 'REJECTED_UNAUTHORIZED',
      },
      parametersHash: computeParametersHash({ executionId, approverActorId, approverRole, reason }),
      timestamp: new Date().toISOString(),
    };
    await this.store.appendAudit(event);
  }

  async recordAudit(
    action: ActionIntent,
    context: RequestContext | undefined,
    decision: ActionPolicyDecision | undefined,
    lifecycle: ActionLifecycleState,
    result?: unknown,
    error?: string,
    durationMs?: number
  ): Promise<ActionAuditEvent> {
    const event: ActionAuditEvent = {
      executionId: action.executionId || decision?.executionId || 'unknown',
      actionId: action.actionId,
      toolName: action.toolName,
      companionId: context?.companionId || 'unknown',
      actorId: context?.actor.actorId,
      sessionId: context?.actor.sessionId,
      channel: context?.conversation.channel,
      correlationId: context?.conversation.correlationId,
      riskLevel: decision?.riskLevel || 'LOW',
      lifecycle,
      decision,
      parametersHash: computeParametersHash(action.parameters),
      resultHash: result !== undefined ? computeParametersHash(result) : undefined,
      timestamp: new Date().toISOString(),
      durationMs,
      error,
    };
    await this.store.appendAudit(event);
    return event;
  }

  async getAuditLog(): Promise<ActionAuditEvent[]> {
    return this.store.getAuditLog();
  }

  getStore(): ActionStore {
    return this.store;
  }
}
