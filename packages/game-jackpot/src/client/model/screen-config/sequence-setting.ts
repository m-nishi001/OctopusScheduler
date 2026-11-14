/**
 * オープニング・エンディング(自動で流れる画面)の設定。項目を順に出す。
 * 項目の種類は テキスト / 画像 の2つだけ(HTML は扱わない)。テキストは文字として表示する。
 * 秒数の単位はすべて「秒」。
 */
export const SEQUENCE_KINDS = ["テキスト", "画像"] as const;
export type SequenceKind = (typeof SEQUENCE_KINDS)[number];

/**
 * 効果。
 *  - 流れる: エンドロールのように、全体を下から上へ流す(秒数 = 流れ切るまでの長さ)
 *  - 行送り: `lines` 行ずつ、`seconds` 秒おきに上へ送る(テキストだけ。画像は静止と同じ)
 *  - フェード: 現れて、消える(秒数 = 現れてから消えるまでの長さ)
 *  - 静止: そのまま出す(秒数 = 出している長さ)
 */
export const SEQUENCE_EFFECTS = ["流れる", "行送り", "フェード", "静止"] as const;
export type SequenceEffect = (typeof SEQUENCE_EFFECTS)[number];

export const DEFAULT_SEQUENCE_SECONDS = 3;
export const DEFAULT_SEQUENCE_LINES = 3;
export const MIN_SEQUENCE_SECONDS = 0.1;
export const MAX_SEQUENCE_SECONDS = 600;
export const MAX_SEQUENCE_LINES = 20;

export interface SequenceItem {
  kind: SequenceKind;
  /** kind が テキスト のときの本文(改行はそのまま行になる)。 */
  text?: string;
  /** kind が 画像 のときの、画像の素材の名前。 */
  image?: string;
  effect: SequenceEffect;
  /** 秒。効果ごとの意味は {@link SEQUENCE_EFFECTS}。 */
  seconds: number;
  /** 行送りの、1回に送る行数。 */
  lines?: number;
  /** 項目の始めに鳴らす効果音の素材の名前。 */
  se?: string;
  /** 管理画面の一覧に出す名前。 */
  name?: string;
  /** 再生のとき、素材から作る表示用の URL(保存しない)。 */
  imageUrl?: string;
  /** 再生のとき、効果音の素材から作る URL(保存しない)。 */
  seUrl?: string;
}

export interface SequenceSettings {
  bgm: string;
  items: SequenceItem[];
}

export const EMPTY_SEQUENCE: SequenceSettings = { bgm: "", items: [] };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isKind = (v: unknown): v is SequenceKind => (SEQUENCE_KINDS as readonly unknown[]).includes(v);
const isEffect = (v: unknown): v is SequenceEffect => (SEQUENCE_EFFECTS as readonly unknown[]).includes(v);

/** 秒数を範囲に収める。数でない・0 以下は既定(3秒)。 */
export function clampSeconds(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return DEFAULT_SEQUENCE_SECONDS;
  return Math.min(MAX_SEQUENCE_SECONDS, Math.max(MIN_SEQUENCE_SECONDS, n));
}

/** 行数を 1〜20 の整数に収める。数でないときは既定(3行)。 */
export function clampLines(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_SEQUENCE_LINES;
  return Math.min(MAX_SEQUENCE_LINES, Math.max(1, Math.round(n)));
}

/** 1項目を保存の形にそろえる。知らない種類・効果は捨てる(null)。素材は、種類に合うものだけ残す。 */
function parseItem(raw: unknown): SequenceItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isKind(r.kind) || !isEffect(r.effect)) return null;
  const item: SequenceItem = { kind: r.kind, effect: r.effect, seconds: clampSeconds(r.seconds) };
  if (r.kind === "テキスト") item.text = str(r.text);
  else item.image = str(r.image);
  if (r.effect === "行送り") item.lines = clampLines(r.lines);
  if (str(r.se)) item.se = str(r.se);
  if (str(r.name)) item.name = str(r.name);
  return item;
}

/** 保存されている設定を読む。無い・形が違うものは空の設定、読めない項目は捨てる。 */
export function parseSequenceSettings(raw: unknown): SequenceSettings {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_SEQUENCE, items: [] };
  const r = raw as { bgm?: unknown; items?: unknown };
  const items = Array.isArray(r.items) ? r.items.map(parseItem).filter((i): i is SequenceItem => i !== null) : [];
  return { bgm: str(r.bgm), items };
}

/** 保存するときの形(再生用の URL を落とす)。 */
export function toStoredSequence(settings: SequenceSettings): SequenceSettings {
  return { bgm: settings.bgm, items: settings.items.map(({ imageUrl: _i, seUrl: _s, ...stored }) => stored) };
}

/** 新しい項目の初期値。 */
export function newSequenceItem(): SequenceItem {
  return { kind: "テキスト", text: "", effect: "フェード", seconds: DEFAULT_SEQUENCE_SECONDS, name: "" };
}
