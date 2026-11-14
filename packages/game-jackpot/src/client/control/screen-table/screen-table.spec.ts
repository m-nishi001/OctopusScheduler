import { describe, expect, it } from "vitest";
import { parseTable, stringifyTable } from "@octopus/table-io";
import type { Row } from "@octopus/table-io";
import type { ScreenSettingRecord } from "../../../server/jackpot-api-contract";
import { mediaNamesOf, PAGE_HEADERS, rowText, SCREEN_HEADERS, screensToTables, tablesToScreens } from "./screen-table";

const rec = (screenName: string, settingName: string, value: unknown): ScreenSettingRecord => ({ screenName, settingName, settingValue: JSON.stringify(value) });
const AVAILABLE = new Set(["o.mp3", "pic.png", "se.wav", "a.mp3", "b.mp3"]);
const toScreens = (screens: Row[], pages: Row[] | null = [], over: { current?: ScreenSettingRecord[]; kakuhenPrizeCount?: number } = {}) =>
  tablesToScreens({ screens, pages }, { available: AVAILABLE, mimeOf: () => "", current: over.current ?? [], kakuhenPrizeCount: over.kakuhenPrizeCount ?? 2 });
const valueOf = (records: ScreenSettingRecord[], settingName: string) => JSON.parse(records.find((r) => r.settingName === settingName)!.settingValue);

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

describe("画面設定 -> 2つの表", () => {
  it("screens.csv は画面ごとに1行、使わない列は空欄。pages.csv はページを1行ずつ(行の順)", () => {
    const { screens, pages } = screensToTables(ALL);
    expect(screens).toEqual([
      { screen: "オープニング", bgm: "o.mp3" },
      { screen: "説明", bgm: "" },
      { screen: "デモ抽選", bgm: "a.mp3", demoDraw: "なし", demoRounds: "2" },
      { screen: "本抽選", memberBgms: "a.mp3;b.mp3", stopSec: "6", participantStop: "不可", kakuhenMode: "回を指定", kakuhenTimings: "3, 7" },
      { screen: "最終結果", bgm: "b.mp3" },
      { screen: "エンディング", bgm: "" },
    ]);
    expect(pages.map((p) => `${p.screen}/${p.kind}`)).toEqual(["オープニング/テキスト", "オープニング/画像", "オープニング/テキスト", "説明/テキスト", "説明/画像"]);
    expect(pages[0]).toMatchObject({ text: "ようこそ\n二行目", image: "", effect: "流れる", seconds: "3", lines: "", se: "se.wav", name: "題" });
    expect(pages[2]).toMatchObject({ effect: "行送り", seconds: "2", lines: "2" });
    // 説明のページは、効果・秒数・行数・効果音の列を持たない
    expect(pages[3]).toEqual({ screen: "説明", kind: "テキスト", text: "説明", image: "" });
  });

  it("設定が無い画面は行が無い。確変の決め方は おまかせ・なし・回を指定", () => {
    expect(screensToTables([])).toEqual({ screens: [], pages: [] });
    const row = (v: unknown) => screensToTables([rec("main", "main-screen-settings", v)]).screens[0];
    expect(row({})).toMatchObject({ kakuhenMode: "おまかせ", kakuhenTimings: "", stopSec: "4", participantStop: "可" });
    expect(row({ kakuhenMode: "none" })).toMatchObject({ kakuhenMode: "なし", kakuhenTimings: "" });
    expect(row({ kakuhenMode: "fixed", kakuhenFixedTimings: [2, 5] })).toMatchObject({ kakuhenMode: "回を指定", kakuhenTimings: "2, 5" });
  });

  it("参照している素材の名前を集める(BGM・メンバー抽選BGM・画像・効果音)", () => {
    expect(mediaNamesOf(screensToTables(ALL)).sort()).toEqual(["a.mp3", "b.mp3", "o.mp3", "pic.png", "se.wav"]);
  });
});

describe("書き出し -> 取り込み(往復)", () => {
  it("CSV の文字列にして読み戻して取り込むと、同じ設定・同じ行になる(全画面)", () => {
    const t = screensToTables(ALL);
    const screensCsv = stringifyTable(SCREEN_HEADERS, t.screens);
    const pagesCsv = stringifyTable(PAGE_HEADERS, t.pages);
    const readScreens = parseTable(new TextEncoder().encode(screensCsv), SCREEN_HEADERS);
    const readPages = parseTable(new TextEncoder().encode(pagesCsv), PAGE_HEADERS);
    if (!readScreens.ok || !readPages.ok) throw new Error("parse");
    const back = toScreens(readScreens.rows.map((r) => r.cells), readPages.rows.map((r) => r.cells), { kakuhenPrizeCount: 2 });
    expect([...back.screenErrors, ...back.pageErrors].every((e) => e === null)).toBe(true);
    const again = screensToTables(back.records);
    expect(again.screens.map((r) => rowText(SCREEN_HEADERS, r))).toEqual(t.screens.map((r) => rowText(SCREEN_HEADERS, r)));
    expect(again.pages.map((r) => rowText(PAGE_HEADERS, r))).toEqual(t.pages.map((r) => rowText(PAGE_HEADERS, r)));
    expect(back.records.map((r) => r.settingName)).toEqual(ALL.map((r) => r.settingName));
    expect(valueOf(back.records, "main-screen-settings")).toEqual({ memberLotteryBgms: ["a.mp3", "b.mp3"], kakuhenMode: "fixed", kakuhenFixedTimings: [3, 7], prizeStopSec: 6, participantStop: false });
    expect(valueOf(back.records, "demo-screen-settings")).toEqual({ enabled: false, rounds: 2, bgm: "a.mp3" });
  });

  it("確変の決め方(なし)も往復する", () => {
    const t = screensToTables([rec("main", "main-screen-settings", { kakuhenMode: "none", memberLotteryBgms: [], prizeStopSec: 4, participantStop: true })]);
    const back = toScreens(t.screens, []);
    expect(valueOf(back.records, "main-screen-settings")).toMatchObject({ kakuhenMode: "none", kakuhenFixedTimings: [] });
  });

  it("出てくる画面だけを作り、その画面はファイルの行だけで決まる(ほかの項目は初期値)", () => {
    const { records } = toScreens([{ screen: "デモ抽選", demoRounds: "3" }], null);
    expect(records).toHaveLength(1);
    expect(valueOf(records, "demo-screen-settings")).toEqual({ enabled: true, rounds: 3, bgm: "" });
    const main = toScreens([{ screen: "本抽選", kakuhenMode: "おまかせ" }], null).records[0];
    expect(JSON.parse(main.settingValue)).toEqual({ memberLotteryBgms: [], kakuhenMode: "auto", kakuhenFixedTimings: [], prizeStopSec: 4, participantStop: true });
  });
});

describe("pages.csv の取り込み", () => {
  const OPENING = { screen: "オープニング" };

  it("ページは行の順。秒数が空なら3秒、効果が空ならフェード。行送りの行数が空なら3行", () => {
    const { records, pageErrors } = toScreens(
      [{ ...OPENING, bgm: "o.mp3" }],
      [
        { ...OPENING, kind: "テキスト", text: "A" },
        { ...OPENING, kind: "テキスト", text: "B", effect: "行送り", seconds: "0.5" },
        { ...OPENING, kind: "画像", image: "pic.png", effect: "静止", se: "se.wav", name: "ロゴ" },
      ]
    );
    expect(pageErrors).toEqual([null, null, null]);
    expect(valueOf(records, "opening-screen-settings")).toEqual({
      bgm: "o.mp3",
      items: [
        { kind: "テキスト", effect: "フェード", seconds: 3, text: "A" },
        { kind: "テキスト", effect: "行送り", seconds: 0.5, lines: 3, text: "B" },
        { kind: "画像", effect: "静止", seconds: 3, image: "pic.png", se: "se.wav", name: "ロゴ" },
      ],
    });
  });

  it("説明は 画像 / テキスト のページになる", () => {
    const d = { screen: "説明" };
    const { records, pageErrors } = toScreens([d], [{ ...d, kind: "画像", image: "pic.png" }, { ...d, kind: "テキスト", text: "ようこそ" }]);
    expect(pageErrors).toEqual([null, null]);
    expect(valueOf(records, "description-screen-settings")).toEqual({ bgm: "", pages: [{ kind: "画像", image: "pic.png" }, { kind: "テキスト", text: "ようこそ" }] });
  });

  it("screens.csv に行があって pages.csv に行が無い画面は、ページが空になる(pages.csv を渡したとき)", () => {
    const current = [rec("ending", "ending-screen-settings", { bgm: "", items: [{ kind: "テキスト", text: "x", effect: "静止", seconds: 1 }] })];
    expect(valueOf(toScreens([{ screen: "エンディング" }], [], { current }).records, "ending-screen-settings").items).toEqual([]);
  });

  it("pages.csv を渡さなければ、ページはいまのまま。pages.csv だけなら、BGM はいまのまま", () => {
    const current = [rec("opening", "opening-screen-settings", { bgm: "o.mp3", items: [{ kind: "テキスト", text: "x", effect: "静止", seconds: 1 }] })];
    const onlyScreens = toScreens([{ screen: "オープニング", bgm: "a.mp3" }], null, { current });
    expect(valueOf(onlyScreens.records, "opening-screen-settings")).toEqual({ bgm: "a.mp3", items: [{ kind: "テキスト", text: "x", effect: "静止", seconds: 1 }] });
    const onlyPages = toScreens([], [{ ...OPENING, kind: "テキスト", text: "新" }], { current });
    expect(valueOf(onlyPages.records, "opening-screen-settings")).toMatchObject({ bgm: "o.mp3", items: [{ text: "新" }] });
  });
});

describe("screens.csv のエラー", () => {
  const errorsOf = (screens: Row[], over = {}) => toScreens(screens, [], over).screenErrors;
  /** 同じ画面は1行しか書けないので、行ごとに別々に取り込んでエラーを集める。 */
  const eachOf = (rows: Row[]) => rows.map((r) => toScreens([r], []).screenErrors[0]);

  it("画面が違う・重複(1画面1行)", () => {
    const e = errorsOf([{ screen: "ホーム" }, { screen: "説明" }, { screen: "説明" }]);
    expect(e[0]).toContain("画面は");
    expect(e[1]).toBeNull();
    expect(e[2]).toContain("2 行目と重複");
  });

  it("その画面で使わない列に値があるとエラー", () => {
    const e = errorsOf([{ screen: "オープニング", demoRounds: "2" }, { screen: "本抽選", bgm: "a.mp3" }, { screen: "最終結果", kakuhenMode: "なし" }]);
    expect(e[0]).toContain("「オープニング」では「デモ回数」は使いません");
    expect(e[1]).toContain("「本抽選」では「BGM」は使いません");
    expect(e[2]).toContain("「確変の決め方」は使いません");
  });

  it("素材が無い・種類が違う(音の欄に画像)", () => {
    const e = errorsOf([{ screen: "最終結果", bgm: "none.mp3" }, { screen: "オープニング", bgm: "pic.png" }, { screen: "本抽選", memberBgms: "a.mp3;pic.png;none.mp3" }]);
    expect(e[0]).toContain("「none.mp3」が見つかりません");
    expect(e[1]).toContain("音ではありません");
    expect(e[2]).toContain("音ではありません");
  });

  it("デモ抽選は あり・なし、デモ回数は 1〜3。TRUE/FALSE・○× は受け付けない", () => {
    const e = eachOf([{ screen: "デモ抽選", demoDraw: "TRUE" }, { screen: "デモ抽選", demoRounds: "4" }, { screen: "デモ抽選", demoDraw: "○" }]);
    expect(e[0]).toContain("あり・なし");
    expect(e[1]).toContain("1〜3");
    expect(e[2]).toContain("あり・なし");
    expect(errorsOf([{ screen: "デモ抽選", demoDraw: "なし", demoRounds: "2" }])).toEqual([null]);
  });

  it("参加者の停止は 可・不可。空欄は可", () => {
    const stopOf = (participantStop: string) => toScreens([{ screen: "本抽選", participantStop }]);
    expect(valueOf(stopOf("可").records, "main-screen-settings").participantStop).toBe(true);
    expect(valueOf(stopOf("不可").records, "main-screen-settings").participantStop).toBe(false);
    expect(valueOf(stopOf("").records, "main-screen-settings").participantStop).toBe(true);
    expect(stopOf("たぶん").screenErrors[0]).toContain("可・不可");
    expect(stopOf("TRUE").screenErrors[0]).toContain("可・不可");
  });

  it("停止秒数は 2〜15", () => {
    expect(errorsOf([{ screen: "本抽選", stopSec: "99" }])[0]).toContain("停止秒数は2〜15");
    expect(errorsOf([{ screen: "本抽選", stopSec: "6" }])).toEqual([null]);
  });

  it("確変の決め方: おまかせ・なし・回を指定だけ。回は 回を指定 のときだけ書け、回を指定なら必須", () => {
    const e = eachOf([
      { screen: "本抽選", kakuhenMode: "auto" },
      { screen: "本抽選", kakuhenMode: "回を指定" },
      { screen: "本抽選", kakuhenMode: "回を指定", kakuhenTimings: "3, x" },
      { screen: "本抽選", kakuhenMode: "おまかせ", kakuhenTimings: "3" },
      { screen: "本抽選", kakuhenMode: "なし", kakuhenTimings: "3" },
      { screen: "本抽選", kakuhenMode: "回を指定", kakuhenTimings: "3, 7" },
    ]);
    expect(e[0]).toContain("おまかせ・なし・回を指定");
    expect(e[1]).toContain("確変の回を");
    expect(e[2]).toContain("確変の回は");
    expect(e[3]).toContain("回を指定」のときだけ");
    expect(e[4]).toContain("回を指定」のときだけ");
    expect(e[5]).toBeNull();
  });

  it("回の数が確変対応ありの景品の数と違えば、取り込めるが警告する(おまかせ・なし・一致なら警告なし)", () => {
    const w = (over: Row, prizes: number) => toScreens([{ screen: "本抽選", ...over }], [], { kakuhenPrizeCount: prizes });
    expect(w({ kakuhenMode: "回を指定", kakuhenTimings: "3, 7" }, 2).screenWarnings[0]).toBeNull();
    const more = w({ kakuhenMode: "回を指定", kakuhenTimings: "3, 7, 9" }, 2);
    expect(more.screenErrors[0]).toBeNull();
    expect(more.screenWarnings[0]).toContain("確変にする回（3回）が、確変対応ありの景品（2件）より多い");
    expect(w({ kakuhenMode: "回を指定", kakuhenTimings: "3" }, 2).screenWarnings[0]).toContain("より少ない");
    expect(w({ kakuhenMode: "おまかせ" }, 5).screenWarnings[0]).toBeNull();
    expect(w({ kakuhenMode: "なし" }, 5).screenWarnings[0]).toBeNull();
  });
});

describe("pages.csv のエラー", () => {
  const errorsOf = (rows: Row[]) => toScreens([], rows).pageErrors;
  const base = { screen: "オープニング" };

  it("画面・種類・効果・秒数・行数・文字・画像", () => {
    const e = errorsOf([
      { ...base },
      { ...base, kind: "動画" },
      { ...base, kind: "HTML", text: "<b>x</b>" },
      { ...base, kind: "テキスト", text: "x", effect: "ぐるぐる" },
      { ...base, kind: "テキスト", text: "x", seconds: "-1" },
      { ...base, kind: "テキスト" },
      { ...base, kind: "画像", image: "pic.png", effect: "行送り" },
      { ...base, kind: "テキスト", text: "x", effect: "行送り", lines: "0" },
      { ...base, kind: "テキスト", text: "x", effect: "フェード", lines: "2" },
      { ...base, kind: "テキスト", text: "x", image: "pic.png" },
      { ...base, kind: "画像", image: "pic.png", text: "x" },
      { ...base, kind: "画像" },
      { screen: "本抽選", kind: "テキスト", text: "x" },
      { ...base, kind: "テキスト", text: "x", effect: "FADE" },
    ]);
    expect(e[0]).toContain("種類が空");
    expect(e[1]).toContain("テキスト・画像");
    expect(e[2]).toContain("テキスト・画像");
    expect(e[3]).toContain("流れる・行送り・フェード・静止");
    expect(e[4]).toContain("秒数");
    expect(e[5]).toContain("文字が空");
    expect(e[6]).toContain("行送りはテキストだけ");
    expect(e[7]).toContain("行数は1以上");
    expect(e[8]).toContain("行送り のときだけ");
    expect(e[9]).toContain("画像は空欄");
    expect(e[10]).toContain("文字は空欄");
    expect(e[11]).toContain("画像の素材が空");
    expect(e[12]).toContain("オープニング・説明・エンディング");
    expect(e[13]).toContain("流れる・行送り・フェード・静止");
  });

  it("説明のページには、効果・秒数・行数・効果音を入れられない", () => {
    const base = { screen: "説明", kind: "テキスト", text: "x" };
    const e = errorsOf([{ ...base, effect: "静止" }, { ...base, seconds: "3" }, { ...base, lines: "2" }, { ...base, se: "se.wav" }, { ...base, kind: "HTML" }, { ...base, kind: "画像", text: "", image: "" }]);
    for (const i of [0, 1, 2, 3]) expect(e[i]).toContain("入れられません");
    expect(e[4]).toContain("テキスト・画像");
    expect(e[5]).toContain("画像の素材が空");
  });
});
