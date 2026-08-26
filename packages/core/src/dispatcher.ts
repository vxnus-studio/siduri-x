import { ExperienceAdapter, ExperienceEvent, ExperienceAdapterResult } from './experience';

export interface DispatchSummary {
  dispatched: boolean;
  eventResults: { event: ExperienceEvent; result: ExperienceAdapterResult }[];
}

export class ExperienceDispatcher {
  private readonly adapters: ExperienceAdapter[] = [];

  registerAdapter(adapter: ExperienceAdapter): void {
    this.adapters.push(adapter);
  }

  async dispatchEvents(events: ExperienceEvent[]): Promise<DispatchSummary> {
    const eventResults: { event: ExperienceEvent; result: ExperienceAdapterResult }[] = [];

    for (const event of events) {
      const matchingAdapters = this.adapters.filter((a) => a.kind === event.kind);
      for (const adapter of matchingAdapters) {
        const result = await adapter.handleEvent(event);
        eventResults.push({ event, result });
      }
    }

    return {
      dispatched: eventResults.length > 0,
      eventResults,
    };
  }
}
