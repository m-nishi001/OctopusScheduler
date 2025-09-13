
import { ScheduleTimeSpan } from "../../domains/schedule-event/vo/schedule-timespan";
import { PlayAudioEventTypeDto } from "./dtos/event-types/play-audio-event-type-dto";
import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";
import type { IScheduleEventRepository } from "../../domains/schedule-event/repository/schedule-event-repository";
import type { CreateScheduleEventDto } from "./dtos/create-schedule-event-dto";
import { injectable, inject, injectAll } from "tsyringe";
import { PlayMovieEventTypeDto } from "./dtos/event-types/play-movie-event-type-dto";
import { ShowImageEventTypeDto } from "./dtos/event-types/show-image-event-type-dto";
import { TransitionPageEventTypeDto } from "./dtos/event-types/transition-page-event-type-dto";

@injectable()
export class ScheduleEventService {
    private _repo: IScheduleEventRepository;
    private _eventInstances: IScheduleEvent[];

    constructor(
        @inject("IScheduleEventRepository") scheduleEventRepository: IScheduleEventRepository,
        @injectAll("IScheduleEvent") eventInstances: IScheduleEvent[]
    ) {
        this._repo = scheduleEventRepository;
        this._eventInstances = eventInstances;
    }

    async createScheduleEvent(dto: CreateScheduleEventDto): Promise<IScheduleEvent | null> {
        const eventInstance = this._eventInstances.find(
            inst => inst.scheduleEventType?.scheduleEventType === dto.eventType
        );
        if (!eventInstance) throw new Error("Unknown eventType: " + dto.eventType);
        eventInstance.updateEventName(dto.eventName);
        eventInstance.updateEventDetail(dto.detail);
        if (dto.start && dto.end && eventInstance.updateTimeSpan) {
            const startDate = new Date(dto.start);
            const endDate = new Date(dto.end);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                const timeSpan = ScheduleTimeSpan.create(startDate, endDate);
                if (timeSpan) {
                    eventInstance.updateTimeSpan(timeSpan);
                }
            }
        }
        await this._repo.add(eventInstance);
        return this.convertToEntity(eventInstance);
    }

    async getScheduleEventById(scheduleEventId: string): Promise<IScheduleEvent | null> {
        const scheduleEvent = await this._repo.findById(scheduleEventId);
        return scheduleEvent ? this.convertToEntity(scheduleEvent) : null;
    }

    async getAllScheduleEvents(): Promise<IScheduleEvent[]> {
        const scheduleEvents = await this._repo.findAll();
        console.log("Fetched schedule events:", scheduleEvents);
        return scheduleEvents
            .map(event => this.convertToEntity(event))
            .filter(event => event !== null);
    }

    async deleteScheduleEvent(scheduleEventId: string): Promise<void> {
        await this._repo.delete(scheduleEventId);
    }

    getEventTypeList(): Array<{
        eventType: string;
        displayName: string;
        displayDescription: string
    }> {
        const eventTypeDtos = [
            new PlayAudioEventTypeDto(),
            new PlayMovieEventTypeDto(),
            new ShowImageEventTypeDto(),
            new TransitionPageEventTypeDto()
        ];
        return eventTypeDtos.map(dto => ({
            eventType: dto.eventType,
            displayName: dto.displayName,
            displayDescription: dto.displayDescription
        }));
    }

    private convertToEntity(data: IScheduleEvent): IScheduleEvent | null {
        const eventType = data.scheduleEventType?.scheduleEventType || data.scheduleEventType;
        const instance = this._eventInstances.find(inst => inst.scheduleEventType?.scheduleEventType === eventType);
        if (!instance) return null;
        const ctor = (instance as any).constructor;
        if (typeof ctor.from === "function") {
            return ctor.from(data);
        }
        return null;
    }
}