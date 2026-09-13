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
 * - Security is enforced at the external machine boundary, NOT internally between roles.
 * - No internal audience or viewer/operator/owner role hierarchies.
 * - Authenticated callers are the single owner with full companion access.
 * - Unauthenticated callers are bounded to public chat.
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
    const correlationId =
      rawCtx.conversation?.correlationId ||
      input.correlationId ||
      (input.generateCorrelationId ? `corr-${Date.now()}` : undefined);

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

    const isViewerRequested =
      (typeof input.role === 'string' && input.role.toLowerCase() === 'viewer') ||
      (typeof input.serverRole === 'string' && input.serverRole.toLowerCase() === 'viewer') ||
      (typeof actor.authorizationRole === 'string' && actor.authorizationRole.toLowerCase() === 'viewer') ||
      (typeof (actor as any).role === 'string' && (actor as any).role.toLowerCase() === 'viewer');

    // Determine server-enforced authentication status at the machine boundary
    const isAuthenticated = input.authenticated !== undefined
      ? Boolean(input.authenticated)
      : (actor.authenticated !== undefined ? Boolean(actor.authenticated) : true);

    const isViewer = !isAuthenticated || isViewerRequested;

    const CANONICAL_CAPABILITIES = new Set(['chat', 'memory:approve', 'action:execute', 'system']);
    const DEFAULT_OWNER_CAPABILITIES = ['chat', 'memory:approve', 'action:execute', 'system'];

    let safeCapabilities: string[];
    let authorizationRole: string;

    if (isViewer) {
      safeCapabilities = ['chat'];
      authorizationRole = 'viewer';
      if (Array.isArray(actor.capabilities) && actor.capabilities.some((c: string) => c !== 'chat' && c !== 'chat:public')) {
        diagnostics.push('capability_escalation_attempt_suppressed');
      }
      if (actor.authorizationRole && actor.authorizationRole.toLowerCase() !== 'viewer') {
        diagnostics.push('role_escalation_attempt_suppressed');
      }
    } else {
      authorizationRole = 'administrator';
      if (Array.isArray(actor.capabilities) && actor.capabilities.length > 0) {
        const filtered = actor.capabilities.filter((c: string) => CANONICAL_CAPABILITIES.has(c));
        if (filtered.length < actor.capabilities.length) {
          diagnostics.push('capability_escalation_attempt_suppressed');
        }
        safeCapabilities = filtered.length > 0 ? filtered : [...DEFAULT_OWNER_CAPABILITIES];
      } else {
        safeCapabilities = [...DEFAULT_OWNER_CAPABILITIES];
      }
    }

    const constructed: RequestContext = {
      companionId,
      actor: {
        ...actor,
        actorId: actor.actorId,
        sessionId: actor.sessionId,
        capabilities: safeCapabilities,
        authenticated: isAuthenticated,
        authorizationRole,
      },
      conversation: {
        correlationId,
        channel: rawCtx.conversation?.channel || input.channel || 'direct',
        isLive: rawCtx.conversation?.isLive,
        ...rawCtx.conversation,
      },
      source: input.source || rawCtx.source || (isAuthenticated ? 'local' : 'external'),
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

  const isViewerRequested =
    (typeof input.role === 'string' && input.role.toLowerCase() === 'viewer') ||
    (typeof input.serverRole === 'string' && input.serverRole.toLowerCase() === 'viewer');

  const isAuthenticated = input.authenticated !== undefined ? Boolean(input.authenticated) : true;
  const isViewer = !isAuthenticated || isViewerRequested;

  const actorId = input.actorId || input.actor?.actorId || (isAuthenticated && !isViewer ? 'local-user' : 'anonymous-session');
  const sessionId = input.sessionId || input.actor?.sessionId || `session-${Date.now()}`;
  if (!input.actorId && !input.actor?.actorId) {
    diagnostics.push('anonymous_session_generated');
  }

  const CANONICAL_CAPABILITIES = new Set(['chat', 'memory:approve', 'action:execute', 'system']);
  const DEFAULT_OWNER_CAPABILITIES = ['chat', 'memory:approve', 'action:execute', 'system'];

  const rawCaps = Array.isArray(input.capabilities)
    ? input.capabilities
    : Array.isArray(input.actor?.capabilities)
    ? input.actor.capabilities
    : undefined;

  let capabilities: string[];
  let authorizationRole: string;

  if (isViewer) {
    capabilities = ['chat'];
    authorizationRole = 'viewer';
    if (rawCaps && rawCaps.some((c: string) => c !== 'chat' && c !== 'chat:public')) {
      diagnostics.push('capability_escalation_attempt_suppressed');
    }
    if (input.role && input.role.toLowerCase() !== 'viewer') {
      diagnostics.push('role_escalation_attempt_suppressed');
    }
  } else {
    authorizationRole = 'administrator';
    if (rawCaps && rawCaps.length > 0) {
      const filtered = rawCaps.filter((c: string) => CANONICAL_CAPABILITIES.has(c));
      if (filtered.length < rawCaps.length) {
        diagnostics.push('capability_escalation_attempt_suppressed');
      }
      capabilities = filtered.length > 0 ? filtered : [...DEFAULT_OWNER_CAPABILITIES];
    } else {
      capabilities = [...DEFAULT_OWNER_CAPABILITIES];
    }
  }

  const mappedContext: RequestContext = {
    companionId,
    actor: {
      actorId,
      sessionId,
      capabilities,
      authenticated: isAuthenticated,
      authorizationRole,
    },
    conversation: {
      channel: input.channel || input.conversation?.channel || 'direct',
      correlationId,
    },
    source: input.source || (isAuthenticated ? 'local' : 'external'),
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
