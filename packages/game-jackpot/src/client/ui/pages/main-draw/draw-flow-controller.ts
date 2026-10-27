import type { DrawEndReason, DrawProgress } from "@control/draw/dto/draw-progress";
import type { ActionQueue, Step } from "./action-queue";

/** 終了の画面が出た直後は、連打された進行操作で飛ばさない(この時間は見せる)。 */
export const MIN_END_DISPLAY_MS = 1000;

/** 次に進む先。終了(景品・メンバーのどちらが尽きた場合も endReason に出る)か、積むサイクルのステップ。 */
export type NextCycle = { kind: "finished"; progress: DrawProgress } | { kind: "cycle"; steps: Step[] };

export interface DrawFlowDeps {
  queue: ActionQueue;
  /**
   * 続けられるかを確かめ、続けられるなら次の抽選のサイクルを返す(先に裏で用意してあれば、通信せずにそれを返す)。
   * 失敗したら例外を投げる。
   */
  nextCycle(): Promise<NextCycle>;
  /** 抽選の失敗。サイクルは積まれず、次の進行操作でもう一度抽選する。 */
  onDrawError(error: unknown): void;
  /** ステップの失敗。そのステップは捨てられ、次の進行操作で続きから進む。 */
  onStepError(error: unknown): void;
  /** 抽選が終わった(景品かメンバーが尽きた)。終了の画面を出す。 */
  onFinished(reason: DrawEndReason, progress: DrawProgress): void;
  /** 終了の画面で進行操作(「次へ」・Enter・OK)があった。結果の画面へ進む。 */
  onLeave(): void;
  /** 進行が止まった(次のEnter待ち、または終了)。この時点の状態を公開する。 */
  onSettled(): void;
  now?: () => number;
}

/**
 * 抽選の進行役。Enter(または遠隔の「次へ」)ごとに、pause のステップまで連続して進める。
 * キューが空になれば、続けられるかを確かめて次の抽選を引く。続けられなければ「終了」になり、
 * 終了後の進行操作は結果の画面へ進む。画面の都合(ref・DOM)は知らない。
 */
export class DrawFlowController {
  /** 画面の準備ができるまで、進行操作は無視する(準備前に届いた遠隔操作で二重に抽選しないため)。 */
  ready = false;
  private running = false;
  private endedAtMs: number | null = null;
  private left = false;

  constructor(private readonly deps: DrawFlowDeps) {}

  /** 抽選が終わっている(終了の画面を出している)。 */
  get finished(): boolean {
    return this.endedAtMs !== null;
  }

  async advance(): Promise<void> {
    if (!this.ready || this.running) return;
    if (this.endedAtMs !== null) {
      this.leave();
      return;
    }
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

  private leave(): void {
    if (this.left || this.now() - (this.endedAtMs ?? 0) < MIN_END_DISPLAY_MS) return;
    this.left = true;
    this.deps.onLeave();
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** 続けられるなら次の抽選を引いてサイクルを積む。終了、または積めなかったら false。 */
  private async refill(): Promise<boolean> {
    try {
      const next = await this.deps.nextCycle();
      if (next.kind === "finished") {
        this.endedAtMs = this.now();
        this.deps.onFinished(next.progress.endReason!, next.progress);
        return false;
      }
      this.deps.queue.addCycle(next.steps);
      return true;
    } catch (e) {
      this.deps.onDrawError(e);
      return false;
    }
  }
}
