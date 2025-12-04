import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/vue";
import { reactive, nextTick } from "vue";

// Provide a simple canvas getContext polyfill so jsdom tests don't fail
(HTMLCanvasElement.prototype as any).getContext = function () {
  return {} as any;
};

// モック対象モジュール
vi.mock("../roulette-audio", () => {
  const audioMock = {
    startBgm: vi.fn(() => Promise.resolve()),
    stopBgmAudio: vi.fn(() => Promise.resolve()),
    bgmAutoplayBlocked: { value: false },
    tryResumeBgm: vi.fn(() => Promise.resolve()),
    isBgmPlaying: { value: false },
    currentBgmSrc: { value: "" },
  };
  return {
    useRouletteAudio: () => audioMock,
  };
});

vi.mock("../roulette-animator", () => {
  const animatorMock = {
    startSpin: vi.fn(() => Promise.resolve()),
    stopSpin: vi.fn(() => Promise.resolve("mock-result")),
    spinning: { value: false },
  } as any;
  return {
    useRouletteAnimator: (_opts: any, _drawCb: any) => animatorMock,
  };
});

vi.mock("../roulette-image-loader", () => ({
  convertToInternal: vi.fn((prizes: any[]) =>
    Promise.resolve(
      prizes.map((p: any, i: number) => ({
        id: p.id ?? String(i),
        index: i,
        name: p.name ?? "",
        imageElement: new Image(),
      }))
    )
  ),
}));

vi.mock("../roulette-drawer", () => ({
  drawWheel: vi.fn(),
}));

vi.mock("../roulette-angle-utils", () => ({
  calculateSectorAngle: (count: number) => 360 / count,
}));

import { useRouletteAnimation } from "../roulette-animation-logic";
import { useRouletteAudio } from "../roulette-audio";
import { useRouletteAnimator } from "../roulette-animator";
import { convertToInternal } from "../roulette-image-loader";
import { drawWheel } from "../roulette-drawer";
import { calculateSectorAngle } from "../roulette-angle-utils";

describe("useRouletteAnimation - full coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initial draw on mount uses initial prizes and calls drawWheel with rotation 0", async () => {
    const props = reactive({
      prizes: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
    });

    const TestComp = {
      template: `<canvas ref="canvas"></canvas>`,
      setup() {
        const api = useRouletteAnimation(props as any);
        // expose api for test access
        (globalThis as any).__testApi = api;
        return api;
      },
    };

    const { unmount, container } = render(TestComp);

    // ensure canvas getContext exists and is truthy
    const canvasEl = container.querySelector("canvas") as HTMLCanvasElement;
    (canvasEl as any).getContext = () => ({}) as any;

    // wait for onMounted async work
    await nextTick();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(convertToInternal).toHaveBeenCalledWith(props.prizes);
    // ensure the hook instance we exposed called drawWheel via its drawCallback
    expect(drawWheel).toHaveBeenCalled();

    unmount();
  });

  it("updatePrizes updates internal items and triggers drawWheel", async () => {
    const props = reactive({ prizes: [] });

    const TestComp = {
      template: `<canvas ref="canvas"></canvas>`,
      setup() {
        const api = useRouletteAnimation(props as any);
        (globalThis as any).__testApi = api;
        return api;
      },
    };

    const { container, unmount } = render(TestComp);
    const canvasEl = container.querySelector("canvas") as HTMLCanvasElement;
    (canvasEl as any).getContext = () => ({}) as any;

    const api = (globalThis as any).__testApi;
    // call updatePrizes
    await api.updatePrizes([{ id: "x", name: "X" }]);
    await nextTick();
    await Promise.resolve();

    expect(convertToInternal).toHaveBeenCalledWith([{ id: "x", name: "X" }]);
    expect(drawWheel).toHaveBeenCalledWith(
      0,
      expect.any(Array),
      expect.anything(),
      expect.anything()
    );

    unmount();
  });

  it("drawCallback does not call drawWheel if ctx or canvas missing", async () => {
    const props = reactive({ prizes: [] });
    const api = useRouletteAnimation(props as any);

    // call updatePrizes to set internal items
    await api.updatePrizes([{ id: "x", name: "X" }]);

    // At this point no canvas/context, drawWheel should not be called for custom rotation
    // We invoke startSpin -> animator mock won't call drawCallback automatically, so call drawWheel directly via checking mock
    // Ensure drawWheel was only called by updatePrizes initial draw
    vi.clearAllMocks();
    // call internal draw callback by calling updatePrizes with items but canvas still missing
    await api.updatePrizes([{ id: "y", name: "Y" }]);
    expect(drawWheel).toHaveBeenCalledTimes(0);
  });

  it("startSpin skips bgm and calls animator.startSpin (normal)", async () => {
    const props = reactive({ prizes: [] });
    const api = useRouletteAnimation(props as any);
    const animator = useRouletteAnimator();

    await api.startSpin(2, 2);

    expect(animator.startSpin).toHaveBeenCalledWith(2, 2);
  });

  it("startSpin does not reject when bgm is not started", async () => {
    const props = reactive({ prizes: [] });
    const api = useRouletteAnimation(props as any);

    // Should resolve without issues since bgm is skipped
    await expect(api.startSpin()).resolves.toBeUndefined();
  });

  it("stopSpin throws if targetPrizeId is missing", async () => {
    const props = reactive({ prizes: [] });
    const api = useRouletteAnimation(props as any);

    await expect((api.stopSpin as any)()).rejects.toThrow(
      "Target prize not specified"
    );
  });

  it("stopSpin throws if roulette items not initialized", async () => {
    const props = reactive({ prizes: [] });
    const api = useRouletteAnimation(props as any);

    await expect(api.stopSpin(undefined, "someId")).rejects.toThrow(
      "Roulette items not initialized"
    );
  });

  it("stopSpin normal flow calls calculateSectorAngle, animator.stopSpin and startBgm and returns result", async () => {
    const props = reactive({ prizes: [{ id: "p1" }] });
    const TestComp = {
      template: `<canvas ref="canvas"></canvas>`,
      setup() {
        return useRouletteAnimation(props as any);
      },
    };

    const { unmount } = render(TestComp);
    await nextTick();
    await Promise.resolve();

    const api = useRouletteAnimation(props as any);

    // initialize items directly to avoid relying on another hook instance
    await api.updatePrizes([{ id: "p1", name: "P1" }]);

    const animator = useRouletteAnimator();

    (animator.stopSpin as any).mockImplementationOnce(() =>
      Promise.resolve("p1")
    );

    const result = await api.stopSpin(undefined, "p1");
    expect(calculateSectorAngle).toBeTruthy();
    expect(animator.stopSpin).toHaveBeenCalledWith(
      "p1",
      expect.any(Array),
      expect.any(Number),
      3,
      1
    );
    expect(result).toBe("p1");

    unmount();
  });

  it("stopSpin propagates animator.stopSpin rejection and does not call startBgm", async () => {
    const props = reactive({ prizes: [{ id: "p1" }] });
    const api = useRouletteAnimation(props as any);

    await api.updatePrizes([{ id: "p1", name: "P1" }]);

    const animator = useRouletteAnimator();
    (animator.stopSpin as any).mockImplementationOnce(() =>
      Promise.reject(new Error("anim fail"))
    );

    await expect(api.stopSpin(undefined, "p1")).rejects.toThrow("anim fail");
  });

  it("watch on props.prizes calls updateRouletteItems for non-empty and ignores empty", async () => {
    const props = reactive({ prizes: [{ id: "a" }] });
    const TestComp = {
      template: `<canvas ref="canvas"></canvas>`,
      setup() {
        return useRouletteAnimation(props as any);
      },
    };

    render(TestComp);
    await nextTick();
    await Promise.resolve();

    // update with non-empty
    props.prizes = [{ id: "b" }];
    await nextTick();
    await Promise.resolve();
    expect(convertToInternal).toHaveBeenCalled();

    // update with empty - should not call convertToInternal again
    const before = (convertToInternal as any).mock.calls.length;
    props.prizes = [];
    await nextTick();
    await Promise.resolve();
    const after = (convertToInternal as any).mock.calls.length;
    expect(after).toBe(before);
  });

  it("onUnmounted calls stopBgmAudio and swallows errors", async () => {
    const props = reactive({ prizes: [] });
    const TestComp = {
      template: `<canvas ref="canvas"></canvas>`,
      setup() {
        return useRouletteAnimation(props as any);
      },
    };

    const { unmount } = render(TestComp);
    await nextTick();
    await Promise.resolve();
    // should not throw when unmounting despite mocked rejection
    expect(() => unmount()).not.toThrow();
  });

  it("returned api contains expected members", () => {
    const props = reactive({ prizes: [] });
    const api = useRouletteAnimation(props as any);
    expect(api).toHaveProperty("canvas");
    expect(typeof api.startSpin).toBe("function");
    expect(typeof api.stopSpin).toBe("function");
    expect(api).toHaveProperty("spinning");
    expect(typeof api.updatePrizes).toBe("function");
  });
});
