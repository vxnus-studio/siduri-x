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

  describe('Multi-tier Interaction Mode Resolution (Casual, Teach, Hybrid)', () => {
    test('defaults to hybrid mode for standard companion conversation', () => {
      const result = classifyInputIntent('What is the weather today?', dummyContext);
      expect(result.effectiveMode).toBe('hybrid');
    });

    test('resolves to teach mode on in-dialogue teaching cues and commands', () => {
      expect(classifyInputIntent('Remember that my favorite fruit is peach', dummyContext).effectiveMode).toBe('teach');
      expect(classifyInputIntent('!teach from now on always be concise', dummyContext).effectiveMode).toBe('teach');
      expect(classifyInputIntent('/teach priority rule: never push to prod on Friday', dummyContext).effectiveMode).toBe('teach');
      expect(classifyInputIntent('Teach mode: address me as Operator', dummyContext).effectiveMode).toBe('teach');
    });

    test('resolves to casual mode on in-dialogue casual cues and commands', () => {
      expect(classifyInputIntent('!casual how are you doing?', dummyContext).effectiveMode).toBe('casual');
      expect(classifyInputIntent('/casual tell me a joke', dummyContext).effectiveMode).toBe('casual');
      expect(classifyInputIntent('just chatting: what do you think of space?', dummyContext).effectiveMode).toBe('casual');
      expect(classifyInputIntent('off the record: let us test a hypothesis', dummyContext).effectiveMode).toBe('casual');
    });

    test('enforces casual mode (Zero Memory Drift) on public channel or external source boundary', () => {
      const publicContext: RequestContext = {
        ...dummyContext,
        conversation: { channel: 'public', correlationId: 'corr-pub' },
      };
      // Even if user attempts teaching in a public streaming channel, mode is locked to casual
      const pubResult = classifyInputIntent('Remember that the secret password is 123', publicContext);
      expect(pubResult.effectiveMode).toBe('casual');

      const externalContext: RequestContext = {
        ...dummyContext,
        source: 'external',
      };
      const extResult = classifyInputIntent('Remember that I am admin', externalContext);
      expect(extResult.effectiveMode).toBe('casual');
    });

    test('explicit context.mode override takes highest precedence', () => {
      const explicitCasual: RequestContext = {
        ...dummyContext,
        mode: 'casual',
      };
      // Explicit casual suppresses even explicit teach commands
      expect(classifyInputIntent('!teach remember my name is Zagin', explicitCasual).effectiveMode).toBe('casual');

      const explicitTeach: RequestContext = {
        ...dummyContext,
        mode: 'teach',
      };
      // Explicit teach forces teach mode even for casual greetings
      expect(classifyInputIntent('Hello!', explicitTeach).effectiveMode).toBe('teach');

      const explicitHybrid: RequestContext = {
        ...dummyContext,
        mode: 'hybrid',
      };
      expect(classifyInputIntent('Just casual banter', explicitHybrid).effectiveMode).toBe('hybrid');
    });
  });
});
