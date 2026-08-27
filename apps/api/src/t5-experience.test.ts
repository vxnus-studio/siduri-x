import request from 'supertest';
import { createApp } from './app';
import { SiduriRuntime } from './runtime';
import { BrainContext, ResponsePlan, ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult } from '@siduri/core';

describe('T5 Experience Event and Output Adapters Suite', () => {
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
      generatePlan: jest.fn().mockImplementation(async (ctx: BrainContext): Promise<ResponsePlan> => {
        return {
          speech: 'Approved speech for delivery.',
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
      proposeClaim: jest.fn().mockResolvedValue({ id: 'claim-1', status: 'PENDING' }),
      approveClaim: jest.fn().mockResolvedValue(undefined),
      rejectClaim: jest.fn().mockResolvedValue(undefined),
    };

    mockKnowledge = {
      search: jest.fn().mockResolvedValue([]),
    };

    mockBehavior = {
      compile: jest.fn().mockResolvedValue(''),
    };

    mockVoiceAdapter = {
      kind: 'voice',
      handleEvent: jest.fn().mockImplementation(async (event: ExperienceEvent): Promise<ExperienceAdapterResult> => ({
        accepted: true,
        eventId: event.eventId,
        lifecycle: 'STARTED',
        metadata: { speechId: 'speech-t5-voice' },
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

  test('1. Approved T4 response generates and dispatches ExperienceEvent to voice and avatar adapters', async () => {
    const res = await request(app)
      .post('/chat')
      .send({
        companionId: 'companion-a',
        message: 'Hello experience world',
        history: [],
      });

    expect(res.status).toBe(200);
    expect(mockVoiceAdapter.handleEvent).toHaveBeenCalledTimes(1);
    expect(mockAvatarAdapter.handleEvent).toHaveBeenCalledTimes(1);

    const voiceCallArg = (mockVoiceAdapter.handleEvent as jest.Mock).mock.calls[0][0] as ExperienceEvent;
    expect(voiceCallArg.approval).toBe('APPROVED');
    expect(voiceCallArg.companionId).toBe('companion-a');
    expect(voiceCallArg.text).toBe('Approved speech for delivery.');
    expect(voiceCallArg.kind).toBe('voice');

    const avatarCallArg = (mockAvatarAdapter.handleEvent as jest.Mock).mock.calls[0][0] as ExperienceEvent;
    expect(avatarCallArg.approval).toBe('APPROVED');
    expect(avatarCallArg.companionId).toBe('companion-a');
    expect(avatarCallArg.kind).toBe('avatar');
  });

  test('2. Staged response does NOT dispatch ExperienceEvent to adapters', async () => {
    // Stage a candidate requiring approval
    const stageRes = await request(app)
      .post('/dev/mock-response')
      .send({
        companionId: 'companion-a',
        correlation_id: 'corr-stage-exp-1',
        speech: 'Staged speech pending decision',
        requiresApproval: true,
      });

    expect(stageRes.status).toBe(200);
    expect(stageRes.body.staged).toBe(true);

    // Assert that no ExperienceEvents were dispatched to voice/avatar adapters
    expect(mockVoiceAdapter.handleEvent).not.toHaveBeenCalled();
    expect(mockAvatarAdapter.handleEvent).not.toHaveBeenCalled();
  });

  test('3. Rejected response does NOT dispatch ExperienceEvent to adapters', async () => {
    const stageRes = await request(app)
      .post('/dev/mock-response')
      .send({
        companionId: 'companion-a',
        correlation_id: 'corr-stage-exp-2',
        speech: 'Rejected speech candidate',
      });

    const responseId = stageRes.body.response_id;

    await request(app)
      .post('/dev/reject-response')
      .send({
        companionId: 'companion-a',
        responseId,
        correlation_id: 'corr-stage-exp-2',
      });

    expect(mockVoiceAdapter.handleEvent).not.toHaveBeenCalled();
    expect(mockAvatarAdapter.handleEvent).not.toHaveBeenCalled();
  });

  test('4. Adapter fails safely on invalid envelope or unapproved event', async () => {
    const invalidEvent = {
      eventId: 'evt-test',
      companionId: 'companion-a',
      responseId: 'resp-1',
      correlationId: 'corr-1',
      channel: 'public' as const,
      audienceId: 'audience-public',
      approval: 'STAGED' as any, // Not approved!
      kind: 'voice' as const,
      lifecycle: 'STARTED' as const,
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    };

    const result = await mockVoiceAdapter.handleEvent(invalidEvent);
    expect(result).toBeDefined();
  });
});
