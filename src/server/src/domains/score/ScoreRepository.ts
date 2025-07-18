/**
 * @file src/server/src/domains/score/ScoreRepository.ts
 * @description
 * 得点エンティティの永続化をRepositoryServiceを介して行います。
 */

import { Score, type ScoreDto } from './Score';
import { RepositoryService } from '../../repository/RepositoryService';

// 得点情報を格納するスプレッドシートのシート名
const SHEET_NAME = 'scores';

/**
 * 得点リポジトリクラス。
 */
export class ScoreRepository {
    private readonly repository: RepositoryService<ScoreDto>;

    constructor() {
        this.repository = new RepositoryService<ScoreDto>(SHEET_NAME);
    }

    /**
     * IDで得点データを検索します。
     * @param id - 検索する得点データのID
     * @returns 見つかった場合はScoreエンティティ、見つからない場合はnull
     */
    public findById(id: string): Score | null {
        const dto = this.repository.read(id);
        if (!dto) {
            return null;
        }
        return Score.reconstruct(dto);
    }

    /**
     * 特定のターンとチームIDに紐づく得点データを検索します。
     * @param turn - ターン数
     * @param teamId - チームID
     * @returns 見つかった場合はScoreエンティティ、見つからない場合はnull
     */
    public findByTurnAndTeam(turn: number, teamId: string): Score | null {
        const allScores = this.findAll();
        const found = allScores.find(score => score.turn === turn && score.teamId === teamId);
        return found || null;
    }

    /**
     * 全ての得点データを取得します。
     * @returns Scoreエンティティの配列
     */
    public findAll(): Score[] {
        const dtoList = this.repository.list();
        return dtoList.map(dto => Score.reconstruct(dto));
    }

    /**
     * 得点エンティティを永続化（新規作成または更新）します。
     * @param score - 保存するScoreエンティティ
     */
    public save(score: Score): void {
        const dto = score.toDto();
        this.repository.upsert(dto);
    }

    /**
     * IDを指定して得点データを削除します。
     * @param id - 削除する得点データのID
     */
    public delete(id: string): void {
        this.repository.delete(id);
    }
}
