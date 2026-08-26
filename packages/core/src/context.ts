export type AuthorizationRole = 'viewer' | 'operator' | 'administrator';

export type Channel = 'public' | 'direct' | 'private' | 'operator';

export interface ActorContext {
  actorId: string;
  sessionId: string;
  authorizationRole: AuthorizationRole;
  capabilities: string[];
  authenticated: boolean;
}

export interface ConversationContext {
  channel: Channel;
  audienceId: string;
  isLive?: boolean;
  correlationId: string;
}

export type SubjectKind = 'actor' | 'companion' | 'configured';

export interface SubjectRef {
  subjectId: string;
  kind: SubjectKind;
  ownerActorId?: string;
}

export interface RequestContext {
  companionId: string;
  actor: ActorContext;
  conversation: ConversationContext;
  subject?: SubjectRef;
}

export type DiagnosticCode =
  | 'audience_defaulted_by_public_policy'
  | 'legacy_role_mapped_to_authorization'
  | 'anonymous_session_generated'
  | 'companion_default_mapped_for_bootstrap'
  | 'actor_scoped_subject_mapped'
  | 'legacy_primary_user_quarantined';

export type ContextErrorCode =
  | 'MISSING_CONTEXT'
  | 'INVALID_CONTEXT'
  | 'AMBIGUOUS_CONTEXT'
  | 'FORBIDDEN_CONTEXT'
  | 'LEGACY_PERSONAL_AUDIENCE'
  | 'UNAUTHORIZED_CHANNEL_OR_CAPABILITY';

export interface ContextError {
  code: ContextErrorCode;
  message?: string;
  fields?: string[];
  field?: string;
  conflicts?: string[];
  correlationId?: string;
}

export interface RequestContextValidationResult {
  accepted: boolean;
  context?: RequestContext;
  diagnostics?: DiagnosticCode[];
  error?: ContextError;
}

export function isValidAuthorizationRole(role: unknown): role is AuthorizationRole {
  return role === 'viewer' || role === 'operator' || role === 'administrator';
}

export function isValidChannel(channel: unknown): channel is Channel {
  return channel === 'public' || channel === 'direct' || channel === 'private' || channel === 'operator';
}

export function isValidSubjectKind(kind: unknown): kind is SubjectKind {
  return kind === 'actor' || kind === 'companion' || kind === 'configured';
}

export function validateRequestContext(context: unknown): RequestContextValidationResult {
  if (!context || typeof context !== 'object') {
    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: ['context'],
      },
    };
  }

  const ctx = context as Partial<RequestContext>;
  const missingFields: string[] = [];

  if (!ctx.companionId || typeof ctx.companionId !== 'string' || ctx.companionId.trim() === '') {
    missingFields.push('companionId');
  }

  if (!ctx.actor || typeof ctx.actor !== 'object') {
    missingFields.push('actor');
  } else {
    if (!ctx.actor.actorId || typeof ctx.actor.actorId !== 'string' || ctx.actor.actorId.trim() === '') {
      missingFields.push('actor.actorId');
    }
    if (!ctx.actor.sessionId || typeof ctx.actor.sessionId !== 'string' || ctx.actor.sessionId.trim() === '') {
      missingFields.push('actor.sessionId');
    }
    if (!isValidAuthorizationRole(ctx.actor.authorizationRole)) {
      missingFields.push('actor.authorizationRole');
    }
    if (!Array.isArray(ctx.actor.capabilities)) {
      missingFields.push('actor.capabilities');
    }
    if (typeof ctx.actor.authenticated !== 'boolean') {
      missingFields.push('actor.authenticated');
    }
  }

  if (!ctx.conversation || typeof ctx.conversation !== 'object') {
    missingFields.push('conversation');
  } else {
    if (!isValidChannel(ctx.conversation.channel)) {
      missingFields.push('conversation.channel');
    }
    if (!ctx.conversation.audienceId || typeof ctx.conversation.audienceId !== 'string' || ctx.conversation.audienceId.trim() === '') {
      missingFields.push('conversation.audienceId');
    }
    if (!ctx.conversation.correlationId || typeof ctx.conversation.correlationId !== 'string' || ctx.conversation.correlationId.trim() === '') {
      missingFields.push('conversation.correlationId');
    }
  }

  if (ctx.subject !== undefined) {
    if (!ctx.subject || typeof ctx.subject !== 'object') {
      missingFields.push('subject');
    } else {
      if (!ctx.subject.subjectId || typeof ctx.subject.subjectId !== 'string' || ctx.subject.subjectId.trim() === '') {
        missingFields.push('subject.subjectId');
      }
      if (!isValidSubjectKind(ctx.subject.kind)) {
        missingFields.push('subject.kind');
      }
    }
  }

  if (missingFields.length > 0) {
    return {
      accepted: false,
      error: {
        code: 'MISSING_CONTEXT',
        fields: missingFields,
        correlationId: ctx.conversation?.correlationId,
      },
    };
  }

  return {
    accepted: true,
    context: ctx as RequestContext,
  };
}
