import { buildJackpotHostState, revealableDrawId, type RevealTracker } from "@model/jackpot-host-state";
import type { JackpotHost } from "../../composables/use-jackpot-host";
import type { DrawResultDto } from "@control/draw/dto/draw-result-dto";

export interface HostPublisherDeps {
  host: Pick<JackpotHost, "publish">;
  tracker: RevealTracker;
  /**
   * 当選者と景品が画面に見えた抽選を公開する(確定済みの結果を、参加者のポータルに見せる)。
   * 成功なら true。通信の失敗などで公開できなかったら false(次の公開でもう一度試す)。
   */
  reveal(drawId: string): Promise<boolean>;
  /**
   * 公開に成功した(サーバーが、次の抽選の確定を受け付けられる状態になった)。次のサイクルの下ごしらえを裏で始める合図。
   * 公開は drawId ごとに成功するまで試すので、成功した drawId につき1回だけ呼ぶ。
   */
  onRevealed?(drawId: string): void;
  phase(): string;
  /** 抽選が終わった(景品かメンバーが尽きて、終了の画面を出している)。 */
  ended(): boolean;
  nextLabel(): string | undefined;
  result(): DrawResultDto | null;
}

/**
 * 進行が止まるたびに呼ぶ。いまの状態をセッションへ公開し、当選者と景品が画面に見えた後に
 * 1回だけ(演出の途中では公開しない)、確定済みの結果を参加者のポータルに公開(reveal)する。
 */
export function createHostPublisher(deps: HostPublisherDeps): () => void {
  const revealedDrawIds = new Set<string>();
  return () => {
    const result = deps.result();
    deps.host.publish(
      buildJackpotHostState({
        phase: deps.phase(),
        ended: deps.ended(),
        nextLabel: deps.nextLabel(),
        tracker: deps.tracker,
        memberName: result?.wonMember?.name,
        memberId: result?.wonMember?.id,
        prizeName: result?.wonPrize?.name,
      })
    );
    const drawId = revealableDrawId(result, deps.tracker);
    if (!drawId || revealedDrawIds.has(drawId)) return;
    revealedDrawIds.add(drawId);
    void deps.reveal(drawId).then((ok) => {
      if (!ok) revealedDrawIds.delete(drawId);
      else deps.onRevealed?.(drawId);
    });
  };
}
