// Single-owner, single-machine context model
// Security perimeter is the local machine boundary (external vs internal).
// No internal audience, viewer, or owner role hierarchies.

export interface ActorContext {
  actorId: string;
  sessionId: string;
  authenticated?: boolean;
  capabilities?: string[];
  [key: string]: unknown;
}

export interface ConversationContext {
  correlationId: string;
  sessionId?: string;
  channel?: string;
  [key: string]: unknown;
}

export type SubjectKind = 'actor' | 'companion' | 'configured';

export type InteractionMode = 'casual' | 'teach' | 'hybrid';

export interface SubjectRef {
  subjectId: string;
  kind: SubjectKind;
  ownerActorId?: string;
}

export interface RequestContext {
  companionId: string;
  actor: ActorContext;
  conversation: ConversationContext;
  source?: 'local' | 'external' | string;
  subject?: SubjectRef;
  mode?: InteractionMode;
  metadata?: Record<string, unknown>;
}

export type DiagnosticCode =
  | 'legacy_role_removed'
  | 'anonymous_session_generated'
  | 'companion_default_mapped_for_bootstrap'
  | 'actor_scoped_subject_mapped'
  | 'role_escalation_attempt_suppressed'
  | 'capability_escalation_attempt_suppressed';

export type ContextErrorCode =
  | 'MISSING_CONTEXT'
  | 'INVALID_CONTEXT'
  | 'FORBIDDEN_CONTEXT'
  | 'AMBIGUOUS_CONTEXT'
  | 'UNAUTHORIZED_CAPABILITY';

export interface ContextError {
  code: ContextErrorCode;
  message?: string;
  fields?: string[];
  field?: string;
  correlationId?: string;
}

export interface RequestContextValidationResult {
  accepted: boolean;
  context?: RequestContext;
  diagnostics?: DiagnosticCode[];
  error?: ContextError;
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
  }

  if (!ctx.conversation || typeof ctx.conversation !== 'object') {
    missingFields.push('conversation');
  } else {
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

  if (ctx.mode !== undefined) {
    if (ctx.mode !== 'casual' && ctx.mode !== 'teach' && ctx.mode !== 'hybrid') {
      return {
        accepted: false,
        error: {
          code: 'INVALID_CONTEXT',
          message: `Invalid interaction mode: '${ctx.mode}' (expected 'casual', 'teach', or 'hybrid')`,
          field: 'mode',
          correlationId: ctx.conversation?.correlationId,
        },
      };
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

