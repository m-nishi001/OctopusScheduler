import type { JackpotDraw } from "@octopus/session-hub";
import { buildJackpotDraw, buildJackpotHostState, type RevealTracker } from "@model/jackpot-host-state";
import type { JackpotHost } from "../../composables/use-jackpot-host";
import type { DrawResultDto } from "@control/draw/dto/draw-result-dto";

export interface HostPublisherDeps {
  host: Pick<JackpotHost, "publish"> & { recordDraw(draw: JackpotDraw): Promise<boolean> };
  tracker: RevealTracker;
  /** デモは結果を保存しない。 */
  isDemo: boolean;
  phase(): string;
  nextLabel(): string | undefined;
  result(): DrawResultDto | null;
}

/**
 * 進行が止まるたびに呼ぶ。いまの状態をセッションへ公開し、当選者と景品が画面に見えた後に
 * 1回だけ(演出の途中では保存しない)結果をポータル用に保存する。
 */
export function createHostPublisher(deps: HostPublisherDeps): () => void {
  const recordedDrawIds = new Set<string>();
  return () => {
    const result = deps.result();
    deps.host.publish(
      buildJackpotHostState({
        phase: deps.phase(),
        nextLabel: deps.nextLabel(),
        tracker: deps.tracker,
        memberName: result?.wonMember?.name,
        memberId: result?.wonMember?.id,
        prizeName: result?.wonPrize?.name,
      })
    );
    if (deps.isDemo) return;
    const draw = buildJackpotDraw(result, deps.tracker);
    if (!draw || recordedDrawIds.has(draw.drawId)) return;
    recordedDrawIds.add(draw.drawId);
    void deps.host.recordDraw(draw).then((saved) => {
      if (!saved) recordedDrawIds.delete(draw.drawId);
    });
  };
}
