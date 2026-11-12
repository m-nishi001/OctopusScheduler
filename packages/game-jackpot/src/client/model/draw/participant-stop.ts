/**
 * 景品抽選で、当選した参加者が自分のスマホからルーレット/スロットを止められるか。管理画面の「本抽選画面設定」で決める。
 * OFF のときは、会場の端末の物理ボタン(ホスト画面の Enter)や管理者コンソールだけで止める。
 */
export const DEFAULT_PARTICIPANT_STOP = true;

/** 保存されている画面設定（`main-screen-settings`）から取り出す。無い・boolean 以外のときは既定(止められる)。 */
export function parseParticipantStop(settings: unknown): boolean {
  if (typeof settings !== "object" || settings === null) return DEFAULT_PARTICIPANT_STOP;
  const v = (settings as { participantStop?: unknown }).participantStop;
  return typeof v === "boolean" ? v : DEFAULT_PARTICIPANT_STOP;
}
