import { classifyInputIntent } from './intent-classifier';
import { RequestContext } from './index';

describe('IntentClassifier', () => {
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
      audienceId: 'aud-1',
      correlationId: 'corr-1',
    },
  };

  test('classifies greetings correctly and suppresses knowledge queries', () => {
    const greetings = ['Hello', 'hi', 'Good morning', 'greetings!'];
    for (const g of greetings) {
      const result = classifyInputIntent(g, dummyContext);
      expect(result.isGreeting).toBe(true);
      expect(result.shouldQueryKnowledge).toBe(false);
    }
  });

  test('classifies self-identity inquiries and suppresses knowledge queries', () => {
    const identityQuestions = [
      'Who are you?',
      'What are you',
      'who is siduri',
      'Tell me about yourself',
      'what is your name',
    ];
    for (const q of identityQuestions) {
      const result = classifyInputIntent(q, dummyContext);
      expect(result.isSelfIdentityRequest).toBe(true);
      expect(result.shouldQueryKnowledge).toBe(false);
    }
  });

  test('classifies teaching statements and suppresses knowledge queries', () => {
    const teachingInputs = [
      'Remember that the sky is purple',
      'My name is Alice',
      'Call me Bob',
    ];
    for (const t of teachingInputs) {
      const result = classifyInputIntent(t, dummyContext);
      expect(result.isTeachingLike).toBe(true);
      expect(result.shouldQueryKnowledge).toBe(false);
    }
  });

  test('enables knowledge queries for standard informational questions', () => {
    const queries = [
      'What happened during the Cataclysm?',
      'Tell me about the archons',
      'How does alchemy work in Khaenriah?',
    ];
    for (const q of queries) {
      const result = classifyInputIntent(q, dummyContext);
      expect(result.isGreeting).toBe(false);
      expect(result.isSelfIdentityRequest).toBe(false);
      expect(result.isTeachingLike).toBe(false);
      expect(result.shouldQueryKnowledge).toBe(true);
    }
  });
});
