import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KakuhenSession } from "./kakuhen-session";
import { DrawStateError } from "./draw-context";
import { createTestContext } from "./draw-context.test-helper";
import { playWinningBgm } from "./bgm";

vi.mock("./bgm", () => ({ playWinningBgm: vi.fn().mockResolvedValue(undefined), preloadBgm: vi.fn().mockResolvedValue(undefined) }));

const prizeRes = { winnerPrizeId: "p1", dummyWinnerPrizeId: null, dummyPrizeIds: [], drawId: "d1" };

function setup(overrides: { items?: Array<{ id: string }> } = {}) {
  const winner = { id: "p1", name: "p1", order: 1, image: "img1", image2: "img2", winningImage1: "win1", winningImage2: "win2" };
  const ctx = createTestContext();
  ctx.prizes.value = [winner, { id: "p2", name: "p2", order: 2 }];
  ctx.prizeRes.value = prizeRes as any;
  ctx.result.value = { wonPrize: winner, wonMember: { id: "m1" } } as any;
  if (overrides.items) ctx.prizeAnim.value.getInternalItems = vi.fn(() => overrides.items);
  return { ctx, winner, session: new KakuhenSession(ctx) };
}

describe("KakuhenSession", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  beforeEach(() => vi.clearAllMocks());

  const settle = async (p: Promise<unknown>) => {
    await vi.runAllTimersAsync();
    await p;
  };

  describe("ダミー抽選", () => {
    it("当選景品を画像1・画像2の2つに複製して流し、回し始める", async () => {
      const { ctx, session } = setup();

      await settle(session.startDummyDraw());

      const shown = ctx.preparePrizes.mock.calls[0][0] as any[];
      expect(shown.map((p) => p.id)).toEqual(["p1__k1", "p1__k2"]);
      expect(shown[0]).toMatchObject({ originalPrizeId: "p1", image: "img1" });
      expect(shown[1]).toMatchObject({ originalPrizeId: "p1", image: "img2" });
      // 当選ダイアログに出す画像も、1つ目は画像1側・2つ目は画像2側になる(景品の名前と ID は同じ)
      expect(shown[0]).toMatchObject({ name: "p1", winningImage1: "win1" });
      expect(shown[1]).toMatchObject({ name: "p1", winningImage1: "win2" });
      expect(ctx.prizeAnim.value.updatePrizes).toHaveBeenCalled();
      expect(ctx.prizeAnim.value.startSpin).toHaveBeenCalled();
    });

    it("1つ目(画像1)のセクターに止める", async () => {
      const { ctx, session } = setup();
      await settle(session.startDummyDraw());

      await settle(session.stopDummyDraw());

      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenCalledWith(2, "p1__k1", 1);
    });
  });

  describe("メッセージ", () => {
    it("kakuhen.finished が来たらオーバーレイの完了を待つのをやめる。kakuhen.dismissed で閉じ終わる", async () => {
      const { ctx, session } = setup();

      const shown = session.showMessage();
      expect(ctx.kakuhenOverlayVisible.value).toBe(true);
      window.dispatchEvent(new Event("kakuhen.finished"));
      await settle(shown);

      const hidden = session.hideMessage();
      expect(ctx.kakuhenOverlayVisible.value).toBe(false);
      window.dispatchEvent(new Event("kakuhen.dismissed"));
      await settle(hidden);
    });

    it("完了の通知が来なくても、タイムアウトで先へ進む", async () => {
      const { session } = setup();
      await settle(session.showMessage());
      await settle(session.hideMessage());
    });
  });

  describe("ダミーの当選ダイアログ", () => {
    it("ダミー景品に差し替えて見せ、閉じると本来の当選景品に戻す", async () => {
      const { ctx, winner, session } = setup();
      await settle(session.startDummyDraw());

      await settle(session.showDummyPrizeDialog());
      expect(ctx.showPrizeWinningDialog.value).toBe(true);
      expect(ctx.result.value?.wonPrize?.id).toBe("p1__k1");
      expect(ctx.setSelectedPrize).toHaveBeenLastCalledWith(expect.objectContaining({ id: "p1__k1" }));

      session.closeDummyPrizeDialog();
      expect(ctx.showPrizeWinningDialog.value).toBe(false);
      expect(ctx.result.value?.wonPrize).toEqual(winner);
      expect(ctx.setSelectedPrize).toHaveBeenLastCalledWith(winner);
    });
  });

  describe("本抽選", () => {
    it("回し始める", async () => {
      const { ctx, session } = setup();
      await settle(session.startDummyDraw());
      ctx.prizeAnim.value.startSpin.mockClear();

      await settle(session.startFinalDraw());

      expect(ctx.prizeAnim.value.startSpin).toHaveBeenCalledTimes(1);
    });

    it("2つ目(画像2)のセクターに止め、元の景品一覧へ戻し、最終ダイアログには画像2だけの景品を見せる", async () => {
      const { ctx, winner, session } = setup({ items: [{ id: "p1__k2" }, { id: "p2" }] });
      await settle(session.startDummyDraw());

      await settle(session.stopFinalDraw());

      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenLastCalledWith(5, "p1__k2", 1);
      expect(ctx.preparePrizes).toHaveBeenLastCalledWith([winner, { id: "p2", name: "p2", order: 2 }]); // 複製を除いた元の一覧
      expect(ctx.result.value?.wonPrize).toMatchObject({
        id: "p1",
        winningImage2: "win2",
        image: undefined,
        winningImage1: undefined,
      });
    });

    it("複製したセクターが見つからないときは、最後のセクターに止める", async () => {
      const { ctx, session } = setup({ items: [{ id: "unrelated" }] });
      await settle(session.startDummyDraw());

      await settle(session.stopFinalDraw());

      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenLastCalledWith(5, "unrelated", 1);
    });

    it("内部アイテムが空でも落ちず、2つ目のセクターを指定して止める", async () => {
      const { ctx, session } = setup({ items: [] });
      await settle(session.startDummyDraw());

      await settle(session.stopFinalDraw());

      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenLastCalledWith(5, "p1__k2", 1);
    });

    it("ダミー抽選をしていない状態で止めようとしたら、原因の分かるエラーにする", async () => {
      const { session } = setup();
      await expect(session.stopFinalDraw()).rejects.toBeInstanceOf(DrawStateError);
    });
  });

  describe("1回目はダミー当選景品(dummyWinnerPrizeId)", () => {
    function withDummy() {
      const winner = { id: "p1", name: "確変景品", order: 1, image: "img1", image2: "img2", winningImage1: "win1", winningImage2: "win2", bgm1: "dummy.mp3", bgm2: "win.mp3" };
      const dummy = { id: "p2", name: "ダミー景品", order: 2, image: "d-img", winningImage1: "d-win", bgm1: "normal.mp3" };
      const ctx = createTestContext();
      ctx.prizes.value = [winner, dummy, { id: "p3", name: "p3", order: 3 }];
      ctx.prizeRes.value = { winnerPrizeId: "p1", dummyWinnerPrizeId: "p2", dummyPrizeIds: ["p3"], drawId: "d1" } as any;
      ctx.result.value = { wonPrize: winner, wonMember: { id: "m1" } } as any;
      return { ctx, winner, session: new KakuhenSession(ctx) };
    }

    it("ルーレットには、ダミー景品・本物の景品・ほかのダミーを流す。止まる先と当選ダイアログはダミー景品の名前・画像", async () => {
      const { ctx, session } = withDummy();
      await settle(session.startDummyDraw());
      const shown = ctx.preparePrizes.mock.calls[0][0] as any[];
      expect(shown.map((p) => p.id)).toEqual(["p2__k1", "p1__k2", "p3"]);

      await settle(session.stopDummyDraw());
      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenCalledWith(2, "p2__k1", 1);

      await settle(session.showDummyPrizeDialog());
      expect(ctx.result.value?.wonPrize).toMatchObject({ id: "p2__k1", name: "ダミー景品", originalPrizeId: "p2", winningImage1: "d-win" });
    });

    it("♪ダミー当選は、確変景品の行の bgm1(ダミー景品の bgm1 ではない)。最終は確変景品の bgm2", async () => {
      const { session } = withDummy();
      await settle(session.startDummyDraw());
      await settle(session.stopDummyDraw());
      expect(playWinningBgm).toHaveBeenLastCalledWith("dummy.mp3", expect.any(Number), expect.anything());

      await settle(session.stopFinalDraw());
      expect(playWinningBgm).toHaveBeenLastCalledWith("win.mp3", 5, expect.anything());
    });

    it("最終は本物のセクター(1つしかない)に止まり、本物の景品を見せる", async () => {
      const { ctx, session } = withDummy();
      ctx.prizeAnim.value.getInternalItems = vi.fn(() => [{ id: "p2__k1" }, { id: "p1__k2" }, { id: "p3" }]);
      await settle(session.startDummyDraw());
      await settle(session.stopFinalDraw());
      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenLastCalledWith(5, "p1__k2", 1);
      expect(ctx.result.value?.wonPrize).toMatchObject({ id: "p1", name: "確変景品" });
    });

    it("指定が無い(null)ときは、本物の景品の複製(今までどおり)", async () => {
      const { ctx, session } = setup();
      await settle(session.startDummyDraw());
      expect((ctx.preparePrizes.mock.calls[0][0] as any[]).map((p) => p.id)).toEqual(["p1__k1", "p1__k2"]);
    });
  });

  describe("景品抽選BGMと当選BGM", () => {
    it("ダミー開始で景品抽選BGMを流し、ダミー停止で 景品抽選BGMを即止め → ♪ダミー当選の順", async () => {
      const { ctx, session } = setup();
      const order: string[] = [];
      ctx.prizeLotteryBgm.playRandom.mockImplementation(async () => void order.push("lottery:play"));
      ctx.prizeLotteryBgm.stop.mockImplementation(async () => void order.push("lottery:stop"));
      (playWinningBgm as any).mockImplementation(async () => void order.push("win:play"));

      await settle(session.startDummyDraw());
      await settle(session.stopDummyDraw());
      expect(order).toEqual(["lottery:play", "lottery:stop", "win:play"]);
    });

    it("本抽選は、開始でもう一度景品抽選BGMを流し、停止で 景品抽選BGMを即止め → ♪当選(停止秒つき)", async () => {
      const { ctx, session } = setup({ items: [{ id: "p1__k2" }] });
      await settle(session.startDummyDraw());
      ctx.prizeLotteryBgm.playRandom.mockClear();
      ctx.prizeLotteryBgm.stop.mockClear();

      await settle(session.startFinalDraw());
      expect(ctx.prizeLotteryBgm.playRandom).toHaveBeenCalledTimes(1);

      await settle(session.stopFinalDraw());
      expect(ctx.prizeLotteryBgm.stop).toHaveBeenCalledTimes(1);
      expect(ctx.prizeLotteryBgm.fadeOut).not.toHaveBeenCalled();
    });
  });

  it("景品抽選BGMの再生・停止が永久に解決しなくても、確変の進行は最後まで進む(退行)", async () => {
    const { ctx, session } = setup({ items: [{ id: "p1__k2" }] });
    ctx.prizeLotteryBgm.playRandom.mockImplementation(() => new Promise(() => {}));
    ctx.prizeLotteryBgm.stop.mockImplementation(() => new Promise(() => {}));
    await settle(session.startDummyDraw());
    await settle(session.stopDummyDraw());
    await settle(session.showDummyPrizeDialog());
    await settle(session.startFinalDraw());
    await settle(session.stopFinalDraw());
    expect(ctx.prizeAnim.value.stopSpin).toHaveBeenLastCalledWith(5, "p1__k2", 1);
  });

  it("セッションごとに状態が独立している(前のサイクルの残りが次に影響しない)", async () => {
    const first = setup();
    await settle(first.session.startDummyDraw());

    const second = setup();
    await expect(second.session.stopFinalDraw()).rejects.toBeInstanceOf(DrawStateError);
  });
});
