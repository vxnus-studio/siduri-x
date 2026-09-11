import { InMemoryMemoryOrgan } from './in-memory';

describe('InMemoryMemoryOrgan', () => {
  let memory: InMemoryMemoryOrgan;

  beforeEach(async () => {
    memory = new InMemoryMemoryOrgan();
    await memory.initialize('test-companion');
  });

  test('proposes, approves, and retrieves claims', async () => {
    const claim = await memory.proposeClaim({
      subject: 'user',
      predicate: 'likes',
      value: 'astronomy',
    });

    expect(claim.status).toBe('PENDING');
    expect((await memory.getPendingClaims()).length).toBe(1);
    expect((await memory.getClaims()).length).toBe(0);

    await memory.approveClaim(claim.id);

    expect((await memory.getPendingClaims()).length).toBe(0);
    const approved = await memory.getClaims();
    expect(approved.length).toBe(1);
    expect(approved[0].value).toBe('astronomy');

    const searchRes = await memory.searchClaims('astronomy');
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].id).toBe(claim.id);
  });

  test('proposes and approves directives', async () => {
    const dir = await memory.proposeDirective({
      directive: 'Always respond kindly',
      priority: 80,
    });

    expect(dir.status).toBe('PENDING');
    expect((await memory.getDirectives()).length).toBe(0);

    await memory.approveDirective(dir.id);
    const approved = await memory.getDirectives();
    expect(approved.length).toBe(1);
    expect(approved[0].directive).toBe('Always respond kindly');
    expect(approved[0].status).toBe('ACTIVE');
  });

  test('isolates memory by companionId', async () => {
    await memory.proposeClaim({
      subject: 'user',
      predicate: 'name',
      value: 'Alice',
    });

    const otherMemory = new InMemoryMemoryOrgan();
    await otherMemory.initialize('other-companion');

    expect((await otherMemory.getPendingClaims()).length).toBe(0);
  });
});
