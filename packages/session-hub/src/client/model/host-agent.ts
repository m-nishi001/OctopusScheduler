import { HostCommandRouter } from "./host-command-router";
import type { SessionConnection } from "./session-connection";

/**
 * ホスト端末のアプリ全体で1つだけ動く「エージェント」。
 *
 * ホストは演出のため画面を次々に遷移するが、セッションとの接続(購読・コマンド適用・
 * 状態公開)はその間も途切れてはいけない。そのため接続は画面(ページ)ではなくこの
 * エージェントが持ち、アプリ起動時に保存済みの入室情報から復帰する。
 *
 * 公開する状態(RoomState)は名前空間ごとの「スライス」の集合。各機能(session / jackpot / quiz ...)
 * が自分のスライスだけを更新し、エージェントがまとめて1つの RoomState として公開する。
 */
export class HostAgent {
  readonly router = new HostCommandRouter();

  private readonly slices: Record<string, unknown> = {};
  private readonly clientInputs = new Map<string, string[]>();
  private wasConnected = false;

  constructor(readonly connection: SessionConnection) {
    connection.onCommand((command) => this.router.dispatch(command));
    // 入室(新規・引き継ぎ・再接続)のたびに、手元の最新状態を公開し直す。
    connection.subscribe((state) => {
      const connected = state.phase === "connected" && state.role === "host";
      if (connected && !this.wasConnected) void this.flush();
      this.wasConnected = connected;
    });
  }

  /** アプリ起動時に呼ぶ。保存済みのホスト入室情報があれば復帰する。 */
  restore(): boolean {
    if (this.connection.state.phase !== "idle") return true;
    return this.connection.resume("host");
  }

  get active(): boolean {
    const { phase, role } = this.connection.state;
    return role === "host" && phase !== "idle" && phase !== "ended" && phase !== "unauthorized" && phase !== "replaced";
  }

  /**
   * 名前空間 `ns` の状態を更新して公開する。`clientInput` はその名前空間で
   * 参加者から受け付けるコマンド種別("game.type")。省略時は変更しない。
   */
  publishSlice(ns: string, data: unknown, clientInput?: string[]): Promise<void> {
    this.slices[ns] = data;
    if (clientInput) this.clientInputs.set(ns, clientInput);
    return this.flush();
  }

  /** 名前空間を状態から外す(画面を離れたとき)。受付中の参加者入力も閉じる。 */
  clearSlice(ns: string): Promise<void> {
    delete this.slices[ns];
    this.clientInputs.delete(ns);
    return this.flush();
  }

  private flush(): Promise<void> {
    if (!this.active) return Promise.resolve();
    const clientInput = [...this.clientInputs.values()].flat();
    return this.connection.publish({ ...this.slices }, clientInput).catch(() => undefined);
  }
}
