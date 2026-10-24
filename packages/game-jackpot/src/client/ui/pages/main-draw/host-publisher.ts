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

/** 進行が止まるたびに呼ぶ公開の関数。公開の通信の完了を待つ settled を持つ。 */
export interface HostPublisher {
  (): void;
  /**
   * 公開(reveal)の通信中のものがすべて終わる(onRevealed の呼び出しまで済む)のを待つ。
   * 次のサイクルの用意の前に呼ぶ: 通信中のまま先へ進むと、公開が済む前の「その場の用意」と、公開が済んだ後の「先読み」が
   * 同時に抽選・確定してしまう。
   */
  settled(): Promise<void>;
}

/**
 * 進行が止まるたびに呼ぶ。いまの状態をセッションへ公開し、当選者と景品が画面に見えた後に
 * 1回だけ(演出の途中では公開しない)、確定済みの結果を参加者のポータルに公開(reveal)する。
 */
export function createHostPublisher(deps: HostPublisherDeps): HostPublisher {
  const revealedDrawIds = new Set<string>();
  const inflight = new Set<Promise<void>>();
  const publish = () => {
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
    const run = deps
      .reveal(drawId)
      .then((ok) => {
        if (!ok) revealedDrawIds.delete(drawId);
        else deps.onRevealed?.(drawId);
      })
      .finally(() => inflight.delete(run));
    inflight.add(run);
  };
  return Object.assign(publish, { settled: async () => void (await Promise.all([...inflight])) });
}
