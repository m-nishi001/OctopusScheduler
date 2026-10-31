import { container } from "tsyringe";
import { QuizSyncService } from "@octopus/game-quiz";
import { AssetRepository } from "@model/asset/asset-repository";
import { AssetSource } from "../media/asset-source";

export interface PrepareResult {
  ok: boolean;
  /** 失敗した項目の説明(成功分は含めない)。 */
  errors: string[];
}

/**
 * 音楽・スクリーンの素材を、小さいものから先に取っておく(指示が来たときに待たないため)。
 * 結果は待たない。失敗しても進行は止めず、警告に残すだけ(指示が来たら `ensure` が取り直す)。
 */
function prefetchMedia(): void {
  void (async () => {
    try {
      const metas = await container.resolve(AssetRepository).listRemote();
      await container.resolve(AssetSource).prefetchAll(metas.map((m) => ({ id: m.driveDataId, size: m.size, fileId: m.fileId })));
    } catch (error) {
      console.warn("素材の先読みに失敗しました", error);
    }
  })();
}

let inFlight: Promise<PrepareResult> | null = null;

/**
 * ホスト端末(投影用PC)に、各ゲームのデータを Drive から取り込む。
 *
 * 投影する端末は、設定(賞品・クイズ・画面・素材)を作った端末とは限らない。ホストとして
 * セッションに入った時点で取り込んでおけば、管理端末の遠隔操作ですぐ本番画面を開ける。
 * 取り込みは「新しい方が勝つ」同期なので、ホスト側に未保存の変更が無ければ pull だけが行われる。
 * あわせて、音楽・スクリーンの素材の先読みを始める(待たない)。
 * 同時に何度呼ばれても1回分にまとめる。
 */
export function prepareHostData(): Promise<PrepareResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    prefetchMedia();
    const errors: string[] = [];
    const run = async (label: string, fn: () => Promise<{ results: { result: string }[] }>): Promise<void> => {
      try {
        const summary = await fn();
        const failed = summary.results.filter((r) => r.result === "failed").length;
        if (failed > 0) errors.push(`${label}: ${failed}件の取り込みに失敗しました`);
      } catch (e) {
        errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    await Promise.all([
      // ジャックポットのパッケージは必要になったときに読み込む(ホストのデータ準備でだけ使うため)。
      run("ジャックポット", async () => {
        const { JackpotSyncService } = await import("@octopus/game-jackpot");
        return container.resolve(JackpotSyncService).syncAll();
      }),
      run("クイズ", () => container.resolve(QuizSyncService).syncAll()),
    ]);
    return { ok: errors.length === 0, errors };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
