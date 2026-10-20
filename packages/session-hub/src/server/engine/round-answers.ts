import type { RoundAnswer } from "../../shared/protocol";

/**
 * 回答を1件、回答の一覧へ反映した結果。
 *   - inserted  : 新しく採用した
 *   - replaced  : 同じ参加者の以前の回答を、別の選択肢に置き換えた(選び直し)
 *   - unchanged : 同じ選択肢の再送。何も変えない(回答時刻も動かさない)
 *   - full      : 上限に達していて、新しい回答は受け付けられなかった
 */
export type UpsertAnswerResult =
  | { kind: "inserted" | "replaced" | "unchanged"; answer: RoundAnswer }
  | { kind: "full" };

/**
 * 同じ参加者の回答か。同じ端末、または同じメンバー(別の端末からでも1人1件)。
 */
export function isSameRespondent(existing: RoundAnswer, by: Pick<RoundAnswer, "deviceId" | "memberId">): boolean {
  if (existing.deviceId === by.deviceId) return true;
  return by.memberId !== null && existing.memberId === by.memberId;
}

/**
 * 受付中の回答を一覧へ反映する(一覧を直接書き換える)。1人1件で、選び直すと置き換わり、一覧の末尾へ移る。
 * 置き換えたときだけ回答時刻(atMs)が新しくなる = 速さの基準は「最後に選んだ時刻」。
 * 一覧は常に回答時刻の順に並ぶ。
 */
export function upsertAnswer(answers: RoundAnswer[], answer: RoundAnswer, maxAnswers: number): UpsertAnswerResult {
  const index = answers.findIndex((a) => isSameRespondent(a, answer));
  if (index >= 0) {
    const existing = answers[index];
    if (existing.no === answer.no) return { kind: "unchanged", answer: existing };
    answers.splice(index, 1);
    answers.push(answer);
    return { kind: "replaced", answer };
  }
  if (answers.length >= maxAnswers) return { kind: "full" };
  answers.push(answer);
  return { kind: "inserted", answer };
}
