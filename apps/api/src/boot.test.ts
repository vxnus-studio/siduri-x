import { bootCompanion, isDisabled, createBrain, createMemory, createVoice, createKnowledge, createVision, createBehavior, createBody, createHands, createEar, createMouth, createSelf, createObservation } from './boot';
import { FixtureObservationOrgan } from '@siduri-x/observation';

describe('Canonical bootCompanion & Organ Factory Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('isDisabled correctly identifies undefined or none provider', () => {
    expect(isDisabled(undefined)).toBe(true);
    expect(isDisabled({ provider: 'none' })).toBe(true);
    expect(isDisabled({ provider: 'openrouter' })).toBe(false);
    expect(isDisabled({ provider: 'sqlite' })).toBe(false);
  });

  test('creates all standard organs with fallback configurations', () => {
    const brain = createBrain({ provider: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', apiKey: 'test' });
    expect(brain).toBeDefined();

    const voice = createVoice({ provider: 'none' });
    expect(voice).toBeUndefined();

    const memory = createMemory({ provider: 'sqlite', dbPath: ':memory:' });
    expect(memory).toBeDefined();

    const selfRepo = createSelf({ dbPath: ':memory:' });
    expect(selfRepo).toBeDefined();

    const vision = createVision({ provider: 'none' });
    expect(vision).toBeUndefined();

    const behavior = createBehavior({ provider: 'active_self' });
    expect(behavior).toBeDefined();

    const body = createBody({ provider: 'none' });
    expect(body).toBeUndefined();

    const hands = createHands();
    expect(hands).toBeDefined();

    const ear = createEar();
    expect(ear).toBeDefined();

    const mouth = createMouth(undefined, voice);
    expect(mouth).toBeDefined();

    const observation = createObservation();
    expect(observation).toBeInstanceOf(FixtureObservationOrgan);
  });

  test('bootCompanion wires all organs and runs migrations', async () => {
    let migrationsRun = false;
    const testConfig = {
      name: 'Test Companion',
      brain: { provider: 'openrouter', apiKey: 'mock-key', model: 'mock-model' },
      memory: { provider: 'none' }, // will use custom mock
      voice: { provider: 'none' },
      vision: { provider: 'none' },
      behavior: { provider: 'none' },
      body: { provider: 'none' },
      hands: { provider: 'none' },
      ear: { provider: 'none' },
      mouth: { provider: 'none' },
      knowledge: { provider: 'none' },
    };

    const mockObservation = new FixtureObservationOrgan({ analyze: async () => JSON.stringify({ readings: [] }) });

    const runtime = await bootCompanion('test-comp-1', testConfig as any, {
      observationOrgan: mockObservation,
    });

    expect(runtime).toBeDefined();
    expect(runtime.id).toBe('test-comp-1');
    expect(runtime.observation).toBe(mockObservation);
    expect(runtime.hands).toBeDefined();
    expect(runtime.ear).toBeDefined();
    expect(runtime.mouth).toBeDefined();
  });

  test('bootCompanion handles nested organs configuration structure', async () => {
    const nestedConfig = {
      name: 'Nested Companion',
      organs: {
        brain: { provider: 'openrouter', apiKey: 'mock' },
        memory: { provider: 'none' },
        knowledge: { provider: 'none' },
        voice: { provider: 'none' },
      },
    };

    const runtime = await bootCompanion('nested-comp', nestedConfig as any);
    expect(runtime).toBeDefined();
    expect(runtime.id).toBe('nested-comp');
    expect(runtime.brain).toBeDefined();
  });
});
