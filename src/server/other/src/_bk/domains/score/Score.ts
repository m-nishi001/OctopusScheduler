/**
 * @file src/server/src/domains/score/Score.ts
 * @description
 * チームの得点に関するドメインエンティティとデータ転送オブジェクト(DTO)を定義します。
 */

import type { ISerializable } from '../../repository/ISerializable';

/**
 * 'scores'シートの1行に相当する、得点のメタデータを表すDTO (Data Transfer Object)。
 * RepositoryServiceによって永続化される際の基本単位となります。
 */
export interface ScoreDto extends ISerializable {
    /**
     * ISerializableインターフェースを満たすための一意なID (UUID)。
     * 各得点レコードはこれで識別されます。
     */
    id: string;

    /**
     * 得点が紐づくチームのID。
     */
    teamId: string;

    /**
     * 得点が記録されたターン数（巡目）。
     */
    turn: number;

    /**
     * そのターンで獲得した得点。
     */
    points: number;
}


/**
 * 得点エンティティクラス。
 * 得点に関するビジネスルールと状態を管理します。
 */
export class Score implements ISerializable {
    public readonly id: string;
    public readonly teamId: string;
    public readonly turn: number;
    private _points: number;

    private constructor(id: string, teamId: string, turn: number, points: number) {
        // --- 不変条件 (Invariant) のチェック ---
        if (!id) throw new Error('ID is required for a Score.');
        if (!teamId) throw new Error('Team ID is required for a Score.');
        if (turn < 1) throw new Error('Turn must be a positive number.');
        // pointsは負の値も許可する

        this.id = id;
        this.teamId = teamId;
        this.turn = turn;
        this._points = points;
    }

    /**
     * ファクトリメソッド: 新しい得点インスタンスを生成します。
     * @param teamId チームID
     * @param turn ターン数
     * @param points 得点
     * @returns 新しいScoreインスタンス
     */
    public static create(teamId: string, turn: number, points: number): Score {
        const newId = Utilities.getUuid();
        return new Score(newId, teamId, turn, points);
    }

    /**
     * ファクトリメソッド: 永続化されたデータからインスタンスを再構成します。
     * @param dto - リポジトリから取得したデータ (ScoreDto)
     * @returns 再構成されたScoreインスタンス
     */
    public static reconstruct(dto: ScoreDto): Score {
        return new Score(dto.id, dto.teamId, dto.turn, dto.points);
    }

    /**
     * 得点を更新します。
     * @param newPoints - 新しい得点
     */
    public updatePoints(newPoints: number): void {
        this._points = newPoints;
    }

    // --- ゲッター (Getter) ---
    get points(): number { return this._points; }

    /**
     * 永続化やクライアントへの転送のために、エンティティをDTOに変換します。
     * @returns プレーンな得点情報オブジェクト (ScoreDto)
     */
    public toDto(): ScoreDto {
        return {
            id: this.id,
            teamId: this.teamId,
            turn: this.turn,
            points: this._points,
        };
    }
}
