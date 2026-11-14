/**
 * ジャックポット画面設定の表(CSV)への対応。画面設定は「画面ごとに1件の JSON」だが、表では1行に1つの設定(または1つのコンテンツ)にする。
 * 画面の設定を表の行にする {@link screensToRows} と、行を画面の設定に戻す {@link rowsToScreens} は、どちらも純粋関数。
 *
 * - 列: `画面*, 項目*, 素材, 文字, 種類, 効果, 秒数, 行数, 効果音, コンテンツ名`。
 * - 画面: オープニング / 説明 / デモ抽選 / 本抽選 / 最終結果 / エンディング(管理画面の「画面設定」の並びと同じ)。
 * - 項目と使う列:
 *   - `BGM`(オープニング・説明・デモ抽選・最終結果・エンディング): 素材 = 音の素材の名前。
 *   - `デモ抽選`(デモ抽選): 文字 = `あり` / `なし`(練習抽選をするか。既定は あり)。
 *   - `デモ回数`(デモ抽選): 文字 = 1〜3 の数(既定 1)。
 *   - `メンバー抽選BGM`(本抽選): 素材 = 音の素材の名前。行の順に並ぶ(複数行)。
 *   - `確変の回`(本抽選): 文字 = `おまかせ` / `なし` / `3, 7`(確変にする回)。
 *   - `停止秒数`(本抽選): 文字 = 2〜15 の数(秒)。
 *   - `コンテンツ`(オープニング・エンディング): 種類 = テキスト / 画像。文字 = 本文(テキスト)、素材 = 画像、
 *     効果 = 流れる / 行送り / フェード / 静止、秒数 = 表示する長さ(秒)、行数 = 行送りの1回に送る行数(既定 3)、効果音 = 音の素材の名前、コンテンツ名 = 管理画面の表示名。行の順に出る。
 *   - `コンテンツ`(説明): 種類 = 画像 / テキスト。文字 = 本文(テキスト)、素材 = 画像。効果・秒数・行数・効果音は入れられない(1ページずつ手で送る)。行の順に並ぶ。
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
import { clampDemoRounds, MAX_DEMO_ROUNDS, MIN_DEMO_ROUNDS, parseDemoDrawSettings } from "../../model/screen-config/demo-draw-setting";
import { parseDescriptionSettings } from "../../model/screen-config/description-setting";
import { clampLines, DEFAULT_SEQUENCE_LINES, DEFAULT_SEQUENCE_SECONDS, parseSequenceSettings, SEQUENCE_EFFECTS, SEQUENCE_KINDS } from "../../model/screen-config/sequence-setting";

export const SCREEN_CSV_NAME = "screens.csv";

export const SCREEN_HEADERS: readonly Header[] = [
  { key: "screen", label: "画面", aliases: ["screen"], required: true },
  { key: "item", label: "項目", aliases: ["item"], required: true },
  { key: "media", label: "素材", aliases: ["media"], media: true },
  { key: "text", label: "文字", aliases: ["text", "テキスト"] },
  { key: "type", label: "種類", aliases: ["type"] },
  { key: "effect", label: "効果", aliases: ["effect"] },
  { key: "seconds", label: "秒数", aliases: ["seconds", "duration"] },
  { key: "lines", label: "行数", aliases: ["lines"] },
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
const ITEM_DEMO_DRAW = "デモ抽選";
const ITEM_DEMO_ROUNDS = "デモ回数";
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
  demo: [ITEM_BGM, ITEM_DEMO_DRAW, ITEM_DEMO_ROUNDS],
  result: [ITEM_BGM],
  main: [ITEM_MEMBER_BGM, ITEM_KAKUHEN, ITEM_STOP_SEC, ITEM_PARTICIPANT_STOP],
};

const DEMO_DRAW_ON = "あり";
const DEMO_DRAW_OFF = "なし";
const DESCRIPTION_KIND_LABELS = ["画像", "テキスト"];
const KAKUHEN_AUTO = "おまかせ";
const KAKUHEN_NONE = "なし";
const PARTICIPANT_STOP_ON = "可";
const PARTICIPANT_STOP_OFF = "不可";

const norm = (s: string): string => s.normalize("NFKC").trim().toLowerCase();

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
        const demo = parseDemoDrawSettings(v);
        rows.push(
          ...bgmRow(label, ITEM_BGM, demo.bgm),
          { screen: label, item: ITEM_DEMO_DRAW, text: demo.enabled ? DEMO_DRAW_ON : DEMO_DRAW_OFF },
          { screen: label, item: ITEM_DEMO_ROUNDS, text: String(demo.rounds) }
        );
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
      case "description": {
        const description = parseDescriptionSettings(v);
        rows.push(...bgmRow(label, ITEM_BGM, description.bgm));
        for (const page of description.pages) {
          rows.push({ screen: label, item: ITEM_CONTENT, type: page.kind, text: page.kind === "テキスト" ? page.text ?? "" : "", media: page.kind === "画像" ? page.image ?? "" : "" });
        }
        break;
      }
      default: {
        const sequence = parseSequenceSettings(v);
        rows.push(...bgmRow(label, ITEM_BGM, sequence.bgm));
        for (const item of sequence.items) {
          rows.push({
            screen: label,
            item: ITEM_CONTENT,
            type: item.kind,
            text: item.kind === "テキスト" ? item.text ?? "" : "",
            media: item.kind === "画像" ? item.image ?? "" : "",
            effect: item.effect,
            seconds: String(item.seconds),
            lines: item.effect === "行送り" ? String(item.lines ?? DEFAULT_SEQUENCE_LINES) : "",
            se: item.se ?? "",
            name: item.name ?? "",
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
        let enabled = true;
        const enabledAt = cellOf(ITEM_DEMO_DRAW);
        if (enabledAt && (enabledAt.row.text ?? "") !== "") {
          const t = norm(enabledAt.row.text ?? "");
          if (t === norm(DEMO_DRAW_ON)) enabled = true;
          else if (t === norm(DEMO_DRAW_OFF)) enabled = false;
          else fail(enabledAt.i, `デモ抽選は ${DEMO_DRAW_ON}・${DEMO_DRAW_OFF} のどちらかで入力してください: ${enabledAt.row.text}`);
        }
        let rounds = 1;
        const roundsAt = cellOf(ITEM_DEMO_ROUNDS);
        if (roundsAt && (roundsAt.row.text ?? "") !== "") {
          const n = Number(roundsAt.row.text);
          if (!Number.isInteger(n) || n < MIN_DEMO_ROUNDS || n > MAX_DEMO_ROUNDS) {
            fail(roundsAt.i, `デモ回数は${MIN_DEMO_ROUNDS}〜${MAX_DEMO_ROUNDS}の整数で入力してください: ${roundsAt.row.text}`);
          } else rounds = clampDemoRounds(n);
        }
        value = { enabled, rounds, bgm: bgmOf(ITEM_BGM, "BGM") };
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
      case "description": {
        const pages: Record<string, unknown>[] = [];
        for (const i of g.rows.filter((k) => rows[k].item === ITEM_CONTENT)) {
          const c = rows[i];
          const kind = DESCRIPTION_KIND_LABELS.find((k) => norm(k) === norm(c.type ?? ""));
          if (!kind) {
            fail(i, c.type ? `説明の種類は ${DESCRIPTION_KIND_LABELS.join("・")} のどちらかです: ${c.type}` : "説明の種類が空です");
            continue;
          }
          if (c.effect || c.seconds || c.lines || c.se) {
            fail(i, "説明のページには、効果・秒数・行数・効果音は入れられません(1ページずつ手で送ります)");
            continue;
          }
          if (kind === "テキスト") {
            if (!c.text) fail(i, "テキストの文字が空です");
            pages.push({ kind, text: c.text ?? "" });
          } else {
            const image = mediaCell(i, "画像", c.media, "image");
            if (!c.media) fail(i, "画像の素材が空です");
            pages.push({ kind, image });
          }
        }
        value = { bgm: bgmOf(ITEM_BGM, "BGM"), pages };
        break;
      }
      default: {
        const items: Record<string, unknown>[] = [];
        for (const i of g.rows.filter((k) => rows[k].item === ITEM_CONTENT)) {
          const c = rows[i];
          const kind = SEQUENCE_KINDS.find((k) => norm(k) === norm(c.type ?? ""));
          if (!kind) {
            fail(i, c.type ? `種類は ${SEQUENCE_KINDS.join("・")} のどちらかです: ${c.type}` : "コンテンツの種類が空です");
            continue;
          }
          const effect = c.effect ? SEQUENCE_EFFECTS.find((e) => norm(e) === norm(c.effect ?? "")) : "フェード";
          if (!effect) {
            fail(i, `効果は ${SEQUENCE_EFFECTS.join("・")} のどれかです: ${c.effect}`);
            continue;
          }
          if (effect === "行送り" && kind !== "テキスト") {
            fail(i, "行送りはテキストだけで使えます");
            continue;
          }
          let seconds = DEFAULT_SEQUENCE_SECONDS;
          if (c.seconds) {
            const sec = Number(c.seconds);
            if (!Number.isFinite(sec) || sec <= 0) {
              fail(i, `秒数は0より大きい数(秒)で入力してください: ${c.seconds}`);
              continue;
            }
            seconds = sec;
          }
          const item: Record<string, unknown> = { kind, effect, seconds };
          if (effect === "行送り") {
            const n = c.lines ? Number(c.lines) : DEFAULT_SEQUENCE_LINES;
            if (!Number.isInteger(n) || n < 1) {
              fail(i, `行数は1以上の整数で入力してください: ${c.lines}`);
              continue;
            }
            item.lines = clampLines(n);
          } else if (c.lines) {
            fail(i, "行数は、効果が 行送り のときだけ入れられます");
            continue;
          }
          if (c.name) item.name = c.name;
          if (kind === "テキスト") {
            if (!c.text) fail(i, "テキストの文字が空です");
            item.text = c.text ?? "";
          } else {
            const image = mediaCell(i, "画像", c.media, "image");
            if (!c.media) fail(i, "画像の素材が空です");
            item.image = image;
          }
          const se = mediaCell(i, "効果音", c.se, "audio");
          if (se) item.se = se;
          items.push(item);
        }
        value = { bgm: bgmOf(ITEM_BGM, "BGM"), items };
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
