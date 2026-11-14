import { describe, expect, it } from "vitest";
import { nextScreen, SCREEN_PATH, type JackpotScreen, type ScreenFlowSettings } from "./screen-flow";

const cfg = (over: Partial<ScreenFlowSettings> = {}): ScreenFlowSettings => ({ demoDraw: true, entry: false, ...over });

describe("nextScreen", () => {
  it("既定: オープニング → 説明 → デモ抽選 → 本抽選 → 結果 → エンディング → おわり", () => {
    const order: JackpotScreen[] = ["opening", "description", "demo-draw", "draw", "result", "ending"];
    for (let i = 0; i < order.length - 1; i++) expect(nextScreen(order[i], cfg())).toBe(order[i + 1]);
    expect(nextScreen("ending", cfg())).toBeNull();
  });

  it("デモ抽選が OFF なら、説明から本抽選へ直行する", () => {
    expect(nextScreen("description", cfg({ demoDraw: false }))).toBe("draw");
  });

  it("エントリーを挟むときだけ、オープニングの次がエントリー(エントリーの次は説明)", () => {
    expect(nextScreen("opening", cfg({ entry: true }))).toBe("entry");
    expect(nextScreen("opening", cfg({ entry: false }))).toBe("description");
    expect(nextScreen("entry", cfg({ entry: true }))).toBe("description");
  });

  it("デモ抽選・エントリーの設定は、ほかの画面の行き先を変えない", () => {
    for (const demoDraw of [true, false]) {
      expect(nextScreen("draw", cfg({ demoDraw }))).toBe("result");
      expect(nextScreen("result", cfg({ demoDraw }))).toBe("ending");
      expect(nextScreen("demo-draw", cfg({ demoDraw }))).toBe("draw");
    }
  });

  it("どの画面にもルートがある", () => {
    expect(SCREEN_PATH["demo-draw"]).toBe("/jackpot-demo-draw");
    expect(Object.keys(SCREEN_PATH)).toHaveLength(7);
  });
});
