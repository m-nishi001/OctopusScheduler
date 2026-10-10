import { container } from "tsyringe";
import type { Router } from "vue-router";
import { HostAgent, isAllowedHostPath } from "@octopus/session-hub";

/** 管理端末の `session.navigate` で受け取るペイロード。 */
interface NavigatePayload {
  path?: unknown;
}

/**
 * ホスト端末のエージェントをアプリに組み込む。
 *   - 保存済みの入室情報があれば復帰する(リロード・誤操作からの自動復帰)
 *   - 管理端末からの画面遷移コマンド(`session.navigate`)を実行する。許可リスト外のパスは
 *     ホスト側で必ず拒否する(管理画面を投影画面に開かせない)
 *   - 画面遷移のたびに、いまの画面(`session.path`)を状態として公開する
 */
export function setupHostAgent(router: Router): HostAgent {
  const agent = container.resolve(HostAgent);

  agent.router.register("session", async (command) => {
    if (command.type !== "navigate") return;
    const path = (command.payload as NavigatePayload | null)?.path;
    if (!isAllowedHostPath(path)) return;
    if (router.currentRoute.value.fullPath === path) return;
    await router.push(path);
  });

  router.afterEach((to) => {
    if (agent.active) void agent.publishSlice("session", { path: to.fullPath });
  });

  agent.restore();
  return agent;
}
