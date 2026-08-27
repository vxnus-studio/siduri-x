import { RequestContext } from './context';

export type ActionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActionLifecycleState =
  | 'PROPOSED'
  | 'VALIDATED'
  | 'POLICY_CHECKED'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface ActionIntent {
  actionId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  description?: string;
  context?: RequestContext;
  executionId?: string;
}

export interface ActionPolicyDecision {
  allowed: boolean;
  reason: string;
  riskLevel: ActionRiskLevel;
  requiredCapabilities?: string[];
  executionId: string;
  decisionCode:
    | 'ALLOWED_AUTO'
    | 'ALLOWED_POLICY'
    | 'REJECTED_UNKNOWN_TOOL'
    | 'REJECTED_UNAUTHORIZED'
    | 'REJECTED_MISSING_CAPABILITY'
    | 'REJECTED_HIGH_RISK_UNAPPROVED'
    | 'REJECTED_CHANNEL_RESTRICTED'
    | 'REJECTED_COMPANION_MISMATCH'
    | 'REJECTED_POLICY';
}

export interface ActionAuditEvent {
  executionId: string;
  actionId: string;
  toolName: string;
  providerId?: string;
  companionId: string;
  actorId?: string;
  sessionId?: string;
  channel?: string;
  correlationId?: string;
  riskLevel: ActionRiskLevel;
  lifecycle: ActionLifecycleState;
  decision?: ActionPolicyDecision;
  parametersHash?: string;
  resultHash?: string;
  timestamp: string;
  durationMs?: number;
  error?: string;
}

export interface ActionExecutionResult {
  actionId: string;
  executionId: string;
  toolName: string;
  lifecycle: ActionLifecycleState;
  success: boolean;
  result?: unknown;
  error?: string;
  decision?: ActionPolicyDecision;
  durationMs?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  providerId?: string;
  riskLevel?: ActionRiskLevel;
  requiredCapabilities?: string[];
  allowedRoles?: string[];
  allowedChannels?: string[];
  timeoutMs?: number;
  requiresApproval?: boolean;
}

export interface ToolExecutionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface HandsOrgan {
  listTools(): Promise<ToolDefinition[]>;
  executeAction(
    action: ActionIntent,
    authorization: any, // AuthorizationCapability required
    options?: ToolExecutionOptions
  ): Promise<ActionExecutionResult>;
}
