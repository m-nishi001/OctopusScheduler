import { describe, it, expect, vi } from "vitest";
import { RevealTracker } from "@model/jackpot-host-state";
import { createHostPublisher } from "./host-publisher";

function setup(options: { result?: any; nextLabel?: string } = {}) {
  const tracker = new RevealTracker();
  const host = { publish: vi.fn() };
  const reveal = vi.fn().mockResolvedValue(true);
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
    reveal,
    phase: () => "prize",
    ended: () => state.ended,
    nextLabel: () => state.nextLabel,
    result: () => state.result,
  });
  return { publish, host, tracker, state, reveal };
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
    const { publish, host, reveal } = setup({ result: null });
    publish();
    expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ member: null, prize: null }));
    expect(reveal).not.toHaveBeenCalled();
  });

  it("結果の公開(reveal)は、当選者と景品が見えたあとに、drawId ごとに1回だけ", () => {
    const { publish, tracker, reveal } = setup();
    publish();
    expect(reveal).not.toHaveBeenCalled(); // まだ見えていない

    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");
    publish();
    publish();
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledWith("d1");
  });

  it("公開に失敗したら、次の公開でもう一度公開する", async () => {
    const { publish, tracker, reveal } = setup();
    reveal.mockResolvedValueOnce(false);
    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");

    publish();
    await Promise.resolve();
    await Promise.resolve();
    publish();

    expect(reveal).toHaveBeenCalledTimes(2);
  });

  describe("公開に成功したら次のサイクルの下ごしらえを始める合図(onRevealed)", () => {
    const flush = async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve();
    };
    function withHook() {
      const s = setup();
      const onRevealed = vi.fn();
      const publish = createHostPublisher({
        host: s.host,
        tracker: s.tracker,
        reveal: s.reveal,
        onRevealed,
        phase: () => "prize",
        ended: () => false,
        nextLabel: () => undefined,
        result: () => s.state.result,
      });
      s.tracker.onAction("stopMemberDraw");
      s.tracker.onAction("stopPrizeDraw");
      return { ...s, publish, onRevealed };
    }

    it("公開に成功した drawId につき1回だけ呼ぶ", async () => {
      const { publish, onRevealed } = withHook();
      publish();
      publish();
      await flush();
      expect(onRevealed).toHaveBeenCalledTimes(1);
      expect(onRevealed).toHaveBeenCalledWith("d1");
    });

    it("公開に失敗したら呼ばない。次の公開で成功したときに呼ぶ", async () => {
      const { publish, reveal, onRevealed } = withHook();
      reveal.mockResolvedValueOnce(false);
      publish();
      await flush();
      expect(onRevealed).not.toHaveBeenCalled();
      publish();
      await flush();
      expect(onRevealed).toHaveBeenCalledTimes(1);
    });

    it("settled は、公開の通信が終わり onRevealed が呼ばれるまで待つ。通信が無ければすぐ解決する", async () => {
      const { publish, reveal, onRevealed } = withHook();
      await publish.settled(); // 何も通信していない
      let finish!: (ok: boolean) => void;
      reveal.mockReturnValueOnce(new Promise<boolean>((r) => (finish = r)));
      publish();
      let done = false;
      void publish.settled().then(() => (done = true));
      await flush();
      expect(done).toBe(false);
      expect(onRevealed).not.toHaveBeenCalled();
      finish(true);
      await publish.settled();
      expect(onRevealed).toHaveBeenCalledTimes(1);
      expect(done).toBe(true);
    });

    it("公開に失敗しても settled は解決する(待ち続けない)", async () => {
      const { publish, reveal } = withHook();
      reveal.mockResolvedValueOnce(false);
      publish();
      await expect(publish.settled()).resolves.toBeUndefined();
    });

    it("まだ公開できない(当選者・景品が見えていない)間は呼ばない", async () => {
      const s = setup();
      const onRevealed = vi.fn();
      const publish = createHostPublisher({
        host: s.host,
        tracker: s.tracker,
        reveal: s.reveal,
        onRevealed,
        phase: () => "member",
        ended: () => false,
        nextLabel: () => undefined,
        result: () => s.state.result,
      });
      publish();
      await flush();
      expect(onRevealed).not.toHaveBeenCalled();
    });
  });
});
