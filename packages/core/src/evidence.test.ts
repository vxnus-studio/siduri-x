import {
  EvidenceRecord,
  filterEvidenceRecords,
  EvidenceFilterOptions,
} from './evidence';

describe('T4 Evidence & Disclosure Core Contract', () => {
  const baseRecord: EvidenceRecord = {
    evidenceId: 'ev-1',
    sourceId: 'src-1',
    origin: 'knowledge',
    trust: 'configured',
    sensitivity: 'public',
    companionId: 'companion-a',
    correlationId: 'corr-1',
    createdAt: new Date(Date.now() - 5000).toISOString(),
  };

  test('companion isolation excludes foreign companion evidence', () => {
    const records: EvidenceRecord[] = [
      { ...baseRecord, evidenceId: 'ev-mine', companionId: 'companion-a' },
      { ...baseRecord, evidenceId: 'ev-foreign', companionId: 'companion-b' },
    ];
    const options: EvidenceFilterOptions = {
      companionId: 'companion-a',
      channel: 'public',
    };
    const { admitted, excluded } = filterEvidenceRecords(records, options);
    expect(admitted.map((e) => e.evidenceId)).toEqual(['ev-mine']);
    expect(excluded).toEqual([
      expect.objectContaining({
        record: expect.objectContaining({ evidenceId: 'ev-foreign' }),
        reason: 'companion_isolation_mismatch',
      }),
    ]);
  });

  test('expired evidence is excluded', () => {
    const records: EvidenceRecord[] = [
      { ...baseRecord, evidenceId: 'ev-valid', expiresAt: new Date(Date.now() + 60000).toISOString() },
      { ...baseRecord, evidenceId: 'ev-expired', expiresAt: new Date(Date.now() - 1000).toISOString() },
    ];
    const options: EvidenceFilterOptions = {
      companionId: 'companion-a',
      channel: 'public',
    };
    const { admitted, excluded } = filterEvidenceRecords(records, options);
    expect(admitted.map((e) => e.evidenceId)).toEqual(['ev-valid']);
    expect(excluded).toEqual([
      expect.objectContaining({
        record: expect.objectContaining({ evidenceId: 'ev-expired' }),
        reason: 'evidence_expired',
      }),
    ]);
  });

  test('single-owner companion admits valid evidence without multi-audience filtering', () => {
    const records: EvidenceRecord[] = [
      { ...baseRecord, evidenceId: 'ev-public' },
      { ...baseRecord, evidenceId: 'ev-direct-only' },
    ];
    const options: EvidenceFilterOptions = {
      companionId: 'companion-a',
    };
    const { admitted, excluded } = filterEvidenceRecords(records, options);
    expect(admitted.map((e) => e.evidenceId)).toEqual(['ev-public', 'ev-direct-only']);
    expect(excluded).toEqual([]);
  });

  test('single-owner companion admits private and restricted sensitivity for companion owner', () => {
    const records: EvidenceRecord[] = [
      { ...baseRecord, evidenceId: 'ev-pub', sensitivity: 'public' },
      { ...baseRecord, evidenceId: 'ev-priv', sensitivity: 'private' },
      { ...baseRecord, evidenceId: 'ev-rest', sensitivity: 'restricted' },
    ];
    const { admitted, excluded } = filterEvidenceRecords(records, {
      companionId: 'companion-a',
    });
    expect(admitted.map((e) => e.evidenceId)).toEqual(['ev-pub', 'ev-priv', 'ev-rest']);
    expect(excluded).toEqual([]);
  });
});
