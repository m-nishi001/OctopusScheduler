import { inject, injectable } from "tsyringe";
import type { RouteLocationRaw } from "vue-router";
import type { ScreenSpec } from "@model/media/screen-spec";
import { AssetSource } from "./asset-source";

/** ルーターを DI で差し替えるためのトークン(`main.ts` で本物を登録する)。 */
export const ScreenRouterToken = Symbol("ScreenRouter");
export interface ScreenRouter {
  push(to: RouteLocationRaw): Promise<unknown>;
}

/** セッションのホスト画面(ロビー)のパスを返すトークン。ホストとして接続していなければ null を返す。 */
export const LobbyPathToken = Symbol("LobbyPath");
export type LobbyPathProvider = () => string | null;

/** ロビーが無いとき(ホストとして接続していない端末)の、何も映さない待機画面。 */
const IDLE_PATH = "/execute";

/**
 * スクリーン(投影画面)。常に1つだけ出す。出したままで、消すのは `clear` だけ。
 * 後から出した指示が勝つ(連番は1つ)。素材の取得を待つ間に別の指示が来たら、古い指示は捨てる。
 * `clear` の戻り先は、常にセッションのホスト画面。直前の画面は覚えない。
 */
@injectable()
export class ScreenControl {
  private seq = 0;

  constructor(
    @inject(AssetSource) private readonly source: Pick<AssetSource, "ensure">,
    @inject(ScreenRouterToken) private readonly router: ScreenRouter,
    @inject(LobbyPathToken) private readonly lobbyPath: LobbyPathProvider
  ) {}

  async show(spec: ScreenSpec): Promise<void> {
    const mine = ++this.seq;
    if (spec.kind === "slideshow") {
      // 画像は、スライドショーの画面が先に取り、1枚ずつ表示する
      await this.router.push({ name: "show-slideshow", params: { data: JSON.stringify(spec) } });
      return;
    }
    await this.source.ensure(spec.id);
    if (mine !== this.seq) return;
    await this.router.push({ name: spec.kind === "image" ? "show-image" : "show-video", params: { id: spec.id } });
  }

  async clear(): Promise<void> {
    this.seq++;
    await this.router.push(this.lobbyPath() ?? IDLE_PATH);
  }
}
