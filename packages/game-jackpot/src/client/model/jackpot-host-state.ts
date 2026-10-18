/**
 * セッション(ホスト/管理/参加者)へ公開するジャックポットの状態。
 *
 * ホスト端末が権威で、管理端末のコンソールと参加者のポータルがこれを表示する。
 * 当選者は「停止演出が終わって画面に見える」まで公開しない(参加者のスマホに
 * 先にネタバレさせない)。サイズは小さく保つ(RoomState の上限は約6KB)。
 */
import type { JackpotDraw, JackpotPublished, JackpotStage } from "@octopus/session-hub";

export const JACKPOT_STOP_COMMAND = "jackpot.stopRoulette";

/** 当選者が確定して画面に見えるステップのラベル。 */
const REVEAL_MEMBER = ["stopMemberDraw"];
const REVEAL_PRIZE = ["stopPrizeDraw", "stopKakuhenFinalDraw"];
/** 参加者のスマホからも止めてよいステップのラベル。 */
const STOP_LABELS = ["stopMemberDraw", "stopPrizeDraw", "stopKakuhenDummyDraw", "stopKakuhenFinalDraw"];

export function canStopAt(label: string | undefined): boolean {
  return !!label && STOP_LABELS.includes(label);
}

/** 抽選1回ぶんの「どこまで見えたか」を追跡する。 */
export class RevealTracker {
  memberRevealed = false;
  prizeRevealed = false;

  /** 次の抽選を始める(前回の当選者を隠す)。 */
  reset(): void {
    this.memberRevealed = false;
    this.prizeRevealed = false;
  }

  /** ステップを実行する直前に呼ぶ。 */
  onAction(label: string | undefined): void {
    if (!label) return;
    if (REVEAL_MEMBER.includes(label)) this.memberRevealed = true;
    if (REVEAL_PRIZE.includes(label)) this.prizeRevealed = true;
  }
}

/**
 * 場面(stage)を、画面の段階・どこまで見えたか・終了済みかから1か所で決める。
 * 各画面(管理コンソール・参加者のポータル)は、この stage だけを見て表示を切り替える。
 */
export function deriveStage(input: { phase: string; tracker: RevealTracker; ended: boolean }): JackpotStage {
  const { phase, tracker } = input;
  if (input.ended) return "ended";
  if (tracker.prizeRevealed) return "prize-revealed";
  if (tracker.memberRevealed) return phase === "prize" ? "prize" : "member-revealed";
  return phase === "member" ? "member" : "waiting";
}

export function buildJackpotHostState(input: {
  phase: string;
  /** 抽選が終わった(景品かメンバーが尽きた)。 */
  ended?: boolean;
  nextLabel: string | undefined;
  tracker: RevealTracker;
  memberName: string | null | undefined;
  memberId?: string | null;
  prizeName: string | null | undefined;
}): JackpotPublished {
  const { tracker } = input;
  return {
    page: "main-draw",
    stage: deriveStage({ phase: input.phase, tracker, ended: input.ended ?? false }),
    canStop: canStopAt(input.nextLabel),
    member: tracker.memberRevealed ? input.memberName ?? null : null,
    memberId: tracker.memberRevealed ? input.memberId || null : null,
    prize: tracker.prizeRevealed ? input.prizeName ?? null : null,
  };
}

/** 説明画面(スライド)の公開状態。管理端末が「次のスライドへ/前へ」を出し分けるために index/total を載せる。 */
export function buildJackpotDescriptionState(index: number, total: number): JackpotPublished {
  return { page: "description", stage: "waiting", canStop: false, member: null, memberId: null, prize: null, index, total };
}

/**
 * 参加者のポータルの「当選履歴」に残す1件を作る。当選者と賞品の**両方が画面に見えた後**でなければ null
 * (抽選の途中で参加者のスマホに結果が出てしまうのを防ぐ。公開用の状態と同じ基準)。
 */
export function buildJackpotDraw(
  result: {
    drawId: string;
    wonMember: { id: string; name: string } | null;
    wonPrize: { id: string; name: string } | null;
    isKakuhen: boolean;
    createdAt: number;
  } | null,
  tracker: RevealTracker
): JackpotDraw | null {
  if (!result || !result.wonMember || !result.wonPrize) return null;
  if (!tracker.memberRevealed || !tracker.prizeRevealed) return null;
  return {
    drawId: result.drawId,
    memberId: result.wonMember.id || null,
    memberName: result.wonMember.name,
    prizeId: result.wonPrize.id,
    prizeName: result.wonPrize.name,
    isKakuhen: result.isKakuhen,
    atMs: result.createdAt,
  };
}
