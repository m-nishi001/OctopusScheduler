import { NextCycleSlot, type SlotState } from "./next-cycle-slot";

export interface CycleSourceDeps<P> {
  /** 保存先の状態を読み直す(別の端末の操作を取り込む)。読んだばかりなら省いてよい。 */
  refresh(): Promise<void>;
  /**
   * 次のサイクルの材料を用意する: 続けられるかの確認 → 抽選 → 保存先への確定 → ルーレットなどの下ごしらえ。
   * **画面の状態には触れない**(裏で先に走らせるので、いま見えている演出を壊さないため)。
   * 確定済みで未公開の抽選が残っていれば、引き直さずそれを材料にする。
   */
  prepare(): Promise<P>;
  /** 使わずに捨てる材料の後始末(画像の URL の破棄など)。 */
  discard(prepared: P): void;
  onPrefetchError?(error: unknown): void;
}

/**
 * 次のサイクルの材料の出どころ。進行役が「次の抽選」を求めたとき、裏で先に用意したものがあればそれを即座に渡し、
 * 無ければ(用意していない・失敗・無効化された)従来どおりその場で用意する。
 *
 * 先に用意してよいのは、**いまの抽選の公開(reveal)が済んでから**(サーバーは、公開されていない抽選がある間は次の確定を断るため)。
 * 呼び出し側は、公開に成功したら prefetch(drawId) を呼ぶ。
 *
 * 失敗しても退行しない: 先の用意が失敗・矛盾しても、受け取りはその場の用意に切り替わる。
 * 先の用意が「確定した後」に失敗・無効化されても、確定済みで未公開の抽選として残り、その場の用意が引き直さずに演出し直す
 * (ホストの再読み込みと同じ。二重に確定しない)。
 */
export class CycleSource<P> {
  private readonly slot: NextCycleSlot<P>;

  constructor(private readonly deps: CycleSourceDeps<P>) {
    this.slot = new NextCycleSlot<P>({ onDiscard: (p) => deps.discard(p), onError: (e) => deps.onPrefetchError?.(e) });
  }

  get state(): SlotState<P> {
    return this.slot.state;
  }

  /** drawId の抽選の公開が済んだ。次のサイクルの材料を裏で用意し始める(同じ drawId では1回だけ)。 */
  prefetch(afterDrawId: string): void {
    this.slot.start(afterDrawId, async () => {
      await this.deps.refresh();
      return this.deps.prepare();
    });
  }

  /** 次のサイクルの材料。用意中なら出来上がりを待つ(二重に確定しない)。無ければ、その場で用意する。 */
  async next(): Promise<P> {
    const prepared = await this.slot.take();
    if (prepared) return prepared;
    await this.deps.refresh();
    return this.deps.prepare();
  }

  /** 先の用意を取り消す(リセット・読み直し・対象の変更・画面を離れる)。 */
  invalidate(): void {
    this.slot.invalidate();
  }
}
