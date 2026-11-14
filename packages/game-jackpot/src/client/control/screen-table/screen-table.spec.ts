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
    items: [
      { kind: "テキスト", name: "題", text: "ようこそ\n二行目", effect: "流れる", seconds: 3, se: "se.wav" },
      { kind: "画像", image: "pic.png", effect: "フェード", seconds: 1.5 },
      { kind: "テキスト", text: "長い文章", effect: "行送り", seconds: 2, lines: 2 },
    ],
  }),
  rec("description", "description-screen-settings", { bgm: "", pages: [{ kind: "テキスト", text: "説明" }, { kind: "画像", image: "pic.png" }] }),
  rec("demo", "demo-screen-settings", { enabled: false, rounds: 2, bgm: "a.mp3" }),
  rec("main", "main-screen-settings", { memberLotteryBgms: ["a.mp3", "b.mp3"], kakuhenMode: "fixed", kakuhenFixedTimings: [3, 7], prizeStopSec: 6, participantStop: false }),
  rec("result", "result-screen-settings", { resultBgm: "b.mp3" }),
  rec("ending", "ending-screen-settings", { bgm: "", items: [] }),
];

describe("画面設定 -> 行", () => {
  it("画面の並びで、設定を1行ずつ・コンテンツを1行ずつにする。空の設定は行にしない", () => {
    const rows = screensToRows(ALL);
    expect(rows.map((r) => `${r.screen}/${r.item}`)).toEqual([
      "オープニング/BGM", "オープニング/コンテンツ", "オープニング/コンテンツ", "オープニング/コンテンツ",
      "説明/コンテンツ", "説明/コンテンツ",
      "デモ抽選/BGM", "デモ抽選/デモ抽選", "デモ抽選/デモ回数",
      "本抽選/メンバー抽選BGM", "本抽選/メンバー抽選BGM", "本抽選/確変の回", "本抽選/停止秒数", "本抽選/参加者の停止",
      "最終結果/BGM",
    ]);
    expect(rows[1]).toMatchObject({ type: "テキスト", text: "ようこそ\n二行目", effect: "流れる", seconds: "3", se: "se.wav", name: "題" });
    expect(rows[2]).toMatchObject({ type: "画像", media: "pic.png", effect: "フェード", seconds: "1.5" });
    expect(rows[3]).toMatchObject({ type: "テキスト", text: "長い文章", effect: "行送り", seconds: "2", lines: "2" });
    // 説明は効果・秒数・効果音を持たない
    expect(rows[4]).toEqual({ screen: "説明", item: "コンテンツ", type: "テキスト", text: "説明", media: "" });
    expect(rows[5]).toEqual({ screen: "説明", item: "コンテンツ", type: "画像", text: "", media: "pic.png" });
    expect(rows[7]).toEqual({ screen: "デモ抽選", item: "デモ抽選", text: "なし" });
    expect(rows[8]).toEqual({ screen: "デモ抽選", item: "デモ回数", text: "2" });
    expect(rows[11]).toMatchObject({ text: "3, 7" });
    expect(rows[12]).toMatchObject({ text: "6" });
    expect(rows[13]).toMatchObject({ item: "参加者の停止", text: "不可" });
  });

  it("設定が無い画面は行が無い。確変はおまかせ・なしの書き方になる", () => {
    expect(screensToRows([])).toEqual([]);
    const auto = screensToRows([rec("main", "main-screen-settings", {})]);
    expect(auto.map((r) => r.text)).toEqual(["おまかせ", "4", "可"]);
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
    expect(JSON.parse(back.records.find((r) => r.settingName === "main-screen-settings")!.settingValue).participantStop).toBe(false);
    expect(back.records.map((r) => r.settingName)).toEqual(["opening-screen-settings", "description-screen-settings", "demo-screen-settings", "main-screen-settings", "result-screen-settings"]);
  });

  it("出てくる画面だけを作り、その画面はファイルの行だけで決まる(ほかの項目は初期値)", () => {
    const { records } = toScreens([{ screen: "デモ抽選", item: "デモ回数", text: "3" }]);
    expect(records).toHaveLength(1);
    expect(JSON.parse(records[0].settingValue)).toEqual({ enabled: true, rounds: 3, bgm: "" });
    const main = toScreens([{ screen: "本抽選", item: "確変の回", text: "おまかせ" }]).records[0];
    expect(JSON.parse(main.settingValue)).toEqual({ memberLotteryBgms: [], kakuhenMode: "auto", kakuhenFixedTimings: [], prizeStopSec: 4, participantStop: true });
  });

  it("コンテンツは行の順。秒数が空なら3秒、効果が空ならフェード。行送りの行数が空なら3行", () => {
    const { records } = toScreens([
      { screen: "エンディング", item: "コンテンツ", type: "テキスト", text: "A" },
      { screen: "エンディング", item: "コンテンツ", type: "テキスト", text: "B", effect: "行送り", seconds: "0.5" },
      { screen: "エンディング", item: "コンテンツ", type: "画像", media: "pic.png", effect: "静止" },
    ]);
    expect(JSON.parse(records[0].settingValue)).toEqual({
      bgm: "",
      items: [
        { kind: "テキスト", effect: "フェード", seconds: 3, text: "A" },
        { kind: "テキスト", effect: "行送り", seconds: 0.5, lines: 3, text: "B" },
        { kind: "画像", effect: "静止", seconds: 3, image: "pic.png" },
      ],
    });
  });

  it("説明は 画像 / テキスト のページになる", () => {
    const { records, errors } = toScreens([
      { screen: "説明", item: "コンテンツ", type: "画像", media: "pic.png" },
      { screen: "説明", item: "コンテンツ", type: "テキスト", text: "ようこそ" },
    ]);
    expect(errors).toEqual([null, null]);
    expect(JSON.parse(records[0].settingValue)).toEqual({ bgm: "", pages: [{ kind: "画像", image: "pic.png" }, { kind: "テキスト", text: "ようこそ" }] });
  });
});

describe("行のエラー", () => {
  const errorsOf = (rows: Row[]) => toScreens(rows).errors;

  it("画面・項目が違う、その画面で使えない項目", () => {
    const e = errorsOf([
      { screen: "ホーム", item: "BGM" },
      { screen: "オープニング", item: "デモ回数" },
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

  it("コンテンツの種類・効果・秒数・行数・文字", () => {
    const base = { screen: "オープニング", item: "コンテンツ" };
    const e = errorsOf([
      { ...base },
      { ...base, type: "動画" },
      { ...base, type: "HTML", text: "<b>x</b>" },
      { ...base, type: "テキスト", text: "x", effect: "ぐるぐる" },
      { ...base, type: "テキスト", text: "x", seconds: "-1" },
      { ...base, type: "テキスト" },
      { ...base, type: "画像", media: "pic.png", effect: "行送り" },
      { ...base, type: "テキスト", text: "x", effect: "行送り", lines: "0" },
      { ...base, type: "テキスト", text: "x", effect: "フェード", lines: "2" },
    ]);
    expect(e[0]).toContain("種類が空");
    expect(e[1]).toContain("テキスト・画像");
    expect(e[2]).toContain("テキスト・画像"); // HTML は廃止
    expect(e[3]).toContain("流れる・行送り・フェード・静止");
    expect(e[4]).toContain("秒数");
    expect(e[5]).toContain("文字が空");
    expect(e[6]).toContain("行送りはテキストだけ");
    expect(e[7]).toContain("行数は1以上");
    expect(e[8]).toContain("行送り のときだけ");
  });

  it("説明のページには、効果・秒数・行数・効果音を入れられない", () => {
    const base = { screen: "説明", item: "コンテンツ", type: "テキスト", text: "x" };
    const e = errorsOf([{ ...base, effect: "静止" }, { ...base, seconds: "3" }, { ...base, se: "se.wav" }, { ...base, type: "HTML" }, { ...base, type: "画像", media: "" }]);
    expect(e[0]).toContain("入れられません");
    expect(e[1]).toContain("入れられません");
    expect(e[2]).toContain("入れられません");
    expect(e[3]).toContain("画像・テキスト");
    expect(e[4]).toContain("画像の素材が空");
  });

  it("デモ抽選は あり・なし、デモ回数は 1〜3", () => {
    const e = errorsOf([
      { screen: "デモ抽選", item: "デモ抽選", text: "たぶん" },
      { screen: "デモ抽選", item: "デモ回数", text: "4" },
    ]);
    expect(e[0]).toContain("あり・なし");
    expect(e[1]).toContain("1〜3");
    expect(errorsOf([{ screen: "デモ抽選", item: "デモ抽選", text: "なし" }, { screen: "デモ抽選", item: "デモ回数", text: "2" }])).toEqual([null, null]);
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

  it("参加者の停止は 可・不可 のどちらか。空欄は可。読めない値はエラー", () => {
    const stopOf = (text: string) => JSON.parse(toScreens([{ screen: "本抽選", item: "参加者の停止", text }]).records[0].settingValue).participantStop;
    expect(stopOf("可")).toBe(true);
    expect(stopOf("不可")).toBe(false);
    expect(stopOf("")).toBe(true);
    
    expect(errorsOf([{ screen: "本抽選", item: "参加者の停止", text: "たぶん" }])[0]).toContain("参加者の停止は 可・不可");
  });
});
