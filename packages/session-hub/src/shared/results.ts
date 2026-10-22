/**
 * 参加者ポータルに見せる「結果」(クイズの順位・ジャックポットの当選履歴)の型と集計。
 *
 * 結果そのものは Durable Object ではなく R2(GAS は Google Drive の JSON)に保存する。
 * DO(RoomState)が運ぶのは「結果が更新された」という軽い通知 `{ rev }` だけで、
 * ポータルは rev が変わったときに `getResults` で取り直す(状態の 6KB 上限に縛られないため)。
 *
 * 純粋関数のみ(サーバ・クライアント・テストで共有)。
 */

/** RoomState.data の名前空間。値は `{ rev: number }`。 */
export const RESULTS_NAMESPACE = "results";

export const RESULTS_LIMITS = {
  /** 1セッションに残せるクイズのラウンド数。 */
  maxRounds: 100,
  /** 1セッションに残せる抽選結果の数。 */
  maxDraws: 500,
  /** 1ラウンドに残す正解者の数(早い順)。 */
  maxCorrectPerRound: 300,
  /** 1ラウンドに残す不正解者の数。 */
  maxWrongPerRound: 500,
  /** ポータルに返す順位表の件数。 */
  topN: 10,
  maxNameLength: 60,
  maxTitleLength: 100,
  maxIdLength: 100,
} as const;

/** 結果の保存先として許すセッションID(ワーカーの SESSION_ID_PATTERN と同じ)。 */
export const RESULTS_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface QuizCorrectEntry {
  /** ログイン済みメンバーのID。不明なら null(累計の対象外)。 */
  memberId: string | null;
  name: string;
  /** 回答までの秒数。 */
  sec: number;
}

export interface QuizRoundResult {
  roundKey: string;
  quizId: string;
  title: string;
  correctNo: number;
  closedAtMs: number;
  /** 回答した人数(正解 + 不正解)。 */
  answeredCount: number;
  /** 正解者(早い順)。 */
  correct: QuizCorrectEntry[];
  /** 不正解だったメンバーのID(「自分は不正解だった」を示すため)。 */
  wrongMemberIds: string[];
}

/** ホストが commit する抽選結果(サーバーが revealedAtMs を足して保存する)。 */
export interface JackpotDrawInput {
  drawId: string;
  /** 当選したメンバーのID(必須。同じセッションで二度当選させないための鍵)。 */
  memberId: string;
  memberName: string;
  prizeId: string;
  prizeName: string;
  isKakuhen: boolean;
  /** commit した時刻。 */
  atMs: number;
}

export interface JackpotDraw extends JackpotDrawInput {
  /** ホストの画面に当選者と景品が見えた時刻。null = commit 済みだが未公開(ポータルには見せない)。 */
  revealedAtMs: number | null;
}

/** 確変の予定。セッションで最初に決めたものを保存し、以後は変えない。 */
export interface JackpotPlan {
  /** 確変にする抽選の順番(確定済みの件数 + 1 を基準にした何回目か)。 */
  kakuhenTimings: number[];
  /** 確変のために取り置いた景品のID。通常の抽選ではこの景品は当たらない。 */
  reservedPrizeIds: string[];
  createdAtMs: number;
}

/** ensureJackpotPlan に渡す案(createdAtMs はサーバーが決める)。 */
export type JackpotPlanInput = Omit<JackpotPlan, "createdAtMs">;

/** 管理用に返す抽選の状態(未公開の行を含む)。 */
export interface JackpotState {
  rev: number;
  plan: JackpotPlan | null;
  /** 古い順。 */
  draws: JackpotDraw[];
}

/** R2 に保存する文書。 */
export interface ResultsDoc {
  v: 2;
  /** 実際に内容が変わった回数。DO の通知(RESULTS_NAMESPACE)と突き合わせる。 */
  rev: number;
  updatedAtMs: number;
  /** クイズのラウンド(終了時刻の昇順)。 */
  rounds: QuizRoundResult[];
  /** 抽選結果(commit 順=古い順)。未公開(revealedAtMs が null)の行を含む。 */
  draws: JackpotDraw[];
  jackpot: { plan: JackpotPlan | null };
}

/** まだ何も残していない結果ファイル。 */
export function emptyResultsDoc(): ResultsDoc {
  return { v: 2, rev: 0, updatedAtMs: 0, rounds: [], draws: [], jackpot: { plan: null } };
}

// ---------- ポータルへ返す見せ方 ----------

export interface RankRow {
  rank: number;
  name: string;
  /** その人自身の行か(強調表示に使う)。 */
  mine: boolean;
}

export interface QuizRoundRow extends RankRow {
  sec: number;
}

export interface QuizRoundView {
  roundKey: string;
  quizId: string;
  title: string;
  closedAtMs: number;
  answeredCount: number;
  correctCount: number;
  top: QuizRoundRow[];
  me: {
    /** 回答した。 */
    answered: boolean;
    /** 正解した(回答していなければ false)。 */
    correct: boolean;
    /** 正解者の中での順位(正解していなければ null)。 */
    rank: number | null;
    sec: number | null;
  };
}

export interface CumulativeRow extends RankRow {
  points: number;
  totalSec: number;
}

export interface JackpotDrawRow {
  drawId: string;
  memberName: string;
  prizeName: string;
  isKakuhen: boolean;
  atMs: number;
  /** 自分が当選した。 */
  mine: boolean;
}

export interface ResultsView {
  rev: number;
  quiz: {
    /** 新しいラウンドが先頭。 */
    rounds: QuizRoundView[];
    cumulative: {
      top: CumulativeRow[];
      /** 累計の対象になった人数。 */
      participants: number;
      /** 自分の累計(1問も正解していなければ null)。 */
      me: CumulativeRow | null;
    };
  };
  jackpot: {
    /** 新しい当選が先頭。 */
    draws: JackpotDrawRow[];
    /** 自分が当選した回数。 */
    myWins: number;
  };
}

// ---------- 検証 ----------

class ResultsValidationError extends Error {}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown, field: string, max: number): string {
  if (typeof v !== "string" || v.length === 0) throw new ResultsValidationError(`${field} は文字列で指定してください`);
  return v.length > max ? v.slice(0, max) : v;
}

function optId(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  return str(v, field, RESULTS_LIMITS.maxIdLength);
}

function num(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ResultsValidationError(`${field} は数値で指定してください`);
  return v;
}

/** 検証に失敗したときの例外かどうか(サーバが INVALID_ARGUMENT に変換する)。 */
export function isResultsValidationError(error: unknown): boolean {
  return error instanceof ResultsValidationError;
}

/** putQuizResult の引数を検証して正規化する(長さの上限で切り詰め、秒数は小数1桁に丸める)。 */
export function parseQuizRoundResult(input: unknown): QuizRoundResult {
  if (!isRecord(input)) throw new ResultsValidationError("結果が不正です");
  if (!Array.isArray(input.correct) || !Array.isArray(input.wrongMemberIds)) throw new ResultsValidationError("correct / wrongMemberIds は配列で指定してください");
  const correct = input.correct.slice(0, RESULTS_LIMITS.maxCorrectPerRound).map((c, i) => {
    if (!isRecord(c)) throw new ResultsValidationError(`correct[${i}] が不正です`);
    return {
      memberId: optId(c.memberId, `correct[${i}].memberId`),
      name: str(c.name, `correct[${i}].name`, RESULTS_LIMITS.maxNameLength),
      sec: Math.max(0, Math.round(num(c.sec, `correct[${i}].sec`) * 10) / 10),
    };
  });
  const wrongMemberIds = input.wrongMemberIds.slice(0, RESULTS_LIMITS.maxWrongPerRound).map((id, i) => str(id, `wrongMemberIds[${i}]`, RESULTS_LIMITS.maxIdLength));
  const answeredCount = Math.max(0, Math.floor(num(input.answeredCount, "answeredCount")));
  return {
    roundKey: str(input.roundKey, "roundKey", RESULTS_LIMITS.maxIdLength),
    quizId: str(input.quizId, "quizId", RESULTS_LIMITS.maxIdLength),
    title: str(input.title, "title", RESULTS_LIMITS.maxTitleLength),
    correctNo: Math.floor(num(input.correctNo, "correctNo")),
    closedAtMs: Math.floor(num(input.closedAtMs, "closedAtMs")),
    answeredCount: Math.max(answeredCount, correct.length + wrongMemberIds.length),
    correct,
    wrongMemberIds,
  };
}

/** commitJackpotDraw の引数を検証して正規化する(memberId は必須)。 */
export function parseJackpotDraw(input: unknown): JackpotDrawInput {
  if (!isRecord(input)) throw new ResultsValidationError("抽選結果が不正です");
  return {
    drawId: str(input.drawId, "drawId", RESULTS_LIMITS.maxIdLength),
    memberId: str(input.memberId, "memberId", RESULTS_LIMITS.maxIdLength),
    memberName: str(input.memberName, "memberName", RESULTS_LIMITS.maxNameLength),
    prizeId: str(input.prizeId, "prizeId", RESULTS_LIMITS.maxIdLength),
    prizeName: str(input.prizeName, "prizeName", RESULTS_LIMITS.maxNameLength),
    isKakuhen: input.isKakuhen === true,
    atMs: Math.floor(num(input.atMs, "atMs")),
  };
}

/** ensureJackpotPlan の引数を検証して正規化する。 */
export function parseJackpotPlan(input: unknown): JackpotPlanInput {
  if (!isRecord(input)) throw new ResultsValidationError("確変の予定が不正です");
  if (!Array.isArray(input.kakuhenTimings) || !Array.isArray(input.reservedPrizeIds)) {
    throw new ResultsValidationError("kakuhenTimings / reservedPrizeIds は配列で指定してください");
  }
  if (input.kakuhenTimings.length > RESULTS_LIMITS.maxDraws || input.reservedPrizeIds.length > RESULTS_LIMITS.maxDraws) {
    throw new ResultsValidationError("確変の予定が大きすぎます");
  }
  return {
    kakuhenTimings: input.kakuhenTimings.map((t, i) => Math.floor(num(t, `kakuhenTimings[${i}]`))),
    reservedPrizeIds: input.reservedPrizeIds.map((id, i) => str(id, `reservedPrizeIds[${i}]`, RESULTS_LIMITS.maxIdLength)),
  };
}

/** 参加者に見せてよい(公開済みの)抽選だけにする。 */
export function revealedDraws(draws: readonly JackpotDraw[]): JackpotDraw[] {
  return draws.filter((d) => d.revealedAtMs !== null);
}

// ---------- 集計 ----------

/**
 * 累計(クイズ全体)の順位。正解1点、同点は正解の合計回答秒数が小さい順、それも同じなら名前順。
 * メンバーIDが無い回答者は累計の対象外。
 */
export function computeCumulative(rounds: readonly QuizRoundResult[]): Array<{ memberId: string; name: string; points: number; totalSec: number }> {
  const byMember = new Map<string, { memberId: string; name: string; points: number; totalSec: number }>();
  for (const round of rounds) {
    for (const c of round.correct) {
      if (!c.memberId) continue;
      const row = byMember.get(c.memberId) ?? { memberId: c.memberId, name: c.name, points: 0, totalSec: 0 };
      row.points += 1;
      row.totalSec = Math.round((row.totalSec + c.sec) * 10) / 10;
      row.name = c.name;
      byMember.set(c.memberId, row);
    }
  }
  return [...byMember.values()].sort((a, b) => b.points - a.points || a.totalSec - b.totalSec || a.name.localeCompare(b.name, "ja"));
}

/** 保存された文書を、その会員(null なら閲覧のみ)向けの見せ方に変える。他人のIDは返さない。 */
export function personalize(doc: ResultsDoc, memberId: string | null): ResultsView {
  const topN = RESULTS_LIMITS.topN;
  const rounds: QuizRoundView[] = [...doc.rounds]
    .sort((a, b) => b.closedAtMs - a.closedAtMs)
    .map((r) => {
      const myIndex = memberId ? r.correct.findIndex((c) => c.memberId === memberId) : -1;
      const answered = myIndex >= 0 || (memberId !== null && r.wrongMemberIds.includes(memberId));
      return {
        roundKey: r.roundKey,
        quizId: r.quizId,
        title: r.title,
        closedAtMs: r.closedAtMs,
        answeredCount: r.answeredCount,
        correctCount: r.correct.length,
        top: r.correct.slice(0, topN).map((c, i) => ({ rank: i + 1, name: c.name, sec: c.sec, mine: memberId !== null && c.memberId === memberId })),
        me: {
          answered,
          correct: myIndex >= 0,
          rank: myIndex >= 0 ? myIndex + 1 : null,
          sec: myIndex >= 0 ? r.correct[myIndex].sec : null,
        },
      };
    });

  const cumulative = computeCumulative(doc.rounds);
  const toRow = (row: (typeof cumulative)[number], i: number): CumulativeRow => ({
    rank: i + 1,
    name: row.name,
    points: row.points,
    totalSec: row.totalSec,
    mine: memberId !== null && row.memberId === memberId,
  });
  const myIndex = memberId ? cumulative.findIndex((c) => c.memberId === memberId) : -1;

  const draws = revealedDraws(doc.draws)
    .sort((a, b) => b.atMs - a.atMs)
    .map((d) => ({
      drawId: d.drawId,
      memberName: d.memberName,
      prizeName: d.prizeName,
      isKakuhen: d.isKakuhen,
      atMs: d.atMs,
      mine: memberId !== null && d.memberId === memberId,
    }));

  return {
    rev: doc.rev,
    quiz: {
      rounds,
      cumulative: {
        top: cumulative.slice(0, topN).map(toRow),
        participants: cumulative.length,
        me: myIndex >= 0 ? toRow(cumulative[myIndex], myIndex) : null,
      },
    },
    jackpot: { draws, myWins: draws.filter((d) => d.mine).length },
  };
}

/** RoomState.data から、結果の更新通知(rev)を読む。形が違えば null。 */
export function readResultsRev(data: Record<string, unknown> | undefined): number | null {
  const slice = data?.[RESULTS_NAMESPACE];
  if (!isRecord(slice)) return null;
  const rev = slice.rev;
  return typeof rev === "number" && Number.isInteger(rev) && rev >= 0 ? rev : null;
}
