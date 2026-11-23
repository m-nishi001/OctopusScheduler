import type { DrawEndReason, DrawProgress } from "@control/draw/dto/draw-progress";
import type { ActionQueue, Step } from "./action-queue";

/** 終了の画面が出た直後は、連打された進行操作で飛ばさない(この時間は見せる)。 */
export const MIN_END_DISPLAY_MS = 1000;

/**
 * 次に進む先。終了(景品・メンバーのどちらが尽きた場合も endReason に出る)か、積むサイクルのステップか、
 * 抽選を打ち切って次の画面へ進む(leave。デモ抽選が決めた回数に達したとき。終了の画面は出さない)。
 */
export type NextCycle = { kind: "finished"; progress: DrawProgress } | { kind: "cycle"; steps: Step[] } | { kind: "leave" };

export interface DrawFlowDeps {
  queue: ActionQueue;
  /**
   * 続けられるかを確かめ、続けられるなら次の抽選のサイクルを返す(先に裏で用意してあれば、通信せずにそれを返す)。
   * 失敗したら例外を投げる。
   */
  nextCycle(): Promise<NextCycle>;
  /** 次の抽選の材料が、いますぐ渡せるか(先読みが済んでいるか)。省略したら渡せる。 */
  nextReady?(): boolean;
  /**
   * 次の抽選の材料がまだ無く、待たされるとき(`nextReady` が false)に、待つ前に呼ぶ。景品の画面で固まらないよう、
   * メンバー抽選の待機画面を出すなどに使う。
   */
  onWaiting?(): void;
  /** 抽選の失敗。サイクルは積まれず、次の進行操作でもう一度抽選する。 */
  onDrawError(error: unknown): void;
  /** ステップの失敗。そのステップは捨てられ、次の進行操作で続きから進む。 */
  onStepError(error: unknown): void;
  /** 抽選が終わった(景品かメンバーが尽きた)。終了の画面を出す。 */
  onFinished(reason: DrawEndReason, progress: DrawProgress): void;
  /** 終了の画面で進行操作(「次へ」・Enter・OK)があった(または、抽選を打ち切った)。次の画面へ進む。 */
  onLeave(): void;
  /** 進行のステップを実行し始めた(無視された進行操作では呼ばない)。ホストが「演出中」を公開して、止める操作の二重押しを防ぐ。 */
  onStarted?(): void;
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

  /** 進行のステップ(または組み直し)を実行中。 */
  get busy(): boolean {
    return this.running;
  }

  /** 抽選が終わっている(終了の画面を出している)。 */
  get finished(): boolean {
    return this.endedAtMs !== null;
  }

  async advance(): Promise<void> {
    if (!this.ready || this.running || this.left) return;
    if (this.endedAtMs !== null) {
      this.leave();
      return;
    }
    await this.run(async () => true);
  }

  /**
   * いまのサイクルを、`prepare` が返すステップに組み直して、最初の pause まで進める(当選者を飛ばして、メンバー抽選からやり直すとき)。
   * `prepare` が null を返す(やらない)、または例外のときは、積んであるステップをそのままにする。
   * 進行中・終了後・離脱後は何もしない(進行操作と同じ排他。戻り値は、組み直したか)。
   */
  async replaceCycle(prepare: () => Promise<Step[] | null>): Promise<boolean> {
    if (!this.ready || this.running || this.left || this.endedAtMs !== null) return false;
    let replaced = false;
    await this.run(async () => {
      const steps = await prepare();
      if (!steps) return false;
      this.deps.queue.clear();
      this.deps.queue.addCycle(steps);
      replaced = true;
      return true;
    });
    return replaced;
  }

  /** 進行中の印を立てて、`before` のあと(false を返したら進めない)pause のステップまで連続して進める。 */
  private async run(before: () => Promise<boolean>): Promise<void> {
    this.running = true;
    this.deps.onStarted?.();
    try {
      if (!(await before())) return;
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
      if (!(this.deps.nextReady?.() ?? true)) this.deps.onWaiting?.();
      const next = await this.deps.nextCycle();
      if (next.kind === "leave") {
        this.left = true;
        this.deps.onLeave();
        return false;
      }
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
