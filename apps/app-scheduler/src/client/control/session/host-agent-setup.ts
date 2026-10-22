import { container } from "tsyringe";
import type { RouteLocationNormalized, Router } from "vue-router";
import {
  HostAgent,
  PORTAL_EVENT_CLOSE_ENTRY,
  PORTAL_EVENT_END,
  PORTAL_EVENT_NS,
  isAllowedHostPath,
} from "@octopus/session-hub";
import { toExecutePath } from "../router/execute-path";
import { registerEventHost } from "./event-host";
import { prepareHostData } from "./prepare-host-data";

/** 管理端末の `session.navigate` で受け取るペイロード。 */
interface NavigatePayload {
  path?: unknown;
}

/** ゲームの終了画面(クイズの結果、ジャックポットのエンディング)。 */
function isGameFinishRoute(route: RouteLocationNormalized): boolean {
  return route.name === "quiz-result" || JACKPOT_ENDING_PATH.test(route.path);
}

/** ジャックポットのエンディングは /execute 配下に登録されている(振り替え前の /jackpot-ending も許す)。 */
const JACKPOT_ENDING_PATH = /^\/(?:execute\/)?jackpot-ending$/;

/** セッションのロビー(ホスト端末の待機画面)。 */
function isLobbyRoute(route: RouteLocationNormalized): boolean {
  return route.name === "session-host";
}

/** ホスト自身が、管理端末から届いたときと同じ経路でイベントのコマンドを処理する。 */
async function dispatchEventCommand(agent: HostAgent, type: string): Promise<void> {
  await agent.router.dispatch({
    seq: 0,
    requestId: `game-finish-${type}`,
    game: PORTAL_EVENT_NS,
    type,
    payload: undefined,
    issuedBy: agent.connection.state.deviceId ?? "host",
    issuerRole: "host",
    atMs: Date.now(),
  });
}

/**
 * ホスト端末のエージェントをアプリに組み込む。
 *   - 保存済みの入室情報があれば復帰する(リロード・誤操作からの自動復帰)
 *   - 管理端末からの画面遷移コマンド(`session.navigate`)を実行する。許可リスト外のパスは
 *     ホスト側で必ず拒否する(管理画面を投影画面に開かせない)
 *   - 管理端末のイベント開始/終了(`event.*`)を受け、参加者ポータルに出すイベントを公開する
 *   - ゲームの終了画面からロビーへ戻ったら、エントリー受付を締め切ってイベントを終了する(運営の手動操作を不要にする)。
 *     終了画面に入った時点では終了しない(クイズの順位発表はイベントとクイズの状態が生きている間に行う)
 *   - 画面遷移のたびに、いまの画面(`session.path`)を状態として公開する
 */
export function setupHostAgent(router: Router): HostAgent {
  const agent = container.resolve(HostAgent);

  agent.router.register("session", async (command) => {
    if (command.type !== "navigate") return;
    const path = (command.payload as NavigatePayload | null)?.path;
    if (!isAllowedHostPath(path)) return;
    // ゲームの画面は /execute 配下に登録されている。/execute への振り替えはルーターが行う(execute-path.ts)。
    // router.resolve はリダイレクトを辿らないので、/execute への振り替えは自分で行ってから比べる。
    const target = router.resolve(toExecutePath(path)).fullPath;
    if (router.currentRoute.value.fullPath === target) return;
    await router.push(path);
  });

  // 参加者ポータルに出すイベント(管理端末の `event.start` / `event.end`)
  registerEventHost(agent);

  router.afterEach((to, from) => {
    if (!agent.active) return; // プレビューなど、ホストとして接続していないときは何もしない
    void agent.publishSlice("session", { path: to.fullPath });
    if (isGameFinishRoute(from) && isLobbyRoute(to)) {
      // 締切(エントリー者の一覧を保存)のあとにイベントを終了する。どちらも繰り返し実行しても安全。
      void dispatchEventCommand(agent, PORTAL_EVENT_CLOSE_ENTRY)
        .then(() => dispatchEventCommand(agent, PORTAL_EVENT_END))
        .catch((error) => console.warn("ゲーム終了時のイベント終了に失敗しました", error));
    }
  });

  // リロード後に自動でホストへ復帰したときも、各ゲームのデータを取り込み直す(失敗しても本番の進行は止めない)。
  if (agent.restore()) void prepareHostData();
  return agent;
}
