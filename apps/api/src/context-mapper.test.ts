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

  test('Overrides forged client actor authentication and caps capabilities on unauthenticated requests', () => {
    const forgedInput = {
      companionId: 'companion-a',
      authenticated: false, // Server detected unauthenticated request
      source: 'external',
      context: {
        actor: {
          actorId: 'attacker',
          sessionId: 'session-att',
          authenticated: true, // Forged
          capabilities: ['system:exec', 'bash', 'chat'], // Forged elevated capabilities
          authorizationRole: 'OWNER', // Forged role
        },
        conversation: {
          correlationId: 'corr-forged-1',
        },
      },
    };

    const result = mapRequestContext(forgedInput);
    expect(result.accepted).toBe(true);
    expect(result.context?.actor.authenticated).toBe(false);
    expect(result.context?.actor.capabilities).toEqual(['chat']);
    expect(result.context?.actor.authorizationRole).toBe('viewer');
    expect(result.context?.source).toBe('external');
    expect(result.diagnostics).toContain('role_escalation_attempt_suppressed');
    expect(result.diagnostics).toContain('capability_escalation_attempt_suppressed');
  });

  test('Prevents attenuated caller from escalating to administrator role or forging elevated capabilities', () => {
    const attenuatedPayload = {
      companionId: 'companion-a',
      authenticated: true,
      role: 'VIEWER',
      source: 'external',
      context: {
        actor: {
          actorId: 'visitor-bob',
          sessionId: 'session-vis-1',
          authorizationRole: 'administrator', // Forged owner/admin role
          capabilities: ['chat', 'system', 'root:manage', 'action:execute'], // Forged system/root capabilities
        },
        conversation: {
          correlationId: 'corr-att-escalate',
        },
      },
    };

    const result = mapRequestContext(attenuatedPayload);
    expect(result.accepted).toBe(true);
    expect(result.context?.actor.authenticated).toBe(true);
    expect(result.context?.actor.authorizationRole).toBe('viewer');
    expect(result.context?.actor.capabilities).toEqual(['chat']);
    expect(result.diagnostics).toContain('role_escalation_attempt_suppressed');
    expect(result.diagnostics).toContain('capability_escalation_attempt_suppressed');
  });

  test('Strips unknown capabilities for authenticated owner while preserving canonical companion capabilities', () => {
    const ownerPayload = {
      companionId: 'companion-a',
      authenticated: true,
      source: 'local',
      context: {
        actor: {
          actorId: 'owner-user',
          sessionId: 'session-owner-1',
          capabilities: ['chat', 'system', 'root:unauthorized', 'arbitrary:hack'],
        },
        conversation: {
          correlationId: 'corr-owner-caps',
        },
      },
    };

    const result = mapRequestContext(ownerPayload);
    expect(result.accepted).toBe(true);
    expect(result.context?.actor.authorizationRole).toBe('administrator');
    expect(result.context?.actor.capabilities).toEqual(['chat', 'system']);
    expect(result.diagnostics).toContain('capability_escalation_attempt_suppressed');
  });

  test('Flat envelope: suppresses role and capability escalation when serverRole is VIEWER', () => {
    const viewerPayload = {
      companionId: 'companion-a',
      authenticated: false,
      serverRole: 'VIEWER',
      role: 'OWNER', // Forged in flat envelope
      capabilities: ['chat', 'system', 'action:execute'],
      generateCorrelationId: true,
    };

    const result = mapRequestContext(viewerPayload);
    expect(result.accepted).toBe(true);
    expect(result.context?.actor.authorizationRole).toBe('viewer');
    expect(result.context?.actor.capabilities).toEqual(['chat']);
    expect(result.diagnostics).toContain('role_escalation_attempt_suppressed');
  });

  test('Authenticated owner receives canonical administrator role and capabilities, and can safely attenuate to viewer', () => {
    const ownerPayload = {
      companionId: 'companion-a',
      authenticated: true,
      serverRole: 'OWNER',
      generateCorrelationId: true,
    };

    const ownerResult = mapRequestContext(ownerPayload);
    expect(ownerResult.accepted).toBe(true);
    expect(ownerResult.context?.actor.authorizationRole).toBe('administrator');
    expect(ownerResult.context?.actor.capabilities).toEqual([
      'chat',
      'memory:approve',
      'action:execute',
      'system',
    ]);

    // Attenuation to viewer
    const attenuatedPayload = {
      ...ownerPayload,
      role: 'VIEWER',
    };
    const attenuatedResult = mapRequestContext(attenuatedPayload);
    expect(attenuatedResult.accepted).toBe(true);
    expect(attenuatedResult.context?.actor.authorizationRole).toBe('viewer');
    expect(attenuatedResult.diagnostics).not.toContain('role_escalation_attempt_suppressed');
  });
});
