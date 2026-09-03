import { NeutralBodyOrgan, Live2DAdapter, BodySnapshot } from './index';

describe('NeutralBodyOrgan', () => {
  let organ: NeutralBodyOrgan;

  beforeEach(() => {
    organ = new NeutralBodyOrgan();
  });

  afterEach(() => {
    organ.cleanup();
  });

  test('constructs with default or custom initial expression with zero external config', () => {
    expect(organ.currentExpression).toBe('neutral');
    expect(organ.state).toBe('idle');
    expect(organ.lastSpeechId).toBeNull();
    expect(organ.lastAction).toBeNull();

    const customOrgan = new NeutralBodyOrgan({
      initialExpression: 'happy',
      modelPath: './assets/body/custom/model.model3.json',
      modelUrl: '/assets/body/custom/model.model3.json',
    });
    expect(customOrgan.currentExpression).toBe('happy');
    expect(customOrgan.modelPath).toBe('./assets/body/custom/model.model3.json');
    expect(customOrgan.modelUrl).toBe('/assets/body/custom/model.model3.json');
    const snapshot = customOrgan.getSnapshot();
    expect(snapshot.modelPath).toBe('./assets/body/custom/model.model3.json');
    expect(snapshot.modelUrl).toBe('/assets/body/custom/model.model3.json');
    customOrgan.cleanup();
  });

  test('Live2DAdapter is exported as a compatible alias', () => {
    const adapter = new Live2DAdapter();
    expect(adapter).toBeInstanceOf(NeutralBodyOrgan);
    adapter.cleanup();
  });

  test('tracks body state machine transitions locally', () => {
    organ.setExpression('smile');
    expect(organ.currentExpression).toBe('smile');

    organ.speak('speech_101', 'Hello world', 'en');
    expect(organ.lastSpeechId).toBe('speech_101');
    expect(organ.lastText).toBe('Hello world');
    expect(organ.lastLanguage).toBe('en');
    expect(organ.state).toBe('speaking');

    organ.act('wave_hand');
    expect(organ.lastAction).toBe('wave_hand');
    expect(organ.state).toBe('acting');

    organ.completeAction();
    expect(organ.state).toBe('idle');

    const snapshot: BodySnapshot = organ.getSnapshot();
    expect(snapshot.state).toBe('idle');
    expect(snapshot.currentExpression).toBe('smile');
    expect(snapshot.lastSpeechId).toBe('speech_101');
    expect(snapshot.lastAction).toBe('wave_hand');
    expect(snapshot.lastText).toBe('Hello world');
    expect(snapshot.lastLanguage).toBe('en');
  });

  test('handleEvent processes valid approved avatar event', async () => {
    const res = await organ.handleEvent({
      eventId: 'evt-avatar-1',
      companionId: 'companion-test',
      responseId: 'resp-100',
      correlationId: 'corr-100',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'avatar',
      lifecycle: 'STARTED',
      evidenceIds: [],
      expression: 'surprised',
      action: 'nod',
      text: 'Affirmative.',
      language: 'en',
      createdAt: new Date().toISOString(),
    });

    expect(res.accepted).toBe(true);
    expect(res.lifecycle).toBe('STARTED');
    expect(res.metadata).toMatchObject({
      expression: 'surprised',
      action: 'nod',
      state: 'acting',
      companionId: 'companion-test',
      correlationId: 'corr-100',
    });
    expect(organ.currentExpression).toBe('surprised');
    expect(organ.lastAction).toBe('nod');
    expect(organ.lastText).toBe('Affirmative.');
  });

  test('handleEvent rejects unapproved events or incompatible kinds', async () => {
    const unapprovedRes = await organ.handleEvent({
      eventId: 'evt-avatar-2',
      companionId: 'companion-test',
      responseId: 'resp-100',
      correlationId: 'corr-100',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'STAGED' as any,
      kind: 'avatar',
      lifecycle: 'STARTED',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    });
    expect(unapprovedRes.accepted).toBe(false);
    expect(unapprovedRes.error).toContain('APPROVED');

    const incompatibleRes = await organ.handleEvent({
      eventId: 'evt-avatar-3',
      companionId: 'companion-test',
      responseId: 'resp-100',
      correlationId: 'corr-100',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'voice',
      lifecycle: 'STARTED',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    });
    expect(incompatibleRes.accepted).toBe(false);
    expect(incompatibleRes.reason).toBe('INCOMPATIBLE_EVENT_KIND');
  });

  test('handleEvent rejects invalid envelope', async () => {
    const invalidRes = await organ.handleEvent({} as any);
    expect(invalidRes.accepted).toBe(false);
    expect(invalidRes.reason).toBe('INVALID_EVENT_ENVELOPE');
  });

  test('requires no open network sockets or transport listeners', () => {
    // Verifies the object has no transport handles
    expect((organ as any).wss).toBeUndefined();
    expect((organ as any).vts).toBeUndefined();
    expect((organ as any).clients).toBeUndefined();
  });

  test('handles sequential avatar events where latest valid event updates active state', async () => {
    await organ.handleEvent({
      eventId: 'evt-avatar-10',
      companionId: 'companion-test',
      responseId: 'resp-101',
      correlationId: 'corr-101',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'avatar',
      lifecycle: 'STARTED',
      evidenceIds: [],
      expression: 'happy',
      action: 'wave',
      createdAt: new Date().toISOString(),
    });
    expect(organ.currentExpression).toBe('happy');
    expect(organ.lastAction).toBe('wave');

    // Newer event arrives
    await organ.handleEvent({
      eventId: 'evt-avatar-11',
      companionId: 'companion-test',
      responseId: 'resp-102',
      correlationId: 'corr-102',
      channel: 'public',
      audienceId: 'audience-public',
      approval: 'APPROVED',
      kind: 'avatar',
      lifecycle: 'STARTED',
      evidenceIds: [],
      expression: 'surprised',
      action: 'nod',
      createdAt: new Date().toISOString(),
    });
    expect(organ.currentExpression).toBe('surprised');
    expect(organ.lastAction).toBe('nod');
  });

  test('speech synchronization sets speaking state and reset returns to idle', () => {
    organ.speak('speech_v1', 'Konnichiwa', 'ja');
    expect(organ.state).toBe('speaking');
    expect(organ.lastSpeechId).toBe('speech_v1');

    organ.completeAction();
    expect(organ.state).toBe('idle');
  });

  test('handles unknown expressions and actions with graceful baseline fallbacks', () => {
    organ.setExpression('unknown_custom_expression');
    expect(organ.currentExpression).toBe('unknown_custom_expression');

    organ.act('unknown_action');
    expect(organ.lastAction).toBe('unknown_action');
    expect(organ.state).toBe('acting');

    organ.completeAction();
    expect(organ.state).toBe('idle');
  });
});
