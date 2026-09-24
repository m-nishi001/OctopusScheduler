import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import mitt from "mitt";
import { KakuhenHandler } from "./kakuhen-handler";
import { ActionQueue } from "./action-queue";

function createEmitterSpy() {
  const emitter = mitt<any>();
  const emitted: string[] = [];
  emitter.on("nextAction", () => emitted.push("nextAction"));
  return { emitter, emitted };
}

function createAnimationRef(overrides: Record<string, any> = {}) {
  return ref<any>({
    startSpin: vi.fn(),
    stopSpin: vi.fn().mockResolvedValue(undefined),
    updatePrizes: vi.fn().mockResolvedValue(undefined),
    getInternalItems: vi.fn(() => []),
    ...overrides,
  });
}

const noopLoadBgmBlob = vi.fn().mockResolvedValue(null);

describe("KakuhenHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // KakuhenHandlerの静的キャッシュはテスト間で共有されるため、
    // 各テストの前提条件が汚染されないよう明示的にリセットする。
    (KakuhenHandler as any)._prevPrize = null;
    (KakuhenHandler as any)._prevPrizes = null;
    (KakuhenHandler as any)._kakuhenPrepared = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startKakuhenDummyDraw", () => {
    it("duplicates the winner into two visual clones and starts spinning", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const winner = { id: "p1", imageAssetId: "img1", image2AssetId: "img2" };
      const prizes = ref<any[]>([winner, { id: "p2" }]);
      const animationRef = createAnimationRef();
      const kakuhenInProgress = ref(false);
      const kakuhenDummyPrize = ref<any>(null);
      const kakuhenFinalPrize = ref<any>(null);
      const preparePrizes = vi.fn().mockResolvedValue([]);
      const prizeRes: any = {
        winnerPrizeId: "p1",
        dummyWinnerPrizeId: null,
        dummyPrizeIds: [],
        drawId: "d1",
      };

      const promise = KakuhenHandler.startKakuhenDummyDraw(
        prizes,
        noopLoadBgmBlob,
        animationRef,
        kakuhenInProgress,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        preparePrizes,
        emitter,
        prizeRes
      );
      await vi.runAllTimersAsync();
      await promise;

      expect(kakuhenDummyPrize.value?.id).toBe("p1__k1");
      expect(kakuhenFinalPrize.value?.id).toBe("p1__k2");
      expect(kakuhenDummyPrize.value?.originalPrizeId).toBe("p1");
      expect(kakuhenInProgress.value).toBe(true);
      expect(animationRef.value.startSpin).toHaveBeenCalled();
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("stopKakuhenDummyDraw", () => {
    it("stops the spin on the first (dummy) occurrence and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const animationRef = createAnimationRef();
      const kakuhenDummyPrize = ref<any>({ id: "p1__k1" });

      await KakuhenHandler.stopKakuhenDummyDraw(
        animationRef,
        kakuhenDummyPrize,
        noopLoadBgmBlob,
        emitter
      );

      expect(animationRef.value.stopSpin).toHaveBeenCalledWith(2, "p1__k1", 1);
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("showKakuhenMessage", () => {
    it("resolves as soon as the kakuhen.finished event is dispatched", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const kakuhenMessageVisible = ref(false);

      const promise = KakuhenHandler.showKakuhenMessage(
        kakuhenMessageVisible,
        emitter
      );
      expect(kakuhenMessageVisible.value).toBe(true);
      window.dispatchEvent(new Event("kakuhen.finished"));
      await vi.runAllTimersAsync();
      await promise;

      expect(emitted).toEqual(["nextAction"]);
    });

    it("falls back to the timeout when kakuhen.finished is never dispatched", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const kakuhenMessageVisible = ref(false);

      const promise = KakuhenHandler.showKakuhenMessage(
        kakuhenMessageVisible,
        emitter
      );
      await vi.runAllTimersAsync();
      await promise;

      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("hideKakuhenMessage", () => {
    it("hides the overlay and resolves as soon as kakuhen.dismissed is dispatched", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const kakuhenMessageVisible = ref(true);

      const promise = KakuhenHandler.hideKakuhenMessage(
        kakuhenMessageVisible,
        emitter
      );
      expect(kakuhenMessageVisible.value).toBe(false);
      window.dispatchEvent(new Event("kakuhen.dismissed"));
      await vi.runAllTimersAsync();
      await promise;

      expect(emitted).toEqual(["nextAction"]);
    });

    it("falls back to the timeout when kakuhen.dismissed is never dispatched", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const kakuhenMessageVisible = ref(true);

      const promise = KakuhenHandler.hideKakuhenMessage(
        kakuhenMessageVisible,
        emitter
      );
      await vi.runAllTimersAsync();
      await promise;

      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("showDummyPrizeDialogAction / closeDummyPrizeDialogAction", () => {
    it("swaps in the dummy prize for display, then restores the original on close", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showDummyPrizeDialog = ref(false);
      const originalPrize = { id: "real-prize" } as any;
      const latestResult = ref<any>({ wonPrize: originalPrize });
      const kakuhenDummyPrize = ref<any>({ id: "p1__k1" });
      const updateSelectedPrize = vi.fn();

      const showPromise = KakuhenHandler.showDummyPrizeDialogAction(
        showDummyPrizeDialog,
        latestResult,
        kakuhenDummyPrize,
        emitter,
        updateSelectedPrize
      );
      await vi.runAllTimersAsync();
      await showPromise;

      expect(showDummyPrizeDialog.value).toBe(true);
      expect(latestResult.value.wonPrize).toBe(kakuhenDummyPrize.value);
      expect(updateSelectedPrize).toHaveBeenCalledWith(kakuhenDummyPrize.value);
      expect(emitted).toEqual(["nextAction"]);

      await KakuhenHandler.closeDummyPrizeDialogAction(
        showDummyPrizeDialog,
        latestResult,
        emitter,
        updateSelectedPrize
      );

      expect(showDummyPrizeDialog.value).toBe(false);
      // Vue's reactivity wraps nested object values in a proxy, so the
      // restored value is equal-by-content but not strictly identical to
      // the plain `originalPrize` object used to seed the ref.
      expect(latestResult.value.wonPrize).toEqual(originalPrize);
      expect(updateSelectedPrize).toHaveBeenLastCalledWith(originalPrize);
      expect(emitted).toEqual(["nextAction", "nextAction"]);
    });
  });

  describe("startKakuhenFinalDraw", () => {
    it("preloads bgm2 and starts the final spin", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const animationRef = createAnimationRef();
      const kakuhenFinalPrize = ref<any>({ id: "p1__k2" });

      const promise = KakuhenHandler.startKakuhenFinalDraw(
        animationRef,
        kakuhenFinalPrize,
        noopLoadBgmBlob,
        emitter
      );
      await vi.runAllTimersAsync();
      await promise;

      expect(animationRef.value.startSpin).toHaveBeenCalled();
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("startKakuhenDummyDraw -> stopKakuhenFinalDraw (static cache lifecycle)", () => {
    it("stops on the matching internal item, restores prizes, updates the dialog, and clears the static caches", async () => {
      const { emitter } = createEmitterSpy();
      const winner = { id: "p1", winningImage2AssetId: "win2" } as any;
      const other = { id: "p2" } as any;
      const prizes = ref<any[]>([winner, other]);
      const animationRef = createAnimationRef({
        getInternalItems: vi.fn(() => [{ id: "p1__k2" }, { id: "p2" }]),
      });
      const kakuhenInProgress = ref(false);
      const kakuhenDummyPrize = ref<any>(null);
      const kakuhenFinalPrize = ref<any>(null);
      const preparePrizes = vi.fn().mockResolvedValue([{ id: "restored" }]);
      const prizeRes: any = {
        winnerPrizeId: "p1",
        dummyWinnerPrizeId: null,
        dummyPrizeIds: [],
        drawId: "d1",
      };

      const startPromise = KakuhenHandler.startKakuhenDummyDraw(
        prizes,
        noopLoadBgmBlob,
        animationRef,
        kakuhenInProgress,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        preparePrizes,
        emitter,
        prizeRes
      );
      await vi.runAllTimersAsync();
      await startPromise;

      const latestResult = ref<any>({ wonPrize: winner });
      const updateSelectedPrize = vi.fn();

      await KakuhenHandler.stopKakuhenFinalDraw(
        animationRef,
        kakuhenFinalPrize,
        updateSelectedPrize,
        kakuhenInProgress,
        latestResult,
        preparePrizes,
        noopLoadBgmBlob,
        emitter
      );

      // occurrence=2 because the internal items contain a matching "p1__k2" candidate
      expect(animationRef.value.stopSpin).toHaveBeenCalledWith(5, "p1__k2", 2);
      expect(kakuhenInProgress.value).toBe(false);
      expect(latestResult.value.wonPrize).toMatchObject({
        id: "p1",
        winningImage2AssetId: "win2",
        imageAssetId: undefined,
        winningImage1AssetId: undefined,
      });
      // static caches must be cleared so the next draw cycle starts clean
      expect((KakuhenHandler as any)._prevPrizes).toBeNull();
      expect((KakuhenHandler as any)._kakuhenPrepared).toBeNull();
    });

    it("falls back to the last internal item when no candidate matches the final prize id", async () => {
      const { emitter } = createEmitterSpy();
      const winner = { id: "p1" } as any;
      const prizes = ref<any[]>([winner]);
      const animationRef = createAnimationRef({
        // no item matches "p1__k2"; only an unrelated fallback item is present
        getInternalItems: vi.fn(() => [{ id: "unrelated" }]),
      });
      const kakuhenInProgress = ref(false);
      const kakuhenDummyPrize = ref<any>(null);
      const kakuhenFinalPrize = ref<any>(null);
      const preparePrizes = vi.fn().mockResolvedValue([]);
      const prizeRes: any = {
        winnerPrizeId: "p1",
        dummyWinnerPrizeId: null,
        dummyPrizeIds: [],
        drawId: "d1",
      };

      const startPromise = KakuhenHandler.startKakuhenDummyDraw(
        prizes,
        noopLoadBgmBlob,
        animationRef,
        kakuhenInProgress,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        preparePrizes,
        emitter,
        prizeRes
      );
      await vi.runAllTimersAsync();
      await startPromise;

      const latestResult = ref<any>({ wonPrize: winner });

      await KakuhenHandler.stopKakuhenFinalDraw(
        animationRef,
        kakuhenFinalPrize,
        vi.fn(),
        kakuhenInProgress,
        latestResult,
        preparePrizes,
        noopLoadBgmBlob,
        emitter
      );

      expect(animationRef.value.stopSpin).toHaveBeenCalledWith(
        5,
        "unrelated",
        1
      );
    });
  });

  describe("getActions", () => {
    it("composes the full kakuhen action cycle without executing it", () => {
      const emitter = mitt<any>();
      const actions = KakuhenHandler.getActions(
        ref(null),
        ref(null),
        ref(null),
        ref(null),
        ref([]),
        ref(false),
        {} as any,
        ref(false),
        ref(false),
        vi.fn(),
        vi.fn(),
        ref(null),
        ref(null),
        ref(false),
        ref(false),
        ref(false),
        new ActionQueue(),
        emitter,
        { phase: "idle" },
        vi.fn(),
        null
      );

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every((a) => typeof a === "function")).toBe(true);
    });
  });
});
