import {
  HandsOrgan,
  ToolDefinition,
  ActionIntent,
  ActionExecutionResult,
  AuthorizationCapability,
  ToolExecutionOptions,
  ActionLifecycleState,
  ActionStore,
  InMemoryActionStore,
  verifyCapabilitySignature,
  computeParametersHash,
} from '@siduri-y/core';
import { validateInputSchema } from './schema-validator';

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (parameters: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}

export interface MCPProviderConfig {
  serverName: string;
  baseUrl?: string;
  command?: string;
  args?: string[];
  tools?: ToolHandler[];
  defaultTimeoutMs?: number;
}

export interface DefaultHandsOrganConfig {
  providers?: MCPProviderConfig[];
  defaultTimeoutMs?: number;
  store?: ActionStore;
  secretKey?: string;
}

export class DefaultHandsOrgan implements HandsOrgan {
  private readonly toolRegistry = new Map<string, ToolHandler>();
  private readonly providerTools = new Map<string, ToolHandler>();
  private readonly defaultTimeoutMs: number;
  private readonly store: ActionStore;
  private readonly secretKey: string;

  constructor(private readonly config: DefaultHandsOrganConfig = {}) {
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 10_000;
    this.store = config.store ?? new InMemoryActionStore();

    const envSecret = typeof process !== 'undefined' && process.env ? process.env.ACTION_POLICY_SECRET : undefined;
    const providedSecret = config.secretKey || envSecret;

    if (!providedSecret && typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      throw new Error('FATAL: ACTION_POLICY_SECRET is required in production environment');
    }

    this.secretKey = providedSecret ?? 'siduri_y_action_policy_secret';

    if (config.providers) {
      for (const provider of config.providers) {
        if (provider.tools) {
          for (const tool of provider.tools) {
            this.registerTool(tool, provider.serverName);
          }
        }
      }
    }
  }

  registerTool(handler: ToolHandler, providerId?: string): void {
    const effectiveProvider = providerId || handler.definition.providerId || 'builtin';
    const toolName = handler.definition.name;
    const qualifiedName = `${effectiveProvider}/${toolName}`;

    this.providerTools.set(qualifiedName, handler);
    this.toolRegistry.set(qualifiedName, handler);

    if (!this.toolRegistry.has(toolName)) {
      this.toolRegistry.set(toolName, handler);
    } else {
      const existing = this.toolRegistry.get(toolName);
      if (existing && existing !== handler) {
        this.toolRegistry.delete(toolName);
      }
    }
  }

  unregisterTool(toolIdentifier: string): boolean {
    const deleted1 = this.toolRegistry.delete(toolIdentifier);
    const deleted2 = this.providerTools.delete(toolIdentifier);
    return deleted1 || deleted2;
  }

  async listTools(): Promise<ToolDefinition[]> {
    return Array.from(this.providerTools.values()).map((handler) => handler.definition);
  }

  findHandler(toolIdentifier: string): ToolHandler | undefined {
    return this.toolRegistry.get(toolIdentifier) || this.providerTools.get(toolIdentifier);
  }

  async executeAction(
    action: ActionIntent,
    authorization: AuthorizationCapability,
    options?: ToolExecutionOptions
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    const actionId = action?.actionId || 'unknown';
    const toolName = action?.toolName || 'unknown';

    // 1. Mandatory Authorization Capability Verification
    if (!authorization) {
      return {
        actionId,
        executionId: 'unauthorized',
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: 'Execution rejected: Missing mandatory AuthorizationCapability from policy engine',
        durationMs: Date.now() - startTime,
      };
    }

    if (authorization.allowed !== true) {
      return {
        actionId,
        executionId: authorization.executionId || 'unauthorized',
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: 'Execution rejected: AuthorizationCapability is not allowed',
        durationMs: Date.now() - startTime,
      };
    }

    // Cryptographic Signature check
    const isSignatureValid = verifyCapabilitySignature(authorization, this.secretKey);
    if (!isSignatureValid) {
      return {
        actionId,
        executionId: authorization.executionId || 'invalid_sig',
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: 'Execution rejected: Invalid or forged AuthorizationCapability signature',
        durationMs: Date.now() - startTime,
      };
    }

    // Expiry check
    if (authorization.expiresAt && new Date(authorization.expiresAt).getTime() <= Date.now()) {
      return {
        actionId,
        executionId: authorization.executionId,
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: 'Execution rejected: AuthorizationCapability has expired',
        durationMs: Date.now() - startTime,
      };
    }

    // Structural binding verification
    if (authorization.actionId !== action.actionId) {
      return {
        actionId,
        executionId: authorization.executionId,
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: `Execution rejected: ActionId mismatch (authorized: "${authorization.actionId}", action: "${action.actionId}")`,
        durationMs: Date.now() - startTime,
      };
    }

    if (authorization.toolName !== action.toolName) {
      return {
        actionId,
        executionId: authorization.executionId,
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: `Execution rejected: ToolName mismatch (authorized: "${authorization.toolName}", action: "${action.toolName}")`,
        durationMs: Date.now() - startTime,
      };
    }

    const currentParamsHash = computeParametersHash(action.parameters);
    if (authorization.parametersHash !== currentParamsHash) {
      return {
        actionId,
        executionId: authorization.executionId,
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: 'Execution rejected: Parameters hash mismatch between intent and authorization',
        durationMs: Date.now() - startTime,
      };
    }

    const executionId = authorization.executionId;

    // 2. Concurrency-Safe Persistent Idempotency Reservation
    const existingExecution = await this.store.getExecution(executionId);
    if (existingExecution) {
      if (existingExecution.lifecycle === 'COMPLETED') {
        return {
          actionId,
          executionId,
          toolName,
          lifecycle: 'COMPLETED',
          success: true,
          result: existingExecution.result,
          durationMs: Date.now() - startTime,
        };
      } else if (existingExecution.lifecycle === 'EXECUTING') {
        return {
          actionId,
          executionId,
          toolName,
          lifecycle: 'FAILED',
          success: false,
          error: 'Concurrent execution already in progress for this executionId',
          durationMs: Date.now() - startTime,
        };
      }
    }

    const reservationSuccess = await this.store.reserveExecution({
      executionId,
      actionId,
      toolName,
      providerId: authorization.providerId,
      parametersHash: currentParamsHash,
      lifecycle: 'EXECUTING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (!reservationSuccess) {
      return {
        actionId,
        executionId,
        toolName,
        lifecycle: 'FAILED',
        success: false,
        error: 'Concurrent execution reservation conflict for executionId',
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Tool Lookup
    const handler = this.findHandler(action.toolName);
    if (!handler) {
      const notFoundResult: ActionExecutionResult = {
        actionId,
        executionId,
        toolName,
        lifecycle: 'FAILED',
        success: false,
        error: `Tool "${action.toolName}" is not registered in Hands organ`,
        durationMs: Date.now() - startTime,
      };
      await this.store.updateExecution({
        executionId,
        actionId,
        toolName,
        providerId: authorization.providerId,
        parametersHash: currentParamsHash,
        lifecycle: 'FAILED',
        error: notFoundResult.error,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return notFoundResult;
    }

    // 4. Recursive Input Schema Validation
    const schemaValidation = validateInputSchema(handler.definition.inputSchema, action.parameters);
    if (!schemaValidation.valid) {
      const validationFailedResult: ActionExecutionResult = {
        actionId,
        executionId,
        toolName,
        lifecycle: 'REJECTED',
        success: false,
        error: `Parameter schema validation failed: ${schemaValidation.errors.join('; ')}`,
        durationMs: Date.now() - startTime,
      };
      await this.store.updateExecution({
        executionId,
        actionId,
        toolName,
        providerId: authorization.providerId,
        parametersHash: currentParamsHash,
        lifecycle: 'REJECTED',
        error: validationFailedResult.error,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return validationFailedResult;
    }

    // 5. Execution with Timeout and Cancellation
    const timeoutMs = options?.timeoutMs || handler.definition.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const effectiveSignal = options?.signal || controller.signal;

    let timeoutHandle: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        const err = new Error(`Tool execution timed out after ${timeoutMs}ms`);
        (err as any).isTimeout = true;
        reject(err);
      }, timeoutMs);
    });

    try {
      const executionPromise = handler.execute(action.parameters, effectiveSignal);
      const result = await Promise.race([executionPromise, timeoutPromise]);
      clearTimeout(timeoutHandle);

      const completedResult: ActionExecutionResult = {
        actionId,
        executionId,
        toolName,
        lifecycle: 'COMPLETED',
        success: true,
        result,
        durationMs: Date.now() - startTime,
      };

      await this.store.updateExecution({
        executionId,
        actionId,
        toolName,
        providerId: authorization.providerId,
        parametersHash: currentParamsHash,
        lifecycle: 'COMPLETED',
        result,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return completedResult;
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      const isTimeout = err?.isTimeout || err?.name === 'AbortError' || err?.message?.includes('timed out');
      const lifecycleState: ActionLifecycleState = isTimeout
        ? 'TIMED_OUT'
        : effectiveSignal.aborted
        ? 'CANCELLED'
        : 'FAILED';

      const failedResult: ActionExecutionResult = {
        actionId,
        executionId,
        toolName,
        lifecycle: lifecycleState,
        success: false,
        error: err?.message || 'Tool execution failed',
        durationMs: Date.now() - startTime,
      };

      await this.store.updateExecution({
        executionId,
        actionId,
        toolName,
        providerId: authorization.providerId,
        parametersHash: currentParamsHash,
        lifecycle: lifecycleState,
        error: failedResult.error,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return failedResult;
    }
  }
}

export function probeHandsHealth(context: { config?: any; env?: Record<string, string | undefined> }): { ok: boolean; message?: string } {
  const secret = context?.config?.secretKey || (context?.env !== undefined ? context.env.ACTION_POLICY_SECRET : process.env.ACTION_POLICY_SECRET);
  if (!secret && process.env.NODE_ENV === 'production') {
    return {
      ok: false,
      message: 'Missing ACTION_POLICY_SECRET in production environment.',
    };
  }
  return { ok: true, message: 'Hands organ configured and operational' };
}

export * from './schema-validator';


