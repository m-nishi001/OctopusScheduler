/**
 * 抽選の進行ステップ。Enterキー(または遠隔の「次へ」)で、pause のステップまで連続して実行される。
 *
 * - label: 遠隔操作が「いま次に実行されるのがルーレットを止める操作か」を知るための目印
 *   (参加者のスマホに停止ボタンを出す)。
 * - pause: 実行し終えたら次のEnterを待つ。
 */
export interface Step {
  label?: string;
  pause?: boolean;
  run: () => Promise<void>;
}

/** 指定した秒数だけ待つ。 */
export const delay = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/** 進行のステップを作る。`label` は、いま次に実行されるのがどの操作かを遠隔操作が知るための目印。 */
export const step = (run: () => Promise<void> | void, label?: string): Step => ({
  run: async () => {
    await run();
  },
  label,
});

/** 指定秒数待ってから、次のEnterを待つ。 */
export const pause = (seconds = 1): Step => ({
  run: () => delay(seconds),
  pause: true,
});

/** 抽選の進行ステップの待ち行列。Enter(または遠隔の「次へ」)のたびに、`pause` のステップまで連続して実行する。 */
export class ActionQueue {
  private steps: Step[] = [];
  /** ステップを取り出して実行する直前に呼ばれる(ラベルが無ければ undefined)。 */
  onDequeue: ((label: string | undefined) => void) | null = null;

  addCycle(steps: Step[]) {
    this.steps.push(...steps);
  }

  dequeue(): Step | undefined {
    const next = this.steps.shift();
    if (next) this.onDequeue?.(next.label);
    return next;
  }

  /** 次に実行されるステップのラベル(取り出さない)。 */
  peekLabel(): string | undefined {
    return this.steps[0]?.label;
  }

  isEmpty(): boolean {
    return this.steps.length === 0;
  }
}
