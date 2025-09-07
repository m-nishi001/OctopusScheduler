import { IScheduleEvent } from "../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventRepository } from "../../domain/schedule-event/schedule-event-reposiotry";
import { DataAccessService, IRepository } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-spreadsheet-servie";
import { injectable } from "tsyringe";

@injectable()
export class SpreadsheetScheduleEventRepository implements IScheduleEventRepository {
	private readonly repository: IRepository<IScheduleEvent>;
	private readonly sheetName = "ScheduleEvents";

	constructor() {
		this.repository = DataAccessService.getRepository<IScheduleEvent>(this.sheetName);
	}

	add(events: IScheduleEvent[]): number {
		let count = 0;
		for (const event of events) {
			this.repository.save(event.serialize());
			count++;
		}
		return count;
	}

	find(predicate: (entity: IScheduleEvent) => boolean): IScheduleEvent[] {
		return this.findAll().filter(predicate);
	}

	findAll(): IScheduleEvent[] {
		const records = this.repository.find(() => true);
		Logger.log(`[SpreadsheetScheduleEventRepository] Retrieved ${JSON.stringify(records)} schedule events.`);
		return records;
	}

	update(predicate: (entity: IScheduleEvent) => boolean, executor: (entity: IScheduleEvent) => IScheduleEvent): number {
		const all = this.findAll();
		let updated = 0;
		for (const event of all) {
			if (predicate(event)) {
				const updatedEvent = executor(event);
				this.repository.save(updatedEvent);
				updated++;
			}
		}
		return updated;
	}

	delete(predicate: (entity: IScheduleEvent) => boolean): number {
		const all = this.findAll();
		const beforeCount = all.length;
		this.repository.delete((obj: any) => {
			const event = all.find(e => e.scheduleEventId === obj.id);
			return event ? predicate(event) : false;
		});
		const afterCount = this.findAll().length;
		return beforeCount - afterCount;
	}
}
