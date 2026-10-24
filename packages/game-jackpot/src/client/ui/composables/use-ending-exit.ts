import { container } from "tsyringe";
import { useRouter } from "vue-router";
import { HostAgent } from "@octopus/session-hub";

export interface EndingExitDeps {
  /** ホストとして接続中なら、セッションのロビーのパス。ホストでなければ null(プレビューなど)。 */
  lobbyPath(): string | null;
  push(path: string): unknown;
}

function defaultDeps(): EndingExitDeps {
  const router = useRouter();
  return {
    lobbyPath: () => (container.isRegistered(HostAgent) ? container.resolve(HostAgent).lobbyPath : null),
    push: (path) => router.push(path),
  };
}

/**
 * エンディング画面で使う。エンディングを最後まで表示し終えたら、ホストとして接続中の端末だけを
 * セッションのロビーへ戻す(イベントの終了は、ロビーへ戻った時点でホスト側が行う。host-agent-setup.ts)。
 * ホストでないとき(プレビューなど)は何もせず、その画面に留まる。
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ。
 */
export function useEndingExit(deps: EndingExitDeps = defaultDeps()): { exitToLobby(): boolean } {
  return {
    exitToLobby: () => {
      const path = deps.lobbyPath();
      if (path === null) return false;
      void deps.push(path);
      return true;
    },
  };
}
