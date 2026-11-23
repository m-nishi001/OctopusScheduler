/**
 * ゲーム(クイズ・ジャックポット)を始める直前の画面(ルートの fullPath)を覚えておく。
 * 終了したとき、ロビーの代わりにその画面へ戻すのに使う。状態はパス1つだけ。メモリだけで持つ(再読み込みで消える)。
 */
export class EventReturn {
  private path: string | null = null;

  /** 開始前の画面を覚える。 */
  capture(path: string): void {
    this.path = path;
  }

  /** 覚えた画面を返す。無ければ null。 */
  take(): string | null {
    return this.path;
  }

  clear(): void {
    this.path = null;
  }
}
