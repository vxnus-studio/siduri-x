import {
  RequestContext,
  validateRequestContext,
  isValidSubjectKind,
} from './context';

describe('Core Context Contract (Single-Owner Single-Machine)', () => {
  const validContext: RequestContext = {
    companionId: 'companion-a',
    actor: {
      actorId: 'local-user',
      sessionId: 'session-a',
      authenticated: true,
      capabilities: ['chat:interact'],
    },
    conversation: {
      correlationId: 'corr-a',
    },
    subject: {
      subjectId: 'actor:local-user',
      kind: 'actor',
      ownerActorId: 'local-user',
    },
  };

  test('validates a correct RequestContext', () => {
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
