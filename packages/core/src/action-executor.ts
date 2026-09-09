import {
  ActionIntent,
  ActionExecutionResult,
  ActionPolicyEngine,
  HandsOrgan,
  RequestContext,
} from './index';

export interface ActionExecutionParams {
  actionIntents?: ActionIntent[];
  requestContext: RequestContext;
  actionPolicy: ActionPolicyEngine;
  hands?: HandsOrgan;
}

/**
 * Executes proposed actions under the primary security invariant:
 * "Brain proposes; the policy layer authorizes; Hands executes; the audit layer records."
 */
export async function executeActionIntents(
  params: ActionExecutionParams
): Promise<ActionExecutionResult[]> {
  const { actionIntents, requestContext, actionPolicy, hands } = params;

  const actionResults: ActionExecutionResult[] = [];
  if (
    !hands ||
    !actionIntents ||
    actionIntents.length === 0 ||
    typeof hands.executeAction !== 'function'
  ) {
    return actionResults;
  }

  for (const rawAction of actionIntents) {
    // 1. Context Propagation: Attach request provenance to ActionIntent
    const actionWithContext: ActionIntent = {
      ...rawAction,
      context: requestContext,
      executionId:
        rawAction.executionId ||
        `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    // 2. Action Policy Authorization Boundary Check
    const { decision, capability } = await actionPolicy.evaluateAction(
      actionWithContext,
      requestContext
    );

    if (!decision.allowed || !capability) {
      // Action was rejected by policy
      actionResults.push({
        actionId: actionWithContext.actionId,
        executionId: decision.executionId,
        toolName: actionWithContext.toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: `Action authorization rejected by policy: ${decision.reason}`,
        decision,
      });
      continue;
    }

    // 3. Hands Execution (only authorized actions execute with AuthorizationCapability)
    const res = await hands.executeAction(actionWithContext, capability);
    actionResults.push({
      ...res,
      decision,
    });

    // 4. Audit recording for execution outcome
    await actionPolicy.recordAudit(
      actionWithContext,
      requestContext,
      decision,
      res.lifecycle,
      res.result,
      res.error,
      res.durationMs
    );
  }

  return actionResults;
}
