/**
 * 次のサイクルの「下ごしらえ」を1つだけ置いておく場所(純粋なモデル。Vue も通信も知らない)。
 *
 * 状態は4つ。
 *   idle      : 何も用意していない
 *   preparing : 裏で用意している最中(key = どの抽選のあとに用意し始めたか)
 *   ready     : 用意できた(value)。次の進行操作で受け取れる
 *   failed    : 用意に失敗した。受け取ろうとしても null で、呼び出し側が従来どおりその場で用意する
 *
 * 受け取り(take)・無効化(invalidate)で idle に戻る。無効化したとき、用意中だったものは出来上がっても捨てる
 * (世代番号で見分ける)。用意できた値を捨てるときは onDiscard で後始末する(画像の URL の破棄など)。
 */
export type SlotState<T> =
  | { kind: "idle" }
  | { kind: "preparing"; key: string }
  | { kind: "ready"; key: string; value: T }
  | { kind: "failed"; key: string; error: unknown };

/** 次のサイクルの下ごしらえを1つ置く場所。使い方は上のコメント。 */
export class NextCycleSlot<T> {
  private current: SlotState<T> = { kind: "idle" };
  /** 用意中の仕事。 */
  private inflight: Promise<void> | null = null;
  /** 無効化のたびに進む。古い世代の仕事の結果は捨てる。 */
  private generation = 0;

  constructor(private readonly options: { onDiscard?: (value: T) => void; onError?: (error: unknown) => void } = {}) {}

  get state(): SlotState<T> {
    return this.current;
  }

  /**
   * key の抽選のあとの下ごしらえを裏で始める。同じ key で用意中・用意済み・失敗済みなら何もしない
   * (失敗した key をむやみにやり直さず、受け取り側が従来どおりその場で用意する)。別の key なら前のものを無効化して始め直す。
   */
  start(key: string, task: () => Promise<T>): void {
    if (this.current.kind !== "idle" && this.current.key === key) return;
    this.invalidate();
    const generation = this.generation;
    this.current = { kind: "preparing", key };
    this.inflight = task().then(
      (value) => {
        if (generation !== this.generation) {
          this.options.onDiscard?.(value); // 無効化されたあとに出来上がった
          return;
        }
        this.current = { kind: "ready", key, value };
      },
      (error) => {
        if (generation !== this.generation) return;
        this.current = { kind: "failed", key, error };
        this.options.onError?.(error);
      }
    );
  }

  /**
   * 用意したものを受け取る。用意中なら出来上がるのを待つ。受け取ったら idle に戻る(二重に使わない)。
   * 用意が無い・失敗・待っている間に無効化された、のときは null。
   */
  async take(): Promise<T | null> {
    if (this.inflight) await this.inflight;
    const state = this.current;
    if (state.kind === "ready") {
      this.current = { kind: "idle" };
      this.inflight = null;
      return state.value;
    }
    if (state.kind === "failed") {
      this.current = { kind: "idle" };
      this.inflight = null;
    }
    return null;
  }

  /** 用意を取り消す(リセット・画面を離れる・対象の変更・読み直し)。用意済みの値は onDiscard で後始末する。 */
  invalidate(): void {
    this.generation++;
    if (this.current.kind === "ready") this.options.onDiscard?.(this.current.value);
    this.current = { kind: "idle" };
    this.inflight = null;
  }
}
