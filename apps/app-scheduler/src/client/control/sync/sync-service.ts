import { injectable, inject } from "tsyringe";
import { SyncRunner } from "@octopus/sync-engine";
import type { SyncSummary } from "@octopus/sync-engine";
import { AssetRepository } from "@model/asset/asset-repository";
import { KeyboardShortcutRepository } from "@model/keyboard-shortcut/keyboard-shortcut-repository";

/**
 * app-scheduler内の同期対象ドメイン(アセット、キーボードショートカット)を
 * まとめてSyncRunnerに渡す薄いオーケストレーション層。旧BulkSyncServiceと
 * 異なり方向指定は受け取らない — 各SyncTargetが自身のupdatedAtを比較して
 * push/pull/skipを自律的に決める(Last-Write-Wins)。
 */
@injectable()
export class SyncService {
  constructor(
    @inject(SyncRunner) private readonly runner: SyncRunner,
    @inject(AssetRepository) private readonly assetRepo: AssetRepository,
    @inject(KeyboardShortcutRepository)
    private readonly keyboardShortcutRepo: KeyboardShortcutRepository
  ) {}

  async syncAll(): Promise<SyncSummary> {
    const targets = [
      ...(await this.assetRepo.listSyncTargets()),
      ...(await this.keyboardShortcutRepo.listSyncTargets()),
    ];
    return this.runner.run(targets);
  }
}
