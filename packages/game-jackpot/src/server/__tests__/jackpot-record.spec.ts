import { describe, expect, it } from "vitest";
import { jackpotMediaRefs, jackpotRecordHashes, prizeMediaNames, screenMediaNames } from "../jackpot-api-contract";
import type { Prize, ScreenSettingRecord } from "../jackpot-api-contract";

const h = (c: string) => c.repeat(32);
const info = (c: string) => ({ hash: h(c), mime: "image/png", size: 1 });
const screen = (value: unknown, raw?: string): ScreenSettingRecord => ({ screenName: "s", settingName: "n", settingValue: raw ?? JSON.stringify(value) });

describe("jackpotRecordHashes", () => {
  it("索引(media)のハッシュを集める。景品と画面設定が共有しても索引は1つ", () => {
    const data = { prizes: [{ id: "p" }], screens: [], media: { "a.png": info("a"), "bgm.wav": info("b") } };
    expect(jackpotRecordHashes(data).sort()).toEqual([h("a"), h("b")]);
  });

  it("形が違うレコード(以前の形式など)でも例外にせず、何も参照していないものとして扱う", () => {
    expect(jackpotRecordHashes(null)).toEqual([]);
    expect(jackpotRecordHashes({})).toEqual([]);
    expect(jackpotRecordHashes([{ id: "old", hash: h("a") }])).toEqual([]);
    expect(jackpotRecordHashes({ media: { "a.png": null, "b.png": {} } })).toEqual([]);
  });
});

describe("prizeMediaNames", () => {
  it("景品の画像・当選画像・BGM の名前を、重複なしで集める", () => {
    const p: Prize = { id: "p", name: "n", order: 1, image: "a.png", image2: "a.png", winningImage1: "w.png", bgm1: "b.mp3", bgm2: "" };
    expect(prizeMediaNames(p).sort()).toEqual(["a.png", "b.mp3", "w.png"]);
  });
});

describe("screenMediaNames", () => {
  it("オープニング等の BGM・コンテンツの画像と効果音を集める", () => {
    const s = screen({ bgm: "o.mp3", contents: [{ type: "image", media: "i.png", se: "se.mp3" }, { type: "text", text: "media" }, { media: "i.png" }] });
    expect(screenMediaNames(s).sort()).toEqual(["i.png", "o.mp3", "se.mp3"]);
  });

  it("デモ・結果画面の BGM と効果音、本抽選のメンバー抽選 BGM の一覧を集める(空は含めない)", () => {
    expect(screenMediaNames(screen({ demoBgm: "d.mp3", demoSe1: "", demoSe2: "e.mp3" })).sort()).toEqual(["d.mp3", "e.mp3"]);
    expect(screenMediaNames(screen({ resultBgm: "r.mp3", resultSe1: "s1.mp3" })).sort()).toEqual(["r.mp3", "s1.mp3"]);
    expect(screenMediaNames(screen({ memberLotteryBgms: ["m1.mp3", "", "m2.mp3"], prizeStopSec: 3 })).sort()).toEqual(["m1.mp3", "m2.mp3"]);
  });

  it("JSON でない値は何も参照していない", () => {
    expect(screenMediaNames(screen(null, "not json"))).toEqual([]);
  });
});

describe("jackpotMediaRefs", () => {
  it("景品と画面設定の参照を、1件ごとのまとまりで返す", () => {
    const refs = jackpotMediaRefs({ prizes: [{ id: "p", name: "n", order: 1, image: "a.png" }], screens: [screen({ demoBgm: "d.mp3" })] });
    expect(refs).toEqual([["a.png"], ["d.mp3"]]);
  });
});
