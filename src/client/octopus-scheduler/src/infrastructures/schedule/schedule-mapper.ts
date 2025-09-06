import { Schedule } from "../../domains/schedule/entity/schedule";
import type { IEvent } from "../../domains/schedule/entity/event";
import { AudioEvent } from "../../domains/schedule/entity/events/audio-event";
import { ImageEvent } from "../../domains/schedule/entity/events/image-event";
import { VideoEvent } from "../../domains/schedule/entity/events/video-event";
import { TransitionEvent } from "../../domains/schedule/entity/events/transition-event";
import { AudioDetail } from "../../domains/schedule/vo/event-details/audio-detail";
import { ImageDetail } from "../../domains/schedule/vo/event-details/image-detail";
import { TransitionDetail } from "../../domains/schedule/vo/event-details/transition-detail";
import { VideoDetail } from "../../domains/schedule/vo/event-details/video-detail";
import { TimeSpan } from "../../domains/schedule/vo/timespan";


/**
 * APIの戻り値イベント型（ローカル型定義）
 */
type ApiScheduleEvent = {
    id: string;
    eventName: string;
    start: string;
    end: string;
    eventDetailJson?: string;
};

/**
 * JSONデータから対応するエンティティオブジェクトにデシリアライズ/シリアライズする責任を持つ
 */
export class ScheduleMapper {
    /**
     * APIの戻り値（単一イベント）からScheduleエンティティを生成
     */
    public static toDomain(json: ApiScheduleEvent): Schedule {
        try {
            const event: IEvent = ScheduleMapper.eventToDomain(json);
            return Schedule.reconstruct(json.id, 1, [event]);
        } catch (error) {
            console.error(`[ScheduleMapper] Error mapping schedule data:`, error);
            throw new Error("Invalid schedule event data format");
        }
    }

    /**
     * APIイベントデータをIEventへ変換
     */
    public static eventToDomain(eventJson: ApiScheduleEvent): IEvent {
        const timeSpan = TimeSpan.from({ start: eventJson.start, end: eventJson.end });
        const detailObj = eventJson.eventDetailJson ? JSON.parse(eventJson.eventDetailJson) : {};
        switch (eventJson.eventName) {
            case "music":
                return new AudioEvent(eventJson.id, timeSpan, AudioDetail.from(detailObj));
            case "image":
                return new ImageEvent(eventJson.id, timeSpan, ImageDetail.from(detailObj));
            case "transition":
                return new TransitionEvent(eventJson.id, timeSpan, TransitionDetail.from(detailObj));
            case "video":
                return new VideoEvent(eventJson.id, timeSpan, VideoDetail.from(detailObj));
            default:
                throw new Error(`未知のイベントタイプ: ${eventJson.eventName}`);
        }
    }

    /**
     * エンティティからJSONデータにシリアライズする
     */
    public static toJSON(schedule: Schedule): string {
        return JSON.stringify(schedule);
    }
}