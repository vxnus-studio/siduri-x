import { SiduriRuntime } from './runtime';
import { CompanionContainer } from './container';

describe('CompanionContainer & Direct Domain Access', () => {
  test('delegates vision and observation methods to configured organs via container', async () => {
    const mockVision = {
      analyze: jest.fn().mockResolvedValue('an ancient artifact'),
    };
    const mockObservation = {
      ingest: jest.fn().mockResolvedValue({ duplicate: false }),
      current: jest.fn().mockReturnValue([{ observationId: 'obs-1' }]),
      clearExpired: jest.fn().mockReturnValue(1),
    };

    const container = new CompanionContainer('test-comp', { name: 'Test' } as any, {
      vision: mockVision as any,
      observation: mockObservation as any,
    });

    const visionResult = await container.vision!.analyze('http://example.com/img.png', 'describe');
    expect(visionResult).toBe('an ancient artifact');
    expect(mockVision.analyze).toHaveBeenCalledWith('http://example.com/img.png', 'describe');

    const frame = new Uint8Array([1, 2, 3]);
    const obsResult = await container.observation!.ingest(frame, 'camera-1', 'provider-x');
    expect(obsResult.duplicate).toBe(false);
    expect(mockObservation.ingest).toHaveBeenCalledWith(frame, 'camera-1', 'provider-x');

    const cur = container.observation!.current();
    expect(cur).toEqual([{ observationId: 'obs-1' }]);

    const cleared = container.observation!.clearExpired();
    expect(cleared).toBe(1);
  });

  test('delegates memory operations directly on the memory organ', async () => {
    const mockMemory = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getClaims: jest.fn().mockResolvedValue([{ id: 'claim-1' }]),
      getPendingClaims: jest.fn().mockResolvedValue([{ id: 'claim-pending-1' }]),
      getDirectives: jest.fn().mockResolvedValue([{ id: 'dir-1' }]),
      approveClaim: jest.fn().mockResolvedValue(undefined),
      rejectClaim: jest.fn().mockResolvedValue(undefined),
      updateClaim: jest.fn().mockResolvedValue({ id: 'claim-1', value: 'updated' }),
      approveDirective: jest.fn().mockResolvedValue(undefined),
      rejectDirective: jest.fn().mockResolvedValue(undefined),
      revokeDirective: jest.fn().mockResolvedValue(undefined),
      disableDirective: jest.fn().mockResolvedValue(undefined),
      resetMemory: jest.fn().mockResolvedValue(undefined),
    };

    const container = new CompanionContainer('test-comp', { name: 'Test' } as any, {
      memory: mockMemory as any,
    });

    expect(await container.memory!.getClaims(10)).toEqual([{ id: 'claim-1' }]);
    expect(mockMemory.getClaims).toHaveBeenCalledWith(10);

    expect(await container.memory!.getPendingClaims()).toEqual([{ id: 'claim-pending-1' }]);
    expect(await container.memory!.getDirectives()).toEqual([{ id: 'dir-1' }]);

    await container.memory!.approveClaim('c-1');
    expect(mockMemory.approveClaim).toHaveBeenCalledWith('c-1');

    await container.memory!.rejectClaim('c-2');
    expect(mockMemory.rejectClaim).toHaveBeenCalledWith('c-2');

    await container.memory!.updateClaim!('c-1', { value: 'updated' } as any);
    expect(mockMemory.updateClaim).toHaveBeenCalledWith('c-1', { value: 'updated' });

    await container.memory!.approveDirective('d-1');
    expect(mockMemory.approveDirective).toHaveBeenCalledWith('d-1');

    await container.memory!.rejectDirective('d-2');
    expect(mockMemory.rejectDirective).toHaveBeenCalledWith('d-2');

    await container.memory!.revokeDirective('d-3');
    expect(mockMemory.revokeDirective).toHaveBeenCalledWith('d-3');

    await container.memory!.disableDirective('d-4');
    expect(mockMemory.disableDirective).toHaveBeenCalledWith('d-4');

    await container.memory!.resetMemory!();
    expect(mockMemory.resetMemory).toHaveBeenCalled();
  });

  test('configures SqliteActionStore when actionStore is sqlite', () => {
    const container = new CompanionContainer('comp-sqlite', {
      id: 'comp-sqlite',
      name: 'Sqlite Test',
      actionStore: 'sqlite',
    });
    expect(container.actionPolicy.getStore()).toBeDefined();
    // Verify it is an instance of SqliteActionStore
    expect(container.actionPolicy.getStore().constructor.name).toBe('SqliteActionStore');
  });

  test('accepts custom actionStore via RuntimeOrgans', () => {
    const customStore: any = {
      recordExecution: jest.fn(),
      getExecution: jest.fn(),
      updateExecution: jest.fn(),
      recordApproval: jest.fn(),
      getApproval: jest.fn(),
      recordAudit: jest.fn(),
      getAuditLog: jest.fn(),
      verifyAuditChain: jest.fn(),
    };
    const container = new CompanionContainer('comp-custom', { id: 'comp-custom', name: 'Custom' }, {
      actionStore: customStore,
    });
    expect(container.actionPolicy.getStore()).toBe(customStore);
  });
});
