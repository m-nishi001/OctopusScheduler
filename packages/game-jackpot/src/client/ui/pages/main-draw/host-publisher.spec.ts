import { describe, it, expect, vi } from "vitest";
import { RevealTracker } from "@model/jackpot-host-state";
import { createHostPublisher } from "./host-publisher";

function setup(options: { isDemo?: boolean; result?: any; nextLabel?: string } = {}) {
  const tracker = new RevealTracker();
  const host = { publish: vi.fn(), recordDraw: vi.fn().mockResolvedValue(true) };
  const state = {
    result: options.result === undefined
      ? { drawId: "d1", wonMember: { id: "m1", name: "Alice" }, wonPrize: { id: "p1", name: "Prize" }, isKakuhen: false, createdAt: 1 }
      : options.result,
    nextLabel: options.nextLabel,
    ended: false,
  };
  const publish = createHostPublisher({
    host,
    tracker,
    isDemo: options.isDemo ?? false,
    phase: () => "prize",
    ended: () => state.ended,
    nextLabel: () => state.nextLabel,
    result: () => state.result,
  });
  return { publish, host, tracker, state };
}

describe("createHostPublisher", () => {
  it("当選者は、停止演出が見えるまで公開しない。次が停止ステップなら canStop", () => {
    const { publish, host, tracker } = setup({ nextLabel: "stopPrizeDraw" });

    publish();
    expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ stage: "waiting", canStop: true, member: null, prize: null }));

    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");
    publish();
    expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ member: "Alice", memberId: "m1", prize: "Prize" }));
  });

  it("抽選が終わったら、場面は ended として公開される(管理端末・ポータルが終了を知る)", () => {
    const { publish, host, tracker, state } = setup();
    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");
    publish();
    expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ stage: "prize-revealed" }));

    state.ended = true;
    publish();
    expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ stage: "ended", canStop: false, member: "Alice", prize: "Prize" }));
  });

  it("抽選に失敗して結果が無くても公開できる", () => {
    const { publish, host } = setup({ result: null });
    publish();
    expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ member: null, prize: null }));
    expect(host.recordDraw).not.toHaveBeenCalled();
  });

  it("結果の保存は、当選者と景品が見えたあとに1回だけ。デモは保存しない", async () => {
    const live = setup();
    live.publish();
    expect(live.host.recordDraw).not.toHaveBeenCalled(); // まだ見えていない

    live.tracker.onAction("stopMemberDraw");
    live.tracker.onAction("stopPrizeDraw");
    live.publish();
    live.publish();
    expect(live.host.recordDraw).toHaveBeenCalledTimes(1);

    const demo = setup({ isDemo: true });
    demo.tracker.onAction("stopMemberDraw");
    demo.tracker.onAction("stopPrizeDraw");
    demo.publish();
    expect(demo.host.recordDraw).not.toHaveBeenCalled();
  });

  it("保存に失敗したら、次の公開でもう一度保存する", async () => {
    const { publish, host, tracker } = setup();
    host.recordDraw.mockResolvedValueOnce(false);
    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");

    publish();
    await Promise.resolve();
    await Promise.resolve();
    publish();

    expect(host.recordDraw).toHaveBeenCalledTimes(2);
  });
});
