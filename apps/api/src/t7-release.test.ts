import request from 'supertest';
import { createApp } from './app';
import { SiduriRuntime } from './runtime';
import { BrainContext, ResponsePlan, ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult } from '@siduri-y/core';

describe('T7 Release Readiness End-to-End Verification Suite', () => {
  let mockBrain: any;
  let mockMemory: any;
  let mockKnowledge: any;
  let mockBehavior: any;
  let mockVoiceAdapter: ExperienceAdapter;
  let mockAvatarAdapter: ExperienceAdapter;
  let runtime: SiduriRuntime;
  let app: any;

  beforeEach(async () => {
    mockBrain = {
      generatePlan: jest.fn().mockImplementation(async (ctx: BrainContext): Promise<ResponsePlan> => ({
        speech: 'Verified neutral response.',
        language: 'en',
      })),
    };

    mockMemory = {
      initialize: jest.fn().mockResolvedValue(undefined),
      searchClaims: jest.fn().mockResolvedValue([]),
      getClaims: jest.fn().mockResolvedValue([]),
      getDirectives: jest.fn().mockResolvedValue([]),
      getPendingClaims: jest.fn().mockResolvedValue([]),
      proposeClaim: jest.fn().mockResolvedValue({ id: 'claim-t7-1', status: 'PENDING' }),
      approveClaim: jest.fn().mockResolvedValue(undefined),
      rejectClaim: jest.fn().mockResolvedValue(undefined),
    };

    mockKnowledge = { search: jest.fn().mockResolvedValue([]) };
    mockBehavior = { compile: jest.fn().mockResolvedValue('') };

    mockVoiceAdapter = {
      kind: 'voice',
      handleEvent: jest.fn().mockImplementation(async (event: ExperienceEvent): Promise<ExperienceAdapterResult> => ({
        accepted: true,
        eventId: event.eventId,
        lifecycle: 'STARTED',
        metadata: { speechId: 'speech-t7-verified' },
      })),
    };

    mockAvatarAdapter = {
      kind: 'avatar',
      handleEvent: jest.fn().mockImplementation(async (event: ExperienceEvent): Promise<ExperienceAdapterResult> => ({
        accepted: true,
        eventId: event.eventId,
        lifecycle: 'STARTED',
      })),
    };

    const config = {
      name: 'NeutralCompanion',
      brain: { provider: 'openrouter' },
      memory: { provider: 'postgres' },
      knowledge: { provider: 'e-knowledge' },
      behavior: { provider: 'active-self' },
      voice: { provider: 'voicevox' },
      vision: { provider: 'none' },
      body: { provider: 'live2d' },
    };

    runtime = new SiduriRuntime('companion-a', config as any, {
      brain: mockBrain,
      memory: mockMemory,
      knowledge: mockKnowledge,
      behavior: mockBehavior,
      voice: mockVoiceAdapter as any,
      body: mockAvatarAdapter as any,
    });
    await runtime.initialize();

    const runtimes = new Map([['companion-a', runtime]]);
    const created = createApp(runtimes);
    app = created.app;
  });

  // 1. R2 Blank slate: /me returns neutral actor/auth metadata with no invented identity
  test('R2 Gate: /me returns neutral actor and auth role without inventing a name', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('VIEWER');
    expect(res.body.actorId).toBe('anonymous-session');
    expect(res.body.authenticated).toBe(false);
    expect(res.body.name).toBeUndefined();
  });

  // 2. Full Positive Flow: Message -> T4 Gating -> Approved -> ExperienceEvents -> Voice & Avatar Adapters
  test('R6/R8 Gate: Full positive end-to-end flow dispatches to voice and avatar adapters', async () => {
    const res = await request(app)
      .post('/chat')
      .send({
        companionId: 'companion-a',
        message: 'Hello neutral companion',
        history: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(mockVoiceAdapter.handleEvent).toHaveBeenCalledTimes(1);
    expect(mockAvatarAdapter.handleEvent).toHaveBeenCalledTimes(1);

    const voiceArg = (mockVoiceAdapter.handleEvent as jest.Mock).mock.calls[0][0] as ExperienceEvent;
    expect(voiceArg.approval).toBe('APPROVED');
    expect(voiceArg.kind).toBe('voice');
    expect(voiceArg.text).toBe('Verified neutral response.');
  });

  // 3. Full Negative Flow: Staged gating halts ExperienceEvent dispatch
  test('R5/R6 Gate: Unapproved staged plan halts ExperienceEvent creation and external side effects', async () => {
    const stageRes = await request(app)
      .post('/dev/mock-response')
      .send({
        companionId: 'companion-a',
        correlation_id: 'corr-t7-staged',
        speech: 'Staged unapproved speech',
        requiresApproval: true,
      });

    expect(stageRes.status).toBe(200);
    expect(stageRes.body.staged).toBe(true);

    expect(mockVoiceAdapter.handleEvent).not.toHaveBeenCalled();
    expect(mockAvatarAdapter.handleEvent).not.toHaveBeenCalled();
  });
});
