/**
 * ジャックポット画面設定の表(CSV)への対応。画面設定は「画面ごとに1件の JSON」だが、表では1行に1つの設定(または1つのコンテンツ)にする。
 * 画面の設定を表の行にする {@link screensToRows} と、行を画面の設定に戻す {@link rowsToScreens} は、どちらも純粋関数。
 *
 * - 列: `画面*, 項目*, 素材, 文字, 種類, 効果, 秒数, 効果音, コンテンツ名`。
 * - 画面: オープニング / 説明 / デモ抽選 / 本抽選 / 最終結果 / エンディング(管理画面の「画面設定」の並びと同じ)。
 * - 項目と使う列:
 *   - `BGM`(オープニング・説明・デモ抽選・最終結果・エンディング): 素材 = 音の素材の名前。
 *   - `抽選SE`(デモ抽選): 素材 = 音の素材の名前。
 *   - `メンバー抽選BGM`(本抽選): 素材 = 音の素材の名前。行の順に並ぶ(複数行)。
 *   - `確変の回`(本抽選): 文字 = `おまかせ` / `なし` / `3, 7`(確変にする回)。
 *   - `停止秒数`(本抽選): 文字 = 2〜15 の数(秒)。
 *   - `コンテンツ`(オープニング・説明・エンディング): 種類 = テキスト / 画像 / HTML。文字 = 本文(テキスト・HTML)、素材 = 画像、
 *     効果 = スクロール / フェード / 静止、秒数 = 表示する長さ(秒)、効果音 = 音の素材の名前、コンテンツ名 = 管理画面の表示名。行の順に出る。
 * - ファイルに出てくる画面だけを、まるごと置き換える(その画面の、ファイルに無い項目は初期値に戻る)。ファイルに出てこない画面は変えない。
 * - 素材の空のセルは「設定なし」。取り込みと書き出しは同じ形なので、書き出したものをそのまま取り込むと、全行「変更なし」になる。
 */
import type { Header, Row } from "@octopus/table-io";
import { mimeOfName, parseTable } from "@octopus/table-io";
import type { ParsedTable } from "@octopus/table-io";
import type { ScreenSettingRecord } from "../../../server/jackpot-api-contract";
import { DEFAULT_PARTICIPANT_STOP, parseParticipantStop } from "../../model/draw/participant-stop";
import { clampPrizeStopSec, DEFAULT_PRIZE_STOP_SEC, MAX_PRIZE_STOP_SEC, MIN_PRIZE_STOP_SEC } from "../../model/draw/prize-stop-sec";
import { parseKakuhenPlan, parseTimingsText } from "../../model/draw/kakuhen-plan";

export const SCREEN_CSV_NAME = "screens.csv";

export const SCREEN_HEADERS: readonly Header[] = [
  { key: "screen", label: "画面", aliases: ["screen"], required: true },
  { key: "item", label: "項目", aliases: ["item"], required: true },
  { key: "media", label: "素材", aliases: ["media"], media: true },
  { key: "text", label: "文字", aliases: ["text", "テキスト"] },
  { key: "type", label: "種類", aliases: ["type"] },
  { key: "effect", label: "効果", aliases: ["effect"] },
  { key: "seconds", label: "秒数", aliases: ["seconds", "duration"] },
  { key: "se", label: "効果音", aliases: ["se"], media: true },
  { key: "name", label: "コンテンツ名", aliases: ["コンテンツ名"] },
];

type ScreenKey = "opening" | "description" | "demo" | "main" | "result" | "ending";

/** 画面の並び(書き出しの順)と、表での呼び名、保存先の画面名・項目名。 */
const SCREENS: readonly { key: ScreenKey; label: string; settingName: string }[] = [
  { key: "opening", label: "オープニング", settingName: "opening-screen-settings" },
  { key: "description", label: "説明", settingName: "description-screen-settings" },
  { key: "demo", label: "デモ抽選", settingName: "demo-screen-settings" },
  { key: "main", label: "本抽選", settingName: "main-screen-settings" },
  { key: "result", label: "最終結果", settingName: "result-screen-settings" },
  { key: "ending", label: "エンディング", settingName: "ending-screen-settings" },
];
const SCREEN_BY_LABEL = new Map(SCREENS.map((s) => [s.label, s] as const));

const ITEM_BGM = "BGM";
const ITEM_DRAW_SE = "抽選SE";
const ITEM_MEMBER_BGM = "メンバー抽選BGM";
const ITEM_KAKUHEN = "確変の回";
const ITEM_STOP_SEC = "停止秒数";
const ITEM_PARTICIPANT_STOP = "参加者の停止";
const ITEM_CONTENT = "コンテンツ";

/** 画面ごとに使える項目。 */
const ITEMS_OF: Readonly<Record<ScreenKey, readonly string[]>> = {
  opening: [ITEM_BGM, ITEM_CONTENT],
  description: [ITEM_BGM, ITEM_CONTENT],
  ending: [ITEM_BGM, ITEM_CONTENT],
  demo: [ITEM_BGM, ITEM_DRAW_SE],
  result: [ITEM_BGM],
  main: [ITEM_MEMBER_BGM, ITEM_KAKUHEN, ITEM_STOP_SEC, ITEM_PARTICIPANT_STOP],
};

const CONTENT_TYPE_LABEL = { text: "テキスト", image: "画像", html: "HTML" } as const;
const CONTENT_EFFECT_LABEL = { scroll: "スクロール", fade: "フェード", static: "静止" } as const;
const KAKUHEN_AUTO = "おまかせ";
const KAKUHEN_NONE = "なし";
const PARTICIPANT_STOP_ON = "可";
const PARTICIPANT_STOP_OFF = "不可";

const norm = (s: string): string => s.normalize("NFKC").trim().toLowerCase();
const pick = <K extends string>(labels: Record<K, string>, cell: string): K | null =>
  (Object.keys(labels) as K[]).find((k) => norm(labels[k]) === norm(cell) || norm(k) === norm(cell)) ?? null;

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

/** 秒数のセルの書き方(ミリ秒 → 秒。余分な 0 は付けない)。 */
const secondsText = (ms: unknown): string => (typeof ms === "number" && Number.isFinite(ms) ? String(Math.round(ms) / 1000) : "");

function bgmRow(screen: string, item: string, media: unknown): Row[] {
  const name = str(media);
  return name ? [{ screen, item, media: name }] : [];
}

/** 画面の設定を、表の行にする。設定が無い画面は行が無い。同じ設定は同じ行になる(取り込みの「変更なし」の判定に使う)。 */
export function screensToRows(records: readonly ScreenSettingRecord[]): Row[] {
  const rows: Row[] = [];
  for (const screen of SCREENS) {
    const record = records.find((r) => r.settingName === screen.settingName);
    if (!record) continue;
    const v = parseValue(record);
    const label = screen.label;
    switch (screen.key) {
      case "demo":
        rows.push(...bgmRow(label, ITEM_BGM, v.demoBgm), ...bgmRow(label, ITEM_DRAW_SE, v.demoDrawSe));
        break;
      case "result":
        rows.push(...bgmRow(label, ITEM_BGM, v.resultBgm));
        break;
      case "main": {
        const list = Array.isArray(v.memberLotteryBgms) ? v.memberLotteryBgms : [];
        for (const name of list) rows.push(...bgmRow(label, ITEM_MEMBER_BGM, name));
        const plan = parseKakuhenPlan(v);
        const text = plan.mode === "auto" ? KAKUHEN_AUTO : plan.fixedTimings.length === 0 ? KAKUHEN_NONE : plan.fixedTimings.join(", ");
        rows.push({ screen: label, item: ITEM_KAKUHEN, text }, { screen: label, item: ITEM_STOP_SEC, text: String(clampPrizeStopSec(v.prizeStopSec)) },
          { screen: label, item: ITEM_PARTICIPANT_STOP, text: parseParticipantStop(v) ? PARTICIPANT_STOP_ON : PARTICIPANT_STOP_OFF });
        break;
      }
      default: {
        rows.push(...bgmRow(label, ITEM_BGM, v.bgm));
        const contents = Array.isArray(v.contents) ? (v.contents as Record<string, unknown>[]) : [];
        for (const c of contents) {
          const type = pick(CONTENT_TYPE_LABEL, str(c.type)) ?? "text";
          const effect = pick(CONTENT_EFFECT_LABEL, str(c.effect)) ?? "scroll";
          rows.push({
            screen: label,
            item: ITEM_CONTENT,
            type: CONTENT_TYPE_LABEL[type],
            text: type === "html" ? str(c.content) || str(c.text) : type === "text" ? str(c.text) || str(c.content) : "",
            media: type === "image" ? str(c.media) : "",
            effect: CONTENT_EFFECT_LABEL[effect],
            seconds: secondsText(c.duration),
            se: str(c.se),
            name: str(c.name),
          });
        }
      }
    }
  }
  return rows;
}

export interface RowsToScreensOptions {
  /** 使える素材の名前(いま登録されているものと、取込で選ばれたファイル)。 */
  available: ReadonlySet<string>;
  /** 素材の名前から MIME。分からなければ空。 */
  mimeOf: (name: string) => string;
}

export interface ScreenImport {
  /** 行ごとの、属する画面の保存先の項目名(エラーの行は null)。 */
  screenOfRow: (string | null)[];
  /** 行ごとのエラー文(エラーが無ければ null)。 */
  errors: (string | null)[];
  /** ファイルに出てくる画面の設定(エラーが無いときだけ意味がある)。 */
  records: ScreenSettingRecord[];
}

/** 表の行を、画面の設定に戻す。ファイルに出てくる画面だけを作る(その画面は、ファイルの行だけでまるごと決まる)。エラーは行ごとに返す。 */
export function rowsToScreens(rows: readonly Row[], options: RowsToScreensOptions): ScreenImport {
  const errors: (string | null)[] = rows.map(() => null);
  const screenOfRow: (string | null)[] = rows.map(() => null);
  const fail = (i: number, message: string): void => {
    errors[i] ??= message;
  };

  type Gathered = { rows: number[]; bgm?: string; singles: Map<string, number> };
  const gathered = new Map<ScreenKey, Gathered>();
  rows.forEach((row, i) => {
    const screen = SCREEN_BY_LABEL.get(row.screen ?? "") ?? SCREENS.find((s) => norm(s.label) === norm(row.screen ?? "") || s.key === norm(row.screen ?? ""));
    if (!screen) return fail(i, `画面は ${SCREENS.map((s) => s.label).join("・")} のどれかです: ${row.screen ?? ""}`);
    const item = row.item ?? "";
    if (!ITEMS_OF[screen.key].includes(item)) return fail(i, `「${screen.label}」の項目は ${ITEMS_OF[screen.key].join("・")} のどれかです: ${item}`);
    screenOfRow[i] = screen.settingName;
    const g = gathered.get(screen.key) ?? { rows: [], singles: new Map<string, number>() };
    gathered.set(screen.key, g);
    g.rows.push(i);
    if (item !== ITEM_MEMBER_BGM && item !== ITEM_CONTENT) {
      const first = g.singles.get(item);
      if (first !== undefined) return fail(i, `「${screen.label}」の「${item}」が ${first + 1} 行目と重複しています`);
      g.singles.set(item, i);
    }
  });

  /** 素材のセルの検査。使えれば名前(空は空)、使えなければエラーを書いて空。 */
  const mediaCell = (i: number, label: string, cell: string | undefined, kind: "audio" | "image"): string => {
    const name = (cell ?? "").trim();
    if (!name) return "";
    if (!options.available.has(name)) {
      fail(i, `${label}「${name}」が見つかりません(素材フォルダか ZIP の media/ に入れてください)`);
      return "";
    }
    const mime = options.mimeOf(name) || mimeOfName(name);
    if (!mime.startsWith(`${kind}/`)) fail(i, `${label}「${name}」は${kind === "audio" ? "音" : "画像"}ではありません`);
    return name;
  };

  const records: ScreenSettingRecord[] = [];
  for (const screen of SCREENS) {
    const g = gathered.get(screen.key);
    if (!g) continue;
    const cellOf = (item: string): { i: number; row: Row } | null => {
      const i = g.singles.get(item);
      return i === undefined ? null : { i, row: rows[i] };
    };
    const bgmOf = (item: string, label: string): string => {
      const at = cellOf(item);
      return at ? mediaCell(at.i, label, at.row.media, "audio") : "";
    };
    let value: Record<string, unknown>;
    switch (screen.key) {
      case "demo":
        value = { demoBgm: bgmOf(ITEM_BGM, "BGM"), demoDrawSe: bgmOf(ITEM_DRAW_SE, "抽選SE") };
        break;
      case "result":
        value = { resultBgm: bgmOf(ITEM_BGM, "BGM") };
        break;
      case "main": {
        const lottery = g.rows.filter((i) => rows[i].item === ITEM_MEMBER_BGM).map((i) => mediaCell(i, "メンバー抽選BGM", rows[i].media, "audio"));
        lottery.forEach((name, k) => {
          if (!name) fail(g.rows.filter((i) => rows[i].item === ITEM_MEMBER_BGM)[k], "メンバー抽選BGM の素材が空です");
        });
        let mode: "auto" | "fixed" = "auto";
        let timings: number[] = [];
        const kakuhen = cellOf(ITEM_KAKUHEN);
        if (kakuhen) {
          const text = kakuhen.row.text ?? "";
          if (text === "" || norm(text) === norm(KAKUHEN_AUTO) || norm(text) === "auto") mode = "auto";
          else if (norm(text) === norm(KAKUHEN_NONE)) mode = "fixed";
          else {
            mode = "fixed";
            timings = parseTimingsText(text);
            if (timings.length === 0 || text.split(/[,、\s]+/).filter(Boolean).length !== timings.length) {
              fail(kakuhen.i, `確変の回は ${KAKUHEN_AUTO}・${KAKUHEN_NONE}・「3, 7」のような回の並びで入力してください(1以上の整数、重複なし): ${text}`);
            }
          }
        }
        let stop = DEFAULT_PRIZE_STOP_SEC;
        const stopAt = cellOf(ITEM_STOP_SEC);
        if (stopAt && (stopAt.row.text ?? "") !== "") {
          const n = Number(stopAt.row.text);
          if (!Number.isFinite(n) || n < MIN_PRIZE_STOP_SEC || n > MAX_PRIZE_STOP_SEC) {
            fail(stopAt.i, `停止秒数は${MIN_PRIZE_STOP_SEC}〜${MAX_PRIZE_STOP_SEC}の数(秒)で入力してください: ${stopAt.row.text}`);
          } else stop = clampPrizeStopSec(n);
        }
        let participantStop = DEFAULT_PARTICIPANT_STOP;
        const stopByAt = cellOf(ITEM_PARTICIPANT_STOP);
        if (stopByAt && (stopByAt.row.text ?? "") !== "") {
          const t = norm(stopByAt.row.text ?? "");
          if (t === norm(PARTICIPANT_STOP_ON)) participantStop = true;
          else if (t === norm(PARTICIPANT_STOP_OFF)) participantStop = false;
          else fail(stopByAt.i, `参加者の停止は ${PARTICIPANT_STOP_ON}・${PARTICIPANT_STOP_OFF} のどちらかで入力してください: ${stopByAt.row.text}`);
        }
        value = { memberLotteryBgms: lottery.filter(Boolean), kakuhenMode: mode, kakuhenFixedTimings: timings, prizeStopSec: stop, participantStop };
        break;
      }
      default: {
        const contents: Record<string, unknown>[] = [];
        for (const i of g.rows.filter((k) => rows[k].item === ITEM_CONTENT)) {
          const c = rows[i];
          const type = c.type ? pick(CONTENT_TYPE_LABEL, c.type) : null;
          if (!type) {
            fail(i, c.type ? `種類は テキスト・画像・HTML のどれかです: ${c.type}` : "コンテンツの種類が空です");
            continue;
          }
          const effect = c.effect ? pick(CONTENT_EFFECT_LABEL, c.effect) : "scroll";
          if (!effect) {
            fail(i, `効果は スクロール・フェード・静止 のどれかです: ${c.effect}`);
            continue;
          }
          let duration = 3000;
          if (c.seconds) {
            const sec = Number(c.seconds);
            if (!Number.isFinite(sec) || sec <= 0) {
              fail(i, `秒数は0より大きい数(秒)で入力してください: ${c.seconds}`);
              continue;
            }
            duration = Math.round(sec * 1000);
          }
          const content: Record<string, unknown> = { type, effect, duration };
          if (c.name) content.name = c.name;
          if (type === "text") {
            if (!c.text) fail(i, "テキストの文字が空です");
            content.text = c.text ?? "";
          } else if (type === "html") {
            if (!c.text) fail(i, "HTML の文字が空です");
            content.content = c.text ?? "";
          } else {
            const media = mediaCell(i, "画像", c.media, "image");
            if (!c.media) fail(i, "画像の素材が空です");
            content.media = media;
          }
          const se = mediaCell(i, "効果音", c.se, "audio");
          if (se) content.se = se;
          contents.push(content);
        }
        value = { bgm: bgmOf(ITEM_BGM, "BGM"), contents };
      }
    }
    records.push({ screenName: screen.key, settingName: screen.settingName, settingValue: JSON.stringify(value) });
  }
  return { screenOfRow, errors, records };
}

/** 保存先の項目名(`opening-screen-settings` など)から、画面の呼び名。 */
export const screenLabelOf = (settingName: string): string => SCREENS.find((s) => s.settingName === settingName)?.label ?? settingName;

/** CSV を読んで行にする。 */
export function parseScreenCsv(bytes: Uint8Array): ParsedTable {
  return parseTable(bytes, SCREEN_HEADERS);
}

/** 行を比べるための文字列(列の順に並べた値)。 */
export const rowText = (row: Row): string => JSON.stringify(SCREEN_HEADERS.map((h) => row[h.key] ?? ""));
