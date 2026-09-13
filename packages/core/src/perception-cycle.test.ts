import { SiduriRuntime } from './runtime';
import { RequestContext } from './index';

describe('SiduriRuntime Unified Perception Cycle & Session History', () => {
  test('processPerception runs sensory perception through the complete cognition-action loop', async () => {
    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'Perception processed successfully',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime('comp-perception', { name: 'PerceptionBot' } as any, {
      brain: mockBrain as any,
    });

    const context: RequestContext = {
      companionId: 'comp-perception',
      actor: {
        actorId: 'operator-alice',
        sessionId: 'sess-alice-1',
        authorizationRole: 'operator',
        capabilities: ['chat:public'],
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        correlationId: 'corr-perc-1',
      },
    };

    const response = await runtime.processPerception({
      source: 'audio_stream',
      text: 'Hello from sensory stream',
      context,
    });

    expect(response.status).toBe('APPROVED');
    expect(response.response.subtitle_en).toBe('Perception processed successfully');
    expect(mockBrain.generatePlan).toHaveBeenCalled();

    // Session history should be recorded under sess-alice-1
    const aliceHistory = runtime.getSessionHistory('sess-alice-1');
    expect(aliceHistory).toHaveLength(2);
    expect(aliceHistory[0]).toEqual({ role: 'user', content: 'Hello from sensory stream' });
    expect(aliceHistory[1]).toEqual({ role: 'assistant', content: 'Perception processed successfully' });
  });

  test('processPerception transcribes raw audioBuffer when EarOrgan supports it', async () => {
    const mockEar = {
      listen: jest.fn().mockImplementation(async (source, payload) => ({
        id: 'p-1',
        source,
        text: payload,
        timestamp: new Date().toISOString(),
      })),
      transcribeAudio: jest.fn().mockResolvedValue('transcribed voice instruction'),
    };

    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'Understood audio',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime('comp-audio', { name: 'AudioBot' } as any, {
      ear: mockEar as any,
      brain: mockBrain as any,
    });

    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    const response = await runtime.processPerception({
      source: 'microphone',
      audioBuffer: audioBytes,
    });

    expect(mockEar.transcribeAudio).toHaveBeenCalledWith(audioBytes);
    expect(response.status).toBe('APPROVED');
    expect(response.response.subtitle_en).toBe('Understood audio');
  });

  test('isolates conversation histories across concurrent sessions', async () => {
    const mockBrain = {
      generatePlan: jest.fn().mockImplementation(async (args) => ({
        speech: `Reply to ${args.recentMessages[args.recentMessages.length - 1].content}`,
        language: 'en',
      })),
    };

    const runtime = new SiduriRuntime('comp-multi', { name: 'MultiSessionBot' } as any, {
      brain: mockBrain as any,
    });

    const aliceContext: RequestContext = {
      companionId: 'comp-multi',
      actor: {
        actorId: 'alice',
        sessionId: 'session-alice',
        authorizationRole: 'operator',
        capabilities: ['chat:public'],
        authenticated: true,
      },
      conversation: { channel: 'direct', correlationId: 'c1' },
    };

    const bobContext: RequestContext = {
      companionId: 'comp-multi',
      actor: {
        actorId: 'bob',
        sessionId: 'session-bob',
        authorizationRole: 'viewer',
        capabilities: ['chat:public'],
        authenticated: false,
      },
      conversation: { channel: 'public', correlationId: 'c2' },
    };

    await runtime.handleUserMessage('Alice secret message', aliceContext);
    await runtime.handleUserMessage('Bob public query', bobContext);

    const aliceHistory = runtime.getSessionHistory('session-alice');
    const bobHistory = runtime.getSessionHistory('session-bob');

    expect(aliceHistory.map((m) => m.content)).toContain('Alice secret message');
    expect(aliceHistory.map((m) => m.content)).not.toContain('Bob public query');

    expect(bobHistory.map((m) => m.content)).toContain('Bob public query');
    expect(bobHistory.map((m) => m.content)).not.toContain('Alice secret message');
  });

  test('prioritizes native evidenceRecord from knowledge items over synthetic generation', async () => {
    const nativeEvidence = {
      evidenceId: 'ev-native-provenance-100',
      sourceId: 'src-e-teyvat-canon',
      documentId: 'doc-archon-war',
      chunkId: 'chunk-3',
      locator: 'p.42',
      revision: 'rev-2026',
      origin: 'knowledge' as const,
      trust: 'configured' as const,
      sensitivity: 'public' as const,
      companionId: 'comp-native-ev',
      correlationId: 'corr-test',
      createdAt: new Date().toISOString(),
    };

    const mockKnowledge = {
      search: jest.fn().mockResolvedValue([
        {
          content: 'The Archon War ended centuries ago.',
          provenance: 'src-e-teyvat-canon',
          revision: 'rev-2026',
          citations: [],
          evidenceRecord: nativeEvidence,
        },
      ]),
    };

    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'The war concluded centuries ago.',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime('comp-native-ev', { name: 'EvBot' } as any, {
      knowledge: mockKnowledge as any,
      brain: mockBrain as any,
    });

    const response = await runtime.handleUserMessage('When did the Archon War end?', 'OWNER');
    expect(response.status).toBe('APPROVED');
    expect(response.metadata.evidence_ids).toContain('ev-native-provenance-100');
  });

  describe('Three Interaction Modes Execution (Casual, Teach, Hybrid)', () => {
    test('Casual Mode enforces Zero Memory Drift: suppresses all memory/directive proposals', async () => {
      const mockMemory = {
        proposeClaim: jest.fn(),
        proposeDirective: jest.fn(),
        addSourceEvent: jest.fn(),
      };

      const mockBrain = {
        generatePlan: jest.fn().mockResolvedValue({
          speech: 'Got it, Alice.',
          language: 'en',
          memoryProposals: [
            { subject: 'actor:alice', predicate: 'mood', value: 'happy' },
          ],
        }),
      };

      const runtime = new SiduriRuntime('comp-casual', { name: 'CasualBot' } as any, {
        memory: mockMemory as any,
        brain: mockBrain as any,
      });

      const casualContext: RequestContext = {
        companionId: 'comp-casual',
        mode: 'casual',
        actor: {
          actorId: 'alice',
          sessionId: 'sess-casual',
          authenticated: true,
        },
        conversation: {
          channel: 'direct',
          correlationId: 'corr-casual-1',
        },
      };

      // User says a teaching statement in Casual mode
      const response = await runtime.processPerception({
        source: 'text_chat',
        text: 'Remember that my name is Alice and I love coffee',
        context: casualContext,
      });

      expect(response.status).toBe('APPROVED');
      expect(response.metadata.mode).toBe('casual');
      // ZERO writes to memory: no source events, no proposed claims
      expect(mockMemory.addSourceEvent).not.toHaveBeenCalled();
      expect(mockMemory.proposeClaim).not.toHaveBeenCalled();
      expect(mockMemory.proposeDirective).not.toHaveBeenCalled();
      expect(response.metadata.proposals).toHaveLength(0);
      expect(response.metadata.memory_proposals).toHaveLength(0);
    });

    test('Teach Mode persists proposals and reflects mode in metadata', async () => {
      const mockMemory = {
        proposeClaim: jest.fn().mockImplementation(async (c) => ({
          id: 'claim-prop-1',
          ...c,
          status: 'PENDING',
        })),
        proposeDirective: jest.fn().mockResolvedValue(undefined),
        addSourceEvent: jest.fn().mockResolvedValue(undefined),
      };

      const mockBrain = {
        generatePlan: jest.fn().mockResolvedValue({
          speech: 'I have recorded your preferred title as Chief Engineer.',
          language: 'en',
        }),
      };

      const runtime = new SiduriRuntime('comp-teach', { name: 'TeachBot' } as any, {
        memory: mockMemory as any,
        brain: mockBrain as any,
      });

      const teachContext: RequestContext = {
        companionId: 'comp-teach',
        mode: 'teach',
        actor: {
          actorId: 'alice',
          sessionId: 'sess-teach',
          authenticated: true,
        },
        conversation: {
          channel: 'direct',
          correlationId: 'corr-teach-1',
        },
      };

      const response = await runtime.processPerception({
        source: 'text_chat',
        text: 'From now on, call me Chief Engineer',
        context: teachContext,
      });

      expect(response.status).toBe('APPROVED');
      expect(response.metadata.mode).toBe('teach');
      expect(mockMemory.proposeClaim).toHaveBeenCalled();
      expect(response.metadata.proposals).toHaveLength(1);
    });

    test('Infers Teach Mode semantically when user uses in-dialogue teaching command', async () => {
      const mockMemory = {
        proposeClaim: jest.fn().mockImplementation(async (c) => ({
          id: 'claim-prop-2',
          ...c,
          status: 'PENDING',
        })),
        proposeDirective: jest.fn().mockResolvedValue(undefined),
        addSourceEvent: jest.fn().mockResolvedValue(undefined),
      };

      const mockBrain = {
        generatePlan: jest.fn().mockResolvedValue({
          speech: 'Recorded the command.',
          language: 'en',
        }),
      };

      const runtime = new SiduriRuntime('comp-infer', { name: 'InferBot' } as any, {
        memory: mockMemory as any,
        brain: mockBrain as any,
      });

      // No explicit mode override in context
      const defaultContext: RequestContext = {
        companionId: 'comp-infer',
        actor: {
          actorId: 'alice',
          sessionId: 'sess-infer',
          authenticated: true,
        },
        conversation: {
          channel: 'direct',
          correlationId: 'corr-infer-1',
        },
      };

      const response = await runtime.processPerception({
        source: 'text_chat',
        text: '!teach remember that your name is Atlas',
        context: defaultContext,
      });

      expect(response.status).toBe('APPROVED');
      expect(response.metadata.mode).toBe('teach');
      expect(mockMemory.proposeClaim).toHaveBeenCalled();
    });
  });
});
