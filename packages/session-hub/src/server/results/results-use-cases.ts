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
  parseJackpotPlan,
  parseQuizRoundResult,
  personalize,
  revealedDraws,
} from "../../shared/results";
import type { JackpotDraw, JackpotDrawInput, JackpotPlan, JackpotState, QuizRoundResult, ResultsDoc, ResultsView } from "../../shared/results";
import { hubError } from "../engine/hub-error";

export interface ResultsDeps {
  storage: Pick<IKeyValueStorage, "getContentAsText" | "putText">;
  withLock: <T>(key: string, timeoutMs: number, fn: () => Promise<T> | T) => Promise<T>;
  now: () => number;
}

const LOCK_TIMEOUT_MS = 5000;

/** セッションの結果ファイルの保存先のキー。sessionId が不正(パスを含むなど)なら INVALID_ARGUMENT。 */
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
  if (!doc || doc.v !== 2 || !Array.isArray(doc.rounds) || !Array.isArray(doc.draws) || typeof doc.jackpot !== "object" || doc.jackpot === null) {
    throw new DomainError(`結果ファイルを読み込めませんでした（${key} が壊れている可能性があります）`);
  }
  return doc;
}

/**
 * ロックをかけた read-modify-write。`change` が null を返す、または結果が同じなら何も書かない。
 * rev は「ポータルに見える内容(クイズのラウンドと、公開済みの抽選)」が変わったときだけ上げる
 * (未公開の抽選の確定や確変の予定の保存では、参加者が取り直さなくて済むように rev を据え置く)。
 */
async function mutateDoc(deps: ResultsDeps, sessionId: string, change: (doc: ResultsDoc) => ResultsDoc | null): Promise<ResultsDoc> {
  const key = resultsKey(sessionId);
  return deps.withLock(`results:${sessionId}`, LOCK_TIMEOUT_MS, async () => {
    const current = await load(deps, key);
    // GAS の実行環境(V8)には structuredClone が無いので、JSON の往復で複製する(結果ファイルは JSON だけで成り立つ)。
    const next = change(JSON.parse(JSON.stringify(current)) as ResultsDoc);
    if (next === null) return current;
    const content = (d: ResultsDoc): string => JSON.stringify({ rounds: d.rounds, draws: d.draws, jackpot: d.jackpot });
    if (content(next) === content(current)) return current;
    const visible = (d: ResultsDoc): string => JSON.stringify({ rounds: d.rounds, draws: revealedDraws(d.draws) });
    const visibleChanged = visible(next) !== visible(current);
    const saved: ResultsDoc = { ...next, v: 2, rev: visibleChanged ? current.rev + 1 : current.rev, updatedAtMs: deps.now() };
    await deps.storage.putText(key, JSON.stringify(saved), "application/json");
    return saved;
  });
}

async function mutate(deps: ResultsDeps, sessionId: string, change: (doc: ResultsDoc) => ResultsDoc | null): Promise<{ rev: number }> {
  return { rev: (await mutateDoc(deps, sessionId, change)).rev };
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

const conflict = (message: string): Error => hubError("JACKPOT_CONFLICT", message);

const sameDraw = (a: JackpotDrawInput, b: JackpotDrawInput): boolean =>
  a.drawId === b.drawId && a.memberId === b.memberId && a.memberName === b.memberName && a.prizeId === b.prizeId && a.prizeName === b.prizeName && a.isKakuhen === b.isKakuhen && a.atMs === b.atMs;

/** ジャックポットの抽選状態(未公開の行を含む)。管理者向け。 */
export async function getJackpotState(deps: ResultsDeps, sessionId: string): Promise<JackpotState> {
  const doc = await load(deps, resultsKey(sessionId));
  return { rev: doc.rev, plan: doc.jackpot.plan, draws: doc.draws };
}

/** 確変の予定を、まだ無ければ保存する。すでにあれば保存済みのものを返す(並行して呼ばれても先に保存されたものが勝つ)。 */
export async function ensureJackpotPlan(deps: ResultsDeps, sessionId: string, input: unknown): Promise<{ rev: number; plan: JackpotPlan }> {
  const proposal = parse(parseJackpotPlan, input);
  const doc = await mutateDoc(deps, sessionId, (d) => {
    if (d.jackpot.plan) return null;
    d.jackpot.plan = { ...proposal, createdAtMs: deps.now() };
    return d;
  });
  return { rev: doc.rev, plan: doc.jackpot.plan as JackpotPlan };
}

/**
 * 抽選結果を未公開で確定する。ロックの中で次を検証し、矛盾すれば JACKPOT_CONFLICT。
 * 同じ drawId で中身も同じ再送は成功(何も書かない)。
 */
export async function commitJackpotDraw(deps: ResultsDeps, sessionId: string, input: unknown): Promise<{ rev: number }> {
  const draw = parse(parseJackpotDraw, input);
  return mutate(deps, sessionId, (doc) => {
    const same = doc.draws.find((d) => d.drawId === draw.drawId);
    if (same) {
      if (sameDraw(same, draw)) return null;
      throw conflict("同じ抽選IDで内容の違う結果がすでにあります");
    }
    if (doc.draws.some((d) => d.memberId === draw.memberId)) throw conflict("このメンバーはすでに当選しています");
    if (doc.draws.some((d) => d.prizeId === draw.prizeId)) throw conflict("この景品はすでに当選済みです");
    if (doc.draws.some((d) => d.revealedAtMs === null)) throw conflict("公開されていない抽選結果があります");
    // 確変の取り置きは、予定(plan)があるときだけ突き合わせる(予定が無い=取り置きの概念が無い)。
    if (doc.jackpot.plan) {
      const reserved = doc.jackpot.plan.reservedPrizeIds;
      if (draw.isKakuhen && !reserved.includes(draw.prizeId)) throw conflict("確変の抽選に、取り置いた景品以外が選ばれました");
      if (!draw.isKakuhen && reserved.includes(draw.prizeId)) throw conflict("通常の抽選に、確変のために取り置いた景品が選ばれました");
    }
    if (doc.draws.length >= RESULTS_LIMITS.maxDraws) throw hubError("PAYLOAD_TOO_LARGE", `結果を残せる抽選は ${RESULTS_LIMITS.maxDraws} 件までです`);
    doc.draws.push({ ...draw, revealedAtMs: null });
    doc.draws.sort((a: JackpotDraw, b: JackpotDraw) => a.atMs - b.atMs);
    return doc;
  });
}

/** 確定済みの抽選を公開する(ポータルに見せ、rev を進める)。公開済みなら何もしない。 */
export async function revealJackpotDraw(deps: ResultsDeps, sessionId: string, drawId: unknown): Promise<{ rev: number }> {
  if (typeof drawId !== "string" || drawId.length === 0) throw hubError("INVALID_ARGUMENT", "drawId が不正です");
  return mutate(deps, sessionId, (doc) => {
    const draw = doc.draws.find((d) => d.drawId === drawId);
    if (!draw) throw conflict("公開する抽選結果が見つかりません");
    if (draw.revealedAtMs !== null) return null;
    draw.revealedAtMs = deps.now();
    return doc;
  });
}

/** 抽選の結果と確変の予定を消す(クイズのラウンドはそのまま)。 */
export async function resetJackpot(deps: ResultsDeps, sessionId: string): Promise<{ rev: number }> {
  return mutate(deps, sessionId, (doc) => {
    doc.draws = [];
    doc.jackpot = { plan: null };
    return doc;
  });
}

/** そのメンバー向けに見せ方を整えた結果を返す。他のメンバーのIDは含まれない。 */
export async function getResultsFor(deps: ResultsDeps, sessionId: string, memberId: string | null): Promise<ResultsView> {
  return personalize(await load(deps, resultsKey(sessionId)), memberId);
}
