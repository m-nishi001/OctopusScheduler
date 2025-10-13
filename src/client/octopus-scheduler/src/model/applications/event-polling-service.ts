import { container } from "tsyringe";
import type { ScheduleEventService } from "./schedule-event/schedule-event-service";
import type { IScheduleEventEntity } from "src/model/domains/schedule-event/i-schedule-event-entity";

export class EventPollingService {
  private pollingTimer: any = null;
  private scheduleEventService = container.resolve<ScheduleEventService>(
    "ScheduleEventService"
  );
  private onEventsCallback?: (
    startEvents: IScheduleEventEntity[],
    endEvents: IScheduleEventEntity[]
  ) => void;

  public setOnEventsCallback(
    callback: (
      startEvents: IScheduleEventEntity[],
      endEvents: IScheduleEventEntity[]
    ) => void
  ) {
    this.onEventsCallback = callback;
  }

  public startPolling(interval = 5000) {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(() => this.handleEvents(), interval);
    this.handleEvents();
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
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
