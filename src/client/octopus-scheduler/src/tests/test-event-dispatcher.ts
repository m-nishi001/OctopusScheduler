import { eventHandlers } from '../eventHandlers/eventHandlers';
import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts';

// サーバーAPI経由で最新イベントを取得（targetTime指定可）
async function fetchLatestEvent(targetTime?: string): Promise<{ type: string, detail: any } | null> {
    const gasService = GasFunctionService.create('callOctopusSchedulerApi');
    if (!gasService) return null;
    return new Promise((resolve) => {
        gasService.createCall<any>('ScheduleService.getLatestEvent', targetTime ? { targetTime } : {})
            .withTimeout(10000)
            .withSuccessed((result) => {
                if (result && result.eventName && result.eventDetailJson) {
                    let detail = null;
                    try {
                        detail = JSON.parse(result.eventDetailJson);
                    } catch (e) {
                        console.error('eventDetailJson parse error', e);
                    }
                    resolve({ type: result.eventName, detail });
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
    async function pollEvents() {
        // サーバーから最新の全イベントメタ情報を再取得
        if (!gasService) return;
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

        // mapの前のallEventsを出力
        console.log('allEvents:', allEvents);

        const eventTimes = allEvents
            .filter(e => !!e.start)
            .map(e => ({ type: e.eventName, start: e.start }))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        // map/filter/sort後のeventTimesを出力
        console.log('eventTimes:', eventTimes);

        for (const e of eventTimes) {
            const event = await fetchLatestEvent(e.start);
            if (event) {
                console.log('取得イベント:', event.type, event.detail);
                const handler = eventHandlers[event.type];
                if (handler) {
                    handler(event.detail);
                    console.log('ハンドラ実行済み:', event.type);
                } else {
                    console.warn('ハンドラ未定義:', event.type);
                }
            } else {
                console.log('該当イベントなし');
            }
            await new Promise(res => setTimeout(res, 1000));
        }
        console.log('==== 全イベント取得・ハンドリング完了 ====');
    }
    await pollEvents();
}
