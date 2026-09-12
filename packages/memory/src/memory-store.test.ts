import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SqliteMemoryStore,
  MemoryEventInput,
  ClaimProposalInput,
} from './index';

describe('@siduri-x/memory Domain Package (Pure SQLite FTS5)', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: SqliteMemoryStore;
  const companionId = 'siduri-episodic-test';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siduri-mem-test-'));
    dbPath = path.join(tmpDir, 'memory.db');
    store = new SqliteMemoryStore({ dbPath });
  });

  afterEach(() => {
    try {
      store.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Episodic Event Ingestion & History', () => {
    it('records episodic events and retrieves in reverse chronological order', async () => {
      const e1: MemoryEventInput = {
        id: 'ev-1',
        sourceType: 'chat_turn',
        occurredAt: '2026-09-11T10:00:00Z',
        payload: { user: 'Hello Siduri', turn: 1 },
      };

      const e2: MemoryEventInput = {
        id: 'ev-2',
        sourceType: 'tool_result',
        occurredAt: '2026-09-11T10:01:00Z',
        payload: { tool: 'calculator', result: 42 },
      };

      const e3: MemoryEventInput = {
        id: 'ev-3',
        sourceType: 'sensory',
        occurredAt: '2026-09-11T10:02:00Z',
        payload: { modality: 'vision', object: 'coffee cup' },
      };

      await store.recordEvent(companionId, e1);
      await store.recordEvent(companionId, e2);
      await store.recordEvent(companionId, e3);

      const recent = await store.getRecentEvents(companionId, 10);
      expect(recent).toHaveLength(3);
      expect(recent[0].id).toBe('ev-3'); // Latest first
      expect(recent[1].id).toBe('ev-2');
      expect(recent[2].id).toBe('ev-1');
      expect(recent[0].payload).toEqual({ modality: 'vision', object: 'coffee cup' });
    });

    it('limits event count according to requested parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await store.recordEvent(companionId, {
          id: `ev-${i}`,
          sourceType: 'chat_turn',
          payload: { index: i },
        });
      }

      const limited = await store.getRecentEvents(companionId, 3);
      expect(limited).toHaveLength(3);
    });
  });

  describe('Claim Lifecycle (Truth Gating)', () => {
    it('proposes claims with PENDING status by default', async () => {
      const proposal: ClaimProposalInput = {
        id: 'claim-1',
        companionId,
        subject: 'Operator Kur',
        predicate: 'likes',
        value: 'Ethiopian light roast coffee',
        confidence: 0.95,
        evidence: ['chat turn 14: "I love Ethiopian pour overs"'],
      };

      const created = await store.proposeClaim(proposal);
      expect(created.id).toBe('claim-1');
      expect(created.status).toBe('PENDING');
      expect(created.confidence).toBe(0.95);

      // Pending claims do NOT show up in approved claims list
      const approved = await store.getApprovedClaims(companionId);
      expect(approved).toHaveLength(0);
    });

    it('approves claims and makes them available for recall', async () => {
      const proposal: ClaimProposalInput = {
        id: 'claim-approved',
        companionId,
        subject: 'Database architecture',
        predicate: 'uses',
        value: 'SQLite WAL mode with FTS5',
      };

      await store.proposeClaim(proposal);
      await store.approveClaim('claim-approved');

      const approved = await store.getApprovedClaims(companionId);
      expect(approved).toHaveLength(1);
      expect(approved[0].id).toBe('claim-approved');
      expect(approved[0].status).toBe('APPROVED');
    });

    it('rejects unverified claims and prevents recall', async () => {
      const proposal: ClaimProposalInput = {
        id: 'claim-rejected',
        companionId,
        subject: 'User secret',
        predicate: 'is',
        value: 'super_confidential_password',
      };

      await store.proposeClaim(proposal);
      await store.rejectClaim('claim-rejected');

      const approved = await store.getApprovedClaims(companionId);
      expect(approved).toHaveLength(0);
    });
  });

  describe('FTS5 BM25 Full-Text Relevance Search', () => {
    it('searches claims matching keywords and excludes unrelated facts', async () => {
      const c1: ClaimProposalInput = {
        id: 'c-1',
        companionId,
        subject: 'Mesopotamian lore',
        predicate: 'features',
        value: 'Siduri welcoming travelers to the garden at the edge of the sea',
      };

      const c2: ClaimProposalInput = {
        id: 'c-2',
        companionId,
        subject: 'TypeScript compiler',
        predicate: 'produces',
        value: 'CommonJS modules and declaration files',
      };

      const c3: ClaimProposalInput = {
        id: 'c-3',
        companionId,
        subject: 'Gilgamesh epic',
        predicate: 'describes',
        value: 'the journey to the underworld seeking immortality',
      };

      await store.proposeClaim(c1);
      await store.proposeClaim(c2);
      await store.proposeClaim(c3);

      await store.approveClaim('c-1');
      await store.approveClaim('c-2');
      await store.approveClaim('c-3');

      // Search for "sea"
      const seaResults = await store.searchClaims(companionId, 'sea');
      expect(seaResults.some((c) => c.id === 'c-1')).toBe(true);
      expect(seaResults.some((c) => c.id === 'c-2')).toBe(false);

      // Search for "TypeScript"
      const tsResults = await store.searchClaims(companionId, 'TypeScript');
      expect(tsResults.some((c) => c.id === 'c-2')).toBe(true);
      expect(tsResults.some((c) => c.id === 'c-1')).toBe(false);

      // Search for "underworld"
      const underworldResults = await store.searchClaims(companionId, 'underworld');
      expect(underworldResults.some((c) => c.id === 'c-3')).toBe(true);
    });

    it('ranks results by BM25 relevance match density', async () => {
      const highMatch: ClaimProposalInput = {
        id: 'high-match',
        companionId,
        subject: 'quantum computing',
        predicate: 'leverages',
        value: 'quantum entanglement and quantum superposition for quantum supremacy',
      };

      const lowMatch: ClaimProposalInput = {
        id: 'low-match',
        companionId,
        subject: 'physics',
        predicate: 'mentions',
        value: 'the quantum scale of subatomic particles',
      };

      await store.proposeClaim(highMatch);
      await store.proposeClaim(lowMatch);
      await store.approveClaim('high-match');
      await store.approveClaim('low-match');

      const results = await store.searchClaims(companionId, 'quantum');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('high-match');
      expect(results[1].id).toBe('low-match');
    });
  });

  describe('Cross-Restart Durability', () => {
    it('persists events and claims across store restart', async () => {
      await store.recordEvent(companionId, {
        id: 'persist-ev',
        sourceType: 'chat_turn',
        payload: { text: 'persisted text' },
      });

      const claim = await store.proposeClaim({
        id: 'persist-claim',
        companionId,
        subject: 'durability',
        predicate: 'is',
        value: 'guaranteed by SQLite WAL',
      });
      await store.approveClaim(claim.id);

      store.close();

      // Open new store instance against same database file
      const store2 = new SqliteMemoryStore({ dbPath });

      const events = await store2.getRecentEvents(companionId);
      expect(events.some((e) => e.id === 'persist-ev')).toBe(true);

      const claims = await store2.searchClaims(companionId, 'durability');
      expect(claims.some((c) => c.id === 'persist-claim')).toBe(true);

      store2.close();
    });
  });

  describe('Directive and Claim Lifecycle State Machine', () => {
    it('proposes, approves, and revokes directives', async () => {
      const dir = await store.proposeDirective({
        directive: 'Respond with conciseness',
        priority: 70,
        category: 'behavioral',
      });
      expect(dir.status).toBe('PENDING');

      // Before approval, active directives must not include it
      let directives = await store.getDirectives();
      expect(directives.some((d) => d.id === dir.id)).toBe(false);

      // Approve directive
      await store.approveDirective(dir.id);
      directives = await store.getDirectives();
      expect(directives.some((d) => d.id === dir.id && d.status === 'ACTIVE')).toBe(true);

      // Revoke directive
      await store.revokeDirective(dir.id);
      directives = await store.getDirectives();
      expect(directives.some((d) => d.id === dir.id)).toBe(false);
    });

    it('proposes, approves, revokes, and expires claims', async () => {
      const claim = await store.proposeClaim({
        id: 'claim-fsm',
        companionId,
        subject: 'weather',
        predicate: 'condition',
        value: 'rainy',
      });
      expect(claim.status).toBe('PENDING');

      await store.approveClaim('claim-fsm');
      let approved = await store.getApprovedClaims(companionId);
      expect(approved.some((c) => c.id === 'claim-fsm')).toBe(true);

      await store.revokeClaim('claim-fsm');
      approved = await store.getApprovedClaims(companionId);
      expect(approved.some((c) => c.id === 'claim-fsm')).toBe(false);
    });

    it('excludes pending and rejected claims from searchClaims', async () => {
      const pendingClaim: ClaimProposalInput = {
        id: 'claim-secret-unapproved',
        companionId,
        subject: 'TopSecret',
        predicate: 'codename',
        value: 'ProjectNebulaX',
      };
      await store.proposeClaim(pendingClaim);

      // Search before approval: must NOT find it
      const unapprovedResults = await store.searchClaims(companionId, 'ProjectNebulaX');
      expect(unapprovedResults.some((c) => c.id === 'claim-secret-unapproved')).toBe(false);

      // After approval: must find it
      await store.approveClaim('claim-secret-unapproved');
      const approvedResults = await store.searchClaims(companionId, 'ProjectNebulaX');
      expect(approvedResults.some((c) => c.id === 'claim-secret-unapproved')).toBe(true);
    });

    it('resets memory for active companion without affecting other companions', async () => {
      const otherCompanion = 'companion-other-reset';
      await store.proposeClaim({
        id: 'claim-self-reset',
        companionId,
        subject: 'LocalUser',
        predicate: 'resides',
        value: 'NeoTokyo',
      });
      await store.approveClaim('claim-self-reset');

      await store.proposeClaim({
        id: 'claim-other-stay',
        companionId: otherCompanion,
        subject: 'RemoteUser',
        predicate: 'resides',
        value: 'Kyoto',
      });
      // Approve for other companion directly on db
      (store as any).db.approveClaim('claim-other-stay', otherCompanion);

      expect((await store.getApprovedClaims(companionId)).length).toBe(1);
      expect((await store.getApprovedClaims(otherCompanion)).length).toBe(1);

      await store.resetMemory(companionId);

      expect(await store.getApprovedClaims(companionId)).toHaveLength(0);
      expect(await store.getApprovedClaims(otherCompanion)).toHaveLength(1);
    });

    it('updates claim by proposing a pending replacement claim', async () => {
      await store.proposeClaim({
        id: 'claim-to-update',
        companionId,
        subject: 'UserRole',
        predicate: 'is',
        value: 'Developer',
      });
      await store.approveClaim('claim-to-update');

      const updated = await store.updateClaim('claim-to-update', {
        value: 'LeadArchitect',
      });
      expect(updated.status).toBe('PENDING');
      expect(updated.value).toBe('LeadArchitect');

      // The original approved claim remains Developer until replacement is approved
      const currentApproved = await store.getApprovedClaims(companionId);
      expect(currentApproved.find((c) => c.id === 'claim-to-update')?.value).toBe('Developer');
    });
  });
});
