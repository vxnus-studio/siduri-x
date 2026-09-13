import {
  BrainOrgan,
  MemoryOrgan,
  VoiceOrgan,
  KnowledgeOrgan,
  VisionOrgan,
  BehaviorOrgan,
  BodyOrgan,
  HandsOrgan,
  EarOrgan,
  ObservationOrgan,
  Message,
  RequestContext,
  ActionPolicyEngine,
  ResponseGatingEngine,
  ExperienceDispatcher,
  ExperienceAdapter,
  OrganConfig,
  StagedResponsePlan,
  ResponseGateEvaluation,
  MouthOrgan,
  MouthMedium,
  FormattedMouthOutput,
  SelfRepository,
  EKnowledgeOrgan,
  ActionExecutionResult,
  ResponsePlan,
} from './index';
import { normalizeUserInput, NormalizedInput } from './input-normalizer';
import { classifyInputIntentAsync, IntentClassification } from './intent-classifier';
import { retrieveRuntimeContext, RetrievedContext } from './context-retriever';
import { compilePrompts, CompiledPrompts } from './prompt-compiler';
import { generateCognitionPlan } from './cognition-planner';
import { settleMemoryProposals, MemorySettlementResult } from './memory-settler';
import { executeActionIntents } from './action-executor';
import { emitExperienceEvents, ExperienceEmissionResult } from './experience-emitter';
import {
  createGateRejectionEnvelope,
  assembleResponseEnvelope,
} from './response-envelope';
import { SessionHistoryManager } from './session-history';

export interface CompanionPerception {
  source: string;
  text?: string;
  audioBuffer?: Uint8Array;
  roleOrContext?: 'OWNER' | 'VIEWER' | 'OPERATOR' | RequestContext | string;
  context?: RequestContext;
  history?: Message[];
  medium?: MouthMedium;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface PerceptionPipelineContext {
  companionId: string;
  companionName: string;
  perception: CompanionPerception;
  organs: {
    brain?: BrainOrgan;
    memory?: MemoryOrgan;
    voice?: VoiceOrgan | ExperienceAdapter;
    knowledge?: KnowledgeOrgan;
    vision?: VisionOrgan;
    behavior?: BehaviorOrgan;
    body?: BodyOrgan | ExperienceAdapter;
    hands?: HandsOrgan;
    ear?: EarOrgan;
    observation?: ObservationOrgan;
    mouth?: MouthOrgan;
    self?: SelfRepository;
    externalKnowledge?: EKnowledgeOrgan;
  };
  gating: ResponseGatingEngine;
  actionPolicy: ActionPolicyEngine;
  dispatcher: ExperienceDispatcher;
  sessionHistory: SessionHistoryManager;

  // Pipeline flow variables
  rawText?: string;
  input?: NormalizedInput;
  sessionKey?: string;
  intent?: IntentClassification;
  contextRetrieval?: RetrievedContext;
  prompts?: CompiledPrompts;
  plan?: ResponsePlan;
  stagedPlan?: StagedResponsePlan;
  gateEval?: ResponseGateEvaluation;
  memorySettlement?: MemorySettlementResult;
  actionResults?: ActionExecutionResult[];
  experienceEmission?: ExperienceEmissionResult;
  mouthDelivery?: FormattedMouthOutput;
  responseEnvelope?: any;
}

export type PerceptionPipelineStage = (context: PerceptionPipelineContext) => Promise<boolean | void>;

export class PerceptionPipeline {
  constructor(public readonly stages: PerceptionPipelineStage[]) {}

  async execute(context: PerceptionPipelineContext): Promise<any> {
    for (const stage of this.stages) {
      const continueNext = await stage(context);
      if (continueNext === false) {
        break;
      }
    }
    return context.responseEnvelope;
  }
}

// --- Individual Pipeline Stages ---

export const earTranscriptionStage: PerceptionPipelineStage = async (context) => {
  let rawText = context.perception.text || '';
  if (!rawText && context.perception.audioBuffer && context.organs.ear && typeof context.organs.ear.transcribeAudio === 'function') {
    rawText = await context.organs.ear.transcribeAudio(context.perception.audioBuffer);
  }
  context.rawText = rawText;
};

export const inputNormalizationStage: PerceptionPipelineStage = async (context) => {
  const roleOrContext = context.perception.context || context.perception.roleOrContext || 'OWNER';
  const history = context.perception.history || [];

  const input = await normalizeUserInput(
    context.rawText || '',
    roleOrContext,
    history,
    context.companionId,
    context.organs.ear
  );
  context.input = input;

  const sessionKey =
    input.requestContext.actor.sessionId ||
    input.requestContext.conversation.correlationId ||
    'default';
  context.sessionKey = sessionKey;

  const currentMessage: Message = { role: 'user', content: input.perceivedText };
  const boundedSessionHistory = [...input.boundedHistory, currentMessage].slice(-20);
  context.sessionHistory.setHistory(sessionKey, boundedSessionHistory);
  context.sessionHistory.setHistory('default', boundedSessionHistory);
};

export const intentClassificationStage: PerceptionPipelineStage = async (context) => {
  if (!context.input) return;
  const intent = await classifyInputIntentAsync(
    context.input.perceivedText,
    context.input.requestContext,
    context.organs.ear?.classifyIntent
      ? (t, c) => context.organs.ear!.classifyIntent!(t, c) as any
      : undefined
  );
  context.intent = intent;
};

export const contextRetrievalStage: PerceptionPipelineStage = async (context) => {
  if (!context.input || !context.intent) return;
  const contextRetrieval = await retrieveRuntimeContext({
    companionId: context.companionId,
    perceivedText: context.input.perceivedText,
    requestContext: context.input.requestContext,
    role: context.input.role,
    isContextObject: context.input.isContextObject,
    shouldQueryKnowledge: context.intent.shouldQueryKnowledge,
    knowledge: context.organs.knowledge,
    memory: context.organs.memory,
    self: context.organs.self,
    externalKnowledge: context.organs.externalKnowledge,
  });
  context.contextRetrieval = contextRetrieval;
};

export const promptCompilationStage: PerceptionPipelineStage = async (context) => {
  if (!context.input || !context.contextRetrieval) return;
  const prompts = await compilePrompts({
    companionName: context.companionName,
    companionId: context.companionId,
    role: context.input.role,
    requestContext: context.input.requestContext,
    behavior: context.organs.behavior,
    activeDirectives: context.contextRetrieval.activeDirectives,
    subsystemDiagnostics: context.contextRetrieval.subsystemDiagnostics,
    knowledgeData: context.contextRetrieval.knowledgeData,
    memoryData: context.contextRetrieval.memoryData,
    lifeContext: context.contextRetrieval.lifeContext,
  });
  context.prompts = prompts;
};

export const cognitionPlanningStage: PerceptionPipelineStage = async (context) => {
  if (!context.input || !context.prompts || !context.sessionKey) return;
  const plan = await generateCognitionPlan({
    companionName: context.companionName,
    brain: context.organs.brain,
    systemPrompt: context.prompts.systemPrompt,
    contextPrompt: context.prompts.contextPrompt,
    recentMessages: context.sessionHistory.getHistory(context.sessionKey).slice(-10),
    recipient: context.input.role,
    perceivedText: context.input.perceivedText,
  });
  context.plan = plan;
};

export const responseGatingStage: PerceptionPipelineStage = async (context) => {
  if (!context.input || !context.plan || !context.contextRetrieval || !context.sessionKey) return;
  const stagedPlan = context.gating.stageResponse({
    requestContext: context.input.requestContext,
    candidateSpeech: context.plan.speech,
    candidateLanguage: context.plan.language || 'ja',
    internalMonologue: context.plan.internalMonologue,
    memoryProposals: context.plan.memoryProposals,
    behaviorProposals: context.plan.behaviorProposals,
    evidenceRecords: context.contextRetrieval.collectedEvidence,
    citations: context.contextRetrieval.citations,
  });
  context.stagedPlan = stagedPlan;

  const gateEval = context.gating.evaluateGate(
    stagedPlan,
    context.contextRetrieval.collectedEvidence
  );
  context.gateEval = gateEval;

  if (!gateEval.admissible) {
    context.responseEnvelope = createGateRejectionEnvelope(stagedPlan, gateEval);
    return false; // Terminate pipeline early upon rejection
  }

  context.sessionHistory.append(context.sessionKey, { role: 'assistant', content: context.plan.speech });
  context.sessionHistory.append('default', { role: 'assistant', content: context.plan.speech });
};

export const memorySettlementStage: PerceptionPipelineStage = async (context) => {
  if (!context.input || !context.plan || !context.intent) return;
  const memorySettlement = await settleMemoryProposals({
    companionId: context.companionId,
    perceivedText: context.input.perceivedText,
    role: context.input.role,
    requestContext: context.input.requestContext,
    memory: context.organs.memory,
    explicitTeaching: context.intent.explicitTeaching,
    plan: context.plan,
  });
  context.memorySettlement = memorySettlement;
};

export const actionExecutionStage: PerceptionPipelineStage = async (context) => {
  if (!context.input || !context.plan) return;
  const actionResults = await executeActionIntents({
    actionIntents: context.plan.actionIntents,
    requestContext: context.input.requestContext,
    actionPolicy: context.actionPolicy,
    hands: context.organs.hands,
  });
  context.actionResults = actionResults;
};

export const experienceEmissionStage: PerceptionPipelineStage = async (context) => {
  if (!context.input || !context.plan || !context.stagedPlan || !context.gateEval) return;
  const experienceEmission = await emitExperienceEvents({
    companionId: context.companionId,
    requestContext: context.input.requestContext,
    stagedPlan: context.stagedPlan,
    gateEval: context.gateEval,
    speech: context.plan.speech,
    language: context.plan.language || 'ja',
    dispatcher: context.dispatcher,
    voice: context.organs.voice,
    body: context.organs.body,
  });
  context.experienceEmission = experienceEmission;
};

export const mouthDeliveryStage: PerceptionPipelineStage = async (context) => {
  if (!context.plan || !context.stagedPlan || !context.gateEval || !context.contextRetrieval) return;
  let mouthDelivery: FormattedMouthOutput | undefined;

  if (context.organs.mouth && typeof context.organs.mouth.speak === 'function') {
    try {
      const avatarEvent = context.experienceEmission?.experienceEvents.find(
        (e) => e.kind === 'avatar'
      );
      mouthDelivery = await context.organs.mouth.speak({
        utteranceId: context.stagedPlan.responseId,
        companionId: context.companionId,
        responseId: context.stagedPlan.responseId,
        correlationId: context.stagedPlan.correlationId,
        text: context.plan.speech,
        language: context.plan.language || 'ja',
        subtitleJa: context.plan.speech,
        subtitleEn: context.plan.speech,
        spokenJa: context.plan.speech,
        expression: avatarEvent?.expression,
        medium: context.perception.medium,
        signal: context.perception.signal,
        audioUrl: context.experienceEmission?.speechId
          ? `/voice/stream?id=${context.experienceEmission.speechId}`
          : undefined,
        metadata: {
          subsystemDiagnostics: context.contextRetrieval.subsystemDiagnostics,
          internalMonologue: context.plan.internalMonologue,
        },
        citations: context.gateEval.filteredCitations,
        evidenceIds: context.gateEval.filteredEvidenceIds,
      });
    } catch (e: any) {
      console.error('[SiduriRuntime] Mouth delivery failed:', e?.message || e);
    }
  }
  context.mouthDelivery = mouthDelivery;
};

export const envelopeAssemblyStage: PerceptionPipelineStage = async (context) => {
  if (!context.stagedPlan || !context.plan || !context.gateEval || !context.contextRetrieval || !context.memorySettlement) return;
  const envelope = assembleResponseEnvelope({
    stagedPlan: context.stagedPlan,
    speech: context.plan.speech,
    language: context.plan.language,
    speechId: context.experienceEmission?.speechId,
    createdMemoryProposals: context.memorySettlement.createdMemoryProposals,
    memoryProposalReceipts: context.memorySettlement.memoryProposalReceipts,
    actionResults: context.actionResults || [],
    filteredEvidenceIds: context.gateEval.filteredEvidenceIds,
    filteredCitations: context.gateEval.filteredCitations,
    subsystemDiagnostics: context.contextRetrieval.subsystemDiagnostics,
    experienceEvents: context.experienceEmission?.experienceEvents || [],
    mouthDelivery: context.mouthDelivery,
  });
  context.responseEnvelope = envelope;
};

export function createDefaultPerceptionPipeline(): PerceptionPipeline {
  return new PerceptionPipeline([
    earTranscriptionStage,
    inputNormalizationStage,
    intentClassificationStage,
    contextRetrievalStage,
    promptCompilationStage,
    cognitionPlanningStage,
    responseGatingStage,
    memorySettlementStage,
    actionExecutionStage,
    experienceEmissionStage,
    mouthDeliveryStage,
    envelopeAssemblyStage,
  ]);
}
