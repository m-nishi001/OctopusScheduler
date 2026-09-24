import type { SubmittedAnswer } from "../../server/quiz-api-contract";

export interface RankedResult {
  userId: string;
  displayName: string;
  isCorrect: boolean;
  timeToAnswerSec: number | null;
}

export interface RankingOptions {
  correctNo: number;
  /**
   * 回答受付が開始された時刻(ms)。この時刻より前に届いた回答は、
   * 出題前(QR表示中など)に送信された不正な回答として除外する。
   * セッションが一度も開始されていない場合は null。
   */
  acceptStartedAtMs: number | null;
  limit?: number;
}

/**
 * 参加者から届いた回答一覧から、正答者を早い順に並べたランキングを作る。
 * `acceptStartedAtMs` 未満のタイムスタンプを弾くことで、回答受付開始前に
 * 送信された回答がランキングに混入しないようにする。
 */
export function computeRanking(
  answers: SubmittedAnswer[],
  options: RankingOptions
): RankedResult[] {
  const { correctNo, acceptStartedAtMs, limit = 10 } = options;

  const validCorrectAnswers = answers.filter((answer) => {
    if (answer.optionNo !== correctNo) return false;
    if (acceptStartedAtMs !== null && answer.serverTimestampMs < acceptStartedAtMs) {
      return false;
    }
    return true;
  });

  const sorted = [...validCorrectAnswers].sort(
    (a, b) => a.serverTimestampMs - b.serverTimestampMs
  );

  const top: RankedResult[] = sorted.slice(0, limit).map((answer) => ({
    userId: answer.userId,
    displayName: answer.displayName,
    isCorrect: true,
    timeToAnswerSec:
      acceptStartedAtMs === null
        ? null
        : (answer.serverTimestampMs - acceptStartedAtMs) / 1000,
  }));

  while (top.length < limit) {
    top.push({
      userId: "",
      displayName: "正答者なし ---",
      isCorrect: false,
      timeToAnswerSec: null,
    });
  }

  return top;
}
