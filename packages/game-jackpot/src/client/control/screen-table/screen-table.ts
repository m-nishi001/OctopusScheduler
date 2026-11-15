/**
 * ジャックポット画面設定の表(CSV)への対応。画面設定は「画面ごとに1件の JSON」で、表は2つに分ける(`screens.zip` に2つの CSV が入る)。
 *
 * ## screens.csv — 画面ごとに1行。列は固定
 * `画面*, BGM, メンバー抽選BGM, 景品抽選BGM, デモ抽選, デモ回数, メンバー停止秒, 景品停止秒, 参加者の停止, 確変の決め方, 確変の回`
 * - 画面: オープニング / 説明 / デモ抽選 / 本抽選 / 最終結果 / エンディング(1画面1行)。
 * - その画面で使わない列は空欄にする(入っていたらエラー)。使う列:
 *   - オープニング・説明・最終結果・エンディング: BGM
 *   - デモ抽選: BGM・デモ抽選・デモ回数
 *   - 本抽選: メンバー抽選BGM・景品抽選BGM・メンバー停止秒・景品停止秒・参加者の停止・確変の決め方・確変の回
 * - BGM: 音の素材の名前。メンバー抽選BGM・景品抽選BGM: 音の素材の名前を `;` で区切って並べる(どちらも3つまで)。
 *   抽選のたびに設定した中から1曲をランダムに選び、停止が始まるまで流してフェードアウトする(未設定なら無音)。
 * - デモ抽選: あり / なし(空欄は あり)。デモ回数: 1〜3(空欄は 1)。メンバー停止秒・景品停止秒: 2〜15(0.5刻み。空欄は メンバー 3.5 / 景品 4)。
 * - 参加者の停止: 可 / 不可(空欄は 可)。
 * - 確変の決め方: おまかせ / なし / 回を指定(空欄は おまかせ)。確変の回: 「3, 7」のような回の並び。回を指定のときだけ書き、回を指定なら必須。
 *
 * ## pages.csv — オープニング・説明・エンディングに出すページ(項目)。1行1ページ。並び順は行の順
 * `画面*, 種類*, 文字, 画像, 効果, 秒数, 行数, 効果音, 名前`
 * - 画面: オープニング / 説明 / エンディング。種類: テキスト / 画像(テキストは 文字 を、画像は 画像 を書く。もう一方は空欄)。
 * - 効果: 流れる / 行送り / フェード / 静止(空欄は フェード)。秒数: 表示する長さ(秒。空欄は 3)。行数: 行送りの1回に送る行数(行送りのときだけ。空欄は 3)。
 * - 効果音: 項目の始めに鳴らす音の素材の名前。名前: 管理画面の一覧に出す名前。
 * - 説明は1ページずつ手で送るので、効果・秒数・行数・効果音は入れられない(入っていたらエラー)。名前は使われない。
 *
 * ## 置き換えの単位
 * ファイルに出てくる画面だけを、まるごと置き換える(出てこない画面は変えない)。
 * - screens.csv に行がある画面は、その行で BGM などが決まる(ファイルに無い列は初期値)。
 * - pages.csv を渡したとき、オープニング・説明・エンディングのページは、screens.csv に行がある画面と、pages.csv に行がある画面で置き換わる。
 *   pages.csv だけの画面は、BGM はいまのまま。pages.csv を渡さなければ、ページはいまのまま。
 * - 素材の空のセルは「設定なし」。書き出しと取り込みは同じ形なので、書き出したものをそのまま取り込むと、全行「変更なし」になる。
 * - 値は日本語の決まった語だけ(TRUE/FALSE・○× などは受け付けない)。
 */
import type { Header, Row } from "@octopus/table-io";
import { mimeOfName } from "@octopus/table-io";
import type { ScreenSettingRecord } from "../../../server/jackpot-api-contract";
import { DEFAULT_PARTICIPANT_STOP, parseParticipantStop } from "../../model/draw/participant-stop";
import { clampMemberStopSec, clampPrizeStopSec, DEFAULT_MEMBER_STOP_SEC, DEFAULT_PRIZE_STOP_SEC, MAX_STOP_SEC, MIN_STOP_SEC } from "../../model/draw/stop-sec";
import { kakuhenCountWarning, parseKakuhenPlan, parseTimingsText } from "../../model/draw/kakuhen-plan";
import { MAX_DEMO_ROUNDS, MIN_DEMO_ROUNDS, parseDemoDrawSettings } from "../../model/screen-config/demo-draw-setting";
import { parseDescriptionSettings } from "../../model/screen-config/description-setting";
import {
  clampLines,
  DEFAULT_SEQUENCE_LINES,
  DEFAULT_SEQUENCE_SECONDS,
  parseSequenceSettings,
  SEQUENCE_EFFECTS,
  SEQUENCE_KINDS,
} from "../../model/screen-config/sequence-setting";

export const SCREEN_CSV_NAME = "screens.csv";
export const PAGES_CSV_NAME = "pages.csv";

/** screens.csv の列(この順に書き出す)。 */
export const SCREEN_HEADERS: readonly Header[] = [
  { key: "screen", label: "画面", aliases: ["screen"], required: true },
  { key: "bgm", label: "BGM", aliases: ["bgm"] },
  { key: "memberBgms", label: "メンバー抽選BGM" },
  { key: "memberResultBgms", label: "メンバー結果BGM" },
  { key: "prizeBgms", label: "景品抽選BGM" },
  { key: "demoDraw", label: "デモ抽選" },
  { key: "demoRounds", label: "デモ回数" },
  { key: "memberStopSec", label: "メンバー停止秒" },
  { key: "prizeStopSec", label: "景品停止秒" },
  { key: "participantStop", label: "参加者の停止" },
  { key: "kakuhenMode", label: "確変の決め方" },
  { key: "kakuhenTimings", label: "確変の回" },
];

/** pages.csv の列(この順に書き出す)。 */
export const PAGE_HEADERS: readonly Header[] = [
  { key: "screen", label: "画面", aliases: ["screen"], required: true },
  { key: "kind", label: "種類", aliases: ["type"], required: true },
  { key: "text", label: "文字", aliases: ["text"] },
  { key: "image", label: "画像", aliases: ["image"] },
  { key: "effect", label: "効果", aliases: ["effect"] },
  { key: "seconds", label: "秒数", aliases: ["seconds"] },
  { key: "lines", label: "行数", aliases: ["lines"] },
  { key: "se", label: "効果音", aliases: ["se"] },
  { key: "name", label: "名前" },
];

/** 旧形式(縦長の 画面/項目/素材/文字…)の見出し。使えなくなったことを伝える。 */
export const RETIRED_SCREEN_HEADERS: Readonly<Record<string, string>> = {
  項目: "画面ごとに1行の screens.csv と、ページを並べる pages.csv の新しい形(書き出し直したもの)",
  素材: "BGM・画像・効果音の列(書き出し直した新しい形)",
};

type ScreenKey = "opening" | "description" | "demo" | "main" | "result" | "ending";

/** 画面の並び(書き出しの順)と、表での呼び名、保存先の項目名。`pages` は pages.csv にページを持つ画面。 */
const SCREENS: readonly { key: ScreenKey; label: string; settingName: string; pages: boolean }[] = [
  { key: "opening", label: "オープニング", settingName: "opening-screen-settings", pages: true },
  { key: "description", label: "説明", settingName: "description-screen-settings", pages: true },
  { key: "demo", label: "デモ抽選", settingName: "demo-screen-settings", pages: false },
  { key: "main", label: "本抽選", settingName: "main-screen-settings", pages: false },
  { key: "result", label: "最終結果", settingName: "result-screen-settings", pages: false },
  { key: "ending", label: "エンディング", settingName: "ending-screen-settings", pages: true },
];
const PAGE_SCREEN_LABELS = SCREENS.filter((s) => s.pages).map((s) => s.label);

/** 画面ごとに使う screens.csv の列(キー)。それ以外の列は空欄。 */
const COLUMNS_OF: Readonly<Record<ScreenKey, readonly string[]>> = {
  opening: ["bgm"],
  description: ["bgm"],
  ending: ["bgm"],
  result: ["bgm"],
  demo: ["bgm", "demoDraw", "demoRounds"],
  main: ["memberBgms", "memberResultBgms", "prizeBgms", "memberStopSec", "prizeStopSec", "participantStop", "kakuhenMode", "kakuhenTimings"],
};
const COLUMN_LABEL = new Map(SCREEN_HEADERS.map((h) => [h.key, h.label] as const));

/** 決まった語(表に書く日本語)。 */
export const DEMO_DRAW_ON = "あり";
export const DEMO_DRAW_OFF = "なし";
export const PARTICIPANT_STOP_ON = "可";
export const PARTICIPANT_STOP_OFF = "不可";
export const KAKUHEN_AUTO = "おまかせ";
export const KAKUHEN_NONE = "なし";
export const KAKUHEN_FIXED = "回を指定";
export const MEMBER_BGM_SEPARATOR = ";";
/** 抽選BGM(メンバー・景品それぞれ)に設定できる曲数(管理画面と同じ)。 */
export const MAX_LOTTERY_BGMS = 3;

/** 値の照合用の形(NFKC・前後の空白・小文字)。 */
const norm = (s: string | undefined): string => (s ?? "").normalize("NFKC").trim().toLowerCase();
const same = (a: string | undefined, b: string): boolean => norm(a) === norm(b);
const isBlank = (s: string | undefined): boolean => (s ?? "").trim() === "";

/** 保存されている画面の設定(1画面分)。JSON でなければ空。 */
function parseValue(record: ScreenSettingRecord): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(record.settingValue);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 画面設定の表(2つ)。`pages` が null は、pages.csv を渡していない(ページはいまのまま)。 */
export interface ScreenTables {
  screens: Row[];
  pages: Row[] | null;
}

/** 画面の設定を、2つの表の行にする。設定が無い画面は行が無い。同じ設定は同じ行になる(取り込みの「変更なし」の判定に使う)。 */
export function screensToTables(records: readonly ScreenSettingRecord[]): { screens: Row[]; pages: Row[] } {
  const screens: Row[] = [];
  const pages: Row[] = [];
  for (const screen of SCREENS) {
    const record = records.find((r) => r.settingName === screen.settingName);
    if (!record) continue;
    const v = parseValue(record);
    const row: Row = { screen: screen.label };
    switch (screen.key) {
      case "demo": {
        const demo = parseDemoDrawSettings(v);
        Object.assign(row, { bgm: demo.bgm, demoDraw: demo.enabled ? DEMO_DRAW_ON : DEMO_DRAW_OFF, demoRounds: String(demo.rounds) });
        break;
      }
      case "result":
        row.bgm = str(v.resultBgm);
        break;
      case "main": {
        const plan = parseKakuhenPlan(v);
        const namesOf = (list: unknown): string => (Array.isArray(list) ? list : []).filter((n): n is string => typeof n === "string" && n !== "").join(MEMBER_BGM_SEPARATOR);
        row.memberBgms = namesOf(v.memberLotteryBgms);
        row.memberResultBgms = namesOf(v.memberResultBgms);
        row.prizeBgms = namesOf(v.prizeLotteryBgms);
        row.memberStopSec = String(clampMemberStopSec(v.memberStopSec));
        row.prizeStopSec = String(clampPrizeStopSec(v.prizeStopSec));
        row.participantStop = parseParticipantStop(v) ? PARTICIPANT_STOP_ON : PARTICIPANT_STOP_OFF;
        row.kakuhenMode = plan.mode === "auto" ? KAKUHEN_AUTO : plan.mode === "none" ? KAKUHEN_NONE : KAKUHEN_FIXED;
        row.kakuhenTimings = plan.mode === "fixed" ? plan.fixedTimings.join(", ") : "";
        break;
      }
      case "description": {
        const description = parseDescriptionSettings(v);
        row.bgm = description.bgm;
        for (const page of description.pages) {
          pages.push({ screen: screen.label, kind: page.kind, text: page.kind === "テキスト" ? page.text ?? "" : "", image: page.kind === "画像" ? page.image ?? "" : "" });
        }
        break;
      }
      default: {
        const sequence = parseSequenceSettings(v);
        row.bgm = sequence.bgm;
        for (const item of sequence.items) {
          pages.push({
            screen: screen.label,
            kind: item.kind,
            text: item.kind === "テキスト" ? item.text ?? "" : "",
            image: item.kind === "画像" ? item.image ?? "" : "",
            effect: item.effect,
            seconds: String(item.seconds),
            lines: item.effect === "行送り" ? String(item.lines ?? DEFAULT_SEQUENCE_LINES) : "",
            se: item.se ?? "",
            name: item.name ?? "",
          });
        }
      }
    }
    screens.push(row);
  }
  return { screens, pages };
}

export interface TablesToScreensOptions {
  /** 使える素材の名前(いま登録されているものと、取込で選ばれたファイル)。 */
  available: ReadonlySet<string>;
  /** 素材の名前から MIME。分からなければ空。 */
  mimeOf: (name: string) => string;
  /** いま保存されている画面の設定(pages.csv だけの画面の BGM や、pages.csv を渡さないときのページを引き継ぐ)。 */
  current: readonly ScreenSettingRecord[];
  /** 確変対応ありの景品の数(回を指定したときの、回数との不一致の警告に使う)。 */
  kakuhenPrizeCount: number;
}

export interface ScreenImport {
  /** screens.csv の行ごとの、属する画面の保存先の項目名(エラーの行は null)。 */
  screenTargets: (string | null)[];
  /** pages.csv の行ごとの、属する画面の保存先の項目名(エラーの行は null)。 */
  pageTargets: (string | null)[];
  /** 行ごとのエラー文(エラーが無ければ null)。 */
  screenErrors: (string | null)[];
  pageErrors: (string | null)[];
  /** 行ごとの警告文(取り込めるが、確認してほしいこと)。screens.csv の行だけ。 */
  screenWarnings: (string | null)[];
  /** ファイルに出てくる画面の設定(エラーが無いときだけ意味がある)。 */
  records: ScreenSettingRecord[];
}

/** 2つの表の行を、画面の設定に戻す。ファイルに出てくる画面だけを作る(置き換えの単位は、このファイルの冒頭の説明)。エラーは行ごとに返す。 */
export function tablesToScreens(tables: ScreenTables, options: TablesToScreensOptions): ScreenImport {
  const { screens: screenRows, pages: pageRows } = tables;
  const screenErrors: (string | null)[] = screenRows.map(() => null);
  const screenWarnings: (string | null)[] = screenRows.map(() => null);
  const screenTargets: (string | null)[] = screenRows.map(() => null);
  const pageList = pageRows ?? [];
  const pageErrors: (string | null)[] = pageList.map(() => null);
  const pageTargets: (string | null)[] = pageList.map(() => null);
  const failScreen = (i: number, message: string): void => {
    screenErrors[i] ??= message;
  };
  const failPage = (i: number, message: string): void => {
    pageErrors[i] ??= message;
  };

  /** 素材のセルの検査。使えれば名前(空は空)、使えなければ(呼び出し側がエラーを書くので)空。 */
  const mediaCell = (cell: string | undefined, label: string, kind: "audio" | "image", fail: (m: string) => void): string => {
    const name = (cell ?? "").trim();
    if (!name) return "";
    if (!options.available.has(name)) {
      fail(`${label}「${name}」が見つかりません(素材フォルダか ZIP の media/ に入れてください)`);
      return "";
    }
    const mime = options.mimeOf(name) || mimeOfName(name);
    if (!mime.startsWith(`${kind}/`)) fail(`${label}「${name}」は${kind === "audio" ? "音" : "画像"}ではありません`);
    return name;
  };

  const current = new Map(options.current.map((r) => [r.settingName, parseValue(r)] as const));

  // --- screens.csv: 画面ごとに1行
  const screenRowOf = new Map<ScreenKey, number>();
  const parsedScreen = new Map<ScreenKey, Record<string, unknown>>();
  screenRows.forEach((row, i) => {
    const screen = SCREENS.find((s) => same(s.label, row.screen));
    if (!screen) return failScreen(i, `画面は ${SCREENS.map((s) => s.label).join("・")} のどれかです: ${row.screen ?? ""}`);
    screenTargets[i] = screen.settingName;
    const first = screenRowOf.get(screen.key);
    if (first !== undefined) return failScreen(i, `「${screen.label}」が ${first + 1} 行目と重複しています(1画面1行です)`);
    screenRowOf.set(screen.key, i);

    // 使わない列は空欄
    const used = COLUMNS_OF[screen.key];
    for (const header of SCREEN_HEADERS) {
      if (header.key === "screen" || used.includes(header.key) || isBlank(row[header.key])) continue;
      failScreen(i, `「${screen.label}」では「${COLUMN_LABEL.get(header.key)}」は使いません(空欄にしてください): ${row[header.key]}`);
    }
    const bgm = used.includes("bgm") ? mediaCell(row.bgm, "BGM", "audio", (m) => failScreen(i, m)) : "";

    switch (screen.key) {
      case "demo": {
        let enabled = true;
        if (!isBlank(row.demoDraw)) {
          if (same(row.demoDraw, DEMO_DRAW_ON)) enabled = true;
          else if (same(row.demoDraw, DEMO_DRAW_OFF)) enabled = false;
          else failScreen(i, `デモ抽選は ${DEMO_DRAW_ON}・${DEMO_DRAW_OFF} のどちらかです: ${row.demoDraw}`);
        }
        let rounds = MIN_DEMO_ROUNDS;
        if (!isBlank(row.demoRounds)) {
          const n = Number(norm(row.demoRounds));
          if (!Number.isInteger(n) || n < MIN_DEMO_ROUNDS || n > MAX_DEMO_ROUNDS) failScreen(i, `デモ回数は${MIN_DEMO_ROUNDS}〜${MAX_DEMO_ROUNDS}の整数です: ${row.demoRounds}`);
          else rounds = n;
        }
        parsedScreen.set("demo", { enabled, rounds, bgm });
        break;
      }
      case "main": {
        const bgmList = (text: string | undefined, label: string, max: number): string[] => {
          const names = (text ?? "").split(MEMBER_BGM_SEPARATOR).map((n) => n.trim());
          const list: string[] = [];
          names.forEach((n, k) => {
            if (n === "") {
              if (names.length > 1 || k > 0) failScreen(i, `${label} に空の名前があります(${MEMBER_BGM_SEPARATOR} で区切って並べます): ${text}`);
              return;
            }
            const name = mediaCell(n, label, "audio", (m) => failScreen(i, m));
            if (name) list.push(name);
          });
          if (list.length > max) failScreen(i, `${label} は${max}つまでです(${list.length}つ書かれています): ${text}`);
          return list;
        };
        const memberLotteryBgms = bgmList(row.memberBgms, "メンバー抽選BGM", MAX_LOTTERY_BGMS);
        const memberResultBgms = bgmList(row.memberResultBgms, "メンバー結果BGM", MAX_LOTTERY_BGMS);
        const prizeLotteryBgms = bgmList(row.prizeBgms, "景品抽選BGM", MAX_LOTTERY_BGMS);
        const stopSecOf = (text: string | undefined, label: string, fallback: number): number => {
          if (isBlank(text)) return fallback;
          const n = Number(norm(text));
          if (!Number.isFinite(n) || n < MIN_STOP_SEC || n > MAX_STOP_SEC) {
            failScreen(i, `${label}は${MIN_STOP_SEC}〜${MAX_STOP_SEC}の数(秒)です: ${text}`);
            return fallback;
          }
          return clampPrizeStopSec(n);
        };
        const memberStopSec = stopSecOf(row.memberStopSec, "メンバー停止秒", DEFAULT_MEMBER_STOP_SEC);
        const prizeStopSec = stopSecOf(row.prizeStopSec, "景品停止秒", DEFAULT_PRIZE_STOP_SEC);
        let participantStop = DEFAULT_PARTICIPANT_STOP;
        if (!isBlank(row.participantStop)) {
          if (same(row.participantStop, PARTICIPANT_STOP_ON)) participantStop = true;
          else if (same(row.participantStop, PARTICIPANT_STOP_OFF)) participantStop = false;
          else failScreen(i, `参加者の停止は ${PARTICIPANT_STOP_ON}・${PARTICIPANT_STOP_OFF} のどちらかです: ${row.participantStop}`);
        }
        // 確変の決め方 と 確変の回
        let mode: "auto" | "none" | "fixed" = "auto";
        if (!isBlank(row.kakuhenMode)) {
          if (same(row.kakuhenMode, KAKUHEN_AUTO)) mode = "auto";
          else if (same(row.kakuhenMode, KAKUHEN_NONE)) mode = "none";
          else if (same(row.kakuhenMode, KAKUHEN_FIXED)) mode = "fixed";
          else failScreen(i, `確変の決め方は ${KAKUHEN_AUTO}・${KAKUHEN_NONE}・${KAKUHEN_FIXED} のどれかです: ${row.kakuhenMode}`);
        }
        let timings: number[] = [];
        if (mode === "fixed") {
          const text = row.kakuhenTimings ?? "";
          timings = parseTimingsText(text);
          const count = text.split(/[,、\s]+/).filter(Boolean).length;
          if (isBlank(text)) failScreen(i, `確変の決め方が「${KAKUHEN_FIXED}」のときは、確変の回を「3, 7」のように書いてください`);
          else if (timings.length === 0 || count !== timings.length) failScreen(i, `確変の回は「3, 7」のような回の並びです(1以上の整数、重複なし): ${text}`);
          else {
            const warning = kakuhenCountWarning(timings.length, options.kakuhenPrizeCount);
            if (warning) screenWarnings[i] = `注意: ${warning}`;
          }
        } else if (!isBlank(row.kakuhenTimings)) {
          failScreen(i, `確変の回は、確変の決め方が「${KAKUHEN_FIXED}」のときだけ書けます(いまは「${mode === "auto" ? KAKUHEN_AUTO : KAKUHEN_NONE}」): ${row.kakuhenTimings}`);
        }
        parsedScreen.set("main", { memberLotteryBgms, memberResultBgms, prizeLotteryBgms, kakuhenMode: mode, kakuhenFixedTimings: timings, memberStopSec, prizeStopSec, participantStop });
        break;
      }
      case "result":
        parsedScreen.set("result", { resultBgm: bgm });
        break;
      default:
        parsedScreen.set(screen.key, { bgm });
    }
  });

  // --- pages.csv: オープニング・説明・エンディングのページ(行の順)
  const pagesOf = new Map<ScreenKey, Record<string, unknown>[]>();
  const pageRowCount = new Map<ScreenKey, number>();
  pageList.forEach((row, i) => {
    const screen = SCREENS.find((s) => s.pages && same(s.label, row.screen));
    if (!screen) return failPage(i, `pages.csv の画面は ${PAGE_SCREEN_LABELS.join("・")} のどれかです: ${row.screen ?? ""}`);
    pageTargets[i] = screen.settingName;
    pageRowCount.set(screen.key, (pageRowCount.get(screen.key) ?? 0) + 1);
    const list = pagesOf.get(screen.key) ?? [];
    pagesOf.set(screen.key, list);

    const kind = isBlank(row.kind) ? undefined : (SEQUENCE_KINDS as readonly string[]).find((k) => same(k, row.kind));
    if (!kind) return failPage(i, row.kind ? `種類は ${SEQUENCE_KINDS.join("・")} のどちらかです: ${row.kind}` : "種類が空です");
    const isDescription = screen.key === "description";

    // 種類に合う列だけを使う
    if (kind === "テキスト") {
      if (isBlank(row.text)) failPage(i, "テキストの文字が空です");
      if (!isBlank(row.image)) failPage(i, `種類がテキストのときは、画像は空欄にしてください: ${row.image}`);
    } else {
      if (isBlank(row.image)) failPage(i, "画像の素材が空です");
      if (!isBlank(row.text)) failPage(i, `種類が画像のときは、文字は空欄にしてください: ${row.text}`);
    }
    const image = kind === "画像" ? mediaCell(row.image, "画像", "image", (m) => failPage(i, m)) : "";

    if (isDescription) {
      // 説明は1ページずつ手で送る。効果・秒数・行数・効果音は持たない
      for (const [key, label] of [["effect", "効果"], ["seconds", "秒数"], ["lines", "行数"], ["se", "効果音"]] as const) {
        if (!isBlank(row[key])) failPage(i, `説明のページには、効果・秒数・行数・効果音は入れられません(1ページずつ手で送ります): ${label}「${row[key]}」`);
      }
      list.push(kind === "画像" ? { kind, image } : { kind, text: row.text ?? "" });
      return;
    }

    const effect = isBlank(row.effect) ? "フェード" : (SEQUENCE_EFFECTS as readonly string[]).find((e) => same(e, row.effect));
    if (!effect) return failPage(i, `効果は ${SEQUENCE_EFFECTS.join("・")} のどれかです: ${row.effect}`);
    if (effect === "行送り" && kind !== "テキスト") return failPage(i, "行送りはテキストだけで使えます");
    let seconds = DEFAULT_SEQUENCE_SECONDS;
    if (!isBlank(row.seconds)) {
      const sec = Number(norm(row.seconds));
      if (!Number.isFinite(sec) || sec <= 0) return failPage(i, `秒数は0より大きい数(秒)です: ${row.seconds}`);
      seconds = sec;
    }
    const item: Record<string, unknown> = { kind, effect, seconds };
    if (effect === "行送り") {
      const n = isBlank(row.lines) ? DEFAULT_SEQUENCE_LINES : Number(norm(row.lines));
      if (!Number.isInteger(n) || n < 1) return failPage(i, `行数は1以上の整数です: ${row.lines}`);
      item.lines = clampLines(n);
    } else if (!isBlank(row.lines)) {
      return failPage(i, `行数は、効果が 行送り のときだけ入れられます: ${row.lines}`);
    }
    if (kind === "テキスト") item.text = row.text ?? "";
    else item.image = image;
    const se = mediaCell(row.se, "効果音", "audio", (m) => failPage(i, m));
    if (se) item.se = se;
    if (!isBlank(row.name)) item.name = (row.name ?? "").trim();
    list.push(item);
  });

  // --- 画面ごとに設定を作る(ファイルに出てくる画面だけ)
  const records: ScreenSettingRecord[] = [];
  for (const screen of SCREENS) {
    const fromScreens = parsedScreen.get(screen.key);
    const hasPages = screen.pages && (pageRowCount.get(screen.key) ?? 0) > 0;
    if (!fromScreens && !hasPages) continue;
    const existing = current.get(screen.settingName) ?? {};
    let value: Record<string, unknown>;
    if (!screen.pages) {
      value = fromScreens ?? {};
    } else {
      const bgm = fromScreens ? str(fromScreens.bgm) : str(existing.bgm);
      // pages.csv を渡したときは、ファイルに出てくる画面のページを置き換える。渡さなければ、いまのまま
      const replacePages = pageRows !== null;
      const pages = replacePages ? pagesOf.get(screen.key) ?? [] : screen.key === "description" ? parseDescriptionSettings(existing).pages : parseSequenceSettings(existing).items;
      value = screen.key === "description" ? { bgm, pages } : { bgm, items: pages };
    }
    records.push({ screenName: screen.key, settingName: screen.settingName, settingValue: JSON.stringify(value) });
  }
  return { screenTargets, pageTargets, screenErrors, pageErrors, screenWarnings, records };
}

/** 保存先の項目名(`opening-screen-settings` など)から、画面の呼び名。 */
export const screenLabelOf = (settingName: string): string => SCREENS.find((s) => s.settingName === settingName)?.label ?? settingName;

/** 行を比べるための文字列(列の順に並べた値)。 */
export const rowText = (headers: readonly Header[], row: Row): string => JSON.stringify(headers.map((h) => row[h.key] ?? ""));

/** 表の行が参照している素材の名前(重複なし)。BGM・メンバー抽選BGM・メンバー結果BGM・景品抽選BGM・画像・効果音。 */
export function mediaNamesOf(tables: { screens: readonly Row[]; pages: readonly Row[] | null }): string[] {
  const names = new Set<string>();
  for (const r of tables.screens) {
    if (r.bgm) names.add(r.bgm.trim());
    for (const n of `${r.memberBgms ?? ""}${MEMBER_BGM_SEPARATOR}${r.memberResultBgms ?? ""}${MEMBER_BGM_SEPARATOR}${r.prizeBgms ?? ""}`.split(MEMBER_BGM_SEPARATOR)) if (n.trim()) names.add(n.trim());
  }
  for (const r of tables.pages ?? []) {
    if (r.image) names.add(r.image.trim());
    if (r.se) names.add(r.se.trim());
  }
  return [...names];
}
