import { describe, it, expect } from "vitest";
import { useRouletteAnimator, UseRouletteOptions } from "../roulette-animator";
import { InternalRouletteItem } from "../roulette-image-loader";

// モック用のヘルパー関数
function createMockRaf() {
  let rafId = 0;
  const callbacks: { id: number; cb: FrameRequestCallback }[] = [];
  const mockRaf = (cb: FrameRequestCallback) => {
    rafId++;
    callbacks.push({ id: rafId, cb });
    return rafId;
  };
  const mockCancelRaf = (id: number) => {
    const index = callbacks.findIndex((c) => c.id === id);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  };
  const executeNextCallback = () => {
    if (callbacks.length > 0) {
      const { cb } = callbacks.shift()!;
      cb(0);
    }
  };
  return { mockRaf, mockCancelRaf, executeNextCallback };
}

function createMockNow() {
  let mockTime = 0;
  const mockNow = () => mockTime;
  const advanceTime = (ms: number) => {
    mockTime += ms;
  };
  return { mockNow, advanceTime };
}

// テストケース: useRouletteAnimator の初期化テスト
// パターン: Unit Test - コンポーザブルの初期化を確認
describe("useRouletteAnimator", () => {
  it("デフォルトオプションで初期化できる", () => {
    const { startSpin, spinning } = useRouletteAnimator();
    expect(typeof startSpin).toBe("function");
    expect(spinning.value).toBe(false);
  });

  it("カスタムオプションで初期化できる", () => {
    const { mockRaf, mockCancelRaf } = createMockRaf();
    const { mockNow } = createMockNow();
    const img = new Image();
    const opts: UseRouletteOptions = {
      raf: mockRaf,
      cancelRaf: mockCancelRaf,
      now: mockNow,
      initialPrizes: [{ id: "1", index: 0, name: "", imageElement: img }],
    };
    const { startSpin, spinning } = useRouletteAnimator(opts);
    expect(typeof startSpin).toBe("function");
    expect(spinning.value).toBe(false);
  });

  // テストケース: startSpin の基本動作テスト
  // パターン: Unit Test - スピン開始時の状態変化を確認
  it("startSpin を呼び出すと spinning が true になる", () => {
    const { mockRaf } = createMockRaf();
    const { mockNow } = createMockNow();
    const opts: UseRouletteOptions = { raf: mockRaf, now: mockNow };
    const { startSpin, spinning } = useRouletteAnimator(opts);

    startSpin(1, 1); // accelDuration=1, targetSpeed=1
    expect(spinning.value).toBe(true);

    // アニメーションはモックされているので、直接実行せず状態を確認
  });

  // テストケース: startSpin の加速完了チェック
  // パターン: Integration Test - 指定時間で加速が完了するか確認
  it("startSpin で指定時間後に加速が完了する", () => {
    const { mockRaf, executeNextCallback } = createMockRaf();
    const { mockNow, advanceTime } = createMockNow();
    let rotations: number[] = [];
    const drawCallback = (rotation: number) => rotations.push(rotation);
    const opts: UseRouletteOptions = { raf: mockRaf, now: mockNow };
    const animator = useRouletteAnimator(opts, drawCallback);

    animator.startSpin(2, 2); // accelDuration=2秒, targetSpeed=2
    // 加速期間中にアニメーションを進める
    for (let i = 0; i < 120; i++) {
      // 約2秒 (60fps * 2)
      advanceTime(16.67); // 60fps
      executeNextCallback();
    }

    // 加速完了後、回転が記録されていることを確認
    expect(rotations.length).toBeGreaterThan(0);
    // 最終回転が正の値であることを確認（アニメーションが進んだ）
    expect(rotations[rotations.length - 1]).toBeGreaterThan(0);
    // 内部状態の直接検証: currentSpeed が targetSpeed に近づく
    expect(animator.currentSpeed).toBeCloseTo(2, 1); // 許容誤差1
  });

  // テストケース: stopSpin の基本動作テスト
  // パターン: Unit Test - スピン停止時の状態変化を確認
  it("stopSpin を呼び出すと spinning が false になる", async () => {
    const { mockRaf, executeNextCallback } = createMockRaf();
    const { mockNow, advanceTime } = createMockNow();
    const img = new Image();
    const items: InternalRouletteItem[] = [
      { id: "1", index: 0, name: "", imageElement: img },
    ];
    const opts: UseRouletteOptions = { raf: mockRaf, now: mockNow };
    const { startSpin, stopSpin, spinning, currentSpeed } =
      useRouletteAnimator(opts);

    // まずスピンを開始
    startSpin(1, 1);
    expect(spinning.value).toBe(true);

    // 停止
    const promise = stopSpin("1", items, Math.PI / 2, 1); // duration=1秒
    // アニメーションを進める
    for (let i = 0; i < 60; i++) {
      // 約1秒
      advanceTime(16.67);
      executeNextCallback();
    }
    await promise;

    expect(spinning.value).toBe(false);
    // 内部状態の直接検証: 減速完了後 currentSpeed が 0 に近づく
    expect(currentSpeed).toBeCloseTo(0, 1);
  });

  // テストケース: stopSpin の減速完了チェック
  // パターン: Integration Test - 指定時間で減速が完了するか確認
  it("stopSpin で指定時間後に減速が完了する", async () => {
    const { mockRaf, executeNextCallback } = createMockRaf();
    const { mockNow, advanceTime } = createMockNow();
    let rotations: number[] = [];
    const drawCallback = (rotation: number) => rotations.push(rotation);
    const img = new Image();
    const items: InternalRouletteItem[] = [
      { id: "1", index: 0, name: "", imageElement: img },
    ];
    const opts: UseRouletteOptions = { raf: mockRaf, now: mockNow };
    const { startSpin, stopSpin } = useRouletteAnimator(opts, drawCallback);

    // スピンを開始
    startSpin(1, 1);
    // 少し進める
    for (let i = 0; i < 30; i++) {
      advanceTime(16.67);
      executeNextCallback();
    }

    // 停止
    const promise = stopSpin("1", items, Math.PI / 2, 2); // duration=2秒
    // 減速期間中にアニメーションを進める
    for (let i = 0; i < 120; i++) {
      // 約2秒
      advanceTime(16.67);
      executeNextCallback();
    }
    await promise;

    // 減速完了後、回転が記録されていることを確認
    expect(rotations.length).toBeGreaterThan(30); // 開始後の回転も含む
  });

  // テストケース: stopSpin で存在しない賞品を指定するとエラーが発生する
  // パターン: Error Handling Test - 無効な入力でエラーが発生するか確認
  it("stopSpin で存在しない賞品を指定するとエラーが発生する", async () => {
    const { stopSpin } = useRouletteAnimator();
    const img = new Image();
    const items: InternalRouletteItem[] = [
      { id: "1", index: 0, name: "", imageElement: img },
    ];

    await expect(stopSpin("999", items, Math.PI / 2)).rejects.toThrow(
      "Target prize not found"
    );
  });

  // エッジケース: 負の duration で stopSpin を呼び出す
  // パターン: Error Handling Test - 異常なパラメータで適切に処理するか確認
  it("stopSpin で負の duration を指定するとエラーが発生する", async () => {
    const { stopSpin } = useRouletteAnimator();
    const img = new Image();
    const items: InternalRouletteItem[] = [
      { id: "1", index: 0, name: "", imageElement: img },
    ];

    await expect(stopSpin("1", items, Math.PI / 2, -1)).rejects.toThrow();
  });

  // エッジケース: 0 の targetSpeed で startSpin を呼び出す
  // パターン: Edge Case Test - 境界値で動作するか確認
  it("startSpin で targetSpeed=0 を指定すると加速しない", () => {
    const { mockRaf, executeNextCallback } = createMockRaf();
    const { mockNow, advanceTime } = createMockNow();
    const opts: UseRouletteOptions = { raf: mockRaf, now: mockNow };
    const animator = useRouletteAnimator(opts);

    animator.startSpin(1, 0); // targetSpeed=0
    // 時間を進める
    for (let i = 0; i < 60; i++) {
      advanceTime(16.67);
      executeNextCallback();
    }

    // currentSpeed が 0 のままか確認（加速しない）
    expect(animator.currentSpeed).toBe(0);
  });

  // エッジケース: 複数の賞品で stopSpin を呼び出す
  // パターン: Integration Test - 複数のアイテムで正しく動作するか確認
  it("stopSpin で複数の賞品から正しいものを選択する", async () => {
    const { mockRaf, executeNextCallback } = createMockRaf();
    const { mockNow, advanceTime } = createMockNow();
    const img = new Image();
    const items: InternalRouletteItem[] = [
      { id: "1", index: 0, name: "", imageElement: img },
      { id: "2", index: 1, name: "", imageElement: img },
      { id: "3", index: 2, name: "", imageElement: img },
    ];
    const opts: UseRouletteOptions = { raf: mockRaf, now: mockNow };
    const { startSpin, stopSpin, spinning } = useRouletteAnimator(opts);

    startSpin(1, 1);
    expect(spinning.value).toBe(true);

    const promise = stopSpin("2", items, Math.PI / 2, 1); // index=1 の賞品
    for (let i = 0; i < 60; i++) {
      advanceTime(16.67);
      executeNextCallback();
    }
    const result = await promise;

    expect(spinning.value).toBe(false);
    expect(result).toBe("2");
  });

  // エッジケース: startSpin 中に stopSpin を複数回呼び出す
  // パターン: Concurrency Test - 連続呼び出しで適切に処理するか確認
  it("startSpin 中に stopSpin を複数回呼び出すと最後のものが有効", async () => {
    const { mockRaf, executeNextCallback } = createMockRaf();
    const { mockNow, advanceTime } = createMockNow();
    const img = new Image();
    const items: InternalRouletteItem[] = [
      { id: "1", index: 0, name: "", imageElement: img },
      { id: "2", index: 1, name: "", imageElement: img },
    ];
    const opts: UseRouletteOptions = { raf: mockRaf, now: mockNow };
    const { startSpin, stopSpin, spinning } = useRouletteAnimator(opts);

    startSpin(1, 1);
    expect(spinning.value).toBe(true);

    // 複数回 stopSpin を呼び出す
    const promise1 = stopSpin("1", items, Math.PI / 2, 1);
    const promise2 = stopSpin("2", items, Math.PI / 2, 1); // 最後のものが有効

    for (let i = 0; i < 60; i++) {
      advanceTime(16.67);
      executeNextCallback();
    }

    await promise1; // 最初の呼び出しも完了させる
    const result2 = await promise2;

    expect(spinning.value).toBe(false);
    expect(result2).toBe("2"); // 最後の呼び出しが有効
  });
});
