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
  computeParametersHash,
  canonicalizeJson,
  signCapabilityPayload,
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
}

export interface ApproveActionOptions {
  executionId: string;
  approverActorId: string;
  reason?: string;
}

export class ActionPolicyEngine {
  private readonly toolRegistry = new Map<string, ToolDefinition>();
  private readonly rules: ActionPolicyRule[] = [];
  private readonly store: ActionStore;
  private readonly defaultRiskLevel: ActionRiskLevel;
  private readonly defaultRequireApprovalForHighRisk: boolean;
  private readonly secretKey: string;
  private readonly approvedExecutions = new Set<string>();

  constructor(options: ActionPolicyEngineOptions = {}) {
    this.rules = options.rules ?? [];
    this.defaultRiskLevel = options.defaultRiskLevel ?? 'HIGH';
    this.defaultRequireApprovalForHighRisk = options.defaultRequireApprovalForHighRisk ?? true;
    this.store = options.store ?? new InMemoryActionStore();

    const envSecret = typeof process !== 'undefined' && process.env ? process.env.ACTION_POLICY_SECRET : undefined;
    const providedSecret = options.secretKey || envSecret;

    if (!providedSecret && typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      throw new Error('FATAL: ACTION_POLICY_SECRET is required in production environment');
    }

    this.secretKey = providedSecret ?? 'siduri_y_action_policy_secret';
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

    // Role check if tool restricts roles
    if (toolDef.allowedRoles && toolDef.allowedRoles.length > 0) {
      const actorRole = effectiveContext.actor.authorizationRole;
      if (!toolDef.allowedRoles.includes(actorRole)) {
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
      const channel = effectiveContext.conversation.channel;
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

    if (requiresExplicitApproval && !this.approvedExecutions.has(executionId)) {
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

  approveAction(options: ApproveActionOptions): boolean {
    this.approvedExecutions.add(options.executionId);
    return true;
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
