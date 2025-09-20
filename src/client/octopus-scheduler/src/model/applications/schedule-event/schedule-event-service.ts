import { ScheduleTimeSpan } from "../../domains/schedule-event/vo/schedule-timespan";
import { PlayAudioEventTypeDto } from "./dtos/event-types/play-audio-event-type-dto";
import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";
import type { IScheduleEventRepository } from "../../domains/schedule-event/repository/schedule-event-repository";
import type { CreateScheduleEventDto } from "./dtos/create-schedule-event-dto";
import type { IScheduleEventService } from "./ischedule-event-service";
import { injectable, inject, injectAll } from "tsyringe";
import type { IScheduleEventFactory } from "./factory/ischedule-event-factory";
import { AssetService } from "../assets/asset-service";
import { PlayMovieEventTypeDto } from "./dtos/event-types/play-movie-event-type-dto";
import { ShowImageEventTypeDto } from "./dtos/event-types/show-image-event-type-dto";
import { TransitionPageEventTypeDto } from "./dtos/event-types/transition-page-event-type-dto";
import type { EventTypeDto } from "./dtos/event-type-dto";

@injectable()
export class ScheduleEventService implements IScheduleEventService {
    private _repo: IScheduleEventRepository;
    private _assetService: AssetService;
    private _eventFactories: IScheduleEventFactory[];

    constructor(
        @inject("IScheduleEventRepository") scheduleEventRepository: IScheduleEventRepository,
        @inject("AssetService") assetService: AssetService,
        @injectAll("IScheduleEventFactory") eventFactories: IScheduleEventFactory[]
    ) {
        this._repo = scheduleEventRepository;
        this._assetService = assetService;
        this._eventFactories = eventFactories;
    }

    async updateScheduleEvent(dto: { scheduleEventId: string } & CreateScheduleEventDto): Promise<IScheduleEvent | null> {
        const eventInstance = this.createOrUpdateEventInstance(dto);
        await this._repo.update(eventInstance);
        return this.convertToEntity(eventInstance);
    }

    async createScheduleEvent(dto: CreateScheduleEventDto): Promise<IScheduleEvent | null> {
        const eventInstance = this.createOrUpdateEventInstance(dto);
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
        const factory = this._eventFactories.find(f => f.supports(data.scheduleEventType));
        if (!factory) return null;
        return factory.createFromRepository(data);
    }

    private createOrUpdateEventInstance(
        dto: Partial<CreateScheduleEventDto> & { scheduleEventId?: string }
    ): IScheduleEvent {
        const factory = this._eventFactories.find(f => f.supports({ scheduleEventType: dto.eventType } as any));
        if (!factory) throw new Error("Unknown eventType: " + dto.eventType);
        const eventInstance = factory.createFromClient({
            scheduleEventId: dto.scheduleEventId ?? "",
            scheduleEventType: { scheduleEventType: dto.eventType } as any,
            scheduleEventName: dto.eventName ?? "",
            scheduleTimeSpan: ScheduleTimeSpan.Empty,
            scheduleEventDetail: dto.detail ?? {},
            processedAt: null,
            registeredAt: new Date(),
            updatedAt: new Date(),
            serialize: function () { return this; },
            updateTimeSpan: () => { },
            updateEventName: () => { },
            updateEventDetail: () => { },
            markAsProcessed: () => { },
            executeScheduleEvent: () => { }
        });
        if (!eventInstance) throw new Error("Failed to create eventInstance.");
        // 以降は従来通りプロパティ更新
        eventInstance.updateEventName(dto.eventName ?? "");
        if (dto.detail) eventInstance.updateEventDetail(dto.detail);
        const startDate = new Date(dto.start || "");
        const endDate = new Date(dto.end || "");
        const timeSum = startDate.getTime() + endDate.getTime();
        if (!isNaN(timeSum)) {
            eventInstance.updateTimeSpan(ScheduleTimeSpan.create(startDate, endDate)!);
        }
        console.log("Created/Updated event instance:", eventInstance);
        return eventInstance.serialize();
    }
}