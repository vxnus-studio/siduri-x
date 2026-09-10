import {
  RequestContext,
  DiagnosticCode,
  ContextError,
  validateRequestContext,
} from '@siduri-x/core';

export interface ContextMapperOptions {
  endpointPolicy?: 'public' | 'private' | 'operator' | 'direct' | string;
  allowAnonymousPublicChat?: boolean;
}

export interface MapRequestContextResult {
  accepted: boolean;
  context?: RequestContext;
  diagnostics?: DiagnosticCode[];
  error?: ContextError;
}

/**
 * Maps incoming HTTP requests to a canonical RequestContext.
 * In a single-owner, single-machine model:
 * - Security is enforced at the external boundary, not internally between roles.
 * - No internal audience or viewer/operator/owner role hierarchies.
 */
export function mapRequestContext(
  input: any,
  options: ContextMapperOptions = {}
): MapRequestContextResult {
  const diagnostics: DiagnosticCode[] = [];

  if (!input || typeof input !== 'object') {
    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: ['request'],
      },
    };
  }

  // 1. If incoming input already has a context structure
  if (input.context && typeof input.context === 'object') {
    const rawCtx = input.context;
    const companionId = input.companionId || rawCtx.companionId || input.id;
    const correlationId = rawCtx.conversation?.correlationId || input.correlationId;

    if (!companionId) {
      return {
        accepted: false,
        error: {
          code: 'MISSING_CONTEXT',
          fields: ['companionId'],
          correlationId,
        },
      };
    }

    const actor = rawCtx.actor;
    if (!actor || typeof actor !== 'object') {
      return {
        accepted: false,
        error: {
          code: 'MISSING_CONTEXT',
          fields: ['actor'],
          correlationId,
        },
      };
    }

    // Reject invalid primary_user subject
    if (rawCtx.subject && (rawCtx.subject.subjectId === 'primary_user' || rawCtx.subject === 'primary_user')) {
      return {
        accepted: false,
        error: {
          code: 'FORBIDDEN_CONTEXT',
          message: 'Global primary_user subject is forbidden',
          field: 'subject.subjectId',
          correlationId,
        },
      };
    }

    const constructed: RequestContext = {
      companionId,
      actor: {
        actorId: actor.actorId,
        sessionId: actor.sessionId,
        capabilities: Array.isArray(actor.capabilities) ? actor.capabilities : ['chat'],
        authenticated: actor.authenticated !== undefined ? Boolean(actor.authenticated) : true,
        authorizationRole: actor.authorizationRole,
        ...actor,
      },
      conversation: {
        correlationId,
        channel: rawCtx.conversation?.channel || input.channel || 'direct',
        isLive: rawCtx.conversation?.isLive,
        ...rawCtx.conversation,
      },
      source: input.source || rawCtx.source || 'local',
      subject: rawCtx.subject,
    };

    const validated = validateRequestContext(constructed);
    if (!validated.accepted) {
      return validated;
    }

    return {
      accepted: true,
      context: validated.context,
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
    };
  }

  // 2. Synthesize clean RequestContext from request envelope
  const companionId = input.companionId || input.id;
  const correlationId = input.correlationId || input.conversation?.correlationId || (input.generateCorrelationId ? `corr-${Date.now()}` : undefined);

  if (!companionId) {
    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: ['companionId'],
        correlationId,
      },
    };
  }

  if (companionId === 'default') {
    diagnostics.push('companion_default_mapped_for_bootstrap');
  }

  if (!correlationId) {
    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: ['conversation.correlationId'],
      },
    };
  }

  if (input.subject === 'primary_user' || input.subjectId === 'primary_user') {
    return {
      accepted: false,
      error: {
        code: 'FORBIDDEN_CONTEXT',
        message: 'Global primary_user subject is forbidden',
        field: 'subject',
        correlationId,
      },
    };
  }

  const actorId = input.actorId || input.actor?.actorId || 'local-user';
  const sessionId = input.sessionId || input.actor?.sessionId || `session-${Date.now()}`;
  if (!input.actorId && !input.actor?.actorId) {
    diagnostics.push('anonymous_session_generated');
  }

  const capabilities = Array.isArray(input.capabilities)
    ? input.capabilities
    : Array.isArray(input.actor?.capabilities)
    ? input.actor.capabilities
    : ['chat', 'system'];

  const mappedContext: RequestContext = {
    companionId,
    actor: {
      actorId,
      sessionId,
      capabilities,
      authenticated: input.authenticated !== undefined ? Boolean(input.authenticated) : true,
      authorizationRole: input.role ? (input.role.toLowerCase() === 'viewer' ? 'viewer' : 'administrator') : undefined,
    },
    conversation: {
      channel: input.channel || input.conversation?.channel || 'direct',
      correlationId,
    },
    source: input.source || 'local',
    subject: input.subject,
  };

  const validated = validateRequestContext(mappedContext);
  if (!validated.accepted) {
    return validated;
  }

  return {
    accepted: true,
    context: validated.context,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  };
}
