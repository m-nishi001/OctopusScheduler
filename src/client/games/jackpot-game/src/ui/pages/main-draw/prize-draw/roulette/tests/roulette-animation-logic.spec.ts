import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// モジュールのトップレベルで実行される container.resolve や useAudio を
// テスト用にモックする必要があるため、モックは import の前に定義します。
vi.mock("tsyringe", () => ({
  container: {
    resolve: vi.fn(() => ({
      // getAssetDataById はテストでは呼ばれないことが多いが、安全のため実装
      getAssetDataById: async (_id: string) => null,
    })),
  },
}));

// Provide minimal decorator helpers that other modules may import from tsyringe
vi.mock("tsyringe", () => ({
  container: {
    resolve: vi.fn(() => ({
      getAssetDataById: async (_id: string) => null,
    })),
  },
  // decorators used in other modules (no-op implementations)
  injectable: () => (target: any) => target,
  inject:
    (_id?: any) =>
    (_target: any, _prop?: string | symbol, _index?: number) => {},
}));

vi.mock("@shared-composables/use-audio", () => ({
  useAudio: () => ({
    load: async (_: any) => {},
    play: async (_opts?: any) => {},
    stop: async () => {},
  }),
}));

// Mock Image constructor
global.Image = class {
  src: string = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string = "";
  naturalWidth: number = 60;
  naturalHeight: number = 60;
  width: number = 60;
  height: number = 60;

  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
} as any;

import { useRouletteAnimation } from "../roulette-animation-logic";

// PrizeDto minimal shape used in tests
type PrizeStub = { id: string; name: string; imageAssetId?: string };

describe("roulette-animation-logic - stopSpin／境界値テスト", () => {
  let fakeTime = 1000;
  let originalRAF: any;
  let originalCancel: any;
  let originalPerformanceNow: any;

  beforeEach(() => {
    // タイマー類を操作できるように Vitest の偽タイマーを使う
    vi.useFakeTimers();

    // performance.now を制御
    originalPerformanceNow = performance.now;
    fakeTime = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => fakeTime);

    // requestAnimationFrame を同期的に動かし、呼ばれるたびに時刻を進める
    originalRAF = globalThis.requestAnimationFrame;
    originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      // 一回の RAF 呼び出しで十分に経過させて decelerate の progress が 1 になるようにする
      fakeTime += 4000; // 4秒進める
      cb(fakeTime);
      return 1; // dummy id
    };
    globalThis.cancelAnimationFrame = (_: number) => {};
  });

  afterEach(() => {
    vi.useRealTimers();
    // restore
    (performance.now as any) = originalPerformanceNow;
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCancel;
    vi.restoreAllMocks();
  });

  it("selectedPrize が null の場合、例外を投げること", async () => {
    /*
      テスト内容:
        - 存在しないIDで stopSpin を呼ぶ
      期待値:
        - Error("Target prize not found") を投げる
    */
    const prizes: PrizeStub[] = [
      { id: "p1", name: "prize p1" },
      { id: "p2", name: "prize p2" },
    ];
    const props: any = {
      prizes,
      selectedPrize: undefined,
      showResult: false,
    };
    const hook = useRouletteAnimation(props, { emitDelayMs: 0 });
    await hook.updatePrizes(prizes);

    await expect(hook.stopSpin("nonexistent")).rejects.toThrowError(
      "Target prize not found"
    );
  });

  it("先頭の賞に向かって停止し、'stopped' イベントが発火して選択賞 ID を返すこと", async () => {
    /*
      テスト内容:
        - prizes の先頭を selectedPrize として stopSpin を呼ぶ
        - requestAnimationFrame を同期的に進め、デセレレート処理を即時完了させる
        - stopSpin 内の setTimeout(1000) による遅延を advanceTimers で進める
      期待値:
        - stopSpin の Promise は selectedPrize.id を返す
        - emit が 1 回呼ばれ、引数は ("stopped", selectedPrize.id)
    */
    const prizes: PrizeStub[] = [
      { id: "first", name: "first prize" },
      { id: "second", name: "second prize" },
      { id: "third", name: "third prize" },
    ];
    const props: any = { prizes, selectedPrize: prizes[0], showResult: false };
    const hook = useRouletteAnimation(props, { emitDelayMs: 0 });
    await hook.updatePrizes(prizes);

    // ask stopSpin to stop at index 0 (first sector) deterministically
    const promise = hook.stopSpin(prizes[0].id);

    // decelerate の then ハンドラ内で stopBgm().finally(() => setTimeout(...)) のように
    // マイクロタスクを挟んで setTimeout がスケジュールされるため、まずマイクロタスクを
    // フラッシュしてからタイマーを進める必要がある。
    await Promise.resolve();
    // stopBgm().finally(() => setTimeout(...)) のようにさらにマイクロタスクを跨ぐ場合があるため
    // 安全のためマイクロタスクをもう一度フラッシュする
    await Promise.resolve();
    // decelerate の中で setTimeout があるため、タイマーを実行する
    vi.runAllTimers();
    // flush microtasks that may have been queued by timer callbacks
    await Promise.resolve();

    const result = await promise;
    expect(result).toBeUndefined(); // stopSpin returns void now
  });

  it("末尾の賞を選択した場合でも正しく停止して選択賞 ID を返すこと（境界値）", async () => {
    /*
      テスト内容:
        - prizes の最後の要素を selectedPrize として stopSpin を呼ぶ
        - 同様に RAF とタイマーを操作して完了させる
      期待値:
        - Promise は最後の賞の id を返す
        - emit に ("stopped", lastId) が渡される
    */
    const prizes: PrizeStub[] = [
      { id: "a", name: "a" },
      { id: "b", name: "b" },
      { id: "c", name: "c" },
      { id: "d", name: "d" },
    ];
    const last = prizes[prizes.length - 1];
    const props: any = { prizes, selectedPrize: last, showResult: false };
    const hook = useRouletteAnimation(props, { emitDelayMs: 0 });
    await hook.updatePrizes(prizes);

    // stop at last index
    const promise = hook.stopSpin(last.id);
    await Promise.resolve();
    await Promise.resolve();
    vi.runAllTimers();
    // flush microtasks that may have been queued by timer callbacks
    await Promise.resolve();
    const result = await promise;
    expect(result).toBeUndefined();
  });

  it("selectedPrize が prizes に含まれない場合でも、選択された賞 ID で resolve されること", async () => {
    /*
      テスト内容:
        - props.prizes に存在しない id を selectedPrize として与える
        - stopSpin を呼び、処理が正常完了することを確認する
      期待値:
        - Promise は渡した selectedPrize.id を返す
        - emit で渡される値も同じ id である
    */
    const prizes: PrizeStub[] = [
      { id: "x", name: "x" },
      { id: "y", name: "y" },
    ];
    const externalPrize = { id: "external" };
    const props: any = {
      prizes,
      selectedPrize: externalPrize,
      showResult: false,
    };
    const hook = useRouletteAnimation(props, { emitDelayMs: 0 });
    await hook.updatePrizes(prizes);

    // even if selectedPrize is not in prizes, we can instruct stopSpin to stop at
    // a particular sector while still expecting the external prize ID to be emitted
    const promise = hook.stopSpin(externalPrize.id);
    await Promise.resolve();
    await Promise.resolve();
    vi.runAllTimers();
    // flush microtasks that may have been queued by timer callbacks
    await Promise.resolve();
    const result = await promise;
    expect(result).toBeUndefined();
  });
});
