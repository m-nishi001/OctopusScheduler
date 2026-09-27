import { injectable, inject } from "tsyringe";
import { SyncRunner } from "@octopus/sync-engine";
import type { SyncSummary } from "@octopus/sync-engine";
import { AssetDataRepository } from "../../model/asset/asset-data-repository";
import { MemberRepository } from "../../model/member/member-repository";
import { PrizeRepository } from "../../model/prize/prize-repository";
import { ScreenConfigRepository } from "../../model/screen-config/screen-config-repository";

/**
 * game-jackpot内の同期対象ドメイン(アセット、メンバー拡張設定、景品、画面設定)を
 * まとめてSyncRunnerに渡す薄いオーケストレーション層。旧BulkSyncServiceと異なり
 * 方向指定は受け取らない — 各SyncTargetが自身のupdatedAtを比較して自律的に
 * push/pull/skipを決める。
 */
@injectable()
export class SyncService {
  constructor(
    @inject(SyncRunner) private readonly runner: SyncRunner,
    @inject(AssetDataRepository) private readonly assetRepo: AssetDataRepository,
    @inject(MemberRepository) private readonly memberRepo: MemberRepository,
    @inject(PrizeRepository) private readonly prizeRepo: PrizeRepository,
    @inject(ScreenConfigRepository)
    private readonly screenConfigRepo: ScreenConfigRepository
  ) {}

  async syncAll(): Promise<SyncSummary> {
    const targets = [
      ...(await this.assetRepo.listSyncTargets()),
      ...(await this.memberRepo.listSyncTargets()),
      ...(await this.prizeRepo.listSyncTargets()),
      ...(await this.screenConfigRepo.listSyncTargets()),
    ];
    return this.runner.run(targets);
  }
}
