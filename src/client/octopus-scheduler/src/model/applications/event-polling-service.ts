import { container } from "tsyringe";
import { injectable } from "tsyringe";
import type { ScheduleEventService } from "./schedule-event/schedule-event-service";
import type { IScheduleEventDto } from "./schedule-event/i-schedule-event-dto";
import type { IAssetRepository } from "../domains/assets/repository/asset-repository";

@injectable()
export class EventPollingService {
  private syncTimer: any = null;
  private eventTimer: any = null;
  private assetSyncTimer: any = null;
  private scheduleEventService = container.resolve<ScheduleEventService>(
    "ScheduleEventService"
  );
  private assetRepository =
    container.resolve<IAssetRepository>("IAssetRepository");
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

  public startPolling(
    syncInterval = 10000,
    eventInterval = 1000,
    assetSyncInterval = 5000
  ) {
    if (this.syncTimer || this.eventTimer || this.assetSyncTimer) return;
    this.syncTimer = setInterval(() => this.syncEvents(), syncInterval);
    this.eventTimer = setInterval(() => this.handleEvents(), eventInterval);
    this.assetSyncTimer = setInterval(
      () => this.syncAssets(),
      assetSyncInterval
    );
    this.syncEvents();
    this.handleEvents();
    this.syncAssets();
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
    if (this.assetSyncTimer) {
      clearInterval(this.assetSyncTimer);
      this.assetSyncTimer = null;
    }
  }

  private async syncEvents() {
    try {
      await this.scheduleEventService.syncScheduleEvents();
    } catch (error) {
      console.error("Failed to sync schedule events:", error);
    }
  }

  private async syncAssets() {
    try {
      await this.assetRepository.syncAssets();
    } catch (error) {
      console.error("Failed to sync assets:", error);
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
