import { RESULTS_NAMESPACE } from "../../shared/results";
import type { JackpotDrawInput, JackpotPlan, JackpotPlanInput, JackpotState, QuizRoundResult } from "../../shared/results";
import { lobbyPath } from "../../shared/host-navigation";
import { PORTAL_EVENT_NS, readPortalEvent } from "../../shared/portal-event";
import { HostCommandRouter } from "./host-command-router";
import type { ClientInput } from "../../shared/session-types";
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
  private readonly clientInputs = new Map<string, ClientInput[]>();
  private wasConnected = false;

  constructor(readonly connection: SessionConnection) {
    connection.onCommand((command) => this.router.dispatch(command));
    // 入室(新規・引き継ぎ・再接続)のたびに、手元の最新状態を公開し直す。
    connection.subscribe((state) => {
      const connected = state.phase === "connected" && state.role === "host";
      if (connected && !this.wasConnected) {
        void this.flush();
        void this.restoreResultsRev();
      }
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

  /** いま発生中のイベントのID。イベントが無ければ null。クイズの回答ラウンドをイベントごとに分けるのに使う。 */
  get eventId(): string | null {
    return readPortalEvent({ [PORTAL_EVENT_NS]: this.slices[PORTAL_EVENT_NS] })?.id ?? null;
  }

  /**
   * ホストとして接続中なら、このセッションのロビー画面のパス。ゲームの終了後はここへ戻る
   * (管理画面などホストが開いてはいけない画面へ出ないようにするため)。ホストでなければ null。
   */
  get lobbyPath(): string | null {
    const session = this.connection.state.session;
    return this.active && session ? lobbyPath(session.id) : null;
  }

  /**
   * 名前空間 `ns` の状態を更新して公開する。`clientInput` はその名前空間で
   * 参加者から受け付ける操作(key は "game.type"。memberIds で宛先のメンバーに絞れる)。省略時は変更しない。
   */
  publishSlice(ns: string, data: unknown, clientInput?: ClientInput[]): Promise<void> {
    this.slices[ns] = data;
    if (clientInput) this.clientInputs.set(ns, clientInput);
    return this.flush();
  }

  /**
   * クイズ1ラウンドの結果を保存し、更新番号(rev)を参加者へ知らせる。
   * 結果そのものは R2 に置き、DO には `{ rev }` だけを載せる(参加者はそれを見て取り直す)。
   */
  async recordQuizResult(result: QuizRoundResult): Promise<void> {
    if (!this.active) return;
    this.publishResultsRev(await this.connection.putQuizResult(result));
  }

  /** 抽選の状態(未公開の行を含む)を読む。 */
  getJackpotState(): Promise<JackpotState> {
    return this.connection.getJackpotState();
  }

  /** 確変の予定を、まだ無ければ保存する。返るのは保存されている予定。 */
  ensureJackpotPlan(plan: JackpotPlanInput): Promise<JackpotPlan> {
    return this.connection.ensureJackpotPlan(plan);
  }

  /** 抽選結果を未公開で確定する(参加者には見えないので通知しない)。矛盾すれば JACKPOT_CONFLICT。 */
  async commitJackpotDraw(draw: JackpotDrawInput): Promise<void> {
    if (!this.active) return;
    await this.connection.commitJackpotDraw(draw);
  }

  /** 確定済みの抽選を公開し、参加者へ知らせる。 */
  async revealJackpotDraw(drawId: string): Promise<void> {
    if (!this.active) return;
    this.publishResultsRev(await this.connection.revealJackpotDraw(drawId));
  }

  /** 抽選の結果と確変の予定を消し、参加者へ知らせる。 */
  async resetJackpot(): Promise<void> {
    if (!this.active) return;
    this.publishResultsRev(await this.connection.resetJackpot());
  }

  /** 確定して、すぐ公開する(抽選画面の改修まで使う暫定の窓口)。 */
  async recordJackpotDraw(draw: JackpotDrawInput): Promise<void> {
    await this.commitJackpotDraw(draw);
    await this.revealJackpotDraw(draw.drawId);
  }

  /**
   * ホストの再読み込み・引き継ぎ後は、公開していた rev が消えている。保存済みの結果から rev を取り直して公開し直す
   * (結果が1件も無ければ何も公開しない)。
   */
  async restoreResultsRev(): Promise<void> {
    try {
      const { rev } = await this.connection.getResults();
      if (rev > 0 && this.active) this.publishResultsRev(rev);
    } catch {
      // 結果が読めなくても、ホストの進行は止めない(次に結果を保存したときに公開される)
    }
  }

  private publishResultsRev(rev: number): void {
    void this.publishSlice(RESULTS_NAMESPACE, { rev });
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
