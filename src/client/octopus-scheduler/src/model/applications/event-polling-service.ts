import { container } from "tsyringe";
import { injectable } from "tsyringe";
import type { ScheduleEventService } from "./schedule-event/schedule-event-service";
import type { IScheduleEventDto } from "./schedule-event/i-schedule-event-dto";

@injectable()
export class EventPollingService {
  private syncTimer: any = null;
  private eventTimer: any = null;
  private scheduleEventService = container.resolve<ScheduleEventService>(
    "ScheduleEventService"
  );
  private onEventsCallback?: (
    startEvents: IScheduleEventDto[],
    endEvents: IScheduleEventDto[]
  ) => void;

  public setOnEventsCallback(
    callback: (
      startEvents: IScheduleEventDto[],
      endEvents: IScheduleEventDto[]
    ) => void
  ) {
    this.onEventsCallback = callback;
  }

  public startPolling(interval = 5000) {
    if (this.syncTimer || this.eventTimer) return;
    this.syncTimer = setInterval(() => this.syncEvents(), interval);
    this.eventTimer = setInterval(() => this.handleEvents(), interval);
    this.syncEvents();
    this.handleEvents();
  }

  public stopPolling() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.eventTimer) {
      clearInterval(this.eventTimer);
      this.eventTimer = null;
    }
  }

  private async syncEvents() {
    try {
      await this.scheduleEventService.syncScheduleEvents();
    } catch (error) {
      console.error("Failed to sync schedule events:", error);
    }
  }

  private async handleEvents() {
    const { startEvents, endEvents } =
      await this.scheduleEventService.getCurrentScheduleEvent();

    if (this.onEventsCallback) {
      this.onEventsCallback(startEvents, endEvents);
    }

    if (startEvents.length > 0) {
      await this.scheduleEventService.markEventsAsStarted(
        startEvents.map((e) => e.id)
      );
    }
    if (endEvents.length > 0) {
      await this.scheduleEventService.markEventsAsEnded(
        endEvents.map((e) => e.id)
      );
    }
  }
}
