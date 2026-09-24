import type { JackpotRemoteScreen } from "./remote-control-repository";

/** リモート制御の画面キーと実際のルートパスの対応。 */
export const REMOTE_SCREEN_ROUTES: Record<JackpotRemoteScreen, string> = {
  home: "/jackpot-home",
  opening: "/jackpot-opening",
  description: "/jackpot-description",
  demo: "/jackpot-demo",
  "main-draw": "/main-draw",
  result: "/jackpot-result",
  ending: "/jackpot-ending",
};

/**
 * main-draw画面は歴史的経緯で /jackpot-draw と /main-draw の2つのパスを
 * 持つため、逆引き時は両方を "main-draw" として認識する。
 */
const ADDITIONAL_SCREEN_PATHS: Partial<Record<JackpotRemoteScreen, string[]>> = {
  "main-draw": ["/jackpot-draw"],
};

/** 現在のルートパスから、対応するリモート制御の画面キーを逆引きする。 */
export function resolveScreenFromPath(
  path: string
): JackpotRemoteScreen | null {
  for (const [screen, route] of Object.entries(REMOTE_SCREEN_ROUTES) as [
    JackpotRemoteScreen,
    string
  ][]) {
    if (path === route) return screen;
    if (ADDITIONAL_SCREEN_PATHS[screen]?.includes(path)) return screen;
  }
  return null;
}

/**
 * リモートの目標画面(targetScreen)へ遷移すべきかどうかを判定する。
 * targetScreenがnull(リモート制御が一度も使われていない)の間は常にfalseを
 * 返し、同一デバイスでの既存のローカル画面遷移を一切妨げない。
 */
export function shouldNavigateToRemoteScreen(
  currentPath: string,
  targetScreen: JackpotRemoteScreen | null
): boolean {
  if (!targetScreen) return false;
  return resolveScreenFromPath(currentPath) !== targetScreen;
}

/**
 * リモートの進行操作(actionSeq)を発火すべきかどうかを判定する。
 * previousSeqがnull(まだ一度もポーリングしていない=基準値取得前)の間は、
 * 過去に発行済みだったactionSeqをロード直後に誤って再生してしまわないよう
 * 常にfalseを返す。2回目以降のポーリングで、前回値より増えていれば発火する。
 */
export function shouldFireRemoteAdvance(
  previousSeq: number | null,
  nextSeq: number
): boolean {
  if (previousSeq === null) return false;
  return nextSeq > previousSeq;
}
