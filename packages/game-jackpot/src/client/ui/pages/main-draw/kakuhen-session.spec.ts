import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KakuhenSession } from "./kakuhen-session";
import { DrawStateError } from "./draw-context";
import { createTestContext } from "./draw-context.test-helper";

const prizeRes = { winnerPrizeId: "p1", dummyWinnerPrizeId: null, dummyPrizeIds: [], drawId: "d1" };

function setup(overrides: { items?: Array<{ id: string }> } = {}) {
  const winner = { id: "p1", imageAssetId: "img1", image2AssetId: "img2", winningImage2AssetId: "win2" };
  const ctx = createTestContext();
  ctx.prizes.value = [winner, { id: "p2" }];
  ctx.prizeRes.value = prizeRes as any;
  ctx.result.value = { wonPrize: winner, wonMember: { id: "m1" } } as any;
  if (overrides.items) ctx.prizeAnim.value.getInternalItems = vi.fn(() => overrides.items);
  return { ctx, winner, session: new KakuhenSession(ctx) };
}

describe("KakuhenSession", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

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
      expect(shown[0]).toMatchObject({ originalPrizeId: "p1", imageAssetId: "img1" });
      expect(shown[1]).toMatchObject({ originalPrizeId: "p1", imageAssetId: "img2" });
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

      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenLastCalledWith(5, "p1__k2", 2);
      expect(ctx.preparePrizes).toHaveBeenLastCalledWith([winner, { id: "p2" }]); // 複製を除いた元の一覧
      expect(ctx.result.value?.wonPrize).toMatchObject({
        id: "p1",
        winningImage2AssetId: "win2",
        imageAssetId: undefined,
        winningImage1AssetId: undefined,
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

      expect(ctx.prizeAnim.value.stopSpin).toHaveBeenLastCalledWith(5, "p1__k2", 2);
    });

    it("ダミー抽選をしていない状態で止めようとしたら、原因の分かるエラーにする", async () => {
      const { session } = setup();
      await expect(session.stopFinalDraw()).rejects.toBeInstanceOf(DrawStateError);
    });
  });

  it("セッションごとに状態が独立している(前のサイクルの残りが次に影響しない)", async () => {
    const first = setup();
    await settle(first.session.startDummyDraw());

    const second = setup();
    await expect(second.session.stopFinalDraw()).rejects.toBeInstanceOf(DrawStateError);
  });
});
