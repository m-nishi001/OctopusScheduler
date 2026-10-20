/**
 * ジャックポットの「いまの場面」の公開状態(RoomState.data の `jackpot` 名前空間)。
 *
 * ホストが権威で、管理端末のコンソールと参加者のポータルがこれを読む。3者が同じ定義を使い、
 * 場面は `stage` で明示する(各画面が member/prize の有無や段階から場面を推測しない)。
 * 当選者・賞品は、停止演出が終わって会場の画面に見えてから公開する(先にネタバレしない)。
 */

export const JACKPOT_NS = "jackpot";

/**
 * 場面。1回の抽選は waiting → member → member-revealed → prize → prize-revealed と進み、
 * 抽選が終わる(景品かメンバーが尽きる)と ended になる。
 *   waiting         : 抽選の前(オープニング・説明・抽選画面の準備中)
 *   member          : メンバー抽選(回し始める前〜回転中)
 *   member-revealed : 当選者が決まって画面に見えている(景品抽選の前)
 *   prize           : 景品抽選(回し始める前〜回転中)
 *   prize-revealed  : 景品が決まって画面に見えている
 *   ended           : 抽選が終わった(終了の画面)
 */
export const JACKPOT_STAGES = ["waiting", "member", "member-revealed", "prize", "prize-revealed", "ended"] as const;
export type JackpotStage = (typeof JACKPOT_STAGES)[number];

/** 公開された値を、ジャックポットの進行段階として読む。知らない値は `waiting`。 */
export function parseJackpotStage(value: unknown): JackpotStage {
  return (JACKPOT_STAGES as readonly unknown[]).includes(value) ? (value as JackpotStage) : "waiting";
}

export interface JackpotPublished {
  /** 公開している画面("description" = 説明のスライド、"main-draw" = 抽選画面)。 */
  page: "main-draw" | "description";
  stage: JackpotStage;
  /** 次の操作でルーレット/スロットを止められるか。 */
  canStop: boolean;
  /** 公開済みの当選者名(停止演出が終わるまでは null)。 */
  member: string | null;
  /** 公開済みの当選者のID(ポータルが「自分が当選したか」を判定する。member と同時に公開する)。 */
  memberId: string | null;
  /** 公開済みの当選賞品名(停止演出が終わるまでは null)。 */
  prize: string | null;
  /** 説明画面: 表示中のスライド(-1 = 導入画面、0 以上 = 0始まり)と枚数。 */
  index?: number;
  total?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const orNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** 公開された状態から、いまのジャックポットを取り出す。無い・形が合わないときは null(項目の型が違えば既定値)。 */
export function readJackpotState(data: Record<string, unknown> | null | undefined): JackpotPublished | null {
  const raw = data?.[JACKPOT_NS];
  if (!isRecord(raw)) return null;
  const state: JackpotPublished = {
    page: raw.page === "description" ? "description" : "main-draw",
    stage: parseJackpotStage(raw.stage),
    canStop: raw.canStop === true,
    member: orNull(raw.member),
    memberId: orNull(raw.memberId),
    prize: orNull(raw.prize),
  };
  if (typeof raw.index === "number" && Number.isFinite(raw.index)) state.index = raw.index;
  if (typeof raw.total === "number" && Number.isFinite(raw.total)) state.total = raw.total;
  return state;
}
