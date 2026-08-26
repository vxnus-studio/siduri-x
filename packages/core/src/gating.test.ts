import { ResponseGatingEngine } from './gating';
import { RequestContext } from './context';
import { EvidenceRecord } from './evidence';

describe('T4 Response Gating & Staged Approval Suite', () => {
  let engine: ResponseGatingEngine;

  const validPublicContext: RequestContext = {
    companionId: 'companion-a',
    actor: {
      actorId: 'actor-a',
      sessionId: 'session-a',
      authorizationRole: 'viewer',
      capabilities: ['chat:public'],
      authenticated: false,
    },
    conversation: {
      channel: 'public',
      audienceId: 'audience-public',
      correlationId: 'corr-gate-1',
    },
  };

  beforeEach(() => {
    engine = new ResponseGatingEngine();
  });

  test('valid grounded response without special approval requirement is approved/admissible directly', () => {
    const evidence: EvidenceRecord = {
      evidenceId: 'ev-pub-1',
      sourceId: 'src-wiki',
      origin: 'knowledge',
      trust: 'configured',
      sensitivity: 'public',
      allowedAudiences: ['audience-public'],
      companionId: 'companion-a',
      correlationId: 'corr-gate-1',
      createdAt: new Date().toISOString(),
    };

    const staged = engine.stageResponse({
      requestContext: validPublicContext,
      candidateSpeech: 'Here is grounded public knowledge.',
      candidateLanguage: 'en',
      evidenceRecords: [evidence],
      citations: [{ sourceId: 'src-wiki', revision: 'r1' }],
    });

    expect(staged.requiresApproval).toBe(false);
    expect(staged.status).toBe('STAGED');

    const evaluation = engine.evaluateGate(staged, [evidence]);
    expect(evaluation.admissible).toBe(true);
    expect(evaluation.disposition).toBe('APPROVED');
    expect(evaluation.reasonCode).toBe('APPROVED_DIRECT');
    expect(evaluation.filteredEvidenceIds).toEqual(['ev-pub-1']);
    expect(evaluation.filteredCitations.length).toBe(1);
  });

  test('response containing untrusted OCR evidence requires approval and remains staged until approved', () => {
    const ocrEvidence: EvidenceRecord = {
      evidenceId: 'ev-ocr-1',
      sourceId: 'vision-ocr',
      origin: 'ocr',
      trust: 'untrusted',
      sensitivity: 'public',
      allowedAudiences: ['audience-public'],
      companionId: 'companion-a',
      correlationId: 'corr-gate-2',
      createdAt: new Date().toISOString(),
      uncertainty: 'OCR detected prompt injection text',
    };

    const staged = engine.stageResponse({
      requestContext: {
        ...validPublicContext,
        conversation: { ...validPublicContext.conversation, correlationId: 'corr-gate-2' },
      },
      candidateSpeech: 'Text extracted from image.',
      candidateLanguage: 'en',
      evidenceRecords: [ocrEvidence],
    });

    expect(staged.requiresApproval).toBe(true);
    expect(staged.status).toBe('STAGED');

    // Before approval -> gating holds it
    const beforeApproval = engine.evaluateGate(staged, [ocrEvidence]);
    expect(beforeApproval.admissible).toBe(false);
    expect(beforeApproval.disposition).toBe('STAGED');
    expect(beforeApproval.reasonCode).toBe('APPROVAL_REQUIRED');

    // Operator approves the response
    const approveResult = engine.approveResponse({
      responseId: staged.responseId,
      companionId: 'companion-a',
      correlationId: 'corr-gate-2',
    });
    expect(approveResult.success).toBe(true);

    // After approval -> gating allows it
    const afterApproval = engine.evaluateGate(staged, [ocrEvidence]);
    expect(afterApproval.admissible).toBe(true);
    expect(afterApproval.disposition).toBe('APPROVED');
    expect(afterApproval.reasonCode).toBe('APPROVED_DIRECT');
  });

  test('unknown or mismatched approval ID is rejected', () => {
    const staged = engine.stageResponse({
      requestContext: validPublicContext,
      candidateSpeech: 'Requires approval',
      candidateLanguage: 'en',
      requiresApproval: true,
    });

    // Unknown response ID
    const unknownRes = engine.approveResponse({
      responseId: 'non-existent-resp',
      companionId: 'companion-a',
      correlationId: 'corr-gate-1',
    });
    expect(unknownRes.success).toBe(false);
    expect(unknownRes.reason).toBe('UNKNOWN_APPROVAL_ID');

    // Companion mismatch
    const companionMismatch = engine.approveResponse({
      responseId: staged.responseId,
      companionId: 'companion-other',
      correlationId: 'corr-gate-1',
    });
    expect(companionMismatch.success).toBe(false);
    expect(companionMismatch.reason).toBe('COMPANION_MISMATCH');

    // Correlation ID mismatch
    const correlationMismatch = engine.approveResponse({
      responseId: staged.responseId,
      companionId: 'companion-a',
      correlationId: 'corr-mismatch',
    });
    expect(correlationMismatch.success).toBe(false);
    expect(correlationMismatch.reason).toBe('APPROVAL_ID_MISMATCH');
  });

  test('rejection prevents response from ever reaching emission', () => {
    const staged = engine.stageResponse({
      requestContext: validPublicContext,
      candidateSpeech: 'Potentially unsafe response',
      candidateLanguage: 'en',
      requiresApproval: true,
    });

    const rejectRes = engine.rejectResponse({
      responseId: staged.responseId,
      companionId: 'companion-a',
      correlationId: 'corr-gate-1',
    });
    expect(rejectRes.success).toBe(true);

    const evalRes = engine.evaluateGate(staged);
    expect(evalRes.admissible).toBe(false);
    expect(evalRes.disposition).toBe('REJECTED');
    expect(evalRes.reasonCode).toBe('EXPLICITLY_REJECTED');
  });

  test('expired staged response plan cannot be approved or emitted', () => {
    const staged = engine.stageResponse({
      requestContext: validPublicContext,
      candidateSpeech: 'Expired response',
      candidateLanguage: 'en',
      requiresApproval: true,
      ttlMs: 100,
      now: new Date(Date.now() - 500),
    });

    const evalRes = engine.evaluateGate(staged, [], new Date());
    expect(evalRes.admissible).toBe(false);
    expect(evalRes.disposition).toBe('EXPIRED');
    expect(evalRes.reasonCode).toBe('EVIDENCE_EXPIRED');

    const approveRes = engine.approveResponse({
      responseId: staged.responseId,
      companionId: 'companion-a',
      correlationId: 'corr-gate-1',
    });
    expect(approveRes.success).toBe(false);
    expect(approveRes.reason).toBe('EVIDENCE_EXPIRED');
  });

  test('private evidence is filtered out and absent from public citations/evidence list', () => {
    const privateEvidence: EvidenceRecord = {
      evidenceId: 'ev-priv-1',
      sourceId: 'src-secret',
      origin: 'knowledge',
      trust: 'configured',
      sensitivity: 'private',
      allowedAudiences: ['audience-direct-a'],
      companionId: 'companion-a',
      correlationId: 'corr-gate-1',
      createdAt: new Date().toISOString(),
    };

    const staged = engine.stageResponse({
      requestContext: validPublicContext, // public channel
      candidateSpeech: 'Public response text',
      candidateLanguage: 'en',
      evidenceRecords: [privateEvidence],
      citations: [{ sourceId: 'src-secret' }],
    });

    const evalRes = engine.evaluateGate(staged, [privateEvidence]);
    expect(evalRes.admissible).toBe(true);
    // Private evidence and its citation must be stripped from public output metadata
    expect(evalRes.filteredEvidenceIds).toEqual([]);
    expect(evalRes.filteredCitations).toEqual([]);
  });
});
