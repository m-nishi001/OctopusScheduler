import { injectable, inject } from "tsyringe";
import { SyncRunner } from "@octopus/sync-engine";
import type { SyncSummary } from "@octopus/sync-engine";
import { QuizRepository } from "../../model/quiz-repository";

/**
 * game-quiz内の同期対象(クイズ一覧メタデータ+各クイズのアセット)をまとめて
 * SyncRunnerに渡す薄いオーケストレーション層。旧SyncQuizzesUseCaseと異なり
 * 方向指定は受け取らない — 各SyncTargetが自身のupdatedAtを比較して自律的に
 * push/pull/skipを決める。
 */
@injectable()
export class SyncService {
  constructor(
    @inject(SyncRunner) private readonly runner: SyncRunner,
    @inject(QuizRepository) private readonly quizRepo: QuizRepository
  ) {}

  async syncAll(): Promise<SyncSummary> {
    const targets = await this.quizRepo.listSyncTargets();
    return this.runner.run(targets);
  }
}
