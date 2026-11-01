import { injectable, inject } from "tsyringe";
import { SyncRunner } from "@octopus/sync-engine";
import type { SyncSummary } from "@octopus/sync-engine";
import { JackpotRepository } from "../../model/jackpot-repository";
import { MemberRepository } from "../../model/member/member-repository";

/**
 * game-jackpot内の同期対象ドメイン(景品・画面設定・素材のレコード、メンバー拡張設定)を
 * まとめてSyncRunnerに渡す薄いオーケストレーション層。旧BulkSyncServiceと異なり
 * 方向指定は受け取らない — 各SyncTargetが自身のupdatedAtを比較して自律的に
 * push/pull/skipを決める。
 */
@injectable()
export class SyncService {
  constructor(
    @inject(SyncRunner) private readonly runner: SyncRunner,
    @inject(JackpotRepository) private readonly jackpotRepo: JackpotRepository,
    @inject(MemberRepository) private readonly memberRepo: MemberRepository
  ) {}

  async syncAll(): Promise<SyncSummary> {
    const targets = [...(await this.jackpotRepo.listSyncTargets()), ...(await this.memberRepo.listSyncTargets())];
    return this.runner.run(targets);
  }
}
