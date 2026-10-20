import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SlotAnimation from "./slot-animation.vue";
import type { AnimationRef } from "../animation-types";
import type { PrizeDto } from "@control/prize/dto/prize-dto";

vi.mock("@octopus/composables/use-audio", () => ({
  useAudio: () => ({
    load: vi.fn(() => Promise.resolve()),
    play: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
  }),
}));

const prizes: PrizeDto[] = [
  { id: "p1", name: "賞1", order: 1 },
  { id: "p2", name: "賞2", order: 2 },
  { id: "p3", name: "賞3", order: 3 },
];

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

  // 画面の当選と保存した抽選結果が食い違わないこと: 止める景品が無いとき、乱数で別の景品に止めない
  it("止める景品が演出の中に無いときは、別の景品で止まらず、例外にする（止まったと通知もしない）", async () => {
    const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
    const api = wrapper.vm as unknown as Required<AnimationRef>;
    await api.startSpin();

    await expect(api.stopSpin(3, "no-such-prize")).rejects.toThrow("no-such-prize");
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.emitted("stopped")).toBeUndefined();
  });

  // 確変では、当選景品を2つに複製した一覧(p1__k1 / p1__k2)を流して、その複製に止める。
  // スロットがこれに対応していないと、複製が見つからず、乱数で別の景品に止まっていた。
  describe("確変: 流す景品の差し替え", () => {
    const kakuhenItems = [
      { id: "p1__k1", name: "賞1" },
      { id: "p1__k2", name: "賞1" },
      { id: "p2", name: "賞2" },
    ];

    it("updatePrizes で差し替えた景品が getInternalItems に出て、複製の景品に止まれる", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      expect(api.getInternalItems().map((i) => i.id)).toEqual(["p1", "p2", "p3"]);

      await api.updatePrizes(kakuhenItems);
      expect(api.getInternalItems().map((i) => i.id)).toEqual(["p1__k1", "p1__k2", "p2"]);

      await api.startSpin();
      const stopped = api.stopSpin(3, "p1__k2");
      await vi.advanceTimersByTimeAsync(5000);
      await expect(stopped).resolves.toBe("p1__k2");
      expect(wrapper.emitted("stopped")?.[0]).toEqual(["p1__k2"]);
    });

    it("元の一覧に戻すと、複製は止められなくなり、元の景品に止まれる", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.updatePrizes(kakuhenItems);
      await api.updatePrizes(prizes);

      await api.startSpin();
      await expect(api.stopSpin(3, "p1__k2")).rejects.toThrow("p1__k2");
      const stopped = api.stopSpin(3, "p3");
      await vi.advanceTimersByTimeAsync(5000);
      await expect(stopped).resolves.toBe("p3");
    });
  });

  // 3列のリールが回る間、窓(3マス)が帯の外(黒)を映さないこと(以前は帯の末尾で位置を戻す瞬間に黒が見えた)
  describe("リールの継ぎ目(今回の不具合)", () => {
    const px = (s: string | undefined) => Number.parseFloat(s ?? "0");

    /** 描画された帯と窓の関係を、DOMから読む。 */
    function inspect(wrapper: ReturnType<typeof mount>) {
      const itemH = px((wrapper.element as HTMLElement).style.getPropertyValue("--slot-item-h"));
      return wrapper.findAll(".reel").map((reel) => {
        const content = reel.find(".reel-content").element as HTMLElement;
        const shift = -px(/translateY\((.*)px\)/.exec(content.style.transform)?.[1]);
        const rows = reel.findAll(".prize-item");
        return { itemH, shift, rows, windowBottom: shift + 3 * itemH, stripHeight: rows.length * itemH };
      });
    }

    it("回転中は毎フレーム、どのリールも窓が帯の内側に収まる", async () => {
      const frames: Array<() => void> = [];
      vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
        frames.push(cb);
        return 0;
      });
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
      await (wrapper.vm as unknown as Required<AnimationRef>).startSpin();

      for (let frame = 0; frame < 1500; frame++) {
        frames.splice(0).forEach((run) => run());
        await wrapper.vm.$nextTick();
        for (const reel of inspect(wrapper)) {
          expect(reel.shift, `frame ${frame}`).toBeGreaterThanOrEqual(0);
          expect(reel.windowBottom, `frame ${frame}`).toBeLessThanOrEqual(reel.stripHeight);
        }
      }
    });

    it("どの景品に止めても、窓が帯の内側に収まり、一番上にその景品が見える", async () => {
      for (const target of prizes) {
        const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: target } });
        const api = wrapper.vm as unknown as Required<AnimationRef>;
        await api.startSpin();
        const stopped = api.stopSpin(3, target.id);
        await vi.advanceTimersByTimeAsync(5000);
        await stopped;
        for (const reel of inspect(wrapper)) {
          expect(reel.windowBottom).toBeLessThanOrEqual(reel.stripHeight);
          expect(reel.rows[Math.round(reel.shift / reel.itemH)].text()).toBe(target.name);
        }
      }
    });

    it("景品が1件・2件でも、帯が空白にならない", async () => {
      for (const n of [1, 2]) {
        const few = (prizes).slice(0, n);
        const wrapper = mount(SlotAnimation, { props: { prizes: few, selectedPrize: few[0] } });
        for (const reel of inspect(wrapper)) {
          expect(reel.rows.length).toBeGreaterThanOrEqual(3);
          expect(reel.rows.every((row) => row.text() !== "")).toBe(true);
        }
      }
    });
  });
});
