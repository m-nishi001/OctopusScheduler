/**
 * @file Timetable.ts
 * @description
 * イベントの進行スケジュールである「タイムテーブル」に関するドメインエンティティとDTOを定義します。
 */

import type { ISerializable } from '../../repository/ISerializable';

/**
 * 'timetables'シートの1行に相当する、タイムテーブルのアイテムを表すDTO (Data Transfer Object)。
 * RepositoryServiceによって永続化される際の基本単位となります。
 */
export interface TimetableDto extends ISerializable {
    /**
     * ISerializableインターフェースを満たすための一意なID (UUID)。
     */
    id: string;

    /**
     * ターンの名称 (例: 「1巡目」, 「小休憩」, 「結果発表」)。
     */
    turnName: string;

    /**
     * 開始時刻 (例: "13:00")。
     * スプレッドシートでの扱いやすさを考慮し、文字列として保持します。
     */
    startTime: string;

    /**
     * 終了時刻 (例: "13:50")。
     * スプレッドシートでの扱いやすさを考慮し、文字列として保持します。
     */
    endTime: string;

    /**
     * 補足事項などを記載する備考欄。
     */
    remarks: string;
}

/**
 * タイムテーブルエンティティクラス。
 * スケジュール項目に関するビジネスルールと状態を管理します。
 */
export class Timetable implements ISerializable {
    public readonly id: string;
    private _turnName: string;
    private _startTime: string;
    private _endTime: string;
    private _remarks: string;

    /**
     * コンストラクタはprivateとし、ファクトリメソッド経由でのみインスタンスを生成します。
     * @param id - 項目の一意なID
     * @param turnName - ターン名
     * @param startTime - 開始時刻
     * @param endTime - 終了時刻
     * @param remarks - 備考
     */
    private constructor(id: string, turnName: string, startTime: string, endTime: string, remarks: string) {
        // --- 不変条件 (Invariant) のチェック ---
        if (!id) throw new Error('ID is required for a Timetable item.');
        if (!turnName || turnName.trim() === '') throw new Error('Turn name is required.');
        // 時刻のフォーマットチェックはここでは行わず、入力の自由度を許容する

        this.id = id;
        this._turnName = turnName;
        this._startTime = startTime;
        this._endTime = endTime;
        this._remarks = remarks;
    }

    /**
     * ファクトリメソッド: 新しいタイムテーブル項目を生成します。
     * @param turnName - ターン名
     * @param startTime - 開始時刻
     * @param endTime - 終了時刻
     * @param remarks - 備考
     * @returns 新しいTimetableインスタンス
     */
    public static create(turnName: string, startTime: string, endTime: string, remarks: string): Timetable {
        const newId = Utilities.getUuid();
        return new Timetable(newId, turnName, startTime, endTime, remarks);
    }

    /**
     * ファクトリメソッド: 永続化されたデータからインスタンスを再構成します。
     * @param dto - リポジトリから取得したデータ (TimetableDto)
     * @returns 再構成されたTimetableインスタンス
     */
    public static reconstruct(dto: TimetableDto): Timetable {
        return new Timetable(dto.id, dto.turnName, dto.startTime, dto.endTime, dto.remarks);
    }

    /**
     * タイムテーブルの項目情報を更新します。
     * @param turnName - 新しいターン名
     * @param startTime - 新しい開始時刻
     * @param endTime - 新しい終了時刻
     * @param remarks - 新しい備考
     */
    public updateDetails(turnName: string, startTime: string, endTime: string, remarks: string): void {
        if (!turnName || turnName.trim() === '') {
            throw new Error('Turn name cannot be empty.');
        }
        this._turnName = turnName;
        this._startTime = startTime;
        this._endTime = endTime;
        this._remarks = remarks;
    }

    // --- ゲッター (Getter) ---
    get turnName(): string { return this._turnName; }
    get startTime(): string { return this._startTime; }
    get endTime(): string { return this._endTime; }
    get remarks(): string { return this._remarks; }

    /**
     * 永続化やクライアントへの転送のために、エンティティをDTOに変換します。
     * @returns プレーンなタイムテーブル項目オブジェクト (TimetableDto)
     */
    public toDto(): TimetableDto {
        return {
            id: this.id,
            turnName: this._turnName,
            startTime: this._startTime,
            endTime: this._endTime,
            remarks: this._remarks,
        };
    }
}
