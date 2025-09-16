
import { ScheduleTimeSpan } from "../../domains/schedule-event/vo/schedule-timespan";
import { PlayAudioEventTypeDto } from "./dtos/event-types/play-audio-event-type-dto";
import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";
import type { IScheduleEventRepository } from "../../domains/schedule-event/repository/schedule-event-repository";
import type { CreateScheduleEventDto } from "./dtos/create-schedule-event-dto";
import type { IScheduleEventService } from "./ischedule-event-service";
import { injectable, inject, injectAll } from "tsyringe";
import { AssetService } from "../assets/asset-service";
import { PlayMovieEventTypeDto } from "./dtos/event-types/play-movie-event-type-dto";
import { ShowImageEventTypeDto } from "./dtos/event-types/show-image-event-type-dto";
import { TransitionPageEventTypeDto } from "./dtos/event-types/transition-page-event-type-dto";
import type { EventTypeDto } from "./dtos/event-type-dto";

@injectable()
export class ScheduleEventService implements IScheduleEventService {
    private _repo: IScheduleEventRepository;
    private _eventInstances: IScheduleEvent[];
    private _assetService: AssetService;

    constructor(
        @inject("IScheduleEventRepository") scheduleEventRepository: IScheduleEventRepository,
        @injectAll("IScheduleEvent") eventInstances: IScheduleEvent[],
        @inject("AssetService") assetService: AssetService
    ) {
        this._repo = scheduleEventRepository;
        this._eventInstances = eventInstances;
        this._assetService = assetService;
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

    async getCurrentScheduleEvent(): Promise<{
        startEvents: IScheduleEvent[],
        endEvents: IScheduleEvent[]
    }> {
        const { startedEvents, endedEvents } = await this._repo.fetchLatestEvents();
        console.log("Fetched current schedule events:", { startedEvents, endedEvents });
        console.log("startedEvents size:", startedEvents.length);
        console.log("endedEvents size:", endedEvents.length);
        return {
            startEvents: startedEvents,
            endEvents: endedEvents
        };
    }

    async deleteScheduleEvent(scheduleEventId: string): Promise<void> {
        await this._repo.delete(scheduleEventId);
    }

    async getEventTypeList(): Promise<EventTypeDto[]> {
        const allAssets = await this._assetService.getAllAssets();
        const eventTypeDtos = [
            new PlayAudioEventTypeDto(
                allAssets.filter(a => a.assetType.assetTypeName.includes('audio')).map(a => ({ id: a.assetId, name: a.assetName }))
            ),
            new PlayMovieEventTypeDto(
                allAssets.filter(a => a.assetType.assetTypeName.includes('video')).map(a => ({ id: a.assetId, name: a.assetName }))
            ),
            new ShowImageEventTypeDto(
                allAssets.filter(a => a.assetType.assetTypeName.includes('image')).map(a => ({ id: a.assetId, name: a.assetName }))
            ),
            new TransitionPageEventTypeDto([])
        ];
        return eventTypeDtos.map(dto => ({
            eventType: dto.eventType,
            displayName: dto.displayName,
            displayDescription: dto.displayDescription,
            settingsSchema: dto.settingsSchema
        }));
    }

    private convertToEntity(data: IScheduleEvent): IScheduleEvent | null {
        /**
         * Converts a plain IScheduleEvent object (often deserialized from storage/JSON)
         * back into a fully functional event class instance (e.g. PlayAudioEvent).
         *
         * Why this is needed:
         * - When you deserialize an object, you lose its class methods and prototype chain.
         * - This function finds the correct event class (by eventType),
         *   then uses its static 'from' method to reconstruct a proper instance.
         *
         * Implementation details:
         * - Finds a sample instance of the correct event type from DI container.
         * - Gets its constructor (the class itself).
         * - If the class has a static 'from' method, calls it to create a new instance.
         * - Returns null if no matching type or method is found.
         *
         * This pattern is common in TypeScript/JavaScript for restoring class functionality after deserialization.
         */
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