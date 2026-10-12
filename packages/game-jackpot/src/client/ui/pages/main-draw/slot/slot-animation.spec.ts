import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SlotAnimation from "./slot-animation.vue";
import type { AnimationRef } from "./animation-types";

vi.mock("@octopus/composables/use-audio", () => ({
  useAudio: () => ({
    load: vi.fn(() => Promise.resolve()),
    play: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
  }),
}));

const prizes = [
  { id: "p1", name: "賞1" },
  { id: "p2", name: "賞2" },
  { id: "p3", name: "賞3" },
] as never[];

beforeEach(() => {
  vi.useFakeTimers();
  // アニメーションのループは手動で回さない(回転量ではなく、親から操作できるかを見る)
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SlotAnimation", () => {
  // 景品抽選で「開始しても何も動かない」不具合の再発防止:
  // 親(抽選の進行)は ref 越しに startSpin/stopSpin を呼ぶので、公開されていなければ黙って何も起きない。
  it("親から ref 越しに startSpin / stopSpin を呼べる", () => {
    const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[1] } });
    const api = wrapper.vm as unknown as AnimationRef;
    expect(typeof api.startSpin).toBe("function");
    expect(typeof api.stopSpin).toBe("function");
  });

  it("startSpin で回り始め、stopSpin で指定した景品に止まる", async () => {
    const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
    const api = wrapper.vm as unknown as Required<AnimationRef>;

    await api.startSpin();
    expect(wrapper.classes()).toContain("spinning");

    const stopped = api.stopSpin(3, "p3");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(stopped).resolves.toBe("p3");
    expect(wrapper.classes()).not.toContain("spinning");
    expect(wrapper.emitted("stopped")?.[0]).toEqual(["p3"]);
  });
});
