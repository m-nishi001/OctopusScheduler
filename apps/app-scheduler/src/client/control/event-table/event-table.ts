/**
 * 設定>イベントの表(CSV)への対応。汎用の判断(差分・往復・エラー)は `@octopus/table-io` に任せ、ここは列と検証だけを持つ。
 *
 * - 列: `ID, 種別*, 開始*, 終了*, 素材, 表示, フォルダ, 切替秒, 切替効果, フェードアウト秒, 遷移先URL`。
 *   種別に使わない列は書かず、読むときも無視する。
 * - 素材のセル: 設定>アセットの素材のファイル名。空 = いまのまま、`-` = 外す(音楽・画像・動画は素材が必要なので、外すとエラー)。
 * - スライドショーの「フォルダ」は、素材の置き場所(`directoryId`)のフォルダ名。
 */
import { resolveMediaCell } from "@octopus/table-io";
import type { Header, Row, TableAdapter } from "@octopus/table-io";
import type { AppEvent, AppEventType } from "../app-event/app-event";
import { listFolders, folderOf } from "@model/media/media-catalog";
import { classifyMedia, type MediaKind } from "@model/media/media-kind";
import { MAX_INTERVAL_SEC, MIN_INTERVAL_SEC, parseScreenSpec } from "@model/media/screen-spec";
import type { ScreenSpec } from "@model/media/screen-spec";

export const EVENT_CSV_NAME = "events.csv";

/** 切替秒の既定(追加フォームと同じ)。 */
const DEFAULT_INTERVAL_SEC = 5;

/** 素材の一覧の1件のうち、表を読み書きするのに要る分。 */
export interface EventAssetEntry {
  id: string;
  name: string;
  mime: string;
  directoryId?: string;
}

/** 設定>アセットの一覧を、名前と id で引ける形にしたもの。 */
export interface EventAssets {
  /** 名前 → 素材。同じ名前が複数あるものは入れない({@link duplicates} に入る)。 */
  byName: ReadonlyMap<string, { id: string; kind: MediaKind }>;
  byId: ReadonlyMap<string, string>;
  /** 同じ名前の素材が複数ある名前。 */
  duplicates: ReadonlySet<string>;
  /** スライドショーに使える(画像が入っている)フォルダの名前。 */
  folders: ReadonlySet<string>;
}

/** 素材の一覧(メタデータ)から、名前と id の引き当てを作る。 */
export function eventAssets(entries: readonly EventAssetEntry[]): EventAssets {
  const count = new Map<string, number>();
  for (const e of entries) count.set(e.name, (count.get(e.name) ?? 0) + 1);
  const duplicates = new Set([...count].filter(([, n]) => n > 1).map(([name]) => name));
  const unique = entries.filter((e) => !duplicates.has(e.name));
  return {
    byName: new Map(unique.map((e) => [e.name, { id: e.id, kind: classifyMedia(e.mime, e.name) }] as const)),
    byId: new Map(entries.map((e) => [e.id, e.name] as const)),
    duplicates,
    folders: new Set(
      listFolders(entries.map((e) => ({ id: e.id, name: e.name, kind: classifyMedia(e.mime, e.name), folder: folderOf(e.directoryId) })))
    ),
  };
}

const HEADERS: readonly Header[] = [
  { key: "id", label: "ID", aliases: ["イベントID"] },
  { key: "type", label: "種別", aliases: ["type", "種類"], required: true },
  { key: "start", label: "開始", aliases: ["start", "開始日時", "開始時間"], required: true },
  { key: "end", label: "終了", aliases: ["end", "終了日時", "終了時間"], required: true },
  { key: "media", label: "素材", aliases: ["media", "asset", "音源", "画像", "動画"], media: true },
  { key: "display", label: "表示", aliases: ["display", "表示するもの"] },
  { key: "folder", label: "フォルダ", aliases: ["folder"] },
  { key: "intervalSec", label: "切替秒", aliases: ["interval", "intervalsec", "1枚あたりの表示時間"] },
  { key: "transition", label: "切替効果", aliases: ["transition", "切替アクション"] },
  { key: "fadeOutSec", label: "フェードアウト秒", aliases: ["fadeout", "fadeoutsec", "フェードアウト"] },
  { key: "url", label: "遷移先URL", aliases: ["url", "遷移URL", "transitionurl"] },
];

/** 種別の表記(日本語・英語・保存形)と種別の対応。 */
const TYPE_NAMES: Record<AppEventType, readonly string[]> = {
  AudioEvent: ["音楽", "audio", "audioevent"],
  ScreenEvent: ["スクリーン", "screen", "screenevent"],
  TransitionPageEvent: ["ページ遷移", "画面遷移", "transition", "transitionpage", "transitionpageevent"],
};
const TYPE_LABEL: Record<AppEventType, string> = { AudioEvent: "音楽", ScreenEvent: "スクリーン", TransitionPageEvent: "ページ遷移" };

const DISPLAY_NAMES: Record<ScreenSpec["kind"], readonly string[]> = {
  image: ["画像", "image"],
  video: ["動画", "video"],
  slideshow: ["スライドショー", "slideshow"],
};
const DISPLAY_LABEL: Record<ScreenSpec["kind"], string> = { image: "画像", video: "動画", slideshow: "スライドショー" };

const TRANSITION_NAMES: Record<"fade" | "slide", readonly string[]> = { fade: ["フェード", "fade"], slide: ["スライド", "slide"] };
const TRANSITION_LABEL = { fade: "フェード", slide: "スライド" } as const;

const norm = (s: string): string => s.normalize("NFKC").trim().toLowerCase();
const pickName = <K extends string>(names: Record<K, readonly string[]>, cell: string): K | null =>
  (Object.keys(names) as K[]).find((k) => names[k].includes(norm(cell))) ?? null;

const pad = (n: number): string => String(n).padStart(2, "0");

/** CSV に書く日時: 端末のローカル時刻の `YYYY-MM-DD HH:mm`。 */
export const formatEventDateTime = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const DATE_TIME = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * CSV の日時を読む。`YYYY-MM-DD HH:mm`・`/` 区切り・秒つき・ISO(`T`、`Z` や時差つき)・日付だけ(0時)。
 * 時差が無ければ端末のローカル時刻。実在しない日時は null。
 */
export function parseEventDateTime(text: string): Date | null {
  const m = DATE_TIME.exec(text.normalize("NFKC").trim());
  if (!m) return null;
  const [y, mo, d, h, mi, sec] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0", m[6] ?? "0"].map(Number);
  if (m[7]) {
    const zone = m[7].toUpperCase() === "Z" ? "Z" : m[7].replace(/^([+-]\d{2}):?(\d{2})$/, "$1:$2");
    const date = new Date(`${m[1]}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(sec)}${zone}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(y, mo - 1, d, h, mi, sec);
  const valid = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date.getHours() === h && date.getMinutes() === mi;
  return valid ? date : null;
}

class RowError extends Error {}

const parseSeconds = (label: string, cell: string | undefined, fallback: number, min: number, max = Number.POSITIVE_INFINITY): number => {
  if (!cell) return fallback;
  const n = Number(cell);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new RowError(max === Number.POSITIVE_INFINITY ? `${label}は${min}以上の数で入力してください` : `${label}は${min}〜${max}の数(秒)で入力してください`);
  }
  return n;
};

/**
 * イベントの `TableAdapter`。`assets` は素材の名前と id の引き当て(書き出しでは id から名前、取込では名前から id)。
 * 取込では、これから入る素材も含めた一覧を渡す。
 */
export function eventAdapter(assets: EventAssets, now: () => Date = () => new Date()): TableAdapter<AppEvent> {
  const nameOf = (id: string): string => assets.byId.get(id) ?? id;
  const available = new Set([...assets.byName.keys(), ...assets.duplicates]);
  const KIND_LABEL: Record<MediaKind, string> = { image: "画像", video: "動画", audio: "音声", file: "ファイル" };

  /** 素材のセルを素材の id にする。`kind` に合わない種類の素材はエラー。 */
  function mediaId(label: string, cell: string | undefined, previousId: string | undefined, kind: MediaKind): string {
    const r = resolveMediaCell(cell, previousId === undefined ? undefined : nameOf(previousId), available);
    if ("missing" in r) throw new RowError(`${label}「${r.missing}」が見つかりません`);
    if (r.name === null) throw new RowError(`${label}は必須です`);
    if (assets.duplicates.has(r.name)) throw new RowError(`同名の素材が複数あります: ${r.name}`);
    const asset = assets.byName.get(r.name);
    if (!asset) throw new RowError(`${label}「${r.name}」が見つかりません`);
    if (asset.kind !== kind) throw new RowError(`${label}「${r.name}」は${KIND_LABEL[kind]}ではありません`);
    return asset.id;
  }

  function build(row: Row, existing: AppEvent | undefined): AppEvent {
    const type = pickName(TYPE_NAMES, row.type ?? "");
    if (!type) throw new RowError(row.type ? `種別は 音楽・スクリーン・ページ遷移 のどれかです: ${row.type}` : "種別が空です");
    const startTime = parseEventDateTime(row.start ?? "");
    if (!startTime) throw new RowError(row.start ? `開始の日時を読めません: ${row.start}` : "開始が空です");
    const endTime = parseEventDateTime(row.end ?? "");
    if (!endTime) throw new RowError(row.end ? `終了の日時を読めません: ${row.end}` : "終了が空です");
    if (startTime >= endTime) throw new RowError("開始が終了より後(または同じ)です");

    const timing = {
      id: row.id,
      startTime,
      endTime,
      processedAt: existing?.processedAt ?? null,
      registeredAt: existing?.registeredAt ?? now(),
      updatedAt: now(),
    };
    const before = existing?.type === type ? existing : undefined;

    switch (type) {
      case "AudioEvent": {
        const prev = before?.type === "AudioEvent" ? before : undefined;
        return {
          ...timing,
          type,
          audioId: mediaId("音源", row.media, prev?.audioId, "audio"),
          fadeOutSec: parseSeconds("フェードアウト秒", row.fadeOutSec, prev?.fadeOutSec ?? 0, 0),
        };
      }
      case "TransitionPageEvent": {
        const prev = before?.type === "TransitionPageEvent" ? before : undefined;
        const transitionUrl = row.url || prev?.transitionUrl || "";
        if (!transitionUrl) throw new RowError("遷移先URLが空です");
        return { ...timing, type, transitionUrl, fadeOutDuration: parseSeconds("フェードアウト秒", row.fadeOutSec, prev?.fadeOutDuration ?? 0, 0) };
      }
      case "ScreenEvent": {
        const prev = before?.type === "ScreenEvent" ? before.spec : undefined;
        const kind = row.display ? pickName(DISPLAY_NAMES, row.display) : (prev?.kind ?? null);
        if (!kind) throw new RowError(row.display ? `表示は 画像・動画・スライドショー のどれかです: ${row.display}` : "表示が空です");
        let candidate: unknown;
        if (kind === "slideshow") {
          const folder = row.folder || (prev?.kind === "slideshow" ? prev.folder : "");
          if (!folder) throw new RowError("フォルダが空です");
          if (!assets.folders.has(folder)) throw new RowError(`フォルダ「${folder}」が見つかりません(アセットの画像が入ったフォルダ)`);
          const transition = row.transition ? pickName(TRANSITION_NAMES, row.transition) : (prev?.kind === "slideshow" ? prev.transition : "fade");
          if (!transition) throw new RowError(`切替効果は フェード・スライド のどちらかです: ${row.transition}`);
          const intervalSec = parseSeconds("切替秒", row.intervalSec, prev?.kind === "slideshow" ? prev.intervalSec : DEFAULT_INTERVAL_SEC, MIN_INTERVAL_SEC, MAX_INTERVAL_SEC);
          candidate = { kind, folder, intervalSec, transition };
        } else {
          const previousId = prev && prev.kind !== "slideshow" ? prev.id : undefined;
          candidate = { kind, id: mediaId(kind === "image" ? "画像" : "動画", row.media, previousId, kind) };
        }
        const spec = parseScreenSpec(candidate);
        if (!spec) throw new RowError("表示の指定が正しくありません");
        return { ...timing, type, spec };
      }
    }
  }

  return {
    csvName: EVENT_CSV_NAME,
    headers: HEADERS,
    labelKey: "start",
    key: (e) => e.id,
    newKey: () => crypto.randomUUID(),
    toRow(e): Row {
      const row: Row = { id: e.id, type: TYPE_LABEL[e.type], start: formatEventDateTime(e.startTime), end: formatEventDateTime(e.endTime) };
      switch (e.type) {
        case "AudioEvent":
          row.media = nameOf(e.audioId);
          row.fadeOutSec = String(e.fadeOutSec);
          break;
        case "TransitionPageEvent":
          row.url = e.transitionUrl;
          row.fadeOutSec = String(e.fadeOutDuration ?? 0);
          break;
        case "ScreenEvent":
          row.display = DISPLAY_LABEL[e.spec.kind];
          if (e.spec.kind === "slideshow") {
            row.folder = e.spec.folder;
            row.intervalSec = String(e.spec.intervalSec);
            row.transition = TRANSITION_LABEL[e.spec.transition];
          } else {
            row.media = nameOf(e.spec.id);
          }
          break;
      }
      return row;
    },
    fromRow(row, existing) {
      try {
        return build(row, existing);
      } catch (e) {
        if (e instanceof RowError) return e.message;
        throw e;
      }
    },
  };
}
