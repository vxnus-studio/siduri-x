import {
  RequestContext,
  validateRequestContext,
  isValidAuthorizationRole,
  isValidChannel,
  isValidSubjectKind,
} from './context';

describe('Core Context Contract (P1)', () => {
  const validContext: RequestContext = {
    companionId: 'companion-a',
    actor: {
      actorId: 'actor-a',
      sessionId: 'session-a',
      authorizationRole: 'viewer',
      capabilities: ['chat:public'],
      authenticated: false,
    },
    conversation: {
      channel: 'public',
      audienceId: 'audience-public',
      correlationId: 'corr-a',
    },
    subject: {
      subjectId: 'actor:actor-a',
      kind: 'actor',
      ownerActorId: 'actor-a',
    },
  };

  test('validates a correct neutral RequestContext', () => {
    const result = validateRequestContext(validContext);
    expect(result.accepted).toBe(true);
    expect(result.context).toEqual(validContext);
    expect(result.error).toBeUndefined();
  });

  test('validates a correct RequestContext without subject', () => {
    const { subject, ...contextWithoutSubject } = validContext;
    const result = validateRequestContext(contextWithoutSubject);
    expect(result.accepted).toBe(true);
    expect(result.context?.subject).toBeUndefined();
  });

  test('rejects missing root context or non-object', () => {
    const result = validateRequestContext(null);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toContain('context');
  });

  test('rejects missing companionId, actor, or conversation', () => {
    const result = validateRequestContext({});
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toEqual(
      expect.arrayContaining(['companionId', 'actor', 'conversation'])
    );
  });

  test('validates authorization role constraints', () => {
    expect(isValidAuthorizationRole('viewer')).toBe(true);
    expect(isValidAuthorizationRole('operator')).toBe(true);
    expect(isValidAuthorizationRole('administrator')).toBe(true);
    expect(isValidAuthorizationRole('owner')).toBe(false);
    expect(isValidAuthorizationRole('user')).toBe(false);
    expect(isValidAuthorizationRole('MASTER')).toBe(false);

    const invalidRoleCtx = {
      ...validContext,
      actor: { ...validContext.actor, authorizationRole: 'invalid_role' as any },
    };
    const result = validateRequestContext(invalidRoleCtx);
    expect(result.accepted).toBe(false);
    expect(result.error?.fields).toContain('actor.authorizationRole');
  });

  test('validates channel constraints', () => {
    expect(isValidChannel('public')).toBe(true);
    expect(isValidChannel('direct')).toBe(true);
    expect(isValidChannel('private')).toBe(true);
    expect(isValidChannel('operator')).toBe(true);
    expect(isValidChannel('chat')).toBe(false);
    expect(isValidChannel('MASTER_PRIVATE')).toBe(false);

    const invalidChannelCtx = {
      ...validContext,
      conversation: { ...validContext.conversation, channel: 'invalid_channel' as any },
    };
    const result = validateRequestContext(invalidChannelCtx);
    expect(result.accepted).toBe(false);
    expect(result.error?.fields).toContain('conversation.channel');
  });

  test('validates subject kinds and constraints', () => {
    expect(isValidSubjectKind('actor')).toBe(true);
    expect(isValidSubjectKind('companion')).toBe(true);
    expect(isValidSubjectKind('configured')).toBe(true);
    expect(isValidSubjectKind('user')).toBe(false);

    const invalidSubjectCtx = {
      ...validContext,
      subject: { subjectId: 'subject-1', kind: 'invalid_kind' as any },
    };
    const result = validateRequestContext(invalidSubjectCtx);
    expect(result.accepted).toBe(false);
    expect(result.error?.fields).toContain('subject.kind');
  });

  test('rejects missing correlationId and preserves correlationId in error if present', () => {
    const missingCorr = {
      ...validContext,
      conversation: { ...validContext.conversation, correlationId: '' },
    };
    const result = validateRequestContext(missingCorr);
    expect(result.accepted).toBe(false);
    expect(result.error?.fields).toContain('conversation.correlationId');

    const missingActorId = {
      ...validContext,
      actor: { ...validContext.actor, actorId: '' },
    };
    const result2 = validateRequestContext(missingActorId);
    expect(result2.accepted).toBe(false);
    expect(result2.error?.fields).toContain('actor.actorId');
    expect(result2.error?.correlationId).toBe('corr-a');
  });
});
