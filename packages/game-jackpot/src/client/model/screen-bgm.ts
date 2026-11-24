/**
 * ジャックポットの画面のBGM(オープニング・説明・デモ抽選・最終結果・エンディング)の、曲の決め方。
 * 画面が切り替わる時点で「行き先の画面の曲名」を決め、同じ曲が鳴っていれば流し続け、違えば止める(router の beforeResolve)。
 */

/** BGM を持つ画面。 */
export type BgmScreen = "opening" | "description" | "demo-draw" | "result" | "ending";

/** 画面の設定(保存されている JSON をそのまま読んだもの)。画面ごと。無い・読めないものは未指定。 */
export type ScreenBgmSettings = Partial<Record<BgmScreen, unknown>>;

/** 画面の設定の置き場所と、曲名を持つ項目。 */
export const BGM_SETTING: Readonly<Record<BgmScreen, { screenName: string; settingName: string; field: string }>> = {
  opening: { screenName: "opening", settingName: "opening-screen-settings", field: "bgm" },
  description: { screenName: "description", settingName: "description-screen-settings", field: "bgm" },
  "demo-draw": { screenName: "demo", settingName: "demo-screen-settings", field: "bgm" },
  result: { screenName: "result", settingName: "result-screen-settings", field: "resultBgm" },
  ending: { screenName: "ending", settingName: "ending-screen-settings", field: "bgm" },
};

const SCREEN_OF_SUFFIX: Readonly<Record<string, BgmScreen>> = {
  "jackpot-opening": "opening",
  "jackpot-description": "description",
  "jackpot-demo-draw": "demo-draw",
  "jackpot-result": "result",
  "jackpot-ending": "ending",
};

const GAME_SCREEN_SUFFIXES = new Set(["jackpot-opening", "jackpot-entry", "jackpot-description", "jackpot-demo-draw", "jackpot-draw", "jackpot-result", "jackpot-history", "jackpot-ending"]);

/**
 * ジャックポットのゲームの画面(BGM を持たない抽選・エントリー・履歴も含む)のパスか。
 * 画面が切り替わるとき、行き先か元がこれなら、行き先の曲名以外の `screen` の曲を止める(抽選の画面から出たときも、BGM を残さない)。
 */
export function isJackpotGamePath(path: string): boolean {
  return GAME_SCREEN_SUFFIXES.has(lastSegment(path));
}

function lastSegment(path: string): string {
  return path.split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop() ?? "";
}

/** ルートのパス(`/execute/jackpot-opening` など。末尾の `/` や、クエリ・ハッシュは無視)から、BGM を持つ画面を引く。該当しなければ null。 */
export function bgmScreenOf(path: string): BgmScreen | null {
  return SCREEN_OF_SUFFIX[lastSegment(path)] ?? null;
}

/** その画面で流す曲名。BGM を持たない画面・未設定・空(空白だけ)は null(止める)。 */
export function bgmNameFor(path: string, settings: ScreenBgmSettings): string | null {
  const screen = bgmScreenOf(path);
  if (!screen) return null;
  const value = (settings[screen] as Record<string, unknown> | null | undefined)?.[BGM_SETTING[screen].field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
