
import { ScheduleEvent } from "../../domain/scheduler/entity/schedule-event";
import { IScheduleEventRepository } from "../../domain/scheduler/schedule-event-reposiotry";
import { ScheduleEventName } from "../../domain/scheduler/value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../../domain/scheduler/value-object/schedule-timespan";
import { ScheduleEventId } from "../../domain/scheduler/value-object/schedule-event-id";
import { DataAccessService, IRepository } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-spreadsheet-servie";
import { injectable } from "tsyringe";

@injectable()
export class SpreadsheetScheduleEventRepository implements IScheduleEventRepository {
	private readonly repository: IRepository<any>;
	private readonly sheetName = "ScheduleEvents";

	constructor() {
		this.repository = DataAccessService.getRepository<any>(this.sheetName);
	}

	add(events: ScheduleEvent[]): number {
		let count = 0;
		for (const event of events) {
			this.repository.save({
				id: event.eventId.id,
				eventName: event.eventName.name,
				start: event.timeSpan.start.toISOString(),
				end: event.timeSpan.end.toISOString()
			});
			count++;
		}
		return count;
	}

	find(predicate: (entity: ScheduleEvent) => boolean): ScheduleEvent[] {
		// いったん全件取得し、ScheduleEventに変換してからpredicateで絞り込む
		return this.findAll().filter(predicate);
	}

	findAll(): ScheduleEvent[] {
		const records = this.repository.find(() => true);
		return records.map(obj => {
			const eventName = ScheduleEventName.create(obj.eventName) ?? ScheduleEventName.Empty;
			const timeSpan = ScheduleTimeSpan.create(new Date(obj.start), new Date(obj.end)) ?? ScheduleTimeSpan.Empty;
			const eventId = ScheduleEventId.from(obj.id) ?? ScheduleEventId.Empty;
			return new ScheduleEvent(eventName, timeSpan, eventId);
		});
	}

	update(predicate: (entity: ScheduleEvent) => boolean, executor: (entity: ScheduleEvent) => ScheduleEvent): number {
		const all = this.findAll();
		let updated = 0;
		for (const event of all) {
			if (predicate(event)) {
				const updatedEvent = executor(event);
				this.repository.save({
					id: updatedEvent.eventId.id,
					eventName: updatedEvent.eventName.name,
					start: updatedEvent.timeSpan.start.toISOString(),
					end: updatedEvent.timeSpan.end.toISOString()
				});
				updated++;
			}
		}
		return updated;
	}

	delete(predicate: (entity: ScheduleEvent) => boolean): number {
		const all = this.findAll();
		let deleted = 0;
		for (const event of all) {
			if (predicate(event)) {
				const result = this.repository.delete((obj: any) => obj.id === event.eventId.id);
				if (result) deleted++;
			}
		}
		return deleted;
	}
}
