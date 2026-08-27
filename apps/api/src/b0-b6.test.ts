import request from 'supertest';
import { createApp } from './app';
import { SiduriRuntime } from './runtime';
import { Message, BrainContext, ResponsePlan } from '@siduri-y/core';

describe('T0 B0 & B6 Runtime Proof Suite', () => {
  let mockBrain: any;
  let mockMemory: any;
  let mockKnowledge: any;
  let mockBehavior: any;
  let runtime: SiduriRuntime;
  let app: any;

  beforeEach(async () => {
    mockBrain = {
      generatePlan: jest.fn().mockImplementation(async (ctx: BrainContext): Promise<ResponsePlan> => {
        return {
          speech: 'Hello. I am a neutral companion.',
          language: 'en',
        };
      }),
    };

    mockMemory = {
      initialize: jest.fn().mockResolvedValue(undefined),
      searchClaims: jest.fn().mockResolvedValue([]),
      getClaims: jest.fn().mockResolvedValue([]),
      getDirectives: jest.fn().mockResolvedValue([]),
      getPendingClaims: jest.fn().mockResolvedValue([]),
      proposeClaim: jest.fn().mockResolvedValue({}),
      approveClaim: jest.fn().mockResolvedValue(undefined),
      rejectClaim: jest.fn().mockResolvedValue(undefined),
    };

    mockKnowledge = {
      search: jest.fn().mockResolvedValue([]),
    };

    mockBehavior = {
      compile: jest.fn().mockResolvedValue(''),
    };

    const config = {
      name: 'NeutralCompanion',
      brain: { provider: 'openrouter' },
      memory: { provider: 'postgres' },
      knowledge: { provider: 'e-knowledge' },
      behavior: { provider: 'active-self' },
      voice: { provider: 'none' },
      vision: { provider: 'none' },
      body: { provider: 'none' },
    };

    runtime = new SiduriRuntime('companion-a', config as any, {
      brain: mockBrain,
      memory: mockMemory,
      knowledge: mockKnowledge,
      behavior: mockBehavior,
    });
    await runtime.initialize();

    const runtimes = new Map([['companion-a', runtime]]);
    const created = createApp(runtimes);
    app = created.app;
  });

  // B0: Fresh companion is empty (no prior claims, no user relationship, no knowledge search on greeting)
  describe('B0 — Fresh companion is empty', () => {
    test('initial state has empty memory and empty directives', async () => {
      const claims = await runtime.memory?.getClaims();
      const directives = await runtime.memory?.getDirectives();
      expect(claims).toEqual([]);
      expect(directives).toEqual([]);
    });

    test('greeting does not query knowledge or inject prior personal knowledge', async () => {
      const res = await request(app)
        .post('/chat')
        .send({
          companionId: 'companion-a',
          message: 'Hello.',
          history: [],
        });

      expect(res.status).toBe(200);
      expect(mockKnowledge.search).not.toHaveBeenCalled();
      expect(mockBrain.generatePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          contextPrompt: '',
          recipient: 'VIEWER',
        })
      );
    });
  });

  // B6: Identity and relationship are learned, not inferred (self identity questions do not query external knowledge)
  describe('B6 — Identity and relationship are learned, not inferred', () => {
    test('asking "Who are you?" suppresses knowledge query and asserts self identity without external search', async () => {
      mockBrain.generatePlan.mockResolvedValueOnce({
        speech: 'I am NeutralCompanion.',
        language: 'en',
      });

      const res = await request(app)
        .post('/chat')
        .send({
          companionId: 'companion-a',
          message: 'Who are you?',
          history: [],
        });

      expect(res.status).toBe(200);
      // B6 oracle: self identity chat does not query external knowledge
      expect(mockKnowledge.search).not.toHaveBeenCalled();
      expect(mockMemory.searchClaims).toHaveBeenCalled();
      expect(mockBrain.generatePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          contextPrompt: '',
        })
      );
      expect(res.body.response.subtitle_en).toBe('I am NeutralCompanion.');
    });

    test('asking "Tell me about yourself" suppresses knowledge query', async () => {
      const res = await request(app)
        .post('/chat')
        .send({
          companionId: 'companion-a',
          message: 'Tell me about yourself',
          history: [],
        });

      expect(res.status).toBe(200);
      expect(mockKnowledge.search).not.toHaveBeenCalled();
    });
  });
});
