import { buildJackpotDemoDrawState, buildJackpotHostState, revealableDrawId, type RevealTracker } from "@model/jackpot-host-state";
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
   * デモ抽選(練習抽選)か。そうなら「デモ抽選」のページ名だけを公開し、当選者・景品・止める操作は載せない。
   * 結果の確定・公開(reveal)の先は、呼び出し側が渡すメモリだけの置き場(練習の結果は記録しない)。
   */
  demoDraw?: boolean;
  phase(): string;
  /** 抽選が終わった(景品かメンバーが尽きて、終了の画面を出している)。 */
  ended(): boolean;
  nextLabel(): string | undefined;
  result(): DrawResultDto | null;
  /** いまの当選者を飛ばしたとき、引き直せるほかの候補の人数(分かるときだけ)。管理端末が「飛ばす」を押せるかの判断に使う。 */
  spare?(): number | undefined;
}

/** 進行が止まるたびに呼ぶ公開の関数。公開の通信の完了を待つ settled を持つ。 */
export interface HostPublisher {
  (): void;
  /**
   * 公開(reveal)の通信中のものがすべて終わるのを待つ。当選者を飛ばす前に呼ぶ(公開の通信中に当選者を置き換えない)。
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
    // デモ抽選は「デモ抽選」のページ名だけ(当選者・景品・止める操作を載せない)。結果の確定・公開(reveal)は、メモリだけの置き場の中で本番と同じに進める
    deps.host.publish(
      deps.demoDraw
        ? buildJackpotDemoDrawState()
        : buildJackpotHostState({
            phase: deps.phase(),
            ended: deps.ended(),
            nextLabel: deps.nextLabel(),
            tracker: deps.tracker,
            memberName: result?.wonMember?.name,
            memberId: result?.wonMember?.id,
            prizeName: result?.wonPrize?.name,
            spare: deps.spare?.(),
          })
    );
    const drawId = revealableDrawId(result, deps.tracker);
    if (!drawId) return;
    // 同じ抽選でも、当選者を飛ばして置き換えたら(未公開に戻っている)、新しい当選者を公開し直す
    const revealKey = `${drawId}:${result?.wonMember?.id}`;
    if (revealedDrawIds.has(revealKey)) return;
    revealedDrawIds.add(revealKey);
    const run = deps
      .reveal(drawId)
      .then((ok) => {
        if (!ok) revealedDrawIds.delete(revealKey);
      })
      .finally(() => inflight.delete(run));
    inflight.add(run);
  };
  return Object.assign(publish, { settled: async () => void (await Promise.all([...inflight])) });
}
