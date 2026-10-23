import { DrawConflictError } from "../../model/errors";
import type { DrawPlan, DrawStore } from "./draw-store";
import type { DrawResultDto } from "./dto/draw-result-dto";

interface Row {
  result: DrawResultDto;
  revealed: boolean;
}

/**
 * メモリだけの抽選状態。セッションの外で動かしたとき、デモのとき、テストで使う。
 * 画面を開き直す(ページを読み込み直す)と消える。矛盾の検査はサーバーの commit と同じ。
 */
export class RehearsalDrawStore implements DrawStore {
  readonly kind = "rehearsal" as const;
  private rows: Row[] = [];
  private currentPlan: DrawPlan | null = null;

  async load(): Promise<void> {}

  async results(): Promise<DrawResultDto[]> {
    return this.rows.map((r) => ({ ...r.result }));
  }

  async plan(): Promise<DrawPlan | null> {
    return this.currentPlan && { ...this.currentPlan };
  }

  async ensurePlan(kakuhenTimings: number[], reservedPrizeIds: string[]): Promise<DrawPlan> {
    this.currentPlan ??= { kakuhenTimings: [...kakuhenTimings], reservedPrizeIds: [...reservedPrizeIds] };
    return { ...this.currentPlan };
  }

  async commit(result: DrawResultDto): Promise<void> {
    const memberId = result.wonMember?.id;
    const prizeId = result.wonPrize?.id;
    if (!memberId || !prizeId) throw new Error("当選者と景品が決まっていない抽選結果は確定できません");
    const same = this.rows.find((r) => r.result.drawId === result.drawId);
    if (same) {
      if (same.result.wonMember?.id === memberId && same.result.wonPrize?.id === prizeId && same.result.isKakuhen === result.isKakuhen) return;
      throw new DrawConflictError("同じ抽選IDで内容の違う結果がすでにあります");
    }
    if (this.rows.some((r) => r.result.wonMember?.id === memberId)) throw new DrawConflictError("このメンバーはすでに当選しています");
    if (this.rows.some((r) => r.result.wonPrize?.id === prizeId)) throw new DrawConflictError("この景品はすでに当選済みです");
    if (this.rows.some((r) => !r.revealed)) throw new DrawConflictError("公開されていない抽選結果があります");
    if (this.currentPlan) {
      const reserved = this.currentPlan.reservedPrizeIds.includes(prizeId);
      if (result.isKakuhen && !reserved) throw new DrawConflictError("確変の抽選に、取り置いた景品以外が選ばれました");
      if (!result.isKakuhen && reserved) throw new DrawConflictError("通常の抽選に、確変のために取り置いた景品が選ばれました");
    }
    this.rows.push({ result: { ...result }, revealed: false });
  }

  async reveal(drawId: string): Promise<void> {
    const row = this.rows.find((r) => r.result.drawId === drawId);
    if (!row) throw new DrawConflictError("公開する抽選結果が見つかりません");
    row.revealed = true;
  }

  async pending(): Promise<DrawResultDto | null> {
    const row = this.rows.find((r) => !r.revealed);
    return row ? { ...row.result } : null;
  }

  async reset(): Promise<void> {
    this.rows = [];
    this.currentPlan = null;
  }
}
