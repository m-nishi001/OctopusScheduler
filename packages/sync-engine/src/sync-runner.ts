/**
 * SyncTarget の一覧を受け取り、ローカル/リモートの差分に応じて
 * push/pull を実行する汎用エンジン。
 *
 * 既存の per-file 同期実装(AssetRepository.syncAssets の runInBatches)を
 * 一般化したもの: kind ごとに IConcurrencyPolicy が返す上限までの
 * ワーカープールで並列実行し、1件のエラーはバッチ全体を止めずに
 * summary.results(結果は対象ごとの一覧)に集約する。
 */
import { inject, injectable } from "tsyringe";
import {
  IConcurrencyPolicyToken,
  type IConcurrencyPolicy,
} from "@octopus/infrastructures/interfaces";
import type { SyncTarget } from "./sync-target";
import { resolveSyncAction } from "./conflict-resolution";
import type { SyncAction } from "./conflict-resolution";

export type SyncResultKind = "pushed" | "pulled" | "skipped" | "failed";

/** 対象1件の同期結果。失敗のときは、例外のメッセージをそのまま `error` に、失敗した時点で決まっていた向きを `action` に入れる(向きが決まる前の失敗は無し)。 */
export interface SyncTargetResult {
  id: string;
  kind: string;
  result: SyncResultKind;
  action?: SyncAction;
  error?: string;
}

/** 同期の結果。対象ごとの一覧だけを持ち、件数は一覧から数える。 */
export interface SyncSummary {
  results: SyncTargetResult[];
}

/** 結果の一覧から、指定した結果の件数を数える。 */
export function countResults(summary: SyncSummary, result: SyncResultKind): number {
  return summary.results.filter((r) => r.result === result).length;
}

/**
 * 同期の対象の一覧を受け取り、ローカルとリモートの差分に応じて送る(push)・取り込む(pull)を実行する。種類ごとの並列度の上限(`IConcurrencyPolicy`)の範囲で並列に行い、1件の失敗は全体を止めず、結果にまとめる。
 */
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
    const summary: SyncSummary = { results: [] };
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
        await this.runOne(target, summary);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  private async runOne(
    target: SyncTarget,
    summary: SyncSummary
  ): Promise<void> {
    let action: SyncAction | undefined;
    try {
      const [local, remote] = await Promise.all([
        target.getLocal(),
        target.getRemote(),
      ]);
      action = resolveSyncAction(local, remote);
      let result: SyncResultKind;
      switch (action) {
        case "push":
          await target.push(local!);
          result = "pushed";
          break;
        case "pull":
          // false は、判定のあとにローカルが編集されていて書かなかったこと(その編集は次の同期で送られる)
          result = (await target.pull(remote!, local)) === false ? "skipped" : "pulled";
          break;
        case "skip":
          result = "skipped";
          break;
      }
      await target.afterSync?.();
      summary.results.push({ id: target.id, kind: target.kind, result });
    } catch (e) {
      summary.results.push({
        id: target.id,
        kind: target.kind,
        result: "failed",
        action,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
