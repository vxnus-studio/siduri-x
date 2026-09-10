import { compilePrompts } from './prompt-compiler';
import { RequestContext } from './index';

describe('PromptCompiler', () => {
  const dummyContext: RequestContext = {
    companionId: 'test-comp',
    actor: {
      actorId: 'user-1',
      sessionId: 'sess-1',
      authorizationRole: 'administrator',
      capabilities: ['chat:public'],
      authenticated: true,
    },
    conversation: {
      channel: 'direct',
      correlationId: 'corr-1',
    },
  };

  test('compiles clean neutral system prompt with companion name and behavior injections', async () => {
    const mockBehavior = {
      compile: jest.fn().mockResolvedValue('BEHAVIOR: Speak formally.'),
    };

    const result = await compilePrompts({
      companionName: 'Siduri',
      companionId: 'test-comp',
      role: 'OWNER',
      requestContext: dummyContext,
      behavior: mockBehavior as any,
      activeDirectives: [],
      subsystemDiagnostics: {},
      knowledgeData: [],
      memoryData: [],
    });

    expect(result.systemPrompt).toContain('You are Siduri.');
    expect(result.systemPrompt).toContain('This is a neutral conversation context.');
    expect(result.systemPrompt).toContain('BEHAVIOR: Speak formally.');
    expect(result.contextPrompt).toBe('');
  });

  test('formats degraded diagnostics, knowledge, and memory in context prompt', async () => {
    const result = await compilePrompts({
      companionName: 'Siduri',
      companionId: 'test-comp',
      role: 'OWNER',
      requestContext: dummyContext,
      activeDirectives: [],
      subsystemDiagnostics: {
        knowledge: 'UNAVAILABLE: timeout',
      },
      knowledgeData: [
        {
          content: 'The moon is made of silver.',
          provenance: 'e-knowledge',
          revision: 'v1',
          citations: [],
        },
      ],
      memoryData: [
        {
          id: 'c1',
          subject: 'User',
          predicate: 'likes',
          value: 'tea',
          companionId: 'test-comp',
          status: 'APPROVED',
        },
      ],
    });

    expect(result.contextPrompt).toContain('SUBSYSTEM STATUS (DEGRADED):');
    expect(result.contextPrompt).toContain('- [knowledge] UNAVAILABLE: timeout');
    expect(result.contextPrompt).toContain('KNOWLEDGE:');
    expect(result.contextPrompt).toContain('- [revision:v1 source:e-knowledge] The moon is made of silver.');
    expect(result.contextPrompt).toContain('MEMORY:');
    expect(result.contextPrompt).toContain('- User likes tea');
  });
});
