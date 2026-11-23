import { container } from "tsyringe";
import { START_LOCATION, type Router } from "vue-router";
import {
  HostAgent,
  PORTAL_EVENT_CLOSE_ENTRY,
  PORTAL_EVENT_END,
  PORTAL_EVENT_NS,
  isAllowedHostPath,
  readExpectedPath,
} from "@octopus/session-hub";
import { isGameFinishRoute, isGameRoute, toExecutePath } from "../router/execute-path";
import { AudioControl } from "../media/audio";
import { EventReturn } from "./event-return";
import { registerEventHost } from "./event-host";
import { registerMediaCommands } from "../media/host-media-commands";
import { registerMediaSyncPublisher } from "../media/media-sync-publisher";
import { prepareHostData } from "./prepare-host-data";

/** 管理端末の `session.navigate` で受け取るペイロード。 */
interface NavigatePayload {
  path?: unknown;
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

/** イベントの開始・終了で、背景BGMを止めて続きから再開するための部品(テストで差し替える)。 */
export interface HostAgentSetupDeps {
  audio: () => Pick<AudioControl, "suspend" | "resume"> | null;
  eventReturn: EventReturn;
}

function defaultDeps(): HostAgentSetupDeps {
  return {
    audio: () => (container.isRegistered(AudioControl) ? container.resolve(AudioControl) : null),
    eventReturn: new EventReturn(),
  };
}

/**
 * ホスト端末のエージェントをアプリに組み込む。
 *   - 保存済みの入室情報があれば復帰する(リロード・誤操作からの自動復帰)
 *   - 管理端末からの画面遷移コマンド(`session.navigate`)を実行する。許可リスト外のパスは
 *     ホスト側で必ず拒否する(管理画面を投影画面に開かせない)
 *   - 管理端末の音楽・スクリーンの指示(`media.*`)を受け、ホストで再生・表示する。素材の一覧の差(アップロード前の素材)と再生の失敗は、状態 `media` として公開する
 *   - 管理端末のイベント開始/終了(`event.*`)を受け、参加者ポータルに出すイベントを公開する
 *   - ゲーム以外の画面からゲームの画面へ入るとき、開始前の画面を覚え、背景BGMを一時停止する。
 *     ゲームの終了画面からゲーム以外の画面(開始前の画面。無ければロビー)へ戻ったら、エントリー受付を締め切ってイベントを終了する(運営の手動操作を不要にする)。
 *     終了画面に入った時点では終了しない(クイズの順位発表はイベントとクイズの状態が生きている間に行う)
 *   - ゲームを出たら(終了画面を通らなくても)、BGMを止めた位置から再開し、覚えた画面は捨てる
 *   - expectedPath 付きのコマンドは、ホストの現在の画面と違えば破棄する(古い画面を見て押された主ボタンの取り違え防止)
 *   - 画面遷移のたびに、いまの画面(`session.path`)を状態として公開する
 */
export function setupHostAgent(router: Router, deps: HostAgentSetupDeps = defaultDeps()): HostAgent {
  const agent = container.resolve(HostAgent);
  agent.setReturnPathSource(() => deps.eventReturn.take());

  // 管理端末が「見ていた画面」(expectedPath)を付けてきた操作は、ホストがもう別の画面なら破棄する。
  // 遅れて届いた主ボタンが、次の画面の操作として扱われて画面を飛ばすのを防ぐ。付いていない操作は従来どおり通す。
  agent.router.setGuard((command) => {
    const expected = readExpectedPath(command.payload);
    return expected === null || expected === router.currentRoute.value.fullPath;
  });

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

  // 管理端末の音楽・スクリーンの指示(`media.*`)。再生できなかったら、管理端末へ知らせる。
  // あわせて、ホストの素材の一覧とサーバーの一覧の差(アップロード前の素材など)を公開する。
  const mediaSync = registerMediaSyncPublisher(agent);
  registerMediaCommands(agent, undefined, mediaSync.reportFailure);

  router.afterEach((to, from) => {
    if (!agent.active) return; // プレビューなど、ホストとして接続していないときは何もしない
    void agent.publishSlice("session", { path: to.fullPath });
    const enteringGame = !isGameRoute(from) && isGameRoute(to);
    const leavingGame = isGameRoute(from) && !isGameRoute(to);
    if (enteringGame && from !== START_LOCATION) {
      deps.eventReturn.capture(from.fullPath);
      void deps.audio()?.suspend(1);
    }
    if (leavingGame) {
      if (isGameFinishRoute(from)) {
        // 締切(エントリー者の一覧を保存)のあとにイベントを終了する。どちらも繰り返し実行しても安全。
        void dispatchEventCommand(agent, PORTAL_EVENT_CLOSE_ENTRY)
          .then(() => dispatchEventCommand(agent, PORTAL_EVENT_END))
          .catch((error) => console.warn("ゲーム終了時のイベント終了に失敗しました", error));
      }
      deps.eventReturn.clear();
      void deps.audio()?.resume();
    }
  });

  // リロード後に自動でホストへ復帰したときも、各ゲームのデータを取り込み直す(失敗しても本番の進行は止めない)。
  if (agent.restore()) void prepareHostData();
  return agent;
}
