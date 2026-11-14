import { describe, expect, it } from "vitest";
import { clampDemoRounds, DEFAULT_DEMO_DRAW, parseDemoDrawSettings } from "./demo-draw-setting";
import { parseDescriptionSettings, stepPage, toStoredDescription } from "./description-setting";
import { clampLines, clampSeconds, newSequenceItem, parseSequenceSettings, toStoredSequence } from "./sequence-setting";

describe("デモ抽選の設定", () => {
  it("無い設定は既定(ON・1回・BGMなし)", () => {
    expect(parseDemoDrawSettings(null)).toEqual({ enabled: true, rounds: 1, bgm: "" });
    expect(parseDemoDrawSettings({})).toEqual(DEFAULT_DEMO_DRAW);
  });
  it("OFF と回数・BGM を読む。回数は 1〜3 に収める", () => {
    expect(parseDemoDrawSettings({ enabled: false, rounds: 2, bgm: "a.mp3" })).toEqual({ enabled: false, rounds: 2, bgm: "a.mp3" });
    expect(clampDemoRounds(0)).toBe(1);
    expect(clampDemoRounds(9)).toBe(3);
    expect(clampDemoRounds("2")).toBe(2);
    expect(clampDemoRounds("x")).toBe(1);
  });
  it("古い形(demoBgm など)は読まない", () => {
    expect(parseDemoDrawSettings({ demoBgm: "old.mp3", demoDrawSe: "se.wav" })).toEqual(DEFAULT_DEMO_DRAW);
  });
});

describe("説明の設定", () => {
  it("画像とテキストのページだけを読み、効果・秒数・効果音は持たない", () => {
    const s = parseDescriptionSettings({
      bgm: "b.mp3",
      pages: [
        { kind: "テキスト", text: "ようこそ", effect: "fade", seconds: 3, se: "x.wav" },
        { kind: "画像", image: "a.png" },
        { kind: "HTML", text: "<b>x</b>" },
        null,
      ],
    });
    expect(s).toEqual({ bgm: "b.mp3", pages: [{ kind: "テキスト", text: "ようこそ" }, { kind: "画像", image: "a.png" }] });
  });
  it("保存の形は表示用の URL を含まない", () => {
    expect(toStoredDescription({ bgm: "", pages: [{ kind: "画像", image: "a.png", imageUrl: "blob:x" }] })).toEqual({ bgm: "", pages: [{ kind: "画像", image: "a.png" }] });
  });
  it("ページ送り: 最後で次へ進むと終わり。最初より前には戻らない", () => {
    expect(stepPage(0, 3, 1)).toEqual({ kind: "stay", index: 1 });
    expect(stepPage(2, 3, 1)).toEqual({ kind: "leave" });
    expect(stepPage(0, 0, 1)).toEqual({ kind: "leave" });
    expect(stepPage(0, 3, -1)).toEqual({ kind: "stay", index: 0 });
    expect(stepPage(2, 3, -1)).toEqual({ kind: "stay", index: 1 });
  });
});

describe("オープニング・エンディングの設定", () => {
  it("テキスト・画像だけを読む。HTML や知らない効果の項目は捨てる", () => {
    const s = parseSequenceSettings({
      bgm: "o.mp3",
      items: [
        { kind: "テキスト", text: "<b>そのまま</b>", effect: "行送り", seconds: 2, lines: 2, se: "s.wav", name: "題" },
        { kind: "画像", image: "a.png", effect: "フェード", seconds: 5 },
        { kind: "HTML", text: "<p>x</p>", effect: "静止", seconds: 1 },
        { kind: "テキスト", text: "x", effect: "scroll", seconds: 1 },
      ],
    });
    expect(s.items).toEqual([
      { kind: "テキスト", text: "<b>そのまま</b>", effect: "行送り", seconds: 2, lines: 2, se: "s.wav", name: "題" },
      { kind: "画像", image: "a.png", effect: "フェード", seconds: 5 },
    ]);
    expect(s.bgm).toBe("o.mp3");
  });
  it("秒数は秒。0 以下・数でないものは既定(3秒)、行数は 1〜20 の整数(既定3)", () => {
    expect(clampSeconds(0)).toBe(3);
    expect(clampSeconds("2.5")).toBe(2.5);
    expect(clampSeconds(0.01)).toBe(0.1);
    expect(clampLines(undefined)).toBe(3);
    expect(clampLines(0)).toBe(1);
    expect(clampLines(99)).toBe(20);
  });
  it("行送り以外では行数を持たない", () => {
    const s = parseSequenceSettings({ items: [{ kind: "テキスト", text: "a", effect: "静止", seconds: 1, lines: 4 }] });
    expect(s.items[0].lines).toBeUndefined();
    expect(parseSequenceSettings({ items: [{ kind: "テキスト", text: "a", effect: "行送り", seconds: 1 }] }).items[0].lines).toBe(3);
  });
  it("古い形(type / contents / duration ミリ秒)は読まない", () => {
    expect(parseSequenceSettings({ bgm: "", contents: [{ type: "text", text: "a", effect: "fade", duration: 3000 }] }).items).toEqual([]);
  });
  it("保存の形は再生用の URL を含まない", () => {
    const item = { ...newSequenceItem(), imageUrl: "blob:a", seUrl: "blob:b" };
    expect(toStoredSequence({ bgm: "", items: [item] }).items[0]).not.toHaveProperty("imageUrl");
    expect(toStoredSequence({ bgm: "", items: [item] }).items[0]).not.toHaveProperty("seUrl");
  });
});
