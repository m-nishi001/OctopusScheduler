import { useRoute, type RouteLocationRaw } from "vue-router";
import {
  DEMO_QUERY_KEY,
  resolveJackpotScope,
  setJackpotScope,
  type JackpotScope,
} from "@model/jackpot-session";

export interface JackpotSession {
  scope: JackpotScope;
  isDemo: boolean;
  /** 遷移先にデモ指定(?demo=1)を引き継ぐ。live ではパスをそのまま返す。 */
  to(path: string): RouteLocationRaw;
}

/**
 * ゲーム画面で使う。ルートの ?demo=1 からスコープを決め、ストレージ層へ反映する。
 * live/demo の判定はここだけで行う。
 */
export function useJackpotSession(): JackpotSession {
  const route = useRoute();
  const scope = resolveJackpotScope(route.query);
  setJackpotScope(scope);
  const isDemo = scope === "demo";
  return {
    scope,
    isDemo,
    to: (path) => (isDemo ? { path, query: { [DEMO_QUERY_KEY]: "1" } } : path),
  };
}
