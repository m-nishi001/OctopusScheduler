import { injectable } from "tsyringe";
import { IScheduleEventRepository } from "../../domain/schedule-event/schedule-event-reposiotry";
import { ScheduleEvent } from "../../domain/schedule-event/entity/schedule-event";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly repository: ISpreadsheetService<ScheduleEvent>;
  private readonly sheetName = "ScheduleEvents";

  constructor() {
    this.repository = SpreadsheetService.getService<ScheduleEvent>(
      this.sheetName,
      "octopus-schedule-api-spreadsheet"
    );
  }

  getScheduleEvents(): ScheduleEvent[] {
    return this.repository.find((r: ScheduleEvent) => true);
  }

  updateScheduleEvents(events: ScheduleEvent[]): void {
    if (events.length === 0) return;
    const transaction = this.repository.beginTransaction();
    for (const event of events) {
      transaction.update(
        (r: ScheduleEvent) => r.id === event.id,
        () => event
      );
    }
    transaction.commit();
  }

  deleteScheduleEvents(ids: string[]): void {
    for (const id of ids) {
      this.repository.delete((r: ScheduleEvent) => r.id === id);
    }
  }

  addScheduleEvents(events: ScheduleEvent[]): void {
    const transaction = this.repository.beginTransaction();
    for (const event of events) {
      transaction.add(event);
    }
    transaction.commit();
  }
}
