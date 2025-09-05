import { inject, injectable } from "tsyringe";
import { IScheduleEventRepository } from "../../domain/schedule/schedule-event-reposiotry";
import { GasService } from "../gas-service";
import { ScheduleEvent } from "../../domain/schedule/entity/schedule-event";
import { GetLatestEventsService } from "../../domain/schedule/service/get-latest-events-service";
import { ScheduleEventName } from "../../domain/schedule/value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../../domain/schedule/value-object/schedule-timespan";
import { ScheduleEventId } from "../../domain/schedule/value-object/schedule-event-id";

@injectable()
export class ScheduleService implements GasService {
    serviceName: string = "ScheduleService";
    functions: Record<string, (args: any) => any>;
    repository: IScheduleEventRepository;

    constructor(@inject("IScheduleEventRepository") repository: IScheduleEventRepository) {
        this.repository = repository;
        this.functions = {
            "save": this.save.bind(this),
            "delete": this.delete.bind(this),
            "getAllScheduleEvents": this.getAllScheduleEvents.bind(this),
            "findById": this.findById.bind(this),
            "getLatestEvent": this.getLatestEvent.bind(this),
            "markEventsAsProcessed": this.markEventsAsProcessed.bind(this)
        };
    }

    // 現在時刻（日本時間）または指定時刻で開始・終了すべきイベントを配列で返す
    private getLatestEvent(args?: { targetTime?: string }): any {
        const now = args && args.targetTime
            ? new Date(args.targetTime)
            : new Date(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

        Logger.log(`[ScheduleService.getLatestEvent] targetTime: ${args && args.targetTime ? args.targetTime : 'not provided'}, now: ${Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')}`);

        // 未処理イベントのみ取得
        const all = this.repository.findAll().filter(e => !e.processedAt);
        const { startEvents, endEvents } = GetLatestEventsService.execute(all, now);

        Logger.log(`[ScheduleService.getLatestEvent] returning startEvents: ${JSON.stringify(startEvents.map(e => e.eventId.id))}, endEvents: ${JSON.stringify(endEvents.map(e => e.eventId.id))}`);

        return {
            startEvents: startEvents.map(e => ({
                id: e.eventId.id,
                eventName: e.eventName.name,
                start: e.timeSpan.start,
                end: e.timeSpan.end,
                eventDetailJson: e.eventDetailJson
            })),
            endEvents: endEvents.map(e => ({
                id: e.eventId.id,
                eventName: e.eventName.name,
                start: e.timeSpan.start,
                end: e.timeSpan.end,
                eventDetailJson: e.eventDetailJson
            }))
        };
    }

    // 指定したイベントID群を処理済みにする
    private markEventsAsProcessed(args: { eventIds: string[] }): { updated: number } {
        if (!args || !Array.isArray(args.eventIds)) return { updated: 0 };
        const now = new Date();
        const updated = this.repository.update(
            (entity: ScheduleEvent) => args.eventIds.includes(entity.eventId.id),
            (entity: ScheduleEvent) => {
                return new ScheduleEvent(
                    entity.eventName,
                    entity.timeSpan,
                    entity.eventId,
                    entity.eventDetailJson,
                    now
                );
            }
        );
        return { updated };
    }

    // Save or update a schedule event
    private save(json: string): { saved: boolean } {
        try {
            const obj = typeof json === 'string' ? JSON.parse(json) : json;
            // Assume obj has id, eventName, start, end
            let eventId = obj.id ? ScheduleEventId.from(obj.id) : undefined;
            const eventName = ScheduleEventName.create(obj.eventName);
            const timespan = ScheduleTimeSpan.create(obj.start, obj.end);
            if (!eventName || !timespan) throw new Error('Invalid eventName or timespan');
            const eventDetailJson = obj.eventDetailJson ?? "{}";
            const event = new ScheduleEvent(eventName, timespan, eventId, eventDetailJson);
            if (eventId) {
                // update
                this.repository.update(
                    (entity: ScheduleEvent) => entity.eventId.equals(eventId!),
                    () => event
                );
            } else {
                // add
                this.repository.add([event]);
            }
            return { saved: true };
        } catch (e) {
            Logger.log(`[ScheduleService.save] failed: ${e}`);
            return { saved: false };
        }
    }


    // Delete a schedule event by id
    private delete(id: string): { deletedCount: number } {
        try {
            const eventId = ScheduleEventId.from(id);
            if (!eventId) throw new Error('Invalid eventId');
            const deletedCount = this.repository.delete((entity: ScheduleEvent) => entity.eventId.equals(eventId));
            return { deletedCount };
        } catch (e) {
            Logger.log(`[ScheduleService.delete] failed: ${e}`);
            return { deletedCount: 0 };
        }
    }



    // Get all schedule events (full info)
    private getAllScheduleEvents(): any[] {
        return this.repository.findAll().map(scheduleEvent => (
            {
                id: scheduleEvent.eventId.id,
                eventName: scheduleEvent.eventName.name,
                start: scheduleEvent.timeSpan.start,
                end: scheduleEvent.timeSpan.end,
                eventDetailJson: scheduleEvent.eventDetailJson
            }
        ));
    }

    // Find a schedule event by id
    private findById(id: string): any {
        const eventId = ScheduleEventId.from(id);
        if (!eventId) return null;
        const event = this.repository.findAll().find(e => e.eventId.equals(eventId));
        if (!event) return null;
        return {
            id: event.eventId.id,
            eventName: event.eventName.name,
            start: event.timeSpan.start,
            end: event.timeSpan.end
        };
    }
}
