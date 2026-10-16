import type { ActionQueue, Step } from "./action-queue";

export interface DrawFlowDeps {
  queue: ActionQueue;
  /** 残りの景品数。0以下なら次の抽選を始めない。 */
  remainingPrizes(): Promise<number>;
  /** 次の抽選をして、そのサイクルのステップを返す。失敗したら例外を投げる。 */
  drawNextCycle(): Promise<Step[]>;
  /** 抽選の失敗。サイクルは積まれず、次の進行操作でもう一度抽選する。 */
  onDrawError(error: unknown): void;
  /** ステップの失敗。そのステップは捨てられ、次の進行操作で続きから進む。 */
  onStepError(error: unknown): void;
  /** 進行が止まった(次のEnter待ち、または終了)。この時点の状態を公開する。 */
  onSettled(): void;
}

/**
 * 抽選の進行役。Enter(または遠隔の「次へ」)ごとに、pause のステップまで連続して進める。
 * キューが空になれば次の抽選を引いて続ける。画面の都合(ref・DOM)は知らない。
 */
export class DrawFlowController {
  /** 画面の準備ができるまで、進行操作は無視する(準備前に届いた遠隔操作で二重に抽選しないため)。 */
  ready = false;
  private running = false;

  constructor(private readonly deps: DrawFlowDeps) {}

  async advance(): Promise<void> {
    if (!this.ready || this.running) return;
    this.running = true;
    try {
      for (;;) {
        if (this.deps.queue.isEmpty() && !(await this.refill())) break;
        const next = this.deps.queue.dequeue();
        if (!next) break;
        await next.run();
        if (next.pause) break;
      }
    } catch (e) {
      this.deps.onStepError(e);
    } finally {
      this.running = false;
      this.deps.onSettled();
    }
  }

  /** 次の抽選を引いてサイクルを積む。積めなかったら false。 */
  private async refill(): Promise<boolean> {
    if ((await this.deps.remainingPrizes()) <= 0) return false;
    try {
      this.deps.queue.addCycle(await this.deps.drawNextCycle());
      return true;
    } catch (e) {
      this.deps.onDrawError(e);
      return false;
    }
  }
}
