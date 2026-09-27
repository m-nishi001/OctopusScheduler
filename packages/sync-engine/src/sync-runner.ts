/**
 * SyncTarget の一覧を受け取り、ローカル/リモートの差分に応じて
 * push/pull を実行する汎用エンジン。
 *
 * 既存の per-file 同期実装(AssetRepository.syncAssets の runInBatches)を
 * 一般化したもの: kind ごとに IConcurrencyPolicy が返す上限までの
 * ワーカープールで並列実行し、1件のエラーはバッチ全体を止めずに
 * summary.failed に集約する。
 */
import { inject, injectable } from "tsyringe";
import {
  IConcurrencyPolicyToken,
  type IConcurrencyPolicy,
} from "@octopus/infrastructures/interfaces";
import type { SyncTarget } from "./sync-target";
import { resolveSyncAction } from "./conflict-resolution";

export interface SyncFailure {
  id: string;
  error: string;
}

export interface SyncSummary {
  pushed: number;
  pulled: number;
  skipped: number;
  failed: SyncFailure[];
}

function createEmptySummary(): SyncSummary {
  return { pushed: 0, pulled: 0, skipped: 0, failed: [] };
}

@injectable()
export class SyncRunner {
  constructor(
    @inject(IConcurrencyPolicyToken)
    private readonly concurrencyPolicy: IConcurrencyPolicy
  ) {}

  /**
   * 渡された全 SyncTarget を同期する。kind ごとに独立した並列度で処理され、
   * 異なる kind 同士は同時に走る。
   */
  async run(targets: SyncTarget[]): Promise<SyncSummary> {
    const summary = createEmptySummary();
    const targetsByKind = new Map<string, SyncTarget[]>();
    for (const target of targets) {
      const list = targetsByKind.get(target.kind) ?? [];
      list.push(target);
      targetsByKind.set(target.kind, list);
    }

    await Promise.all(
      Array.from(targetsByKind.entries()).map(([kind, kindTargets]) =>
        this.runKindBatch(kind, kindTargets, summary)
      )
    );

    return summary;
  }

  private async runKindBatch(
    kind: string,
    targets: SyncTarget[],
    summary: SyncSummary
  ): Promise<void> {
    const concurrency = Math.max(
      1,
      Math.min(this.concurrencyPolicy.maxConcurrency(kind), targets.length)
    );
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < targets.length) {
        const target = targets[nextIndex++];
        try {
          await this.runOne(target, summary);
        } catch (e) {
          summary.failed.push({
            id: target.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  private async runOne(
    target: SyncTarget,
    summary: SyncSummary
  ): Promise<void> {
    const [local, remote] = await Promise.all([
      target.getLocal(),
      target.getRemote(),
    ]);
    const action = resolveSyncAction(local, remote);

    switch (action) {
      case "push":
        await target.push(local!.data);
        summary.pushed++;
        break;
      case "pull":
        await target.pull(remote!.data);
        summary.pulled++;
        break;
      case "skip":
        summary.skipped++;
        break;
    }
  }
}
