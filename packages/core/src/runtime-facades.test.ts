import { SiduriRuntime } from './runtime';

describe('SiduriRuntime Facade Methods & Delegation', () => {
  test('delegates vision and observation methods to configured organs', async () => {
    const mockVision = {
      analyze: jest.fn().mockResolvedValue('an ancient artifact'),
    };
    const mockObservation = {
      ingest: jest.fn().mockResolvedValue({ duplicate: false }),
      current: jest.fn().mockReturnValue([{ observationId: 'obs-1' }]),
      clearExpired: jest.fn().mockReturnValue(1),
    };

    const runtime = new SiduriRuntime('test-comp', { name: 'Test' } as any, {
      vision: mockVision as any,
      observation: mockObservation as any,
    });

    const visionResult = await runtime.analyzeVision('http://example.com/img.png', 'describe');
    expect(visionResult).toBe('an ancient artifact');
    expect(mockVision.analyze).toHaveBeenCalledWith('http://example.com/img.png', 'describe');

    const frame = new Uint8Array([1, 2, 3]);
    const obsResult = await runtime.ingestObservation(frame, 'camera-1', 'provider-x');
    expect(obsResult.duplicate).toBe(false);
    expect(mockObservation.ingest).toHaveBeenCalledWith(frame, 'camera-1', 'provider-x');

    const cur = runtime.getCurrentObservations();
    expect(cur).toEqual([{ observationId: 'obs-1' }]);

    const cleared = runtime.clearExpiredObservations();
    expect(cleared).toBe(1);
  });

  test('delegates memory operations cleanly through facade methods', async () => {
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

    const runtime = new SiduriRuntime('test-comp', { name: 'Test' } as any, {
      memory: mockMemory as any,
    });

    expect(await runtime.getClaims(10)).toEqual([{ id: 'claim-1' }]);
    expect(mockMemory.getClaims).toHaveBeenCalledWith(10);

    expect(await runtime.getPendingClaims()).toEqual([{ id: 'claim-pending-1' }]);
    expect(await runtime.getDirectives()).toEqual([{ id: 'dir-1' }]);

    await runtime.approveClaim('c-1');
    expect(mockMemory.approveClaim).toHaveBeenCalledWith('c-1');

    await runtime.rejectClaim('c-2');
    expect(mockMemory.rejectClaim).toHaveBeenCalledWith('c-2');

    await runtime.updateClaim('c-1', { value: 'new' });
    expect(mockMemory.updateClaim).toHaveBeenCalledWith('c-1', { value: 'new' });

    await runtime.approveDirective('d-1');
    expect(mockMemory.approveDirective).toHaveBeenCalledWith('d-1');

    await runtime.rejectDirective('d-2');
    expect(mockMemory.rejectDirective).toHaveBeenCalledWith('d-2');

    await runtime.revokeDirective('d-3');
    expect(mockMemory.revokeDirective).toHaveBeenCalledWith('d-3');

    await runtime.disableDirective('d-4');
    expect(mockMemory.disableDirective).toHaveBeenCalledWith('d-4');

    await runtime.resetMemory();
    expect(mockMemory.resetMemory).toHaveBeenCalled();
  });
});
