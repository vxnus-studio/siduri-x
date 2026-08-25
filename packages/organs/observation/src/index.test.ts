import { FixtureObservationOrgan } from './index';

describe('FixtureObservationOrgan', () => {
  test('creates bounded evidence without retaining the raw frame', async () => {
    const vision = { analyze: jest.fn().mockResolvedValue(JSON.stringify({ readings: [
      { entity: 'scene', value: 'combat', confidence: 0.9 },
    ] })) };
    const organ = new FixtureObservationOrgan(vision, 1000, 2);
    const frame = new Uint8Array([1, 2, 3]);
    const result = await organ.ingest(frame, 'fixture-genshin', 'fixture-vision');

    expect(result.observation).toMatchObject({ sourceName: 'fixture-genshin', providerId: 'fixture-vision', confidence: 0.9 });
    expect(result.observation?.evidenceId).toMatch(/^evidence_/);
    expect(JSON.stringify(result.observation)).not.toContain('1,2,3');
    expect(vision.analyze).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64'), expect.any(String));
  });

  test('suppresses duplicate frames and expires observations', async () => {
    const vision = { analyze: jest.fn().mockResolvedValue('[{"entity":"scene","value":"idle","confidence":1}]') };
    const organ = new FixtureObservationOrgan(vision, 1000, 2);
    const frame = new Uint8Array([7, 8, 9]);
    const first = await organ.ingest(frame, 'fixture');
    const duplicate = await organ.ingest(frame, 'fixture');

    expect(first.observation).toBeDefined();
    expect(duplicate).toMatchObject({ duplicate: true, reason: 'duplicate_frame' });
    expect(organ.clearExpired(new Date(Date.now() + 2000))).toBe(1);
    expect(organ.current(new Date(Date.now() + 2000))).toEqual([]);
  });

  test('rejects malformed provider readings', async () => {
    const organ = new FixtureObservationOrgan({ analyze: jest.fn().mockResolvedValue('not json') });
    await expect(organ.ingest(new Uint8Array([1]), 'fixture')).resolves.toMatchObject({ reason: 'invalid_reading' });
  });
});
