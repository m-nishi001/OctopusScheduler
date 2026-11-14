/**
 * ジャックポットの画面の流れ。オープニング → [エントリー] → 説明 → [デモ抽選] → 本抽選 → 結果 → エンディング。
 * 次にどの画面へ進むかは、ここ1か所で決める(画面ごとに行き先を持たない)。
 */
export type JackpotScreen = "opening" | "entry" | "description" | "demo-draw" | "draw" | "result" | "ending";

export interface ScreenFlowSettings {
  /** デモ抽選(練習抽選)を挟むか。 */
  demoDraw: boolean;
  /** オープニングのあとにエントリー画面(参加の受付)を挟むか。 */
  entry: boolean;
}

/** 次の画面。最後(エンディング)の次は無いので null。 */
export function nextScreen(current: JackpotScreen, settings: ScreenFlowSettings): JackpotScreen | null {
  switch (current) {
    case "opening":
      return settings.entry ? "entry" : "description";
    case "entry":
      return "description";
    case "description":
      return settings.demoDraw ? "demo-draw" : "draw";
    case "demo-draw":
      return "draw";
    case "draw":
      return "result";
    case "result":
      return "ending";
    case "ending":
      return null;
  }
}

/** 画面のルート。 */
export const SCREEN_PATH: Readonly<Record<JackpotScreen, string>> = {
  opening: "/jackpot-opening",
  entry: "/jackpot-entry",
  description: "/jackpot-description",
  "demo-draw": "/jackpot-demo-draw",
  draw: "/jackpot-draw",
  result: "/jackpot-result",
  ending: "/jackpot-ending",
};
