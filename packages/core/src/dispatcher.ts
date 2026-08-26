import { ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult } from './experience';

export interface DispatchSummary {
  dispatched: boolean;
  eventResults: { event: ExperienceEvent; result: ExperienceAdapterResult }[];
}

export class ExperienceDispatcher {
  private readonly adapters: ExperienceAdapter[] = [];
  private readonly dispatchedEventIds = new Set<string>();

  registerAdapter(adapter: ExperienceAdapter): void {
    this.adapters.push(adapter);
  }

  async dispatchEvents(events: ExperienceEvent[]): Promise<DispatchSummary> {
    const eventResults: { event: ExperienceEvent; result: ExperienceAdapterResult }[] = [];

    for (const event of events) {
      // Replay / duplicate dispatch protection: each eventId is dispatched only once
      if (this.dispatchedEventIds.has(event.eventId)) {
        eventResults.push({
          event,
          result: {
            accepted: false,
            eventId: event.eventId,
            lifecycle: 'FAILED',
            error: 'Duplicate event ID already dispatched',
            reason: 'DUPLICATE_EVENT_DISPATCH',
          },
        });
        continue;
      }

      this.dispatchedEventIds.add(event.eventId);

      const matchingAdapters = this.adapters.filter((a) => a.kind === event.kind);
      for (const adapter of matchingAdapters) {
        const result = await adapter.handleEvent(event);
        eventResults.push({ event, result });
      }
    }

    return {
      dispatched: eventResults.some((r) => r.result.accepted),
      eventResults,
    };
  }
}
