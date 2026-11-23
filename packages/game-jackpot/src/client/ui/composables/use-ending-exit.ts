import { container } from "tsyringe";
import { useRouter } from "vue-router";
import { HostAgent } from "@octopus/session-hub";

export interface EndingExitDeps {
  /** ホストとして接続中なら、終了後に戻る画面のパス(開始前の画面。無ければロビー)。ホストでなければ null(プレビューなど)。 */
  returnPath(): string | null;
  push(path: string): unknown;
}

function defaultDeps(): EndingExitDeps {
  const router = useRouter();
  return {
    returnPath: () => (container.isRegistered(HostAgent) ? container.resolve(HostAgent).returnPath : null),
    push: (path) => router.push(path),
  };
}

/**
 * エンディング画面で使う。エンディングを最後まで表示し終えたら、ホストとして接続中の端末だけを
 * 開始前の画面(無ければセッションのロビー)へ戻す(イベントの終了は、ゲームの画面を出た時点でホスト側が行う。host-agent-setup.ts)。
 * ホストでないとき(プレビューなど)は何もせず、その画面に留まる。
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ。
 */
export function useEndingExit(deps: EndingExitDeps = defaultDeps()): { exitToLobby(): boolean } {
  return {
    exitToLobby: () => {
      const path = deps.returnPath();
      if (path === null) return false;
      void deps.push(path);
      return true;
    },
  };
}
