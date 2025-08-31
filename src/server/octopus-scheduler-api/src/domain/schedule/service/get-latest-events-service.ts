import { ScheduleEvent } from '../entity/schedule-event';

/**
 * 現在時刻または指定時刻で開始・終了すべきイベントを配列で返すドメインサービス
 */
export class GetLatestEventsService {
    static execute(allEvents: ScheduleEvent[], now: Date) {
        // 開始すべきイベント: now >= start && now < end
        const startEvents = allEvents.filter(e => e.timeSpan.start <= now && now < e.timeSpan.end);
        // 終了すべきイベント: now >= end
        const endEvents = allEvents.filter(e => e.timeSpan.end <= now);
        return { startEvents, endEvents };
    }
}
