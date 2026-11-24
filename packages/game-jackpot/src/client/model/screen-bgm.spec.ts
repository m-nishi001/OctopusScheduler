import { describe, expect, it } from "vitest";
import { bgmNameFor, bgmScreenOf, isJackpotGamePath } from "./screen-bgm";

describe("bgmScreenOf", () => {
  it.each([
    ["/execute/jackpot-opening", "opening"],
    ["/execute/jackpot-description", "description"],
    ["/execute/jackpot-demo-draw", "demo-draw"],
    ["/execute/jackpot-result", "result"],
    ["/execute/jackpot-ending/", "ending"],
    ["/jackpot-opening?demo=1", "opening"],
    ["/execute/jackpot-draw", null],
    ["/execute/jackpot-entry", null],
    ["/execute/jackpot-history", null],
    ["/execute/jackpot-admin/screens/opening", null],
    ["/execute/quiz/q1/intro", null],
    ["/session/host/s1", null],
  ])("%s → %s", (path, screen) => {
    expect(bgmScreenOf(path)).toBe(screen);
  });
});

describe("bgmNameFor", () => {
  const settings = {
    opening: { bgm: "open.wav" },
    description: { bgm: "open.wav" },
    "demo-draw": { bgm: "demo.wav", enabled: true },
    result: { resultBgm: "res.wav", bgm: "ignored.wav" },
    ending: { bgm: "  " },
  };
  it.each([
    ["/execute/jackpot-opening", "open.wav"],
    ["/execute/jackpot-description", "open.wav"], // オープニングと同じ曲 → 同じ名前(流し続ける判定に使う)
    ["/execute/jackpot-demo-draw", "demo.wav"],
    ["/execute/jackpot-result", "res.wav"], // 結果は resultBgm
    ["/execute/jackpot-ending", null], // 空白だけは未設定
    ["/execute/jackpot-draw", null], // BGM を持たない画面
    ["/execute/quiz/q1/intro", null],
  ])("%s → %s", (path, name) => {
    expect(bgmNameFor(path, settings)).toBe(name);
  });

  it("設定が無い・形が違う・曲名が文字列でないときは null", () => {
    expect(bgmNameFor("/execute/jackpot-opening", {})).toBeNull();
    expect(bgmNameFor("/execute/jackpot-opening", { opening: null })).toBeNull();
    expect(bgmNameFor("/execute/jackpot-opening", { opening: { bgm: 3 } })).toBeNull();
    expect(bgmNameFor("/execute/jackpot-result", { result: { bgm: "x.wav" } })).toBeNull();
  });
});

describe("isJackpotGamePath", () => {
  it.each([
    ["/execute/jackpot-opening", true],
    ["/execute/jackpot-entry", true],
    ["/execute/jackpot-draw", true], // BGM を持たないが、ここから出るときも曲を止める
    ["/execute/jackpot-history?demo=1", true],
    ["/execute/jackpot-ending/", true],
    ["/execute/jackpot-admin/screens/opening", false],
    ["/execute/quiz/q1/intro", false],
    ["/session/host/s1", false],
  ])("%s → %s", (path, expected) => {
    expect(isJackpotGamePath(path)).toBe(expected);
  });
});
