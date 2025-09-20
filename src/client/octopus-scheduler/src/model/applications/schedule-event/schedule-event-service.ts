import { ScheduleTimeSpan } from "../../domains/schedule-event/vo/schedule-timespan";
import { PlayAudioEventTypeDto } from "./dtos/event-types/play-audio-event-type-dto";
import type { IScheduleEvent } from "../../domains/schedule-event/entity/schedule-event";
import type { IScheduleEventRepository } from "../../domains/schedule-event/repository/schedule-event-repository";
import type { CreateScheduleEventDto } from "./dtos/create-schedule-event-dto";
import type { UpdateScheduleEventDto } from "./dtos/update-schedule-event-dto";
import type { IScheduleEventService } from "./ischedule-event-service";
import { injectable, inject, injectAll } from "tsyringe";
import type { IScheduleEventFactory } from "./factory/ischedule-event-factory";
import { AssetService } from "../assets/asset-service";
import { PlayMovieEventTypeDto } from "./dtos/event-types/play-movie-event-type-dto";
import { ShowImageEventTypeDto } from "./dtos/event-types/show-image-event-type-dto";
import { TransitionPageEventTypeDto } from "./dtos/event-types/transition-page-event-type-dto";
import type { EventTypeDto } from "./dtos/event-type-dto";
import type { EventDto } from "./dtos/event-dto";

@injectable()
export class ScheduleEventService implements IScheduleEventService {

    private _eventTypeMap: Map<string, EventTypeDto> = new Map();
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

    async createScheduleEvent(dto: CreateScheduleEventDto): Promise<EventDto | null> {
        const eventInstance = this.createOrUpdateEventInstance(dto);
        await this._repo.add(eventInstance);
        if (this._eventTypeMap.size === 0) {
            await this.getEventTypeList();
        }
        const entity = this.toDomainEvent(eventInstance);
        return entity ? this.toEventDto(entity) : null;
    }

    async updateScheduleEvent(dto: UpdateScheduleEventDto): Promise<EventDto | null> {
        const eventInstance = this.createOrUpdateEventInstance(dto);
        await this._repo.update(eventInstance);
        const entity = this.toDomainEvent(eventInstance);
        return entity ? this.toEventDto(entity) : null;
    }

    async deleteScheduleEvent(scheduleEventId: string): Promise<void> {
        await this._repo.delete(scheduleEventId);
    }

    async getScheduleEventById(scheduleEventId: string): Promise<EventDto | null> {
        const scheduleEvent = await this._repo.findById(scheduleEventId);
        const entity = scheduleEvent ? this.toDomainEvent(scheduleEvent) : null;
        return entity ? this.toEventDto(entity) : null;
    }

    async getAllScheduleEvents(): Promise<EventDto[]> {
        const scheduleEvents = await this._repo.findAll();
        console.log("Fetched schedule events:", scheduleEvents);

        if (this._eventTypeMap.size === 0) {
            await this.getEventTypeList();
        }

        return scheduleEvents
            .map(event => this.toDomainEvent(event))
            .filter(event => event !== null)
            .map(event => this.toEventDto(event!));
    }

    async getCurrentScheduleEvent(): Promise<{
        startEvents: EventDto[],
        endEvents: EventDto[]
    }> {
        const { startedEvents, endedEvents } = await this._repo.fetchLatestEvents();
        console.log("Fetched current schedule events:", { startedEvents, endedEvents });
        console.log("startedEvents size:", startedEvents.length);
        console.log("endedEvents size:", endedEvents.length);
        return {
            startEvents: startedEvents.map(this.toEventDto),
            endEvents: endedEvents.map(this.toEventDto)
        };
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

    private toEventDto(event: IScheduleEvent): EventDto {
        const typeDto = this._eventTypeMap.get(event.scheduleEventType);
        console.log("Mapping event to DTO:", event, "with typeDto:", typeDto);
        return {
            scheduleEventId: event.scheduleEventId,
            scheduleEventName: event.scheduleEventName,
            scheduleEventType: event.scheduleEventType,
            displayName: typeDto?.displayName ?? event.scheduleEventType,
            displayDescription: typeDto?.displayDescription ?? '',
            start: event.scheduleTimeSpan?.start.toISOString().slice(0, 16) ?? '',
            end: event.scheduleTimeSpan?.end.toISOString().slice(0, 16) ?? '',
            scheduleEventDetail: event.scheduleEventDetail ?? {}
        };
    }

    private toDomainEvent(reposiotyEntity: IScheduleEvent): IScheduleEvent | null {
        const factory = this._eventFactories.find(f => f.supports(reposiotyEntity.scheduleEventType));
        return factory ? factory.createFrom(reposiotyEntity) : null;
    }

    private createOrUpdateEventInstance(dto: CreateScheduleEventDto | UpdateScheduleEventDto): IScheduleEvent {
        const factory = this._eventFactories.find(f => f.supports(dto.scheduleEventType));
        if (!factory) throw new Error("Unknown eventType: " + dto.scheduleEventType);

        const eventInstance = factory.createFrom({
            scheduleEventId: (dto as UpdateScheduleEventDto)?.scheduleEventId ?? "",
            scheduleEventType: { scheduleEventType: dto.scheduleEventType } as any,
            scheduleEventName: dto.scheduleEventName ?? "",
            scheduleTimeSpan: ScheduleTimeSpan.create(new Date(dto.start || ""), new Date(dto.end || "")) ?? ScheduleTimeSpan.Empty,
            scheduleEventDetail: dto.scheduleEventDetail ?? {},
            processedAt: null,
            registeredAt: new Date(),
            updatedAt: new Date(),
        } as IScheduleEvent);

        if (!eventInstance) throw new Error("Failed to create eventInstance.");

        console.log("Created/Updated event instance:", eventInstance);

        return eventInstance.serialize();
    }
}