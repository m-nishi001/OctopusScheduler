/**
 * ホストが公開する各機能の状態（RoomState.data の名前空間ごと）を、参加者ポータルが読む。
 *
 * ポータルはゲームのパッケージ（game-quiz / game-jackpot）に依存しないので、公開される形をここで定義し、
 * 形が合わないもの（古い・壊れた状態）は「無い」として扱う（ポータルを壊さない）。
 * 公開する側（ゲームのホスト）との形の一致は、アプリの契約テストで確かめている。
 */

import { readJackpotState } from "@octopus/session-hub";
import type { JackpotPublished } from "@octopus/session-hub";

export type QuizPage = "intro" | "entry" | "play" | "answer" | "result";
export type QuizPhase = "idle" | "answering" | "closed";

export interface QuizOption {
  no: number;
  text: string;
  color: string;
}

export interface QuizView {
  page: QuizPage;
  title: string;
  /** 回答ラウンドの識別子。出題中にだけ入る。 */
  roundKey: string | null;
  /** 回答受付の締切（サーバ時刻 ms）。受付中のみ。 */
  deadlineMs: number | null;
  phase: QuizPhase;
  question: string | null;
  options: QuizOption[];
  /** 正解発表の画面になってから入る。 */
  correctNo: number | null;
}

const QUIZ_PAGES: readonly string[] = ["intro", "entry", "play", "answer", "result"];
const QUIZ_PHASES: readonly string[] = ["idle", "answering", "closed"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const orNull = <T>(v: unknown, ok: (x: unknown) => x is T): T | null => (ok(v) ? v : null);
const isString = (v: unknown): v is string => typeof v === "string";
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 公開された状態から、いまのクイズを取り出す。無い・形が合わないときは null。 */
export function readQuizView(data: Record<string, unknown> | null | undefined): QuizView | null {
  const raw = data?.quiz;
  if (!isRecord(raw) || !QUIZ_PAGES.includes(raw.page as string)) return null;
  const phase = QUIZ_PHASES.includes(raw.phase as string) ? (raw.phase as QuizPhase) : "idle";
  const options: QuizOption[] = [];
  if (Array.isArray(raw.options)) {
    for (const o of raw.options) {
      if (isRecord(o) && Number.isInteger(o.no) && isString(o.text)) {
        options.push({ no: o.no as number, text: o.text, color: isString(o.color) ? o.color : "" });
      }
    }
  }
  return {
    page: raw.page as QuizPage,
    title: isString(raw.title) ? raw.title : "",
    roundKey: orNull(raw.roundKey, isString),
    deadlineMs: orNull(raw.deadlineMs, isFiniteNumber),
    phase,
    question: orNull(raw.question, isString),
    options,
    correctNo: orNull(raw.correctNo, isFiniteNumber),
  };
}

/** ポータルが見るジャックポットの公開状態。形と読み取りは、ホスト・管理端末と共有する定義(session-hub)。 */
export type JackpotView = Pick<JackpotPublished, "stage" | "member" | "memberId" | "prize">;

/** 公開された状態から、いまのジャックポットを取り出す。無い・形が合わないときは null。 */
export function readJackpotView(data: Record<string, unknown> | null | undefined): JackpotView | null {
  const state = readJackpotState(data);
  return state && { stage: state.stage, member: state.member, memberId: state.memberId, prize: state.prize };
}

/** 参加者に見せる「いま受け付けている操作」の表示名。未知のキーはそのまま出す。 */
export const CLIENT_INPUT_LABELS: Record<string, string> = {
  "jackpot.stopRoulette": "ルーレットを止める",
  "quiz.answer": "回答する",
};

export function clientInputLabel(key: string): string {
  return CLIENT_INPUT_LABELS[key] ?? key;
}
