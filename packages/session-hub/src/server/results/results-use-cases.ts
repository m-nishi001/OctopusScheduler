/**
 * 結果(クイズの順位・ジャックポットの当選履歴)の保存と取得。
 *
 * 1セッション1ファイル(`results/json/<sessionId>.json`)。Cloudflare は R2、GAS は Google Drive の JSON ファイルになる
 * (どちらも IKeyValueStorage)。書き込みはホストが演出の終わりに行う(1ラウンド・1抽選につき1回程度)ので、
 * ロックをかけた read-modify-write で足りる。
 */
import { DomainError } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import { StorageKind, StorageModule, storagePath } from "@octopus/infrastructures/compositions";
import {
  RESULTS_LIMITS,
  RESULTS_SESSION_ID_PATTERN,
  emptyResultsDoc,
  isResultsValidationError,
  parseJackpotDraw,
  parseQuizRoundResult,
  personalize,
} from "../../shared/results";
import type { JackpotDraw, QuizRoundResult, ResultsDoc, ResultsView } from "../../shared/results";
import { hubError } from "../engine/hub-error";

export interface ResultsDeps {
  storage: Pick<IKeyValueStorage, "getContentAsText" | "putText">;
  withLock: <T>(key: string, timeoutMs: number, fn: () => Promise<T> | T) => Promise<T>;
  now: () => number;
}

const LOCK_TIMEOUT_MS = 5000;

export function resultsKey(sessionId: string): string {
  if (typeof sessionId !== "string" || !RESULTS_SESSION_ID_PATTERN.test(sessionId)) {
    throw hubError("INVALID_ARGUMENT", "sessionId が不正です");
  }
  return storagePath(StorageModule.Results, StorageKind.Json, `${sessionId}.json`);
}

/**
 * 結果ファイルを読む。まだ無ければ空。**ファイルがあるのに読めない（壊れている）ときは例外にする**
 * （空として扱うと、次の保存が壊れたファイルを空で上書きし、残っていた結果が消えてしまう）。
 */
async function load(deps: ResultsDeps, key: string): Promise<ResultsDoc> {
  const text = await deps.storage.getContentAsText(key);
  if (text === null) return emptyResultsDoc();
  let doc: ResultsDoc | null = null;
  try {
    doc = JSON.parse(text) as ResultsDoc;
  } catch {
    // 下で扱う
  }
  if (!doc || doc.v !== 1 || !Array.isArray(doc.rounds) || !Array.isArray(doc.draws)) {
    throw new DomainError(`結果ファイルを読み込めませんでした（${key} が壊れている可能性があります）`);
  }
  return doc;
}

/** 内容が変わるときだけ rev を上げて保存する(同じ内容の再送で通知が走らないように)。 */
async function mutate(deps: ResultsDeps, sessionId: string, change: (doc: ResultsDoc) => ResultsDoc | null): Promise<{ rev: number }> {
  const key = resultsKey(sessionId);
  return deps.withLock(`results:${sessionId}`, LOCK_TIMEOUT_MS, async () => {
    const current = await load(deps, key);
    const next = change(structuredClone(current));
    if (next === null || JSON.stringify({ rounds: next.rounds, draws: next.draws }) === JSON.stringify({ rounds: current.rounds, draws: current.draws })) {
      return { rev: current.rev };
    }
    const saved: ResultsDoc = { ...next, v: 1, rev: current.rev + 1, updatedAtMs: deps.now() };
    await deps.storage.putText(key, JSON.stringify(saved), "application/json");
    return { rev: saved.rev };
  });
}

function parse<T>(parser: (input: unknown) => T, input: unknown): T {
  try {
    return parser(input);
  } catch (error) {
    if (isResultsValidationError(error)) throw hubError("INVALID_ARGUMENT", (error as Error).message);
    throw error;
  }
}

/**
 * クイズ1ラウンドの結果を保存する(roundKey で上書き)。
 * ホストの再読み込みで回答が空になった状態(次のラウンドが始まって前の回答が消えた後など)で書き直されても、
 * すでにある、より回答数の多い結果を壊さない。
 */
export async function putQuizResult(deps: ResultsDeps, sessionId: string, input: unknown): Promise<{ rev: number }> {
  const result = parse(parseQuizRoundResult, input);
  return mutate(deps, sessionId, (doc) => {
    const index = doc.rounds.findIndex((r) => r.roundKey === result.roundKey);
    if (index >= 0) {
      if (doc.rounds[index].answeredCount > result.answeredCount) return null;
      doc.rounds[index] = result;
    } else {
      if (doc.rounds.length >= RESULTS_LIMITS.maxRounds) throw hubError("PAYLOAD_TOO_LARGE", `結果を残せるラウンドは ${RESULTS_LIMITS.maxRounds} までです`);
      doc.rounds.push(result);
    }
    doc.rounds.sort((a: QuizRoundResult, b: QuizRoundResult) => a.closedAtMs - b.closedAtMs);
    return doc;
  });
}

/** ジャックポットの抽選結果を1件保存する(drawId で上書き)。 */
export async function putJackpotDraw(deps: ResultsDeps, sessionId: string, input: unknown): Promise<{ rev: number }> {
  const draw = parse(parseJackpotDraw, input);
  return mutate(deps, sessionId, (doc) => {
    const index = doc.draws.findIndex((d) => d.drawId === draw.drawId);
    if (index >= 0) {
      doc.draws[index] = draw;
    } else {
      if (doc.draws.length >= RESULTS_LIMITS.maxDraws) throw hubError("PAYLOAD_TOO_LARGE", `結果を残せる抽選は ${RESULTS_LIMITS.maxDraws} 件までです`);
      doc.draws.push(draw);
    }
    doc.draws.sort((a: JackpotDraw, b: JackpotDraw) => a.atMs - b.atMs);
    return doc;
  });
}

/** 抽選結果を取り消す(管理画面で結果を削除したとき)。無ければ何もしない。 */
export async function deleteJackpotDraw(deps: ResultsDeps, sessionId: string, drawId: unknown): Promise<{ rev: number }> {
  if (typeof drawId !== "string" || drawId.length === 0) throw hubError("INVALID_ARGUMENT", "drawId が不正です");
  return mutate(deps, sessionId, (doc) => {
    const next = doc.draws.filter((d) => d.drawId !== drawId);
    if (next.length === doc.draws.length) return null;
    doc.draws = next;
    return doc;
  });
}

/** そのメンバー向けに見せ方を整えた結果を返す。他のメンバーのIDは含まれない。 */
export async function getResultsFor(deps: ResultsDeps, sessionId: string, memberId: string | null): Promise<ResultsView> {
  return personalize(await load(deps, resultsKey(sessionId)), memberId);
}
