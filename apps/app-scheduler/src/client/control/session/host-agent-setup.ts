import { container } from "tsyringe";
import type { RouteLocationNormalized, Router } from "vue-router";
import {
  HostAgent,
  PORTAL_EVENT_CLOSE_ENTRY,
  PORTAL_EVENT_END,
  PORTAL_EVENT_NS,
  isAllowedHostPath,
} from "@octopus/session-hub";
import { registerEventHost } from "./event-host";
import { prepareHostData } from "./prepare-host-data";

/** 管理端末の `session.navigate` で受け取るペイロード。 */
interface NavigatePayload {
  path?: unknown;
}

/** ゲームの終了画面(クイズの結果、ジャックポットのエンディング)。 */
function isGameFinishRoute(route: RouteLocationNormalized): boolean {
  return route.name === "quiz-result" || route.path === "/jackpot-ending";
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
 *   - ゲームの終了画面に入ったら、エントリー受付を締め切ってイベントを終了する(運営の手動操作を不要にする)
 *   - 画面遷移のたびに、いまの画面(`session.path`)を状態として公開する
 */
export function setupHostAgent(router: Router): HostAgent {
  const agent = container.resolve(HostAgent);

  agent.router.register("session", async (command) => {
    if (command.type !== "navigate") return;
    const path = (command.payload as NavigatePayload | null)?.path;
    if (!isAllowedHostPath(path)) return;
    // クイズの表示ルートは /execute 配下にだけ登録されている(ジャックポットは jackpot- 接頭辞で自動解決される)。
    const target = path.startsWith("/quiz/") ? `/execute${path}` : path;
    if (router.currentRoute.value.fullPath === target) return;
    await router.push(target);
  });

  // 参加者ポータルに出すイベント(管理端末の `event.start` / `event.end`)
  registerEventHost(agent);

  router.afterEach((to) => {
    if (!agent.active) return; // プレビューなど、ホストとして接続していないときは何もしない
    void agent.publishSlice("session", { path: to.fullPath });
    if (isGameFinishRoute(to)) {
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
