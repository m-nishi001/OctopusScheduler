/** 回答ラウンド(開始・締切・回答・一覧)。締切の判定は常にサーバ時刻。 */
import {
  MAX_OPEN_ROUND_MS,
  MAX_ROUND_ANSWERS_KV,
  MAX_ROUND_DURATION_MS,
  MAX_ROUND_OPTIONS,
  MAX_ROUND_OPTION_TEXT,
  MIN_ROUND_DURATION_MS,
  ROUND_KEY_PATTERN,
} from "../../shared/session-types";
import type {
  CloseRoundArgs,
  GetAnswersArgs,
  GetAnswersResult,
  ListParticipantsArgs,
  ListParticipantsResult,
  OpenRoundArgs,
  OpenRoundResult,
  RoundAnswer,
  RoundSummary,
  SubmitAnswerArgs,
  SubmitAnswerResult,
} from "../../shared/protocol";
import { EMPTY_HEAD, authenticate } from "./engine-core";
import type { EngineDeps } from "./engine-core";
import { hubError } from "./hub-error";
import { isSameRespondent } from "./round-answers";
import type { StoredRound } from "./session-repo";

/** 受付中か。手動で締め切られていない かつ サーバ時刻が締切前。 */
export function isRoundOpen(round: StoredRound, now: number): boolean {
  return round.closedAtMs === null && now < round.deadlineMs;
}

/** 保存している回答ラウンドを、端末に返す要約(受付中か・締切・回答数・回答の版)にする。ラウンドが無ければ null。 */
export function toRoundSummary(round: StoredRound | null, now: number): RoundSummary | null {
  if (!round) return null;
  return {
    key: round.key,
    open: isRoundOpen(round, now),
    openedAtMs: round.openedAtMs,
    deadlineMs: round.deadlineMs,
    answerCount: round.answerCount,
    answerRev: round.answerRev,
  };
}

/** ホスト(現在のホスト端末)が回答の受付を開始する。締切はサーバ時刻で決まり、ホストのタブが落ちても自動で締まる。 */
export async function openRound(deps: EngineDeps, args: OpenRoundArgs): Promise<OpenRoundResult> {
  const { meta, device } = await authenticate(deps, args);
  if (device.role !== "host" || meta.hostDeviceId !== device.deviceId) {
    throw hubError("NOT_HOST", "現在のホスト端末だけが回答の受付を開始できます");
  }
  if (!ROUND_KEY_PATTERN.test(args.key ?? "")) throw hubError("INVALID_ARGUMENT", "key が不正です");
  if (args.mode !== undefined && args.mode !== "timed" && args.mode !== "open") {
    throw hubError("INVALID_ARGUMENT", "mode が不正です");
  }
  const openEnded = args.mode === "open";
  if (!openEnded) {
    const durationMs = args.durationMs;
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < MIN_ROUND_DURATION_MS || durationMs > MAX_ROUND_DURATION_MS) {
      throw hubError("INVALID_ARGUMENT", "受付時間が範囲外です");
    }
  }
  const options = args.options;
  const minOptions = openEnded ? 1 : 2;
  if (!Array.isArray(options) || options.length < minOptions || options.length > MAX_ROUND_OPTIONS) {
    throw hubError("INVALID_ARGUMENT", `選択肢は${minOptions}〜${MAX_ROUND_OPTIONS}個で指定してください`);
  }
  const nos = new Set<number>();
  for (const o of options) {
    if (!Number.isInteger(o?.no) || o.no < 1 || o.no > 99 || nos.has(o.no)) {
      throw hubError("INVALID_ARGUMENT", "選択肢の番号が不正です(1〜99の重複しない整数)");
    }
    if (typeof o.text !== "string" || o.text.length > MAX_ROUND_OPTION_TEXT) {
      throw hubError("INVALID_ARGUMENT", "選択肢の文字列が不正です");
    }
    nos.add(o.no);
  }

  const now = deps.now();
  const durationMs = openEnded ? MAX_OPEN_ROUND_MS : (args.durationMs as number);
  const existing = await deps.repo.getRound();
  if (existing && existing.key === args.key) {
    // ホストのリロードなどで同じラウンドの開始が再送されても、回答を消さずに続きとして扱う。
    if (isRoundOpen(existing, now)) return { key: existing.key, deadlineMs: existing.deadlineMs, serverNowMs: now };
    // 締切済みでも resume なら、回答を残したまま受付を再開する(途中参加を受け付け直す)。
    if (args.resume === true) {
      const deadlineMs = now + durationMs;
      await deps.repo.reopenRound(deadlineMs);
      return { key: existing.key, deadlineMs, serverNowMs: now };
    }
  }
  const round = { key: args.key, optionNos: [...nos].sort((a, b) => a - b), openedAtMs: now, deadlineMs: now + durationMs };
  await deps.repo.openRound(round);
  const head = (await deps.repo.getHead()) ?? EMPTY_HEAD(meta);
  if (!head.hasRound) await deps.repo.putHead({ ...head, hasRound: true });
  return { key: round.key, deadlineMs: round.deadlineMs, serverNowMs: now };
}

/** ホストまたは管理端末が受付を締め切る(締切済みなら何もしない)。 */
export async function closeRound(deps: EngineDeps, args: CloseRoundArgs): Promise<RoundSummary> {
  const { device } = await authenticate(deps, args);
  if (device.role === "client") throw hubError("FORBIDDEN", "参加者は受付を締め切れません");
  const now = deps.now();
  const round = await deps.repo.getRound();
  if (!round || round.key !== args.key) throw hubError("ROUND_NOT_OPEN", "該当する回答受付がありません");
  await deps.repo.closeRound(now);
  return toRoundSummary({ ...round, closedAtMs: round.closedAtMs ?? now }, now)!;
}

/**
 * 参加者の回答。1人1件で、受付中なら何度でも選び直せる(最後に選んだものが採用され、回答時刻もその時刻になる)。
 * 締切の判定はサーバ時刻なので、端末の時計がずれていても公平。
 * ログインから確定したメンバーは、別の端末から選び直しても同じ1件(2台でエントリーさせない)。
 * `duplicate` は「今回の送信で回答が変わらなかった」(同じ選択の再送、または締切後に回答済みの内容を返した)。
 */
export async function submitAnswer(deps: EngineDeps, args: SubmitAnswerArgs): Promise<SubmitAnswerResult> {
  const { device } = await authenticate(deps, args);
  if (device.role !== "client") throw hubError("FORBIDDEN", "回答できるのは参加者のみです");
  const now = deps.now();
  const round = await deps.repo.getRound();
  if (!round || round.key !== args.key) throw hubError("ROUND_NOT_OPEN", "いまは回答を受け付けていません");

  const answer: RoundAnswer = {
    deviceId: device.deviceId,
    memberId: device.memberId,
    label: device.label,
    no: args.no,
    atMs: now,
  };
  if (!isRoundOpen(round, now)) {
    // 締切後は変更できない。回答済みなら、その内容を返す(画面表示を揃えるため)。
    const mine = (await deps.repo.listAnswers(round.key)).find((a) => isSameRespondent(a, answer));
    if (mine) return { no: mine.no, atMs: mine.atMs, duplicate: true };
    throw hubError("ROUND_CLOSED", "回答の受付は終了しました");
  }
  if (!Number.isInteger(args.no) || !round.optionNos.includes(args.no)) {
    throw hubError("INVALID_ARGUMENT", "選択肢の番号が不正です");
  }
  const result = await deps.repo.upsertAnswer(round.key, answer, deps.maxAnswers ?? MAX_ROUND_ANSWERS_KV);
  if (!result) throw hubError("ROUND_NOT_OPEN", "いまは回答を受け付けていません");
  if (result.kind === "full") throw hubError("PAYLOAD_TOO_LARGE", "回答数が上限に達しました");
  return { no: result.answer.no, atMs: result.answer.atMs, duplicate: result.kind === "unchanged" };
}

/** ホスト/管理が、回答の一覧(正誤・順位の集計に使う)を取得する。 */
export async function getAnswers(deps: EngineDeps, args: GetAnswersArgs): Promise<GetAnswersResult> {
  const { device } = await authenticate(deps, args);
  if (device.role === "client") throw hubError("FORBIDDEN", "参加者は回答一覧を取得できません");
  const now = deps.now();
  const round = await deps.repo.getRound();
  if (!round || round.key !== args.key) throw hubError("ROUND_NOT_OPEN", "該当する回答受付がありません");
  const answers = (await deps.repo.listAnswers(round.key)).slice().sort((a, b) => a.atMs - b.atMs);
  return { round: toRoundSummary(round, now)!, answers };
}

/** ホスト/管理が、このセッションにポータルから入室したメンバーのID一覧を取得する(自動エントリー・抽選の対象)。 */
export async function listParticipants(deps: EngineDeps, args: ListParticipantsArgs): Promise<ListParticipantsResult> {
  const { device } = await authenticate(deps, args);
  if (device.role === "client") throw hubError("FORBIDDEN", "参加者は参加者名簿を取得できません");
  return { memberIds: await deps.repo.listParticipantIds() };
}
