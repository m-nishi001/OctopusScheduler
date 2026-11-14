import { useRoute, type RouteLocationRaw } from "vue-router";
import {
  DEMO_QUERY_KEY,
  resolveJackpotScope,
  setDemoDrawScreen,
  setJackpotScope,
  type JackpotScope,
} from "@model/jackpot-session";

export interface JackpotSession {
  scope: JackpotScope;
  isDemo: boolean;
  /** デモ抽選(練習抽選)の画面か(ルートの meta.demoDraw)。 */
  isDemoDraw: boolean;
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
  const isDemoDraw = route.meta?.demoDraw === true;
  setDemoDrawScreen(isDemoDraw);
  const isDemo = scope === "demo";
  return {
    scope,
    isDemo,
    isDemoDraw,
    to: (path) => (isDemo ? { path, query: { [DEMO_QUERY_KEY]: "1" } } : path),
  };
}
