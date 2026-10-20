import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import KakuhenOverlay from "./kakuhen-overlay.vue";

/**
 * 確変の「だが」の演出。進行役は `kakuhen.finished` を待って次へ進む。
 * 以前は「通知済み」の印が戻らず、2回目の確変では通知が出ないため、毎回時間切れまで待たされていた。
 */

const finished = vi.fn();
const onFinished = () => finished();

beforeEach(() => {
  vi.useFakeTimers();
  finished.mockClear();
  window.addEventListener("kakuhen.finished", onFinished);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  window.removeEventListener("kakuhen.finished", onFinished);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const show = async (wrapper: ReturnType<typeof mount>, visible: boolean) => {
  await wrapper.setProps({ visible });
  await vi.advanceTimersByTimeAsync(0);
};

describe("KakuhenOverlay", () => {
  it("表示して、2文字目の演出が終わったら kakuhen.finished を1回だけ通知する", async () => {
    const wrapper = mount(KakuhenOverlay, { props: { visible: false } });
    await show(wrapper, true);
    expect(finished).not.toHaveBeenCalled();

    wrapper.find(".char-2").element.dispatchEvent(new Event("animationend"));
    wrapper.find(".char-2").element.dispatchEvent(new Event("animationend"));
    expect(finished).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000); // 時間切れの通知が重ねて出ない
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("2回目の確変でも通知する（表示のたびに、通知済みの印が戻る）", async () => {
    const wrapper = mount(KakuhenOverlay, { props: { visible: false } });
    for (let round = 1; round <= 3; round++) {
      await show(wrapper, true);
      wrapper.find(".char-2").element.dispatchEvent(new Event("animationend"));
      expect(finished).toHaveBeenCalledTimes(round);
      await show(wrapper, false);
    }
  });

  it("演出の終わりを検知できなくても、時間が経てば通知する", async () => {
    const wrapper = mount(KakuhenOverlay, { props: { visible: false } });
    await show(wrapper, true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(finished).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("動きを減らす設定の端末では、演出を待たずにすぐ通知する", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const wrapper = mount(KakuhenOverlay, { props: { visible: false } });
    await show(wrapper, true);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("通知の前に隠された・取り外されたら、通知しない（待ち時間の予約も残らない）", async () => {
    const wrapper = mount(KakuhenOverlay, { props: { visible: false } });
    await show(wrapper, true);
    await show(wrapper, false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(finished).not.toHaveBeenCalled();

    await show(wrapper, true);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(finished).not.toHaveBeenCalled();
  });
});
