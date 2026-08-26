import { mapRequestContext } from './context-mapper';

describe('API Request Context Mapper (P2 & T1-01 to T1-10)', () => {
  // T1-01: Anonymous public chat, no audience
  test('T1-01: Anonymous public chat with no audience resolves to configured public audience and no subject', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'anonymous-session-a',
          sessionId: 'session-a',
          authorizationRole: 'viewer',
          capabilities: ['chat:public'],
          authenticated: false,
        },
        conversation: {
          channel: 'public',
          correlationId: 'corr-public-a',
        },
      },
      message: 'Hello.',
      history: [],
    };

    const result = mapRequestContext(input, {
      endpointPolicy: 'public',
      defaultPublicAudience: 'audience-public',
    });

    expect(result.accepted).toBe(true);
    expect(result.context?.companionId).toBe('companion-a');
    expect(result.context?.conversation.channel).toBe('public');
    expect(result.context?.conversation.audienceId).toBe('audience-public');
    expect(result.context?.subject).toBeUndefined();
    expect(result.diagnostics).toContain('audience_defaulted_by_public_policy');
  });

  // T1-02: OWNER public chat
  test('T1-02: OWNER public chat maps authorization metadata only with no relationship or private routing', () => {
    const input = {
      id: 'companion-a',
      role: 'OWNER',
      correlationId: 'corr-owner-public',
      message: 'Public broadcast message',
    };

    const result = mapRequestContext(input, { endpointPolicy: 'public' });
    expect(result.accepted).toBe(true);
    expect(result.context?.actor.authorizationRole).toBe('administrator');
    expect(result.context?.conversation.channel).toBe('public');
    expect(result.context?.conversation.audienceId).toBe('audience-public');
    expect(result.context?.subject).toBeUndefined();
    expect(result.diagnostics).toContain('legacy_role_mapped_to_authorization');
  });

  // T1-03: Private chat without capability
  test('T1-03: Private chat without capability is rejected before organ invocation', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'actor-a',
          sessionId: 'session-a',
          authorizationRole: 'viewer',
          capabilities: ['chat:public'], // Missing 'chat:private'
          authenticated: true,
        },
        conversation: {
          channel: 'private',
          audienceId: 'audience-private-a',
          correlationId: 'corr-private-a',
        },
      },
      message: 'Show private data',
    };

    const result = mapRequestContext(input, { endpointPolicy: 'private' });
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('UNAUTHORIZED_CHANNEL_OR_CAPABILITY');
    expect(result.error?.fields).toContain('actor.capabilities');
  });

  // T1-04: Operator request without operator context
  test('T1-04: Operator request without operator context is rejected with diagnostic', () => {
    const input = {
      id: 'companion-a',
      role: 'OPERATOR',
      correlationId: 'corr-op-missing',
    };

    const result = mapRequestContext(input, { endpointPolicy: 'operator' });
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toEqual(
      expect.arrayContaining(['conversation.channel', 'conversation.audienceId', 'actor.capabilities'])
    );
  });

  // T1-05: Global primary_user input
  test('T1-05: Global primary_user input is rejected/quarantined at mapper', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'actor-a',
          sessionId: 'session-a',
          authorizationRole: 'viewer',
          capabilities: ['chat:public'],
          authenticated: true,
        },
        conversation: {
          channel: 'public',
          audienceId: 'audience-public',
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

  // T1-06: MASTER_PRIVATE in public mode
  test('T1-06: MASTER_PRIVATE in public mode is rejected with no fallback', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'actor-a',
          sessionId: 'session-a',
          authorizationRole: 'viewer',
          capabilities: ['chat:public'],
          authenticated: false,
        },
        conversation: {
          channel: 'public',
          audienceId: 'MASTER_PRIVATE',
          correlationId: 'corr-master-private',
        },
      },
    };

    const result = mapRequestContext(input, { endpointPolicy: 'public' });
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('LEGACY_PERSONAL_AUDIENCE');
    expect(result.error?.field).toBe('audienceId');
  });

  // T1-07: Missing actor on explicit teaching
  test('T1-07: Missing actor on explicit teaching produces no durable profile and pending/anonymous context only', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: '',
          sessionId: 'session-a',
          authorizationRole: 'viewer',
          capabilities: ['chat:public'],
          authenticated: false,
        },
        conversation: {
          channel: 'public',
          audienceId: 'audience-public',
          correlationId: 'corr-teach-no-actor',
        },
      },
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toContain('actor.actorId');
  });

  // T1-08: Two companion IDs, same actor remain isolated
  test('T1-08: Two companion IDs with same actor remain isolated under context mapper', () => {
    const actor = {
      actorId: 'actor-a',
      sessionId: 'session-a',
      authorizationRole: 'viewer' as const,
      capabilities: ['chat:public'],
      authenticated: true,
    };
    const conv = {
      channel: 'public' as const,
      audienceId: 'audience-public',
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

  // T1-09: Missing correlation ID
  test('T1-09: Missing correlation ID is rejected before stateful operation', () => {
    const input = {
      companionId: 'companion-a',
      context: {
        actor: {
          actorId: 'actor-a',
          sessionId: 'session-a',
          authorizationRole: 'viewer',
          capabilities: ['chat:public'],
          authenticated: true,
        },
        conversation: {
          channel: 'public',
          audienceId: 'audience-public',
          correlationId: '',
        },
      },
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('MISSING_CONTEXT');
    expect(result.error?.fields).toContain('conversation.correlationId');
  });

  // T1-10: Ambiguous legacy request
  test('T1-10: Ambiguous legacy request emits structured diagnostic and rejects ambiguous mapping', () => {
    const input = {
      companionId: 'companion-a',
      role: 'VIEWER',
      context: {
        actor: {
          actorId: 'actor-a',
          sessionId: 'session-a',
          authorizationRole: 'viewer',
          capabilities: ['chat:public'],
          authenticated: true,
        },
        // Role supplied at top level without channel or audience
      },
    };

    const result = mapRequestContext(input);
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('AMBIGUOUS_CONTEXT');
    expect(result.error?.conflicts).toEqual(
      expect.arrayContaining(['role_does_not_select_audience', 'role_does_not_select_subject'])
    );
  });
});
