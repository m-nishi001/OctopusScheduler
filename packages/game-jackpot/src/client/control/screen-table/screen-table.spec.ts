import { describe, expect, it } from "vitest";
import type { Row } from "@octopus/table-io";
import type { ScreenSettingRecord } from "../../../server/jackpot-api-contract";
import { rowsToScreens, rowText, screensToRows } from "./screen-table";

const rec = (screenName: string, settingName: string, value: unknown): ScreenSettingRecord => ({ screenName, settingName, settingValue: JSON.stringify(value) });
const OPTIONS = { available: new Set(["o.mp3", "pic.png", "se.wav", "a.mp3", "b.mp3"]), mimeOf: () => "" };
const toScreens = (rows: Row[]) => rowsToScreens(rows, OPTIONS);

const ALL: ScreenSettingRecord[] = [
  rec("opening", "opening-screen-settings", {
    bgm: "o.mp3",
    contents: [
      { type: "text", name: "題", text: "ようこそ\n二行目", effect: "scroll", duration: 3000, se: "se.wav" },
      { type: "image", media: "pic.png", effect: "fade", duration: 1500 },
      { type: "html", content: "<b>太字</b>", effect: "static", duration: 2000 },
    ],
  }),
  rec("description", "description-screen-settings", { bgm: "", contents: [{ type: "text", content: "説明", effect: "fade", duration: 500 }] }),
  rec("demo", "demo-screen-settings", { demoBgm: "a.mp3", demoDrawSe: "se.wav" }),
  rec("main", "main-screen-settings", { memberLotteryBgms: ["a.mp3", "b.mp3"], kakuhenMode: "fixed", kakuhenFixedTimings: [3, 7], prizeStopSec: 6 }),
  rec("result", "result-screen-settings", { resultBgm: "b.mp3" }),
  rec("ending", "ending-screen-settings", { bgm: "", contents: [] }),
];

describe("画面設定 -> 行", () => {
  it("画面の並びで、設定を1行ずつ・コンテンツを1行ずつにする。空の設定は行にしない", () => {
    const rows = screensToRows(ALL);
    expect(rows.map((r) => `${r.screen}/${r.item}`)).toEqual([
      "オープニング/BGM", "オープニング/コンテンツ", "オープニング/コンテンツ", "オープニング/コンテンツ",
      "説明/コンテンツ",
      "デモ抽選/BGM", "デモ抽選/抽選SE",
      "本抽選/メンバー抽選BGM", "本抽選/メンバー抽選BGM", "本抽選/確変の回", "本抽選/停止秒数",
      "最終結果/BGM",
    ]);
    expect(rows[1]).toMatchObject({ type: "テキスト", text: "ようこそ\n二行目", effect: "スクロール", seconds: "3", se: "se.wav", name: "題" });
    expect(rows[2]).toMatchObject({ type: "画像", media: "pic.png", effect: "フェード", seconds: "1.5" });
    expect(rows[3]).toMatchObject({ type: "HTML", text: "<b>太字</b>", effect: "静止" });
    expect(rows[9]).toMatchObject({ text: "3, 7" });
    expect(rows[10]).toMatchObject({ text: "6" });
  });

  it("設定が無い画面は行が無い。確変はおまかせ・なしの書き方になる", () => {
    expect(screensToRows([])).toEqual([]);
    const auto = screensToRows([rec("main", "main-screen-settings", {})]);
    expect(auto.map((r) => r.text)).toEqual(["おまかせ", "4"]);
    const none = screensToRows([rec("main", "main-screen-settings", { kakuhenMode: "fixed", kakuhenFixedTimings: [] })]);
    expect(none[0].text).toBe("なし");
  });
});

describe("行 -> 画面設定(往復)", () => {
  it("行にして戻して行にすると、同じ行になる(全画面)", () => {
    const rows = screensToRows(ALL);
    const back = toScreens(rows);
    expect(back.errors.every((e) => e === null)).toBe(true);
    expect(screensToRows(back.records).map(rowText)).toEqual(rows.map(rowText));
    expect(back.records.map((r) => r.settingName)).toEqual(["opening-screen-settings", "description-screen-settings", "demo-screen-settings", "main-screen-settings", "result-screen-settings"]);
  });

  it("出てくる画面だけを作り、その画面はファイルの行だけで決まる(ほかの項目は初期値)", () => {
    const { records } = toScreens([{ screen: "デモ抽選", item: "抽選SE", media: "se.wav" }]);
    expect(records).toHaveLength(1);
    expect(JSON.parse(records[0].settingValue)).toEqual({ demoBgm: "", demoDrawSe: "se.wav" });
    const main = toScreens([{ screen: "本抽選", item: "確変の回", text: "おまかせ" }]).records[0];
    expect(JSON.parse(main.settingValue)).toEqual({ memberLotteryBgms: [], kakuhenMode: "auto", kakuhenFixedTimings: [], prizeStopSec: 4 });
  });

  it("コンテンツは行の順。秒数が空なら3秒、効果が空ならスクロール。テキストは text、HTML は content に入る", () => {
    const { records } = toScreens([
      { screen: "エンディング", item: "コンテンツ", type: "テキスト", text: "A" },
      { screen: "エンディング", item: "コンテンツ", type: "HTML", text: "<i>B</i>", effect: "静止", seconds: "0.5" },
    ]);
    expect(JSON.parse(records[0].settingValue)).toEqual({
      bgm: "",
      contents: [
        { type: "text", effect: "scroll", duration: 3000, text: "A" },
        { type: "html", effect: "static", duration: 500, content: "<i>B</i>" },
      ],
    });
  });
});

describe("行のエラー", () => {
  const errorsOf = (rows: Row[]) => toScreens(rows).errors;

  it("画面・項目が違う、その画面で使えない項目", () => {
    const e = errorsOf([
      { screen: "ホーム", item: "BGM" },
      { screen: "オープニング", item: "抽選SE" },
      { screen: "最終結果", item: "コンテンツ" },
    ]);
    expect(e[0]).toContain("画面は");
    expect(e[1]).toContain("「オープニング」の項目は");
    expect(e[2]).toContain("「最終結果」の項目は");
  });

  it("同じ設定の重複(BGM を2行)。メンバー抽選BGM とコンテンツは複数行でよい", () => {
    const e = errorsOf([
      { screen: "デモ抽選", item: "BGM", media: "a.mp3" },
      { screen: "デモ抽選", item: "BGM", media: "b.mp3" },
      { screen: "本抽選", item: "メンバー抽選BGM", media: "a.mp3" },
      { screen: "本抽選", item: "メンバー抽選BGM", media: "a.mp3" },
    ]);
    expect(e[1]).toContain("1 行目と重複");
    expect(e[2]).toBeNull();
    expect(e[3]).toBeNull();
  });

  it("素材が無い・種類が違う(音の欄に画像、画像の欄に音)", () => {
    const e = errorsOf([
      { screen: "最終結果", item: "BGM", media: "none.mp3" },
      { screen: "最終結果", item: "BGM", media: "pic.png" },
      { screen: "オープニング", item: "コンテンツ", type: "画像", media: "a.mp3" },
      { screen: "オープニング", item: "コンテンツ", type: "画像" },
    ]);
    expect(e[0]).toContain("「none.mp3」が見つかりません");
    expect(e[1]).toContain("重複"); // 2行目は同じ設定の重複が先
    expect(e[2]).toContain("画像ではありません");
    expect(e[3]).toContain("画像の素材が空");
    expect(errorsOf([{ screen: "最終結果", item: "BGM", media: "pic.png" }])[0]).toContain("音ではありません");
  });

  it("コンテンツの種類・効果・秒数・文字", () => {
    const base = { screen: "説明", item: "コンテンツ" };
    const e = errorsOf([
      { ...base },
      { ...base, type: "動画" },
      { ...base, type: "テキスト", text: "x", effect: "ぐるぐる" },
      { ...base, type: "テキスト", text: "x", seconds: "-1" },
      { ...base, type: "テキスト" },
      { ...base, type: "HTML" },
    ]);
    expect(e[0]).toContain("種類が空");
    expect(e[1]).toContain("テキスト・画像・HTML");
    expect(e[2]).toContain("スクロール・フェード・静止");
    expect(e[3]).toContain("秒数");
    expect(e[4]).toContain("文字が空");
    expect(e[5]).toContain("文字が空");
  });

  it("確変の回・停止秒数", () => {
    const e = errorsOf([
      { screen: "本抽選", item: "確変の回", text: "3, x" },
      { screen: "本抽選", item: "停止秒数", text: "99" },
    ]);
    expect(e[0]).toContain("確変の回は");
    expect(e[1]).toContain("停止秒数は2〜15");
    expect(errorsOf([{ screen: "本抽選", item: "確変の回", text: "3, 7" }, { screen: "本抽選", item: "停止秒数", text: "6" }])).toEqual([null, null]);
  });
});
