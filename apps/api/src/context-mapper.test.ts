import { mapRequestContext } from './context-mapper';

describe('API Request Context Mapper (Single-Owner, Single-Machine)', () => {
  test('Local chat request maps to valid RequestContext with local user defaults', () => {
    const input = {
      companionId: 'companion-a',
      message: 'Hello world',
      correlationId: 'corr-local-1',
    };

    const result = mapRequestContext(input);

    expect(result.accepted).toBe(true);
    expect(result.context?.companionId).toBe('companion-a');
    expect(result.context?.actor.actorId).toBe('local-user');
    expect(result.context?.actor.authenticated).toBe(true);
    expect(result.context?.conversation.correlationId).toBe('corr-local-1');
    expect(result.context?.source).toBe('local');
    expect(result.context?.subject).toBeUndefined();
  });

  test('Accepts structured context envelope', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'user-main',
          sessionId: 'session-main',
          authenticated: true,
          capabilities: ['chat', 'system'],
        },
        conversation: {
          correlationId: 'corr-structured-1',
        },
      },
      message: 'Hello structured context',
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(true);
    expect(result.context?.actor.actorId).toBe('user-main');
    expect(result.context?.conversation.correlationId).toBe('corr-structured-1');
  });

  test('Rejects global primary_user subject', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'user-a',
          sessionId: 'session-a',
        },
        conversation: {
          correlationId: 'corr-primary-user',
        },
        subject: {
          subjectId: 'primary_user',
          kind: 'actor',
        },
      },
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN_CONTEXT');
    expect(result.error?.field).toBe('subject.subjectId');
  });

  test('Rejects missing actor on structured context', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: '',
          sessionId: 'session-a',
        },
        conversation: {
          correlationId: 'corr-teach-no-actor',
        },
      },
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toContain('actor.actorId');
  });

  test('Two companion IDs with same actor remain isolated under context mapper', () => {
    const actor = {
      actorId: 'user-a',
      sessionId: 'session-a',
      authenticated: true,
    };
    const conv = {
      correlationId: 'corr-iso-1',
    };

    const reqA = { companionId: 'companion-a', context: { actor, conversation: conv } };
    const reqB = { companionId: 'companion-b', context: { actor, conversation: conv } };

    const resA = mapRequestContext(reqA);
    const resB = mapRequestContext(reqB);

    expect(resA.accepted).toBe(true);
    expect(resB.accepted).toBe(true);
    expect(resA.context?.companionId).toBe('companion-a');
    expect(resB.context?.companionId).toBe('companion-b');
  });

  test('Rejects missing companionId', () => {
    const input = {
      message: 'No companion id',
      correlationId: 'corr-no-comp',
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toContain('companionId');
  });

  test('Rejects missing correlation ID when generateCorrelationId is not set', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'user-a',
          sessionId: 'session-a',
        },
        conversation: {
          correlationId: '',
        },
      },
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toContain('conversation.correlationId');
  });

  test('Generates correlationId when generateCorrelationId option is true', () => {
    const input = {
      companionId: 'companion-a',
      generateCorrelationId: true,
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(true);
    expect(result.context?.conversation.correlationId).toMatch(/^corr-/);
  });
});
