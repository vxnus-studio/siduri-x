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

  test('delegates archive operations directly on the archive organ', async () => {
    const mockArchive = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
      getRecentEvents: jest.fn().mockResolvedValue([{ id: 'evt-1' }]),
      searchEvents: jest.fn().mockResolvedValue([{ id: 'evt-1' }]),
    };

    const container = new CompanionContainer('test-comp', { name: 'Test' } as any, {
      archive: mockArchive as any,
    });

    expect(await container.archive!.getRecentEvents('test-comp', 10)).toEqual([{ id: 'evt-1' }]);
    expect(mockArchive.getRecentEvents).toHaveBeenCalledWith('test-comp', 10);

    expect(await container.archive!.searchEvents!('test-comp', 'query', 5)).toEqual([{ id: 'evt-1' }]);
    expect(mockArchive.searchEvents).toHaveBeenCalledWith('test-comp', 'query', 5);

    await container.archive!.recordEvent({ id: 'evt-2' } as any);
    expect(mockArchive.recordEvent).toHaveBeenCalledWith({ id: 'evt-2' });
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
