import type { QuizRoundResult } from "@octopus/session-hub";

/** ランキングの入力。セッション基盤の回答(RoundAnswer)をこの形に直して渡す。 */
export interface RankingAnswer {
  /** メンバーID(ゲストは端末ID)。 */
  userId: string;
  /** ログイン済みメンバーのID。端末IDで回答した人は null(累計の対象外にする)。 */
  memberId?: string | null;
  displayName: string;
  optionNo: number;
  /** 回答を受け付けたサーバ時刻(ms)。 */
  serverTimestampMs: number;
}

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
  answers: RankingAnswer[],
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

/**
 * 1ラウンドの結果(参加者ポータルの「結果」に保存する内容)を作る。画面の順位表(上位10)と違い、
 * 正解者は全員(早い順)、不正解の人は ID のみ残す。出題前に届いた回答(`openedAtMs` 未満)は数えない。
 */
export function buildQuizRoundResult(input: {
  roundKey: string;
  quizId: string;
  title: string;
  correctNo: number;
  answers: RankingAnswer[];
  openedAtMs: number | null;
  closedAtMs: number;
}): QuizRoundResult {
  const { openedAtMs } = input;
  const valid = input.answers.filter((a) => openedAtMs === null || a.serverTimestampMs >= openedAtMs);
  const correct = valid.filter((a) => a.optionNo === input.correctNo).sort((a, b) => a.serverTimestampMs - b.serverTimestampMs);
  const wrong = valid.filter((a) => a.optionNo !== input.correctNo);
  return {
    roundKey: input.roundKey,
    quizId: input.quizId,
    title: input.title,
    correctNo: input.correctNo,
    closedAtMs: input.closedAtMs,
    answeredCount: valid.length,
    correct: correct.map((a) => ({
      memberId: a.memberId ?? null,
      name: a.displayName,
      sec: openedAtMs === null ? 0 : Math.max(0, (a.serverTimestampMs - openedAtMs) / 1000),
    })),
    wrongMemberIds: wrong.flatMap((a) => (a.memberId ? [a.memberId] : [])),
  };
}
