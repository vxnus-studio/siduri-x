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
      getApprovedClaims: async (companionId?: string, limit?: number) =>
        db.getApprovedClaims(companionId || 'default', limit || 50) as any,
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
          if (ctx.identity.origin) {
            parts.push(`- Origin/Created By: ${ctx.identity.origin}`);
          }
        }
        if (ctx.relationship) {
          const nameStr = ctx.relationship.name ? ` [Name: ${ctx.relationship.name}]` : '';
          parts.push(
            `Relationship Stance:\n- Stance toward ${ctx.relationship.entityId}${nameStr}: ${ctx.relationship.stance} (Role: ${ctx.relationship.role})`
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

  function createCognitiveMockBrain(companionId: string) {
    return {
      generatePlan: jest.fn().mockImplementation(async (brainCtx: any) => {
        const lastMsg = brainCtx.recentMessages?.[brainCtx.recentMessages.length - 1]?.content || '';
        const memoryProposals: any[] = [];
        const behaviorProposals: any[] = [];

        if (/AI researcher at VXNUS Studio/i.test(lastMsg)) {
          memoryProposals.push({
            subject: `companion:${companionId}`,
            predicate: 'role',
            value: 'AI researcher at VXNUS Studio',
          });
          behaviorProposals.push({
            directive: 'Acknowledge role as AI researcher at VXNUS Studio',
            category: 'relational',
            subject: `companion:${companionId}`,
            predicate: 'role',
            value: 'AI researcher at VXNUS Studio',
          });
        } else if (/Lead Architect at VXNUS Studio/i.test(lastMsg)) {
          memoryProposals.push({
            subject: `companion:${companionId}`,
            predicate: 'role',
            value: 'Lead Architect at VXNUS Studio',
          });
        } else if (/Research Specialist/i.test(lastMsg)) {
          memoryProposals.push({
            subject: `companion:${companionId}`,
            predicate: 'role',
            value: 'Research Specialist',
          });
        } else if (/Security Officer/i.test(lastMsg)) {
          memoryProposals.push({
            subject: `companion:${companionId}`,
            predicate: 'role',
            value: 'Security Officer',
          });
        } else if (/VXNUS Studio Staff/i.test(lastMsg)) {
          memoryProposals.push({
            subject: `companion:${companionId}`,
            predicate: 'role',
            value: 'VXNUS Studio Staff',
          });
        }

        if (/\bcreator\b/i.test(lastMsg)) {
          memoryProposals.push({
            subject: 'actor:kur-zagin',
            predicate: 'stated_relationship',
            value: 'creator',
            claimType: 'relationship',
          });
          behaviorProposals.push({
            directive: 'Recognize actor:kur-zagin stated relationship as creator',
            category: 'relational',
            subject: 'actor:kur-zagin',
            predicate: 'stated_relationship',
            value: 'creator',
          });
        }

        if (/Kur Zagin/i.test(lastMsg)) {
          memoryProposals.push({
            subject: 'actor:kur-zagin',
            predicate: 'name',
            value: 'Kur Zagin',
            claimType: 'preference',
          });
          behaviorProposals.push({
            directive: 'Address actor:kur-zagin as Kur Zagin',
            category: 'relational',
            subject: 'actor:kur-zagin',
            predicate: 'name',
            value: 'Kur Zagin',
          });
        }

        if (/be concise when answering technical questions/i.test(lastMsg)) {
          behaviorProposals.push({
            directive: 'Be concise when answering technical questions',
            category: 'behavioral',
            priority: 60,
          });
          memoryProposals.push({
            subject: 'actor:kur-zagin',
            predicate: 'rule',
            value: 'Be concise when answering technical questions',
          });
        }

        return {
          speech: 'Understood, I have acknowledged your input.',
          language: 'en',
          memoryProposals: memoryProposals.length > 0 ? memoryProposals : undefined,
          behaviorProposals: behaviorProposals.length > 0 ? behaviorProposals : undefined,
          _receivedSystemPrompt: brainCtx.systemPrompt,
        };
      }),
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

    const mockBrain = createCognitiveMockBrain(companionId);

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

    const mockBrain = createCognitiveMockBrain(companionId);

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

    const mockBrain = createCognitiveMockBrain(companionId);

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

    const mockBrain = createCognitiveMockBrain(companionId);

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

      const mockBrain1 = createCognitiveMockBrain(companionId);

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

      const mockBrain2 = createCognitiveMockBrain(companionId);

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

    const mockBrain = createCognitiveMockBrain(companionId);

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

  // =========================================================================
  // Test H: Natural conversational teaching (past-tense role, user name, creator)
  // =========================================================================
  it('Test H: teaches companion past role ("she was VXNUS Studio Staff"), creator, and name, then recognizes user on subsequent turn', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-h';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);
    const behavior = createBehaviorCompiler();

    const mockBrain = createCognitiveMockBrain(companionId);

    const runtime = new SiduriRuntime(companionId, { name: 'Siduri' } as any, {
      brain: mockBrain as any,
      memory,
      self,
      behavior,
    });
    await runtime.initialize();

    // 1. "she was VXNUS Studio Staff" in Teach mode
    const resRole = await runtime.processPerception({
      source: 'text_chat',
      text: 'She was VXNUS Studio Staff.',
      context: createRequestContext(companionId, 'teach', 'actor:kur-zagin'),
    });
    expect(resRole.status).toBe('APPROVED');
    const roleProp = resRole.metadata?.proposals?.find((p: any) => p.predicate === 'role');
    expect(roleProp).toBeDefined();
    expect(roleProp.value).toBe('VXNUS Studio Staff');
    await runtime.approveProposal(roleProp.id, { companionId });

    // 2. "my name is Kur Zagin" in Teach mode
    const resName = await runtime.processPerception({
      source: 'text_chat',
      text: 'My name is Kur Zagin.',
      context: createRequestContext(companionId, 'teach', 'actor:kur-zagin'),
    });
    expect(resName.status).toBe('APPROVED');
    const nameProp = resName.metadata?.proposals?.find((p: any) => p.predicate === 'name');
    expect(nameProp).toBeDefined();
    expect(nameProp.value).toBe('Kur Zagin');
    await runtime.approveProposal(nameProp.id, { companionId });

    // 3. "I am your creator" in Teach mode
    const resRel = await runtime.processPerception({
      source: 'text_chat',
      text: 'I am your creator.',
      context: createRequestContext(companionId, 'teach', 'actor:kur-zagin'),
    });
    expect(resRel.status).toBe('APPROVED');
    const relProp = resRel.metadata?.proposals?.find((p: any) => p.predicate === 'stated_relationship');
    expect(relProp).toBeDefined();
    await runtime.approveProposal(relProp.id, { companionId });

    // 4. Verify Self relationship has both creator stance AND user name preserved
    const rel = await self.getRelationship?.(companionId, 'actor:kur-zagin');
    expect(rel).toBeDefined();
    expect(rel?.role).toBe('creator');
    expect(rel?.stance).toBe('familiar_loyal');
    expect(rel?.name).toBe('Kur Zagin');

    // 5. Subsequent conversation turn: "do you know me?"
    await runtime.processPerception({
      source: 'text_chat',
      text: 'do you know me?',
      context: createRequestContext(companionId, 'hybrid', 'actor:kur-zagin'),
    });

    const lastCallCtx = mockBrain.generatePlan.mock.calls[mockBrain.generatePlan.mock.calls.length - 1][0];
    // Active Self contains both the creator stance and the user's name
    expect(lastCallCtx.systemPrompt).toContain('Role: VXNUS Studio Staff');
    expect(lastCallCtx.systemPrompt).toContain('familiar_loyal');
    expect(lastCallCtx.systemPrompt).toContain('Kur Zagin');

    db.close();
  });

  // =========================================================================
  // Test I: Benchmark replication (name, creator, new chat turn-1 recognition)
  // =========================================================================
  it('Test I: reproduces benchmark scenario: teaches name, teaches creator relationship, and verifies new session recognizes creator in origin and relationship', async () => {
    const db = new SiduriDatabase({ dbPath });
    const companionId = 'comp-test-i';
    const self = createSelfRepository(db);
    const memory = createMemoryOrgan(db);
    const behavior = createBehaviorCompiler();

    const mockBrain = {
      generatePlan: jest.fn().mockImplementation(async (brainCtx: any) => {
        const lastMsg = brainCtx.recentMessages?.[brainCtx.recentMessages.length - 1]?.content || '';
        const memoryProposals: any[] = [];
        const behaviorProposals: any[] = [];

        if (/your name is Siduri/i.test(lastMsg)) {
          memoryProposals.push({
            subject: 'companion:self',
            predicate: 'name',
            value: 'Siduri',
          });
          behaviorProposals.push({
            directive: 'Address self as Siduri',
            category: 'relational',
            subject: 'companion:self',
            predicate: 'name',
            value: 'Siduri',
          });
        }

        if (/i am Kur Zagin, your creator/i.test(lastMsg)) {
          memoryProposals.push({
            subject: 'actor:kur_zagin',
            predicate: 'name',
            value: 'Kur Zagin',
          });
          memoryProposals.push({
            subject: 'actor:kur_zagin',
            predicate: 'stated_relationship',
            value: 'creator of companion Siduri',
          });
          behaviorProposals.push({
            directive: 'Acknowledge actor:kur_zagin as creator of companion Siduri',
            category: 'relational',
            subject: 'actor:kur_zagin',
            predicate: 'stated_relationship',
            value: 'creator of companion Siduri',
          });
          behaviorProposals.push({
            directive: 'Address actor:kur_zagin as Kur Zagin',
            category: 'behavioral',
            subject: 'actor:kur_zagin',
            predicate: 'name',
            value: 'Kur Zagin',
          });
        }

        return {
          speech: 'I understand and acknowledge.',
          language: 'en',
          memoryProposals: memoryProposals.length > 0 ? memoryProposals : undefined,
          behaviorProposals: behaviorProposals.length > 0 ? behaviorProposals : undefined,
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

    // Session 1 - Turn 1: "your name is Siduri"
    const res1 = await runtime.processPerception({
      source: 'text_chat',
      text: 'your name is Siduri',
      context: createRequestContext(companionId, 'teach', 'owner-user'),
    });
    expect(res1.status).toBe('APPROVED');
    const nameProp = res1.metadata?.proposals?.find((p: any) => p.predicate === 'name');
    expect(nameProp).toBeDefined();
    await runtime.approveProposal(nameProp.id, { companionId });

    // Verify companion name in self_identity
    const idStep1 = await self.getIdentity(companionId);
    expect(idStep1?.name).toBe('Siduri');

    // Session 1 - Turn 2: "i am Kur Zagin, your creator"
    const res2 = await runtime.processPerception({
      source: 'text_chat',
      text: 'i am Kur Zagin, your creator',
      context: createRequestContext(companionId, 'teach', 'owner-user'),
    });
    expect(res2.status).toBe('APPROVED');

    // Approve both proposals (name and creator of companion Siduri)
    const proposals2 = res2.metadata?.proposals || [];
    const creatorProp = proposals2.find((p: any) => p.predicate === 'stated_relationship');
    const userProp = proposals2.find((p: any) => p.predicate === 'name');
    expect(creatorProp).toBeDefined();
    expect(userProp).toBeDefined();

    await runtime.approveProposal(creatorProp.id, { companionId });
    await runtime.approveProposal(userProp.id, { companionId });

    // Also approve the behavioral directives
    const dirProps = res2.metadata?.behavioral_proposals || [];
    for (const d of dirProps) {
      if (d.directive_id) {
        await runtime.approveDirective(d.directive_id, { companionId });
      }
    }

    // Verify self_identity.origin has been dual-promoted!
    const idStep2 = await self.getIdentity(companionId);
    expect(idStep2?.name).toBe('Siduri');
    expect(idStep2?.origin).toBe('Kur Zagin');

    // Verify relationship has creator role, loyal stance, and user name
    const relStep2 = await self.getRelationship(companionId, 'actor:kur_zagin');
    expect(relStep2).toBeDefined();
    expect(relStep2?.role).toBe('creator');
    expect(relStep2?.stance).toBe('familiar_loyal');
    expect(relStep2?.trustScore).toBe(1.0);
    expect(relStep2?.name).toBe('Kur Zagin');

    // Verify single-owner fallback: an incoming request with 'owner-user' gets the primary relationship!
    const relOwnerUser = await self.getRelationship(companionId, 'owner-user');
    expect(relOwnerUser).toBeDefined();
    expect(relOwnerUser?.name).toBe('Kur Zagin');
    expect(relOwnerUser?.role).toBe('creator');
    expect(relOwnerUser?.stance).toBe('familiar_loyal');

    // =======================================================================
    // Session 2 ("New Chat"): user opens a fresh session as 'owner-user'
    // =======================================================================

    // Turn 1: "hey, who are you?"
    await runtime.processPerception({
      source: 'text_chat',
      text: 'hey, who are you?',
      context: createRequestContext(companionId, 'hybrid', 'owner-user'),
    });

    const calls = mockBrain.generatePlan.mock.calls;
    const newChatTurn1Ctx = calls[calls.length - 1][0];

    // Identity nucleus has origin
    expect(newChatTurn1Ctx.systemPrompt).toContain('Name: Siduri');
    expect(newChatTurn1Ctx.systemPrompt).toContain('Origin/Created By: Kur Zagin');
    // Relationship stance recognizes Kur Zagin as creator
    expect(newChatTurn1Ctx.systemPrompt).toContain('Kur Zagin');
    expect(newChatTurn1Ctx.systemPrompt).toContain('familiar_loyal');

    // Turn 2: "who is your creator?"
    await runtime.processPerception({
      source: 'text_chat',
      text: 'who is your creator?',
      context: createRequestContext(companionId, 'hybrid', 'owner-user'),
    });

    const newChatTurn2Ctx = calls[calls.length - 1][0];
    expect(newChatTurn2Ctx.systemPrompt).toContain('Origin/Created By: Kur Zagin');

    // Turn 3: From an anonymous guest session:
    // Should NOT get the personal relationship stance, but Identity origin remains!
    await runtime.processPerception({
      source: 'text_chat',
      text: 'who is your creator?',
      context: createRequestContext(companionId, 'hybrid', 'anonymous-session'),
    });

    const guestTurnCtx = calls[calls.length - 1][0];
    expect(guestTurnCtx.systemPrompt).toContain('Origin/Created By: Kur Zagin');
    expect(guestTurnCtx.systemPrompt).not.toContain('Stance toward anonymous-session [Name: Kur Zagin]');

    // Turn 4: "who am i?" from owner session:
    // Approved memory claims are retrieved in MEMORY: context even if FTS search yielded 0 keyword matches
    await runtime.processPerception({
      source: 'text_chat',
      text: 'who am i?',
      context: createRequestContext(companionId, 'hybrid', 'owner-user'),
    });

    const whoAmICtx = calls[calls.length - 1][0];
    expect(whoAmICtx.contextPrompt).toContain('MEMORY:');
    expect(whoAmICtx.contextPrompt).toContain('Kur Zagin');

    db.close();
  });
});
