/**
 * @file TimetableApplicationService.ts
 * @description
 * タイムテーブル管理に関するユースケース（アプリケーションサービス）を実装します。
 * 主に管理画面からのリクエストを調整し、ドメイン層を操作します。
 */

import { Timetable, type TimetableDto } from './Timetable';
import { TimetalbeDomainService } from './TimetableDomainService';
import { TimetableRepository } from './TimetableRepository';

// --- ペイロードの型定義 ---

/**
 * クライアントから `saveAllTimetables` 関数に渡されるデータの型定義。
 * DTOの配列として受け取ることで、管理画面での一括更新を可能にします。
 * IDがない項目は新規作成、IDがある項目は更新または順序変更として扱われます。
 */
export type SaveAllTimetablesPayload = TimetableDto[];

/**
 * 現在のターン情報をクライアントに返すためのDTO
 */
export interface CurrentTurnInfoDto {
    turnNumber: number; // 1巡目なら1, 2巡目なら2...
    turnName: string;   // 「1巡目」「小休憩」など
    status: 'waiting' | 'in_progress' | 'break' | 'finished';
    startTime: string; // ISO 8601 形式
    endTime: string;   // ISO 8601 形式
}


/**
 * タイムテーブルに関するユースケースを実現するサービスクラス。
 */
export class TimetableApplicationService {
    private readonly timetableRepository: TimetableRepository;

    constructor() {
        this.timetableRepository = new TimetableRepository();
    }

    /**
     * ユースケース: 登録されている全てのタイムテーブル項目を取得します。
     * @returns タイムテーブル情報DTOの配列
     */
    public getAllTimetables(): TimetableDto[] {
        const timetables = this.timetableRepository.findAll();
        return timetables.map(t => t.toDto());
    }

    /**
     * ユースケース: 全てのタイムテーブル項目を一括で保存します。
     * 管理画面での順序変更、追加、削除を一度に反映させるためのメソッドです。
     * @param payload - クライアントから渡された、保存するタイムテーブル項目の全リスト
     * @returns 保存されたタイムテーブルのDTO配列
     */
    public saveAllTimetables(payload: SaveAllTimetablesPayload): TimetableDto[] {
        // 1. クライアントから受け取ったDTOの配列から、Timetableエンティティの配列を再構成します。
        //    IDがないものは新規作成、IDがあるものは既存のものとして扱います。
        const timetables = payload.map(dto => {
            if (dto.id) {
                // 既存のデータはそのままエンティティに変換
                return Timetable.reconstruct(dto);
            } else {
                // IDがなければ新規作成としてエンティティを生成
                return Timetable.create(dto.turnName, dto.startTime, dto.endTime, dto.remarks);
            }
        });

        // 2. リポジトリの `saveAll` メソッドを使い、全件を一度に永続化（置き換え）します。
        this.timetableRepository.saveAll(timetables);

        // 3. 永続化された（IDが採番された）最新のDTOリストをクライアントに返します。
        return timetables.map(t => t.toDto());
    }


    /**
     * タイムテーブルより最大ターン数をを経んっきゃっくする
     * @returns 最大ターン数
     */
    public getMaxTurnCount(): number {
        return TimetalbeDomainService.getMaxTurnCount(this.getAllTimetables());
    }

    /**
     * 【新規追加】現在のサーバー時刻に基づき、現在のターン情報を取得します。
     * @returns 現在のターン情報DTO
     */
    public getCurrentTurnInfo(): CurrentTurnInfoDto | null {
        const allTimetables = this.timetableRepository.findAll();
        if (allTimetables.length === 0) {
            return null;
        }

        const now = new Date();
        const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

        for (const timetable of allTimetables) {
            if (!timetable.startTime || !timetable.endTime) continue;

            const startTime = new Date(`${todayStr}T${Utilities.formatDate(new Date(timetable.startTime), Session.getScriptTimeZone(), 'HH:mm:ss')}`);
            const endTime = new Date(`${todayStr}T${Utilities.formatDate(new Date(timetable.endTime), Session.getScriptTimeZone(), 'HH:mm:ss')}`);

            if (now >= startTime && now < endTime) {
                const isBreak = !timetable.turnName.includes("巡目");
                const turnNumberMatch = timetable.turnName.match(/(\d+)/);

                return {
                    turnNumber: turnNumberMatch ? parseInt(turnNumberMatch[0], 10) : 0,
                    turnName: timetable.turnName,
                    status: isBreak ? 'break' : 'in_progress',
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                };
            }
        }

        // どの時間帯にも当てはまらない場合
        const firstEvent = allTimetables[0];
        const lastEvent = allTimetables[allTimetables.length - 1];
        const firstStartTime = new Date(`${todayStr}T${firstEvent.startTime}`);
        const lastEndTime = new Date(`${todayStr}T${lastEvent.endTime}`);

        if (now < firstStartTime) {
            return {
                turnNumber: 0,
                turnName: "イベント開始前",
                status: 'waiting',
                startTime: firstStartTime.toISOString(),
                endTime: firstStartTime.toISOString(),
            };
        }

        if (now >= lastEndTime) {
            return {
                turnNumber: 0,
                turnName: "イベント終了",
                status: 'finished',
                startTime: lastEndTime.toISOString(),
                endTime: lastEndTime.toISOString(),
            };
        }

        // 時間と時間の間（休憩時間などでタイムテーブルに登録されていない場合）
        return {
            turnNumber: 0,
            turnName: "休憩中",
            status: 'break',
            startTime: now.toISOString(),
            endTime: now.toISOString(),
        };
    }
}
