/**
 * セッション(ホスト/管理/参加者)へ公開するジャックポットの状態。
 *
 * ホスト端末が権威で、管理端末のコンソールと参加者のポータルがこれを表示する。
 * 当選者は「停止演出が終わって画面に見える」まで公開しない(参加者のスマホに
 * 先にネタバレさせない)。サイズは小さく保つ(RoomState の上限は約6KB)。
 */
export const JACKPOT_STOP_COMMAND = "jackpot.stopRoulette";

export interface JackpotHostState {
  page: "main-draw";
  /** 抽選の段階("member" = メンバー抽選, "prize" = 賞品抽選, それ以外 = 待機)。 */
  phase: string;
  /** 次の操作でルーレット/スロットを止められるか。 */
  canStop: boolean;
  /** 公開済みの当選者名(停止演出が終わるまでは null)。 */
  member: string | null;
  /** 公開済みの当選賞品名(停止演出が終わるまでは null)。 */
  prize: string | null;
}

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

export function buildJackpotHostState(input: {
  phase: string;
  nextLabel: string | undefined;
  tracker: RevealTracker;
  memberName: string | null | undefined;
  prizeName: string | null | undefined;
}): JackpotHostState {
  const { tracker } = input;
  return {
    page: "main-draw",
    phase: input.phase,
    canStop: canStopAt(input.nextLabel),
    member: tracker.memberRevealed ? input.memberName ?? null : null,
    prize: tracker.prizeRevealed ? input.prizeName ?? null : null,
  };
}
