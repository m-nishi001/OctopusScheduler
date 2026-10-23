/**
 * セッション(ホスト/管理/参加者)へ公開するクイズの状態。
 *
 * ホスト端末が権威で、管理端末のコンソールと参加者のポータルがこれを表示する。
 * 正解は「正解発表」の画面になるまで公開しない(参加者のスマホに先に答えを渡さない)。
 * RoomState の上限(約6KB)に収まるよう、問題文・選択肢の文字は切り詰める。
 */
import type { QuizSessionScope } from "../../server/quiz-api-contract";

export type QuizHostPage = "intro" | "entry" | "play" | "answer" | "result";
export type QuizAnswerPhase = "idle" | "answering" | "closed";
/**
 * 順位発表(result)の進み具合。会場の発表が終わるまで、参加者のスマホに順位を出さないための印。
 *   revealing: 発表中(順位は会場の画面だけ) / finished: 1位の発表まで終わり、結果の保存も済んだ
 */
export type QuizRevealPhase = "revealing" | "finished";

export interface QuizHostOption {
  no: number;
  text: string;
  color: string;
}

export interface QuizHostState {
  page: QuizHostPage;
  quizId: string;
  title: string;
  /** 回答ラウンドの識別子。参加者はこのキーで回答する。出題画面でのみ入る。 */
  roundKey: string | null;
  /** 回答受付の締切(サーバ時刻 ms)。受付中のみ。 */
  deadlineMs: number | null;
  phase: QuizAnswerPhase;
  /** 出題中だけ入る問題文と選択肢。 */
  question: string | null;
  options: QuizHostOption[];
  /** 正解発表の画面(answer / result)になってから入る。 */
  correctNo: number | null;
  /** 順位発表(result)の画面でだけ入る。それ以外は null。 */
  reveal: QuizRevealPhase | null;
}

const MAX_QUESTION = 300;
const MAX_TITLE = 100;
const MAX_OPTION_TEXT = 100;

const ROUND_KEY_MAX = 80;
const EVENT_PART_MAX = 36;
const sanitizeKeyPart = (text: string): string => text.replace(/[^A-Za-z0-9_-]/g, "_");

/**
 * 回答ラウンドのキー。同じクイズ・同じ区分(本番/デモ)・同じイベントなら同じキーなので、ホストのリロードで続きになる。
 * イベント中はイベントIDを含め、同じクイズを別のイベントで出し直したときは別のラウンド(未回答)にする。
 */
export function roundKeyFor(quizId: string, scope: QuizSessionScope, eventId?: string | null): string {
  const eventPart = eventId ? `:${sanitizeKeyPart(eventId).slice(0, EVENT_PART_MAX)}` : "";
  const tail = `:${scope}${eventPart}`;
  return sanitizeKeyPart(quizId).slice(0, ROUND_KEY_MAX - tail.length) + tail;
}

const clip = (text: string | undefined | null, max: number): string => (text ?? "").slice(0, max);

/** ホストが公開するクイズ画面の状態を作る。参加者のポータルが、問題・選択肢・残り時間を表示するのに使う。 */
export function buildQuizHostState(input: {
  page: QuizHostPage;
  quizId: string;
  title?: string | null;
  roundKey?: string | null;
  deadlineMs?: number | null;
  phase?: QuizAnswerPhase;
  question?: string | null;
  options?: Array<{ no: number; text: string; color?: string }>;
  correctNo?: number | null;
  reveal?: QuizRevealPhase | null;
}): QuizHostState {
  const showQuestion = input.page === "play" || input.page === "answer";
  return {
    page: input.page,
    quizId: input.quizId,
    title: clip(input.title, MAX_TITLE),
    roundKey: input.roundKey ?? null,
    deadlineMs: input.phase === "answering" ? input.deadlineMs ?? null : null,
    phase: input.phase ?? "idle",
    question: showQuestion && input.question ? clip(input.question, MAX_QUESTION) : null,
    options: showQuestion
      ? (input.options ?? []).map((o) => ({ no: o.no, text: clip(o.text, MAX_OPTION_TEXT), color: o.color ?? "" }))
      : [],
    correctNo: input.page === "answer" || input.page === "result" ? input.correctNo ?? null : null,
    reveal: input.page === "result" ? input.reveal ?? "revealing" : null,
  };
}
