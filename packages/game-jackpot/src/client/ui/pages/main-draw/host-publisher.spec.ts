import { describe, it, expect, vi } from "vitest";
import { RevealTracker } from "@model/jackpot-host-state";
import { createHostPublisher } from "./host-publisher";

function setup(options: { result?: any; nextLabel?: string; demoDraw?: boolean } = {}) {
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
    demoDraw: options.demoDraw,
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

  describe("settled(公開の通信の完了待ち)", () => {
    const flush = async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve();
    };
    function withReveal() {
      const s = setup();
      s.tracker.onAction("stopMemberDraw");
      s.tracker.onAction("stopPrizeDraw");
      return s;
    }

    it("公開の通信が終わるまで待つ。通信が無ければすぐ解決する", async () => {
      const { publish, reveal } = withReveal();
      await publish.settled(); // 何も通信していない
      let finish!: (ok: boolean) => void;
      reveal.mockReturnValueOnce(new Promise<boolean>((r) => (finish = r)));
      publish();
      let done = false;
      void publish.settled().then(() => (done = true));
      await flush();
      expect(done).toBe(false);
      finish(true);
      await publish.settled();
      expect(done).toBe(true);
    });

    it("公開に失敗しても settled は解決する(待ち続けない)", async () => {
      const { publish, reveal } = withReveal();
      reveal.mockResolvedValueOnce(false);
      publish();
      await expect(publish.settled()).resolves.toBeUndefined();
    });
  });

  describe("デモ抽選(練習抽選)", () => {
    it("当選者・景品が見えて、次が止めるステップでも、ページ名だけを公開する(当選者・景品・止める操作を載せない)", () => {
      const { publish, host, tracker } = setup({ demoDraw: true, nextLabel: "stopPrizeDraw" });
      tracker.onAction("stopMemberDraw");
      tracker.onAction("stopPrizeDraw");
      publish();
      expect(host.publish).toHaveBeenLastCalledWith({
        page: "demo-draw",
        stage: "waiting",
        canStop: false,
        busy: false,
        member: null,
        memberId: null,
        prize: null,
      });
      for (const [state] of host.publish.mock.calls) {
        expect(state).toMatchObject({ page: "demo-draw", canStop: false, member: null, memberId: null, prize: null });
      }
    });

    it("練習の結果の確定・公開(reveal)は、渡された置き場の中で本番と同じに進める(次の練習を引くため)", () => {
      const { publish, tracker, reveal } = setup({ demoDraw: true });
      tracker.onAction("stopMemberDraw");
      tracker.onAction("stopPrizeDraw");
      publish();
      expect(reveal).toHaveBeenCalledWith("d1");
    });

    it("デモ抽選でなければ、これまでどおり当選者を公開する", () => {
      const { publish, host, tracker } = setup({ demoDraw: false });
      tracker.onAction("stopMemberDraw");
      tracker.onAction("stopPrizeDraw");
      publish();
      expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ page: "main-draw", member: "Alice", prize: "Prize" }));
    });
  });

  it("当選者を飛ばして置き換えたら、同じ抽選でも新しい当選者を公開し直す(同じ当選者は1回だけ)", async () => {
    const { publish, tracker, state, reveal } = setup();
    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");
    publish();
    publish();
    expect(reveal).toHaveBeenCalledTimes(1);

    tracker.reset();
    state.result = { ...state.result, wonMember: { id: "m2", name: "Bob" } };
    publish();
    expect(reveal).toHaveBeenCalledTimes(1); // 新しい当選者がまだ画面に見えていない

    tracker.onAction("stopMemberDraw");
    tracker.onAction("showPrizeResult");
    publish();
    publish();
    expect(reveal).toHaveBeenCalledTimes(2);
    expect(reveal).toHaveBeenLastCalledWith("d1");
  });

  it("引き直せるほかの候補の人数(spare)を、管理端末に公開する", () => {
    const tracker = new RevealTracker();
    const host = { publish: vi.fn() };
    const publish = createHostPublisher({
      host,
      tracker,
      reveal: vi.fn().mockResolvedValue(true),
      phase: () => "prize",
      ended: () => false,
      nextLabel: () => undefined,
      result: () => ({ drawId: "d1", wonMember: { id: "m1", name: "Alice" }, wonPrize: { id: "p1", name: "Prize", order: 1 }, isKakuhen: false, createdAt: 1 }),
      spare: () => 0,
    });
    publish();
    expect(host.publish).toHaveBeenLastCalledWith(expect.objectContaining({ spare: 0 }));
  });

});
