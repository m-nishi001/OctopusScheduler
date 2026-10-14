/**
 * 参加者ポータルに出す「イベント」(イベント発生中のお知らせ)。
 *
 * 管理端末が `event.start` / `event.end` を送り、ホストが `event` 名前空間の状態として公開する。
 * 参加者のポータルはこの状態を見て、画面上部に「イベント発生中」を固定表示する。
 * ホスト・管理・参加者の3者が同じ定義を使う。
 */
import { ROUND_KEY_PATTERN } from "./session-types";

export const PORTAL_EVENT_NS = "event";
export const PORTAL_EVENT_START = "start";
export const PORTAL_EVENT_END = "end";
/** エントリー受付を開始する（受付済みで締め切ったあとなら、回答を残したまま再開する）。 */
export const PORTAL_EVENT_OPEN_ENTRY = "openEntry";
export const PORTAL_EVENT_CLOSE_ENTRY = "closeEntry";
/** まだ一度もエントリー受付を始めていないイベントだけ、受付を開始する(クイズのエントリー画面が自動で呼ぶ)。 */
export const PORTAL_EVENT_ENSURE_ENTRY = "ensureEntry";
/** ジャックポットの抽選の対象を切り替える（全メンバー / エントリーした人だけ）。 */
export const PORTAL_EVENT_SET_POOL = "setPool";

/**
 * ジャックポットの抽選の対象。
 *   all     : 名簿の全メンバー（従来どおり）
 *   entrants: イベントにエントリーした人だけ
 */
export const DRAW_POOLS = ["all", "entrants"] as const;
export type DrawPool = (typeof DRAW_POOLS)[number];

export function parseDrawPool(value: unknown): DrawPool | null {
  return (DRAW_POOLS as readonly unknown[]).includes(value) ? (value as DrawPool) : null;
}

/** `event.setPool` のペイロードを検証する。不正なら null。 */
export function parseSetPoolPayload(payload: unknown): { mode: DrawPool } | null {
  const mode = parseDrawPool((payload as { mode?: unknown } | null)?.mode);
  return mode ? { mode } : null;
}

export const MAX_EVENT_TITLE_LENGTH = 60;

/**
 * イベントのエントリー受付。参加者は key の回答ラウンド（選択肢 ENTRY_OPTION_NO）に回答することでエントリーする。
 * 件数は含めない（エントリーのたびに全員へ配信しないため）。件数・一覧は運営端末が回答ラウンドから取得する。
 */
export interface PortalEventEntry {
  key: string;
  /** 受付中か。締め切ったあとも、エントリー済みの人の表示のために残す。 */
  open: boolean;
}

export interface PortalEvent {
  /** イベントごとの識別子(同じイベントの再配信と、新しいイベントを見分ける)。 */
  id: string;
  title: string;
  startedAtMs: number;
  /** エントリー受付を始めていれば入る。 */
  entry?: PortalEventEntry;
  /** ジャックポットの抽選の対象。省略は all。 */
  pool?: DrawPool;
}

/** エントリーの選択肢（1つだけ）。 */
export const ENTRY_OPTION_NO = 1;
export const ENTRY_OPTIONS = [{ no: ENTRY_OPTION_NO, text: "エントリー" }] as const;

/** イベントのエントリー受付に使う回答ラウンドの key。 */
export function entryRoundKey(eventId: string): string {
  return `entry:${eventId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60)}`;
}

/** 入力されたタイトルを整える。空(空白のみ)は null。 */
export function normalizeEventTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const title = raw.trim().replace(/\s+/g, " ").slice(0, MAX_EVENT_TITLE_LENGTH);
  return title || null;
}

/** `event.start` のペイロードを検証する。不正なら null。 */
export function parseEventStartPayload(payload: unknown): { title: string } | null {
  const title = normalizeEventTitle((payload as { title?: unknown } | null)?.title);
  return title ? { title } : null;
}

/**
 * 公開された状態(RoomState.data)から、いま発生中のイベントを取り出す。
 * 形が合わないものは「イベント無し」として扱う(古い/壊れた状態でポータルを壊さない)。
 */
export function readPortalEvent(data: Record<string, unknown> | null | undefined): PortalEvent | null {
  const value = data?.[PORTAL_EVENT_NS] as Partial<PortalEvent> | null | undefined;
  if (!value || typeof value !== "object") return null;
  const title = normalizeEventTitle(value.title);
  if (!title || typeof value.id !== "string" || !value.id || typeof value.startedAtMs !== "number") return null;
  const event: PortalEvent = { id: value.id, title, startedAtMs: value.startedAtMs };
  const entry = value.entry as Partial<PortalEventEntry> | null | undefined;
  // エントリーの形が合わないときは、イベントごと捨てずにエントリーだけ無いものとして扱う
  if (entry && typeof entry === "object" && typeof entry.key === "string" && ROUND_KEY_PATTERN.test(entry.key) && typeof entry.open === "boolean") {
    event.entry = { key: entry.key, open: entry.open };
  }
  const pool = parseDrawPool(value.pool);
  if (pool) event.pool = pool;
  return event;
}
