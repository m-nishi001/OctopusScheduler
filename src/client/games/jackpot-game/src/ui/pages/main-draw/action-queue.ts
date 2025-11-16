export class ActionQueue {
  public actions: (() => Promise<void>)[] = [];

  enqueue(action: () => Promise<void>) {
    this.actions.push(action);
  }

  dequeue(): (() => Promise<void>) | undefined {
    return this.actions.shift();
  }

  isEmpty(): boolean {
    return this.actions.length === 0;
  }

  addCycle(actions: (() => Promise<void>)[]) {
    this.actions.push(...actions);
  }
}
