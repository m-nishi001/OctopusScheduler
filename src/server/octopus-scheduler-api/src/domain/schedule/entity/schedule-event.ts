import { ScheduleEventId } from "../value-object/schedule-event-id";
import { ScheduleEventName } from "../value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../value-object/schedule-timespan";
import { VideoEventDetail } from "../value-object/video-event-detail";
import { ImageEventDetail } from "../value-object/image-event-detail";
import { MusicEventDetail } from "../value-object/music-event-detail";
import { TransitionEventDetail } from "../value-object/transition-event-detail";


export class ScheduleEvent {
    static Empty: ScheduleEvent = new ScheduleEvent(
        ScheduleEventName.Empty,
        ScheduleTimeSpan.Empty,
        ScheduleEventId.Empty,
        "{}",
        null
    );

    eventId: ScheduleEventId;
    eventName: ScheduleEventName;
    timeSpan: ScheduleTimeSpan;
    eventDetailJson: string; // イベント固有情報(JSON文字列)
    processedAt: Date | null; // 処理済み日時（未処理ならnull）

    constructor(
        eventName: ScheduleEventName,
        timeSpan: ScheduleTimeSpan,
        eventId: ScheduleEventId | null = null,
        eventDetailJson: string = "{}",
        processedAt: Date | null = null
    ) {
        this.eventId = eventId ?? ScheduleEventId.new();
        this.eventName = eventName;
        this.timeSpan = timeSpan;
        this.eventDetailJson = eventDetailJson;
        this.processedAt = processedAt;
    }

    equals(another: ScheduleEvent): boolean {
        return this.eventId.equals(another.eventId)
            && this.eventName.equals(another.eventName)
            && this.timeSpan.equals(another.timeSpan)
            && this.eventDetailJson === another.eventDetailJson;
    }

    // 各イベント詳細クラス→eventDetailJsonへの変換
    static fromDetail(
        eventName: ScheduleEventName,
        timeSpan: ScheduleTimeSpan,
        detail: VideoEventDetail | ImageEventDetail | MusicEventDetail | TransitionEventDetail,
        eventId: ScheduleEventId | null = null,
        processedAt: Date | null = null
    ): ScheduleEvent {
        return new ScheduleEvent(
            eventName,
            timeSpan,
            eventId,
            JSON.stringify(detail),
            processedAt
        );
    }

    // eventDetailJson→各イベント詳細クラスへの変換（eventTypeはeventName.nameで判別）
    toDetail<T>(): T {
        return JSON.parse(this.eventDetailJson) as T;
    }
}