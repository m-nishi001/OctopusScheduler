import type { ConnectionPhase } from "@octopus/session-hub";

export interface PhaseLabel {
  text: string;
  tone: "ok" | "warn" | "error" | "idle";
}

/** 接続状態の表示。再接続中や認証切れを、操作者が一目で分かる文言にする。 */
export function describePhase(phase: ConnectionPhase, failureCount = 0): PhaseLabel {
  switch (phase) {
    case "connected":
      return { text: "接続中", tone: "ok" };
    case "joining":
      return { text: "接続しています…", tone: "warn" };
    case "reconnecting":
      return { text: `再接続中(${failureCount}回失敗)`, tone: "warn" };
    case "ended":
      return { text: "セッションは終了しました", tone: "error" };
    case "unauthorized":
      return { text: "認証が切れました。入り直してください", tone: "error" };
    default:
      return { text: "未接続", tone: "idle" };
  }
}

/** 参加者に見せる「いま受け付けている操作」の表示名。未知のキーはそのまま出す。 */
export const CLIENT_INPUT_LABELS: Record<string, string> = {
  "jackpot.stopRoulette": "ルーレットを止める",
  "quiz.answer": "回答する",
};

export function clientInputLabel(key: string): string {
  return CLIENT_INPUT_LABELS[key] ?? key;
}

/** ホストの在席の表示(サーバ時刻基準の経過秒)。 */
export function describeHostPresence(
  seenAtMs: number | null,
  serverNowMs: number
): { text: string; online: boolean } {
  if (seenAtMs === null) return { text: "ホスト未接続", online: false };
  const sec = Math.max(0, Math.round((serverNowMs - seenAtMs) / 1000));
  if (sec <= 20) return { text: "ホスト接続中", online: true };
  return { text: `ホストの応答が${sec}秒途絶えています`, online: false };
}
