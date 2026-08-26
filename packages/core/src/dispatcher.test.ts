import { ExperienceDispatcher } from './dispatcher';
import { ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult, createExperienceEvents } from './experience';

describe('T5 ExperienceDispatcher Contract Suite', () => {
  let dispatcher: ExperienceDispatcher;
  let mockVoiceAdapter: ExperienceAdapter;
  let mockAvatarAdapter: ExperienceAdapter;

  beforeEach(() => {
    dispatcher = new ExperienceDispatcher();

    mockVoiceAdapter = {
      kind: 'voice',
      handleEvent: jest.fn().mockImplementation(async (event: ExperienceEvent): Promise<ExperienceAdapterResult> => ({
        accepted: true,
        eventId: event.eventId,
        lifecycle: 'STARTED',
      })),
    };

    mockAvatarAdapter = {
      kind: 'avatar',
      handleEvent: jest.fn().mockImplementation(async (event: ExperienceEvent): Promise<ExperienceAdapterResult> => ({
        accepted: true,
        eventId: event.eventId,
        lifecycle: 'STARTED',
      })),
    };

    dispatcher.registerAdapter(mockVoiceAdapter);
    dispatcher.registerAdapter(mockAvatarAdapter);
  });

  test('dispatches experience events to matching adapters', async () => {
    const events = createExperienceEvents({
      responseId: 'resp-1',
      companionId: 'companion-a',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      speech: 'Hello dispatch',
      language: 'en',
    });

    const summary = await dispatcher.dispatchEvents(events);
    expect(summary.dispatched).toBe(true);
    expect(summary.eventResults.length).toBe(2);
    expect(mockVoiceAdapter.handleEvent).toHaveBeenCalledTimes(1);
    expect(mockAvatarAdapter.handleEvent).toHaveBeenCalledTimes(1);
  });

  test('does not dispatch when no matching adapters registered', async () => {
    const emptyDispatcher = new ExperienceDispatcher();
    const events = createExperienceEvents({
      responseId: 'resp-1',
      companionId: 'companion-a',
      correlationId: 'corr-1',
      channel: 'public',
      audienceId: 'audience-public',
      speech: 'Hello empty',
    });

    const summary = await emptyDispatcher.dispatchEvents(events);
    expect(summary.dispatched).toBe(false);
    expect(summary.eventResults.length).toBe(0);
  });
});
