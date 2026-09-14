import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SiduriRuntime,
  SiduriDatabase,
  RequestContext,
  SelfRepository,
  MemoryOrgan,
  BehaviorOrgan,
} from './index';

describe('Conversational Teach Mode End-to-End Lifecycle', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siduri-teach-test-'));
    dbPath = path.join(tmpDir, 'siduri.db');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  /**
   * Helper to build a SelfRepository wrapping a SiduriDatabase
   */
  function createSelfRepository(db: SiduriDatabase): SelfRepository {
    return {
      getIdentity: async (companionId: string) => db.getIdentity(companionId),
      setIdentity: async (identity: any) => db.setIdentity(identity),
      getPersonality: async (companionId: string) =>
        db.getPersonality(companionId) || {
          warmth: 0.5,
          formality: 0.5,
          sarcasm: 0.5,
          verbosity: 0.5,
          curiosity: 0.5,
        },
      setPersonality: async (companionId: string, traits: any) =>
        db.setPersonality(companionId, traits),
      getActiveDirectives: async (companionId: string) =>
        db.getActiveDirectives(companionId),
      commitDirectives: async (companionId: string, directives: any[]) => {
        for (const d of directives) {
          db.commitDirective(d);
        }
      },
      getRelationship: async (companionId: string, entityId: string) =>
        db.getRelationship(companionId, entityId) || null,
      updateRelationship: async (companionId: string, rel: any) =>
        db.upsertRelationship({ ...rel, companionId }),
      approveDirective: async (id: string, companionId?: string) =>
        db.approveDirective(id, companionId),
      rejectDirective: async (id: string, companionId?: string) =>
        db.rejectDirective(id, companionId),
      revokeDirective: async (id: string, companionId?: string) =>
        db.revokeDirective(id, companionId),
    };
  }

  /**
   * Helper to build a MemoryOrgan wrapping a SiduriDatabase
   */
  function createMemoryOrgan(db: SiduriDatabase): MemoryOrgan {
    return {
      initialize: async () => {},
      proposeClaim: async (claim: any) => db.proposeClaim(claim) as any,
      searchClaims: async () => [],
      getClaims: async (limit?: number) => db.getAllClaims(undefined, limit || 500) as any,
      getPendingClaims: async (limit?: number) =>
        db.getAllClaims(undefined, limit || 500).filter((c: any) => c.status === 'pending') as any,
      approveClaim: async (id: string) => db.approveClaim(id),
      rejectClaim: async (id: string) => db.rejectClaim(id),
      getDirectives: async (companionId?: string) =>
        db.getActiveDirectives(companionId || 'default') as any,
      proposeDirective: async (dir: any) => {
        const id = `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const directive = {
          ...dir,
          id,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        db.commitDirective(directive as any);
        return directive as any;
      },
      approveDirective: async (id: string, companionId?: string) =>
        db.approveDirective(id, companionId),
      rejectDirective: async (id: string, companionId?: string) =>
        db.rejectDirective(id, companionId),
      revokeDirective: async (id: string, companionId?: string) =>
        db.revokeDirective(id, companionId),
      disableDirective: async (id: string, companionId?: string) =>
        db.disableDirective(id, companionId),
    };
  }

  /**
   * Mock behavior compiler that compiles active_self tags from context
   */
  function createBehaviorCompiler(): BehaviorOrgan {
    return {
      compile: async (ctx: any) => {
        const parts = ['<active_self>'];
        if (ctx.identity) {
          parts.push(`Identity:\n- Name: ${ctx.identity.name}`);
          if (ctx.identity.archetype || ctx.identity.role) {
            parts.push(`- Role: ${ctx.identity.role || ctx.identity.archetype}`);
          }
        }
        if (ctx.relationship) {
          parts.push(
            `Relationship Stance:\n- Stance toward ${ctx.relationship.entityId}: ${ctx.relationship.stance} (Role: ${ctx.relationship.role})`
          );
        }
        if (ctx.directives && ctx.directives.length > 0) {
          parts.push(
            `Behavioral Directives:\n${ctx.directives.map((d: any) => `- ${d.directive}`).join('\n')}`
          );
        }
        parts.push('</active_self>');
        return parts.join('\n\n');
      },
    } as any;
  }

  function createRequestContext(
    companionId: string,
    mode: 'teach' | 'casual' | 'hybrid' = 'teach',
    actorId: string = 'kur-zagin'
  ): RequestContext {
    return {
      companionId,
      mode,
      actor: {
        actorId,
        sessionId: 'sess-teach-1',
        authorizationRole: 'OWNER',
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        correlationId: `corr-${Date.now()}`,
      },
    };
  }

  // =========================================================================
  // Test A: Conversational role teaching in Teach mode
  // =========================================================================
  it('Test A: teaches companion role in Teach mode, approves proposal, and reflects role in Active Self', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-a';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);
    const behavior = createBehaviorCompiler();

    const mockBrain = {
      generatePlan: jest.fn().mockImplementation(async (brainCtx: any) => {
        return {
          speech: 'Understood, I have acknowledged my role.',
          language: 'en',
          // Brain context should have received the system prompt
          _receivedSystemPrompt: brainCtx.systemPrompt,
        };
      }),
    };

    const runtime = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
      brain: mockBrain as any,
      memory,
      self,
      behavior,
    });
    await runtime.initialize();

    // 1. Send conversational role teaching message
    const perceptionResult = await runtime.processPerception({
      source: 'text_chat',
      text: 'Siduri, you are an AI researcher at VXNUS Studio.',
      context: createRequestContext(companionId, 'teach'),
    });

    expect(perceptionResult.status).toBe('APPROVED');

    // 2. Verify proposal was generated
    const proposals = perceptionResult.metadata?.proposals || [];
    expect(proposals.length).toBeGreaterThanOrEqual(1);

    const roleProposal = proposals.find(
      (p: any) => p.predicate === 'role' || p.predicate === 'archetype'
    );
    expect(roleProposal).toBeDefined();
    expect(roleProposal.value).toBe('AI researcher at VXNUS Studio');
    expect(roleProposal.status).toBe('pending');

    // 3. Truth Gate check: Before approval, SelfRepository must NOT contain the new role
    const identityBefore = await self.getIdentity(companionId);
    expect(identityBefore?.role).toBeUndefined();
    expect(identityBefore?.archetype).toBeUndefined();

    // 4. Operator / Owner approves the proposal
    const approveResult = await runtime.approveProposal(roleProposal.id, { companionId });
    expect(approveResult.success).toBe(true);

    // 5. Verify SelfRepository now has the learned role
    const identityAfter = await self.getIdentity(companionId);
    expect(identityAfter).toBeDefined();
    expect(identityAfter?.role).toBe('AI researcher at VXNUS Studio');
    expect(identityAfter?.archetype).toBe('AI researcher at VXNUS Studio');

    // Also verify a relational directive acknowledging the role was added
    const directives = await self.getActiveDirectives(companionId);
    const roleDirective = directives.find((d) =>
      d.directive.includes('AI researcher at VXNUS Studio')
    );
    expect(roleDirective).toBeDefined();

    // 6. Next conversational turn: verify prompt compiler injects the updated Active Self
    await runtime.processPerception({
      source: 'text_chat',
      text: 'What is your primary mission?',
      context: createRequestContext(companionId, 'hybrid'),
    });

    expect(mockBrain.generatePlan).toHaveBeenCalled();
    const lastCallCtx = mockBrain.generatePlan.mock.calls[1][0];
    expect(lastCallCtx.systemPrompt).toContain('<active_self>');
    expect(lastCallCtx.systemPrompt).toContain('Role: AI researcher at VXNUS Studio');

    db.close();
  });

  // =========================================================================
  // Test B: Creator relationship teaching
  // =========================================================================
  it('Test B: teaches creator relationship, approves proposal, and updates relationship stance', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-b';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);
    const behavior = createBehaviorCompiler();

    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'Greetings, Creator.',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
      brain: mockBrain as any,
      memory,
      self,
      behavior,
    });
    await runtime.initialize();

    // 1. Send creator teaching message
    const perceptionResult = await runtime.processPerception({
      source: 'text_chat',
      text: 'I am your creator, Kur Zagin.',
      context: createRequestContext(companionId, 'teach', 'actor:kur-zagin'),
    });

    const proposals = perceptionResult.metadata?.proposals || [];
    const relProposal = proposals.find(
      (p: any) =>
        p.predicate === 'stated_relationship' ||
        p.predicate === 'relationship' ||
        p.claimType === 'relationship'
    );
    expect(relProposal).toBeDefined();
    expect(relProposal.value).toBe('creator');

    // 2. Truth Gate: Before approval, relationship does not have creator stance
    const relBefore = await self.getRelationship?.(companionId, 'actor:kur-zagin');
    expect(relBefore?.role).toBeUndefined();

    // 3. Approve the relationship proposal
    await runtime.approveProposal(relProposal.id, { companionId });

    // 4. Verify SelfRepository now has creator relationship with loyal stance
    const relAfter = await self.getRelationship?.(companionId, 'actor:kur-zagin');
    expect(relAfter).toBeDefined();
    expect(relAfter?.role).toBe('creator');
    expect(relAfter?.stance).toBe('familiar_loyal');
    expect(relAfter?.trustScore).toBe(1.0);

    // 5. Subsequent conversation retrieves relationship in prompt
    await runtime.processPerception({
      source: 'text_chat',
      text: 'Status update please.',
      context: createRequestContext(companionId, 'hybrid', 'actor:kur-zagin'),
    });

    const lastCallCtx = mockBrain.generatePlan.mock.calls[1][0];
    expect(lastCallCtx.systemPrompt).toContain('Stance toward actor:kur-zagin: familiar_loyal (Role: creator)');

    db.close();
  });

  // =========================================================================
  // Test C: Behavioral rule teaching
  // =========================================================================
  it('Test C: teaches behavioral rule, generates proposal, approves, and activates directive in Self', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-c';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);
    const behavior = createBehaviorCompiler();

    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'Rule noted.',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
      brain: mockBrain as any,
      memory,
      self,
      behavior,
    });
    await runtime.initialize();

    // 1. Send behavioral rule teaching message
    const perceptionResult = await runtime.processPerception({
      source: 'text_chat',
      text: 'Remember this rule: be concise when answering technical questions.',
      context: createRequestContext(companionId, 'teach'),
    });

    // Check behavioral proposals or memory proposals
    const behavioralReceipts = perceptionResult.metadata?.behavioral_proposals || [];
    const memoryProposals = perceptionResult.metadata?.proposals || [];

    const hasDirectiveProposal =
      behavioralReceipts.length > 0 ||
      memoryProposals.some((p: any) => p.predicate === 'rule' || p.predicate === 'behavioral_rule');
    expect(hasDirectiveProposal).toBe(true);

    const directiveId = behavioralReceipts[0]?.directive_id;
    const proposalId = memoryProposals[0]?.id;

    // 2. Active directives before approval must not include the new rule
    const directivesBefore = await self.getActiveDirectives(companionId);
    expect(
      directivesBefore.some((d) => d.directive.toLowerCase().includes('be concise when answering technical questions'))
    ).toBe(false);

    // 3. Approve directive via runtime
    if (directiveId) {
      await runtime.approveDirective(directiveId, { companionId });
    } else if (proposalId) {
      await runtime.approveProposal(proposalId, { companionId });
    }

    // 4. Verify directive is now ACTIVE in SelfRepository
    const directivesAfter = await self.getActiveDirectives(companionId);
    expect(
      directivesAfter.some((d) => d.directive.toLowerCase().includes('be concise when answering technical questions'))
    ).toBe(true);

    db.close();
  });

  // =========================================================================
  // Test D: Casual banter in Casual mode (Zero Memory Drift)
  // =========================================================================
  it('Test D: casual banter in casual mode causes Zero Memory Drift and does NOT mutate Self', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-d';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);

    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'Haha, thank you! I try my best.',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
      brain: mockBrain as any,
      memory,
      self,
    });
    await runtime.initialize();

    // "You are probably the funniest AI I've ever talked to." in casual mode
    const perceptionResult = await runtime.processPerception({
      source: 'text_chat',
      text: "You are probably the funniest AI I've ever talked to.",
      context: createRequestContext(companionId, 'casual'),
    });

    expect(perceptionResult.status).toBe('APPROVED');
    // Zero proposals allowed in casual mode
    expect(perceptionResult.metadata?.proposals).toEqual([]);
    expect(perceptionResult.metadata?.memory_proposals).toEqual([]);

    // Self must remain unchanged
    const identity = await self.getIdentity(companionId);
    expect(identity?.role).toBeUndefined();
    expect(identity?.archetype).toBeUndefined();

    const directives = await self.getActiveDirectives(companionId);
    expect(directives).toHaveLength(0);

    db.close();
  });

  // =========================================================================
  // Test E: Approval gating: rejection leaves Self unchanged
  // =========================================================================
  it('Test E: rejecting a proposal prevents mutation of Self', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-e';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);

    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'Understood.',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
      brain: mockBrain as any,
      memory,
      self,
    });
    await runtime.initialize();

    // 1. Propose a role change
    const perceptionResult = await runtime.processPerception({
      source: 'text_chat',
      text: 'Siduri, your role is Security Officer.',
      context: createRequestContext(companionId, 'teach'),
    });

    const proposal = perceptionResult.metadata?.proposals?.[0];
    expect(proposal).toBeDefined();

    // 2. Reject the proposal
    await runtime.rejectProposal(proposal.id, { companionId });

    // 3. Verify Self is NOT mutated
    const identity = await self.getIdentity(companionId);
    expect(identity?.role).toBeUndefined();
    expect(identity?.archetype).toBeUndefined();

    db.close();
  });

  // =========================================================================
  // Test F: Cross-restart durability (survives runtime restart)
  // =========================================================================
  it('Test F: persists learned state across runtime destruction and recreation', async () => {
    const companionId = 'comp-test-f';

    // --- Phase 1: Runtime 1 teaches and approves ---
    {
      const db1 = new SiduriDatabase({ dbPath });
      const self1 = createSelfRepository(db1);
      const memory1 = createMemoryOrgan(db1);

      const mockBrain1 = {
        generatePlan: jest.fn().mockResolvedValue({
          speech: 'I have recorded my new role as Lead Architect.',
          language: 'en',
        }),
      };

      const runtime1 = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
        brain: mockBrain1 as any,
        memory: memory1,
        self: self1,
      });
      await runtime1.initialize();

      const res = await runtime1.processPerception({
        source: 'text_chat',
        text: 'Siduri, you are the Lead Architect at VXNUS Studio.',
        context: createRequestContext(companionId, 'teach'),
      });

      const roleProposal = res.metadata?.proposals?.find((p: any) => p.predicate === 'role');
      expect(roleProposal).toBeDefined();

      await runtime1.approveProposal(roleProposal.id, { companionId });

      // Verify in runtime 1
      const id1 = await self1.getIdentity(companionId);
      expect(id1?.role).toBe('Lead Architect at VXNUS Studio');

      // Close and destroy runtime 1 completely
      db1.close();
    }

    // --- Phase 2: Runtime 2 initialized afresh pointing to same SQLite database ---
    {
      const db2 = new SiduriDatabase({ dbPath });
      const self2 = createSelfRepository(db2);
      const memory2 = createMemoryOrgan(db2);
      const behavior2 = createBehaviorCompiler();

      const mockBrain2 = {
        generatePlan: jest.fn().mockResolvedValue({
          speech: 'Ready to build architecture.',
          language: 'en',
        }),
      };

      const runtime2 = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
        brain: mockBrain2 as any,
        memory: memory2,
        self: self2,
        behavior: behavior2,
      });
      await runtime2.initialize();

      // Verify that runtime 2 retrieves the learned role from SQLite!
      const id2 = await self2.getIdentity(companionId);
      expect(id2).toBeDefined();
      expect(id2?.role).toBe('Lead Architect at VXNUS Studio');
      expect(id2?.archetype).toBe('Lead Architect at VXNUS Studio');

      // Verify that conversation in runtime 2 retrieves the learned role in prompt compilation
      await runtime2.processPerception({
        source: 'text_chat',
        text: 'What do you do?',
        context: createRequestContext(companionId, 'hybrid'),
      });

      const lastCallCtx = mockBrain2.generatePlan.mock.calls[0][0];
      expect(lastCallCtx.systemPrompt).toContain('Role: Lead Architect at VXNUS Studio');

      db2.close();
    }
  });

  // =========================================================================
  // Test G: Idempotency (duplicate approval does not corrupt database)
  // =========================================================================
  it('Test G: approving the same proposal twice is idempotent and does not create duplicate entries', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-g';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);

    const mockBrain = {
      generatePlan: jest.fn().mockResolvedValue({
        speech: 'Understood.',
        language: 'en',
      }),
    };

    const runtime = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
      brain: mockBrain as any,
      memory,
      self,
    });
    await runtime.initialize();

    const res = await runtime.processPerception({
      source: 'text_chat',
      text: 'Siduri, you are a Research Specialist.',
      context: createRequestContext(companionId, 'teach'),
    });

    const proposal = res.metadata?.proposals?.[0];
    expect(proposal).toBeDefined();

    // Approve once
    await runtime.approveProposal(proposal.id, { companionId });
    const idFirst = await self.getIdentity(companionId);
    expect(idFirst?.role).toBe('Research Specialist');

    // Approve a second time (should be completely idempotent and not error)
    await runtime.approveProposal(proposal.id, { companionId });
    const idSecond = await self.getIdentity(companionId);
    expect(idSecond?.role).toBe('Research Specialist');

    // Check directives: should only have one directive for acknowledging the role
    const directives = await self.getActiveDirectives(companionId);
    const roleDirectives = directives.filter((d) => d.directive.includes('Research Specialist'));
    expect(roleDirectives).toHaveLength(1);

    db.close();
  });
});
