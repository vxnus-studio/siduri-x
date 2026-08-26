import {
  createExperienceEvents,
  validateExperienceEvent,
  ExperienceEvent,
} from './experience';

describe('T5 Experience Event Contract Suite', () => {
  const baseEventOptions = {
    responseId: 'resp-123',
    companionId: 'companion-a',
    correlationId: 'corr-123',
    channel: 'public' as const,
    audienceId: 'audience-public',
    speech: 'Hello world',
    language: 'en',
    evidenceIds: ['ev-1'],
    expression: 'happy',
    action: 'wave',
  };

  test('creates structured voice and avatar experience events from approved response options', () => {
    const events = createExperienceEvents(baseEventOptions);
    expect(events.length).toBe(2);

    const voiceEvent = events.find((e) => e.kind === 'voice');
    expect(voiceEvent).toBeDefined();
    expect(voiceEvent?.approval).toBe('APPROVED');
    expect(voiceEvent?.companionId).toBe('companion-a');
    expect(voiceEvent?.correlationId).toBe('corr-123');
    expect(voiceEvent?.text).toBe('Hello world');
    expect(voiceEvent?.language).toBe('en');
    expect(voiceEvent?.evidenceIds).toEqual(['ev-1']);

    const avatarEvent = events.find((e) => e.kind === 'avatar');
    expect(avatarEvent).toBeDefined();
    expect(avatarEvent?.approval).toBe('APPROVED');
    expect(avatarEvent?.expression).toBe('happy');
    expect(avatarEvent?.action).toBe('wave');
  });

  test('validates experience event envelope correctly', () => {
    const events = createExperienceEvents(baseEventOptions);
    for (const e of events) {
      const val = validateExperienceEvent(e);
      expect(val.valid).toBe(true);
      expect(val.error).toBeUndefined();
    }
  });

  test('rejects unapproved experience event', () => {
    const events = createExperienceEvents(baseEventOptions);
    const unapproved = { ...events[0], approval: 'STAGED' as any };
    const val = validateExperienceEvent(unapproved);
    expect(val.valid).toBe(false);
    expect(val.error).toContain('Event approval must be APPROVED');
  });

  test('rejects missing metadata (companionId, responseId, etc.)', () => {
    const events = createExperienceEvents(baseEventOptions);
    const missingCompanion = { ...events[0], companionId: '' };
    expect(validateExperienceEvent(missingCompanion).valid).toBe(false);

    const missingCorr = { ...events[0], correlationId: '' };
    expect(validateExperienceEvent(missingCorr).valid).toBe(false);

    const missingAudience = { ...events[0], audienceId: '' };
    expect(validateExperienceEvent(missingAudience).valid).toBe(false);
  });
});
