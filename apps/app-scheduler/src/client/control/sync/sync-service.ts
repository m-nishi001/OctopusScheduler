import { injectable, inject } from "tsyringe";
import { SyncRunner } from "@octopus/sync-engine";
import type { SyncSummary } from "@octopus/sync-engine";
import { AssetRepository } from "@model/asset/asset-repository";
import { AppEventRepository } from "@model/app-event/app-event-repository";

/**
 * app-scheduler内の同期対象ドメイン(アセット)を
 * まとめてSyncRunnerに渡す薄いオーケストレーション層。旧BulkSyncServiceと
 * 異なり方向指定は受け取らない — 各SyncTargetが自身のupdatedAtを比較して
 * push/pull/skipを自律的に決める(Last-Write-Wins)。
 */
@injectable()
export class SyncService {
  constructor(
    @inject(SyncRunner) private readonly runner: SyncRunner,
    @inject(AssetRepository) private readonly assetRepo: AssetRepository,
    @inject(AppEventRepository) private readonly eventRepo: AppEventRepository
  ) {}

  async syncAll(): Promise<SyncSummary> {
    // 予定イベントの正はサーバー。同期の周期に合わせて最新をキャッシュに写す(読むだけで、サーバーには書かない。失敗しても同期は続ける)。
    await this.eventRepo.refresh();
    const targets = await this.assetRepo.listSyncTargets();
    return this.runner.run(targets);
  }
}
