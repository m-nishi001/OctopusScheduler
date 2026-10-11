import type { ConnectionPhase, HubErrorCode } from "@octopus/session-hub";

/**
 * ポータルの接続状態(画面に出す粒度)。
 *   joining      : 入室中(初回)
 *   connected    : 接続中
 *   reconnecting : 通信が一時的に不安定。最後に受け取った内容は表示し続ける
 *   waiting      : いま参加できるイベント(公開中のセッション)が無い
 *   ended        : 参加していたセッションが終了した
 *   error        : 入室できなかった(通信失敗・認証切れなど)
 */
export type PortalStatus = "joining" | "connected" | "reconnecting" | "waiting" | "ended" | "error";

export interface JoinFailure {
  code: HubErrorCode | null;
  message: string;
}

export interface StatusInput {
  phase: ConnectionPhase;
  /** 入室の呼び出し中か。 */
  joining: boolean;
  /** 直近の入室の失敗。成功したら null。 */
  failure: JoinFailure | null;
}

export function derivePortalStatus({ phase, joining, failure }: StatusInput): PortalStatus {
  if (phase === "connected") return "connected";
  if (phase === "reconnecting") return "reconnecting";
  if (joining) return "joining";
  if (phase === "ended") return "ended";
  if (failure) return failure.code === "SESSION_NOT_FOUND" ? "waiting" : "error";
  if (phase === "unauthorized") return "error";
  return "joining";
}

/** 画面に出す、状態ごとの短い案内。 */
export function statusMessage(status: PortalStatus, failure: JoinFailure | null): string {
  switch (status) {
    case "joining":
      return "接続しています…";
    case "connected":
      return "接続中";
    case "reconnecting":
      return "通信が不安定です。つなぎ直しています…";
    case "waiting":
      return "いま参加できるイベントはありません。開催されるとここに表示されます。";
    case "ended":
      return "イベントは終了しました。";
    case "error":
      return failure?.message ? failure.message : "接続できませんでした。";
  }
}
