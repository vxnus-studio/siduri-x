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
    allowedAudiences: ['audience-public'],
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
      audienceId: 'audience-public',
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
      audienceId: 'audience-public',
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

  test('audience intersection excludes non-matching audiences', () => {
    const records: EvidenceRecord[] = [
      { ...baseRecord, evidenceId: 'ev-public', allowedAudiences: ['audience-public'] },
      { ...baseRecord, evidenceId: 'ev-direct-only', allowedAudiences: ['audience-direct-a'] },
    ];
    const options: EvidenceFilterOptions = {
      companionId: 'companion-a',
      channel: 'public',
      audienceId: 'audience-public',
    };
    const { admitted, excluded } = filterEvidenceRecords(records, options);
    expect(admitted.map((e) => e.evidenceId)).toEqual(['ev-public']);
    expect(excluded).toEqual([
      expect.objectContaining({
        record: expect.objectContaining({ evidenceId: 'ev-direct-only' }),
        reason: 'audience_not_allowed',
      }),
    ]);
  });

  test('sensitivity policy excludes private and restricted evidence from public channels', () => {
    const records: EvidenceRecord[] = [
      { ...baseRecord, evidenceId: 'ev-pub', sensitivity: 'public', allowedAudiences: ['audience-public'] },
      { ...baseRecord, evidenceId: 'ev-priv', sensitivity: 'private', allowedAudiences: ['audience-public'] },
      { ...baseRecord, evidenceId: 'ev-rest', sensitivity: 'restricted', allowedAudiences: ['audience-public'] },
    ];
    const { admitted, excluded } = filterEvidenceRecords(records, {
      companionId: 'companion-a',
      channel: 'public',
      audienceId: 'audience-public',
    });
    expect(admitted.map((e) => e.evidenceId)).toEqual(['ev-pub']);
    expect(excluded.map((e) => e.record.evidenceId)).toEqual(['ev-priv', 'ev-rest']);
  });

  test('direct channel permits private sensitivity but excludes restricted', () => {
    const records: EvidenceRecord[] = [
      { ...baseRecord, evidenceId: 'ev-pub', sensitivity: 'public', allowedAudiences: ['audience-direct-a'] },
      { ...baseRecord, evidenceId: 'ev-priv', sensitivity: 'private', allowedAudiences: ['audience-direct-a'] },
      { ...baseRecord, evidenceId: 'ev-rest', sensitivity: 'restricted', allowedAudiences: ['audience-direct-a'] },
    ];
    const { admitted, excluded } = filterEvidenceRecords(records, {
      companionId: 'companion-a',
      channel: 'direct',
      audienceId: 'audience-direct-a',
    });
    expect(admitted.map((e) => e.evidenceId)).toEqual(['ev-pub', 'ev-priv']);
    expect(excluded.map((e) => e.record.evidenceId)).toEqual(['ev-rest']);
  });
});
