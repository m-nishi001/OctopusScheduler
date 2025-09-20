import { IScheduleEvent } from "../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventRepository } from "../../domain/schedule-event/schedule-event-reposiotry";
import { ISpreadsheetService, SpreadsheetService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-spreadsheet-servie";
import { injectable } from "tsyringe";

@injectable()
export class SpreadsheetScheduleEventRepository implements IScheduleEventRepository {
	private readonly repository: ISpreadsheetService<IScheduleEvent>;
	private readonly sheetName = "ScheduleEvents";

	constructor() {
		this.repository = SpreadsheetService.getService<IScheduleEvent>(this.sheetName);
	}

	add(events: IScheduleEvent[]): number {
		let count = 0;
		for (const event of events) {
			this.repository.add(event.serialize());
			count++;
		}
		return count;
	}

	find(predicate: (entity: IScheduleEvent) => boolean): IScheduleEvent[] {
		return this.findAll().filter(predicate);
	}

	findAll(): IScheduleEvent[] {
		return this.repository.find(() => true);
	}

	update(
		predicate: (entity: IScheduleEvent) => boolean,
		executor: (entity: IScheduleEvent) => IScheduleEvent): number {
		return this.repository.update(
			predicate,
			(entity: IScheduleEvent) => executor(entity).serialize());
	}

	delete(predicate: (entity: IScheduleEvent) => boolean): number {
		const beforeCount = this.findAll().length;
		this.repository.delete(predicate);
		const afterCount = this.findAll().length;
		return beforeCount - afterCount;
	}
}
