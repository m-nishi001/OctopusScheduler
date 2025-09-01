import { eventHandlers } from '../eventHandlers/eventHandlers';
import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts';
import { usePolling } from '/root/google_apps_script/octopus-scheduler/src/client/packages/shared-composables/src/use-polling';

// サーバーAPI経由で最新イベント群を取得（targetTime指定可）
type ScheduleEventResult = {
    id: string;
    eventName: string;
    start: string;
    end: string;
    eventDetailJson: string;
};

type LatestEventsResponse = {
    startEvents: ScheduleEventResult[];
    endEvents: ScheduleEventResult[];
};

async function fetchLatestEvents(targetTime?: string): Promise<LatestEventsResponse | null> {
    const gasService = GasFunctionService.create('callOctopusSchedulerApi');
    if (!gasService) return null;
    return new Promise((resolve) => {
        gasService.createCall<any>('ScheduleService.getLatestEvent', targetTime ? { targetTime } : {})
            .withTimeout(10000)
            .withSuccessed((result) => {
                if (result && (Array.isArray(result.startEvents) || Array.isArray(result.endEvents))) {
                    resolve(result);
                } else {
                    resolve(null);
                }
            })
            .withFailuered((message) => {
                console.error('getLatestEvent failed', message);
                resolve(null);
            })
            .invoke();
    });
}

// テストイベントの存在チェック・追加・ディスパッチ・ハンドリング検証を1関数で実行
export async function testEventDispatcher() {
    console.log('==== イベントディスパッチテスト開始 ====');
    const gasService = GasFunctionService.create('callOctopusSchedulerApi');
    if (!gasService) return;
    // 1. テストイベントの存在チェック
    let existingEvents: any[] = [];
    await new Promise((resolve) => {
        gasService.createCall<any>('ScheduleService.getAllScheduleEvents')
            .withTimeout(10000)
            .withSuccessed((result) => {
                existingEvents = Array.isArray(result) ? result : [];
                resolve(true);
            })
            .withFailuered(() => resolve(false))
            .invoke();
    });
    // 2. 既存イベントがなければ追加
    if (existingEvents.length === 0) {
        const now = new Date();
        const events = [
            {
                eventName: 'video',
                start: new Date(now.getTime() + 1000 * 10).toISOString(),
                end: new Date(now.getTime() + 1000 * 70).toISOString(),
                eventDetailJson: JSON.stringify({ videoID: 'vid001', fadeInMs: 100, fadeOutMs: 100 })
            },
            {
                eventName: 'image',
                start: new Date(now.getTime() + 1000 * 20).toISOString(),
                end: new Date(now.getTime() + 1000 * 80).toISOString(),
                eventDetailJson: JSON.stringify({ imageID: 'img001', fadeInMs: 100, fadeOutMs: 100 })
            },
            {
                eventName: 'music',
                start: new Date(now.getTime() + 1000 * 30).toISOString(),
                end: new Date(now.getTime() + 1000 * 90).toISOString(),
                eventDetailJson: JSON.stringify({ audioID: 'aud001', fadeInMs: 100, fadeOutMs: 100 })
            },
            {
                eventName: 'transition',
                start: new Date(now.getTime() + 1000 * 40).toISOString(),
                end: new Date(now.getTime() + 1000 * 100).toISOString(),
                eventDetailJson: JSON.stringify({ destinationURL: 'https://example.com' })
            }
        ];
        for (const event of events) {
            await new Promise((resolve) => {
                gasService.createCall<any>('ScheduleService.save', event)
                    .withTimeout(10000)
                    .withSuccessed(() => resolve(true))
                    .withFailuered(() => resolve(false))
                    .invoke();
            });
        }
        console.log('==== テスト用イベント登録完了 ====');
    } else {
        console.log('==== テスト用イベントは既に存在します ====');
    }

    // 3. ディスパッチ処理・取得・ハンドリング検証
    let eventTimes: { type: string, start: string }[] = [];
    let currentIndex = 0;
    let initialized = false;
    let stopPolling: (() => void) | null = null;

    async function pollEvents() {
        if (!gasService) return;
        if (!initialized) {
            // 初回のみ全イベント取得
            let allEvents: any[] = [];
            await new Promise((resolve) => {
                gasService.createCall<any>('ScheduleService.getAllScheduleEvents')
                    .withTimeout(10000)
                    .withSuccessed((result) => {
                        allEvents = Array.isArray(result) ? result : [];
                        resolve(true);
                    })
                    .withFailuered(() => resolve(false))
                    .invoke();
            });
            eventTimes = allEvents
                .filter(e => !!e.start)
                .map(e => ({ type: e.eventName, start: e.start }))
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            console.log('eventTimes:', eventTimes);
            initialized = true;
        }
        if (currentIndex >= eventTimes.length) {
            if (stopPolling) stopPolling();
            console.log('==== 全イベント取得・ハンドリング完了 ====');
            return;
        }
        const e = eventTimes[currentIndex];
        console.log('ポーリング中のイベント:', e);
        currentIndex++;
        const latest = await fetchLatestEvents(e.start);
        console.log('fetchLatestEvents result:', latest);
        const processedIds: string[] = [];
        if (latest) {
            // 開始イベント
            for (const se of latest.startEvents || []) {
                let detail = null;
                try {
                    detail = JSON.parse(se.eventDetailJson);
                } catch (err) {
                    console.error('eventDetailJson parse error', err);
                }
                console.log('取得開始イベント:', se.eventName, detail);
                const handler = eventHandlers[se.eventName];
                if (handler) {
                    handler(detail);
                    console.log('ハンドラ実行済み:', se.eventName);
                } else {
                    console.warn('ハンドラ未定義:', se.eventName);
                }
                processedIds.push(se.id);
            }
            // 終了イベント
            for (const ee of latest.endEvents || []) {
                let detail = null;
                try {
                    detail = JSON.parse(ee.eventDetailJson);
                } catch (err) {
                    console.error('eventDetailJson parse error', err);
                }
                console.log('取得終了イベント:', ee.eventName, detail);
                const handler = eventHandlers[ee.eventName];
                if (handler) {
                    handler(detail);
                    console.log('ハンドラ実行済み:', ee.eventName);
                } else {
                    console.warn('ハンドラ未定義:', ee.eventName);
                }
                processedIds.push(ee.id);
            }
            // 取得・処理したイベントIDをサーバに送信して処理済みにマーク
            if (processedIds.length > 0) {
                await new Promise((resolve) => {
                    gasService.createCall<any>('ScheduleService.markEventsAsProcessed', { eventIds: processedIds })
                        .withTimeout(10000)
                        .withSuccessed((result) => {
                            console.log('markEventsAsProcessed result:', result);
                            resolve(true);
                        })
                        .withFailuered((message) => {
                            console.error('markEventsAsProcessed failed', message);
                            resolve(false);
                        })
                        .invoke();
                });
            }
        } else {
            console.log('該当イベントなし');
        }
    }

    // usePollingでポーリング実行（例: 1秒間隔、即時実行）
    const { start, stop } = usePolling(pollEvents, 1000, { immediate: true });
    start();
    stopPolling = stop;
}
