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
 * GASから返されるEventオブジェクトのJSON構造を定義
 */
interface EventJson {
    id: string;
    _eventName: string;
    _timeSpan: { startTime: string; endTime: string; };
    eventDetail: any;
}

/**
 * GASから返されるScheduleオブジェクトのJSON構造を定義
 */
interface ScheduleJson {
    id: string;
    version: number;
    events: EventJson[];
}

/**
 * JSONデータから対応するエンティティオブジェクトにデシリアライズ/シリアライズする責務を持つ
 */
export class ScheduleMapper {
    /**
     * JSONデータから対応するエンティティオブジェクトにデシリアライズする
     */
    public static toDomain(json: ScheduleJson): Schedule {
        const events: IEvent[] = json.events.map(eventJson => {
            const timeSpan = new TimeSpan(new Date(eventJson._timeSpan.startTime), new Date(eventJson._timeSpan.endTime));
            const detail = eventJson.eventDetail;
            switch (eventJson._eventName) {
                case "AudioEvent":
                    return new AudioEvent(eventJson.id, timeSpan, new AudioDetail(detail.audioID, detail.fadeInMs, detail.fadeOutMs));
                case "ImageEvent":
                    return new ImageEvent(eventJson.id, timeSpan, new ImageDetail(detail.imageID, detail.fadeInMs, detail.fadeOutMs));
                case "TransitionEvent":
                    return new TransitionEvent(eventJson.id, timeSpan, new TransitionDetail(new URL(detail.destinationURL)));
                case "VideoEvent":
                    return new VideoEvent(eventJson.id, timeSpan, new VideoDetail(detail.videoID, detail.fadeInMs, detail.fadeOutMs));
                default:
                    throw new Error(`未知のイベントタイプ: ${eventJson._eventName}`);
            }
        });
        return Schedule.reconstruct(json.id, json.version, events);
    }

    /**
     * エンティティからJSONデータにシリアライズする
     */
    public static toJSON(schedule: Schedule): string {
        return JSON.stringify(schedule);
    }
}