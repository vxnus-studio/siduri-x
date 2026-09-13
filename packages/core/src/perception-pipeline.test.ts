import {
  PerceptionPipeline,
  PerceptionPipelineContext,
  createDefaultPerceptionPipeline,
} from './perception-pipeline';
import { ResponseGatingEngine } from './gating';
import { ActionPolicyEngine } from './action-policy';
import { ExperienceDispatcher } from './dispatcher';
import { SessionHistoryManager } from './session-history';

describe('PerceptionPipeline (Pipes & Filters Execution)', () => {
  function createMockContext(overrides: Partial<PerceptionPipelineContext> = {}): PerceptionPipelineContext {
    return {
      companionId: 'test-companion',
      companionName: 'Test Companion',
      perception: {
        source: 'text_chat',
        text: 'Hello world',
        roleOrContext: 'OWNER',
      },
      organs: {},
      gating: new ResponseGatingEngine(),
      actionPolicy: new ActionPolicyEngine(),
      dispatcher: new ExperienceDispatcher(),
      sessionHistory: new SessionHistoryManager(),
      ...overrides,
    };
  }

  test('executes stages in sequence and returns response envelope', async () => {
    const executedStages: string[] = [];

    const stageA = async (ctx: PerceptionPipelineContext) => {
      executedStages.push('stageA');
      ctx.rawText = (ctx.perception.text || '').toUpperCase();
    };

    const stageB = async (ctx: PerceptionPipelineContext) => {
      executedStages.push('stageB');
      ctx.responseEnvelope = { result: ctx.rawText };
    };

    const pipeline = new PerceptionPipeline([stageA, stageB]);
    const ctx = createMockContext();
    const result = await pipeline.execute(ctx);

    expect(executedStages).toEqual(['stageA', 'stageB']);
    expect(result).toEqual({ result: 'HELLO WORLD' });
  });

  test('halts pipeline execution early when a stage returns false', async () => {
    const executedStages: string[] = [];

    const stageA = async () => {
      executedStages.push('stageA');
    };

    const stageReject = async (ctx: PerceptionPipelineContext) => {
      executedStages.push('stageReject');
      ctx.responseEnvelope = { rejected: true, reason: 'halt_early' };
      return false; // halt
    };

    const stageB = async () => {
      executedStages.push('stageB');
    };

    const pipeline = new PerceptionPipeline([stageA, stageReject, stageB]);
    const ctx = createMockContext();
    const result = await pipeline.execute(ctx);

    expect(executedStages).toEqual(['stageA', 'stageReject']);
    expect(result).toEqual({ rejected: true, reason: 'halt_early' });
  });

  test('createDefaultPerceptionPipeline constructs a 12-stage pipeline', () => {
    const defaultPipeline = createDefaultPerceptionPipeline();
    expect(defaultPipeline.stages.length).toBe(12);
  });
});
