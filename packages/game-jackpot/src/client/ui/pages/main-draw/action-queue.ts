/**
 * 抽選の進行ステップ。Enterキー(または遠隔の「次へ」)で1つずつ(または連鎖して)実行される。
 *
 * ステップには任意のラベルを付けられる。遠隔操作では「いま次に実行されるのが
 * ルーレットを止める操作か」を知る必要がある(参加者のスマホに停止ボタンを出すため)。
 */
export type QueuedAction = (() => Promise<void>) & { label?: string };

/** ステップにラベルを付ける(関数自体は変えない)。 */
export function labeled(label: string, action: () => Promise<void>): QueuedAction {
  const wrapped: QueuedAction = () => action();
  wrapped.label = label;
  return wrapped;
}

export class ActionQueue {
  public actions: QueuedAction[] = [];
  /** ステップを取り出して実行する直前に呼ばれる(ラベルが無ければ undefined)。 */
  public onDequeue: ((label: string | undefined) => void) | null = null;

  enqueue(action: QueuedAction) {
    this.actions.push(action);
  }

  dequeue(): QueuedAction | undefined {
    const action = this.actions.shift();
    if (action) this.onDequeue?.(action.label);
    return action;
  }

  /** 次に実行されるステップのラベル(取り出さない)。 */
  peekLabel(): string | undefined {
    return this.actions[0]?.label;
  }

  isEmpty(): boolean {
    return this.actions.length === 0;
  }

  addCycle(actions: QueuedAction[]) {
    this.actions.push(...actions);
  }

  clear() {
    this.actions = [];
  }
}
