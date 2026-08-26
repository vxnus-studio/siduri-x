import {
  RequestContext,
  AuthorizationRole,
  Channel,
  DiagnosticCode,
  ContextError,
  validateRequestContext,
} from '@siduri-y/core';

export interface ContextMapperOptions {
  endpointPolicy?: 'public' | 'private' | 'operator' | 'direct';
  defaultPublicAudience?: string;
  defaultPrivateAudience?: string;
  defaultOperatorAudience?: string;
  allowAnonymousPublicChat?: boolean;
}

export interface MapRequestContextResult {
  accepted: boolean;
  context?: RequestContext;
  diagnostics?: DiagnosticCode[];
  error?: ContextError;
}

export function mapRequestContext(
  input: any,
  options: ContextMapperOptions = {}
): MapRequestContextResult {
  const diagnostics: DiagnosticCode[] = [];
  const endpointPolicy = options.endpointPolicy || 'public';
  const defaultPublicAudience = options.defaultPublicAudience || 'audience-public';

  if (!input || typeof input !== 'object') {
    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: ['request'],
      },
    };
  }

  // Check for legacy MASTER_PRIVATE in any audience field or request
  const rawAudience =
    input?.context?.conversation?.audienceId ??
    input?.conversation?.audienceId ??
    input?.audienceId ??
    input?.audience;

  if (rawAudience === 'MASTER_PRIVATE' || input?.scope === 'MASTER_PRIVATE') {
    if (endpointPolicy === 'public' || input?.channel === 'public' || input?.context?.conversation?.channel === 'public') {
      return {
        accepted: false,
        error: {
          code: 'LEGACY_PERSONAL_AUDIENCE',
          field: 'audienceId',
          correlationId: input?.context?.conversation?.correlationId || input?.correlationId,
        },
      };
    }
  }

  // 1. If incoming input already has a full neutral context structure
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

    // Role cannot select audience or subject
    const rawRole = input.role || rawCtx.actor?.authorizationRole;
    if (input.role && !rawCtx.conversation?.channel && !rawCtx.conversation?.audienceId) {
      return {
        accepted: false,
        error: {
          code: 'AMBIGUOUS_CONTEXT',
          conflicts: ['role_does_not_select_audience', 'role_does_not_select_subject'],
          correlationId,
        },
      };
    }

    const channel: Channel = rawCtx.conversation?.channel || (endpointPolicy as Channel);
    let audienceId: string | undefined = rawCtx.conversation?.audienceId;

    if (!audienceId) {
      if (channel === 'public' || endpointPolicy === 'public') {
        audienceId = defaultPublicAudience;
        diagnostics.push('audience_defaulted_by_public_policy');
      } else {
        return {
          accepted: false,
          error: {
            code: 'MISSING_CONTEXT',
            fields: ['conversation.audienceId'],
            correlationId,
          },
        };
      }
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

    // Check required capabilities for private/operator/direct channels
    const capabilities: string[] = Array.isArray(actor.capabilities) ? actor.capabilities : [];
    if (channel === 'private' && !capabilities.includes('chat:private')) {
      return {
        accepted: false,
        error: {
          code: 'UNAUTHORIZED_CHANNEL_OR_CAPABILITY',
          message: 'Private channel requires explicit chat:private capability',
          fields: ['actor.capabilities'],
          correlationId,
        },
      };
    }
    if (channel === 'operator' && !capabilities.includes('memory:inspect') && !capabilities.includes('operator:access')) {
      return {
        accepted: false,
        error: {
          code: 'UNAUTHORIZED_CHANNEL_OR_CAPABILITY',
          message: 'Operator channel requires explicit operator capability',
          fields: ['actor.capabilities'],
          correlationId,
        },
      };
    }

    // Check subject policy
    let subject = rawCtx.subject;
    if (subject) {
      if (subject.subjectId === 'primary_user' || subject === 'primary_user') {
        // Global primary_user is rejected or quarantined
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
    }

    const constructed: RequestContext = {
      companionId,
      actor: {
        actorId: actor.actorId,
        sessionId: actor.sessionId,
        authorizationRole: actor.authorizationRole,
        capabilities,
        authenticated: Boolean(actor.authenticated),
      },
      conversation: {
        channel,
        audienceId,
        isLive: rawCtx.conversation?.isLive,
        correlationId,
      },
      subject,
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

  // 2. Legacy compatibility envelope mapping
  const companionId = input.companionId || input.id;
  const correlationId = input.correlationId || input.conversation?.correlationId;

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

  // Map legacy role to authorizationRole
  const legacyRole = input.role?.toString().toUpperCase();
  let authRole: AuthorizationRole = 'viewer';
  if (legacyRole === 'OWNER') {
    authRole = 'administrator';
    diagnostics.push('legacy_role_mapped_to_authorization');
  } else if (legacyRole === 'OPERATOR') {
    authRole = 'operator';
    diagnostics.push('legacy_role_mapped_to_authorization');
  } else if (legacyRole === 'VIEWER') {
    authRole = 'viewer';
    diagnostics.push('legacy_role_mapped_to_authorization');
  } else if (input.role) {
    return {
      accepted: false,
      error: {
        code: 'INVALID_CONTEXT',
        field: 'role',
        correlationId,
      },
    };
  }

  // Check endpoint policy vs legacy request
  if (endpointPolicy === 'private' || endpointPolicy === 'operator' || endpointPolicy === 'direct') {
    // Missing explicit channel, audience, or capability on private/operator endpoint is an error
    const fields: string[] = [];
    if (!input.channel) fields.push('conversation.channel');
    if (!input.audienceId) fields.push('conversation.audienceId');
    if (!input.capabilities && !input.actor?.capabilities) fields.push('actor.capabilities');
    if (!correlationId) fields.push('conversation.correlationId');

    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: fields.length > 0 ? fields : ['conversation.audienceId', 'actor.capabilities'],
        correlationId,
      },
    };
  }

  // Ambiguity check: if legacy input specifies role without correlationId or endpoint context for stateful op
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

  // Missing correlationId for stateful requests
  const finalCorrelationId = correlationId || (input.generateCorrelationId ? `corr-${Date.now()}` : undefined);
  if (!finalCorrelationId) {
    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: ['conversation.correlationId'],
      },
    };
  }

  // Build anonymous public context
  const actorId = input.actorId || input.actor?.actorId || 'anonymous-session-a';
  const sessionId = input.sessionId || input.actor?.sessionId || 'session-a';
  if (!input.actorId && !input.actor?.actorId) {
    diagnostics.push('anonymous_session_generated');
  }

  const channel: Channel = 'public';
  const audienceId = defaultPublicAudience;
  diagnostics.push('audience_defaulted_by_public_policy');

  const capabilities = authRole === 'administrator'
    ? ['chat:public', 'admin:access']
    : authRole === 'operator'
    ? ['chat:public', 'operator:access']
    : ['chat:public'];

  const mappedContext: RequestContext = {
    companionId,
    actor: {
      actorId,
      sessionId,
      authorizationRole: authRole,
      capabilities,
      authenticated: Boolean(input.authenticated),
    },
    conversation: {
      channel,
      audienceId,
      correlationId: finalCorrelationId,
    },
    subject: undefined, // Anonymous public chat has no subject
  };

  return {
    accepted: true,
    context: mappedContext,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  };
}
