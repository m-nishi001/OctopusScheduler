import { container } from "tsyringe";
import { QuizSyncService } from "@octopus/game-quiz";

export interface PrepareResult {
  ok: boolean;
  /** 失敗した項目の説明(成功分は含めない)。 */
  errors: string[];
}

let inFlight: Promise<PrepareResult> | null = null;

/**
 * ホスト端末(投影用PC)に、各ゲームのデータを Drive から取り込む。
 *
 * 投影する端末は、設定(賞品・クイズ・画面・素材)を作った端末とは限らない。ホストとして
 * セッションに入った時点で取り込んでおけば、管理端末の遠隔操作ですぐ本番画面を開ける。
 * 取り込みは「新しい方が勝つ」同期なので、ホスト側に未保存の変更が無ければ pull だけが行われる。
 * 同時に何度呼ばれても1回分にまとめる。
 */
export function prepareHostData(): Promise<PrepareResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const errors: string[] = [];
    const run = async (label: string, fn: () => Promise<{ failed: unknown[] }>): Promise<void> => {
      try {
        const summary = await fn();
        if (summary.failed.length > 0) errors.push(`${label}: ${summary.failed.length}件の取り込みに失敗しました`);
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
