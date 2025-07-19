/**
 * @file src/server/src/domains/score/ScoreApplicationService.ts
 * @description
 * 得点管理に関するユースケース（アプリケーションサービス）を実装します。
 */

import { Score, type ScoreDto } from './Score';
import { ScoreRepository } from './ScoreRepository';

// --- ペイロードの型定義 ---

/**
 * クライアントから `saveScoresForTurn` 関数に渡されるデータの型定義。
 * teamIdをキー、pointsを値とするオブジェクト。
 * 例: { "team-uuid-1": 10, "team-uuid-2": -5 }
 */
export type SaveScoresPayload = {
    [teamId: string]: number;
};

/**
 * 得点に関するユースケースを実現するサービスクラス。
 */
export class ScoreApplicationService {
    private readonly scoreRepository: ScoreRepository;

    constructor() {
        this.scoreRepository = new ScoreRepository();
    }

    /**
     * ユースケース: 登録されている全ての得点を取得します。
     * @returns 得点情報DTOの配列
     */
    public getAllScores(): ScoreDto[] {
        const scores = this.scoreRepository.findAll();
        return scores.map(s => s.toDto());
    }

    /**
     * ユースケース: 特定のターンの得点を一括で保存します。
     * @param turnNumber - 保存対象のターン数
     * @param payload - 保存する得点データ
     * @returns 保存された得点情報のDTO配列
     */
    public saveScoresForTurn(turnNumber: number, payload: SaveScoresPayload): ScoreDto[] {
        const savedScores: Score[] = [];

        for (const teamId in payload) {
            const points = payload[teamId];

            // 既存の得点データを探す
            let scoreEntity = this.scoreRepository.findByTurnAndTeam(turnNumber, teamId);

            if (scoreEntity) {
                // 既存データがあればポイントを更新
                scoreEntity.updatePoints(points);
            } else {
                // なければ新規作成
                scoreEntity = Score.create(teamId, turnNumber, points);
            }

            this.scoreRepository.save(scoreEntity);
            savedScores.push(scoreEntity);
        }

        return savedScores.map(s => s.toDto());
    }
}
