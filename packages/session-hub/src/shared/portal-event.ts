/**
 * 参加者ポータルに出す「イベント」(イベント発生中のお知らせ)。
 *
 * 管理端末が `event.start` / `event.end` を送り、ホストが `event` 名前空間の状態として公開する。
 * 参加者のポータルはこの状態を見て、画面上部に「イベント発生中」を固定表示する。
 * ホスト・管理・参加者の3者が同じ定義を使う。
 */
export const PORTAL_EVENT_NS = "event";
export const PORTAL_EVENT_START = "start";
export const PORTAL_EVENT_END = "end";

export const MAX_EVENT_TITLE_LENGTH = 60;

export interface PortalEvent {
  /** イベントごとの識別子(同じイベントの再配信と、新しいイベントを見分ける)。 */
  id: string;
  title: string;
  startedAtMs: number;
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
  return { id: value.id, title, startedAtMs: value.startedAtMs };
}
