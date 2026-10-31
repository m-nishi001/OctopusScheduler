import { injectable, inject } from "tsyringe";
import { SyncRunner } from "@octopus/sync-engine";
import type { SyncSummary } from "@octopus/sync-engine";
import { QuizRepository } from "../../model/quiz-repository";

/**
 * game-quiz内の同期対象(クイズの一覧1件と、それが参照する画像・音声のファイル)を
 * SyncRunnerに渡す薄いオーケストレーション層。方向指定は受け取らない — 一覧のupdatedAtを
 * 比較してpush/pull/skipが決まる。
 */
@injectable()
export class SyncService {
  constructor(
    @inject(SyncRunner) private readonly runner: SyncRunner,
    @inject(QuizRepository) private readonly quizRepo: QuizRepository
  ) {}

  async syncAll(): Promise<SyncSummary> {
    const targets = this.quizRepo.listSyncTargets();
    return this.runner.run(targets);
  }
}
