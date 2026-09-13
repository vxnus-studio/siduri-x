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

export type CanonicalRole = 'administrator' | 'operator' | 'viewer';

export const ROLE_CAPABILITIES: Record<CanonicalRole, string[]> = {
  administrator: ['chat', 'memory:approve', 'action:execute', 'system'],
  operator: ['chat', 'action:execute'],
  viewer: ['chat'],
};

const ROLE_RANK: Record<CanonicalRole, number> = {
  administrator: 3,
  operator: 2,
  viewer: 1,
};

export function normalizeRoleCeiling(role?: string): CanonicalRole {
  if (!role) return 'viewer';
  const r = role.toLowerCase().trim();
  if (r === 'owner' || r === 'administrator' || r === 'admin') return 'administrator';
  if (r === 'operator') return 'operator';
  return 'viewer';
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
    // Determine server-enforced authentication status
    const isAuthenticated = input.authenticated !== undefined
      ? Boolean(input.authenticated)
      : (actor.authenticated !== undefined ? Boolean(actor.authenticated) : true);

    const serverRoleRaw = input.serverRole || (input.authenticated === false ? 'VIEWER' : undefined);
    let ceiling: CanonicalRole;
    if (!isAuthenticated) {
      ceiling = 'viewer';
    } else if (serverRoleRaw) {
      const sCeiling = normalizeRoleCeiling(serverRoleRaw);
      const rCeiling = input.role ? normalizeRoleCeiling(input.role) : sCeiling;
      ceiling = ROLE_RANK[rCeiling] < ROLE_RANK[sCeiling] ? rCeiling : sCeiling;
    } else if (input.role) {
      ceiling = normalizeRoleCeiling(input.role);
    } else {
      ceiling = 'administrator';
    }

    let effectiveRole: CanonicalRole;

    if (!isAuthenticated) {
      effectiveRole = 'viewer';
      if (actor.authorizationRole && normalizeRoleCeiling(actor.authorizationRole) !== 'viewer') {
        diagnostics.push('role_escalation_attempt_suppressed');
      }
    } else {
      const requestedRole = actor.authorizationRole ? normalizeRoleCeiling(actor.authorizationRole) : ceiling;
      if (ROLE_RANK[requestedRole] > ROLE_RANK[ceiling]) {
        effectiveRole = ceiling;
        diagnostics.push('role_escalation_attempt_suppressed');
      } else {
        effectiveRole = requestedRole;
      }
    }

    let safeCapabilities: string[];
    const allowedCaps = new Set(ROLE_CAPABILITIES[effectiveRole]);

    if (!isAuthenticated || effectiveRole === 'viewer') {
      safeCapabilities = ['chat'];
      if (Array.isArray(actor.capabilities) && actor.capabilities.some((c: string) => !allowedCaps.has(c))) {
        diagnostics.push('capability_escalation_attempt_suppressed');
      }
    } else if (Array.isArray(actor.capabilities) && actor.capabilities.length > 0) {
      const filtered = actor.capabilities.filter((c: string) => allowedCaps.has(c));
      if (filtered.length < actor.capabilities.length) {
        diagnostics.push('capability_escalation_attempt_suppressed');
      }
      safeCapabilities = filtered.length > 0 ? filtered : [...ROLE_CAPABILITIES[effectiveRole]];
    } else {
      safeCapabilities = [...ROLE_CAPABILITIES[effectiveRole]];
    }

    const constructed: RequestContext = {
      companionId,
      actor: {
        ...actor,
        actorId: actor.actorId,
        sessionId: actor.sessionId,
        capabilities: safeCapabilities,
        authenticated: isAuthenticated,
        authorizationRole: effectiveRole,
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

  const isAuthenticated = input.authenticated !== undefined ? Boolean(input.authenticated) : true;
  const actorId = input.actorId || input.actor?.actorId || (isAuthenticated ? 'local-user' : 'anonymous-session');
  const sessionId = input.sessionId || input.actor?.sessionId || `session-${Date.now()}`;
  if (!input.actorId && !input.actor?.actorId) {
    diagnostics.push('anonymous_session_generated');
  }

  const serverRoleRaw = input.serverRole || (input.authenticated === false ? 'VIEWER' : undefined);
  let ceiling: CanonicalRole;
  if (!isAuthenticated) {
    ceiling = 'viewer';
  } else if (serverRoleRaw) {
    const sCeiling = normalizeRoleCeiling(serverRoleRaw);
    const rCeiling = input.role ? normalizeRoleCeiling(input.role) : sCeiling;
    ceiling = ROLE_RANK[rCeiling] < ROLE_RANK[sCeiling] ? rCeiling : sCeiling;
  } else if (input.role) {
    ceiling = normalizeRoleCeiling(input.role);
  } else {
    ceiling = 'administrator';
  }

  let effectiveRole: CanonicalRole;
  if (!isAuthenticated) {
    effectiveRole = 'viewer';
    if (input.role && normalizeRoleCeiling(input.role) !== 'viewer') {
      diagnostics.push('role_escalation_attempt_suppressed');
    }
  } else {
    const requested = input.role ? normalizeRoleCeiling(input.role) : ceiling;
    if (ROLE_RANK[requested] > ROLE_RANK[ceiling]) {
      effectiveRole = ceiling;
      diagnostics.push('role_escalation_attempt_suppressed');
    } else {
      effectiveRole = requested;
    }
  }

  const allowedCaps = new Set(ROLE_CAPABILITIES[effectiveRole]);
  const rawCaps = Array.isArray(input.capabilities)
    ? input.capabilities
    : Array.isArray(input.actor?.capabilities)
    ? input.actor.capabilities
    : undefined;

  let capabilities: string[];
  if (!isAuthenticated || effectiveRole === 'viewer') {
    capabilities = ['chat'];
    if (rawCaps && rawCaps.some((c: string) => !allowedCaps.has(c))) {
      diagnostics.push('capability_escalation_attempt_suppressed');
    }
  } else if (rawCaps && rawCaps.length > 0) {
    const filtered = rawCaps.filter((c: string) => allowedCaps.has(c));
    if (filtered.length < rawCaps.length) {
      diagnostics.push('capability_escalation_attempt_suppressed');
    }
    capabilities = filtered.length > 0 ? filtered : [...ROLE_CAPABILITIES[effectiveRole]];
  } else {
    capabilities = [...ROLE_CAPABILITIES[effectiveRole]];
  }

  const mappedContext: RequestContext = {
    companionId,
    actor: {
      actorId,
      sessionId,
      capabilities,
      authenticated: isAuthenticated,
      authorizationRole: effectiveRole,
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
