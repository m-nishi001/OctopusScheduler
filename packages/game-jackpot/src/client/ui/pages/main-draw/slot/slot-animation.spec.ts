import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SlotAnimation from "./slot-animation.vue";
import type { AnimationRef } from "../animation-types";
import { WIN_ROW } from "./reel-model";
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

    it("どの景品に止めても、窓が帯の内側に収まり、真ん中の行にその景品が見える", async () => {
      for (const target of prizes) {
        const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: target } });
        const api = wrapper.vm as unknown as Required<AnimationRef>;
        await api.startSpin();
        const stopped = api.stopSpin(3, target.id);
        await vi.advanceTimersByTimeAsync(5000);
        await stopped;
        for (const reel of inspect(wrapper)) {
          expect(reel.windowBottom).toBeLessThanOrEqual(reel.stripHeight);
          expect(reel.rows[Math.round(reel.shift / reel.itemH) + WIN_ROW].text()).toBe(target.name);
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

  // ---- 並び・大きさ・止まり方(景品抽選のスロットの見直し) ----
  const px = (s: string | undefined) => Number.parseFloat(s ?? "0");
  const rngOf = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** 8件(ルーレットと同じ用意済みの景品: 当選景品 + ダミー)。 */
  const prepared = ["特賞", "一等", "二等", "三等", "四等", "五等", "六等", "七等"].map((name, i) => ({ id: `q${i}`, name, order: i }));
  type Wrapper = ReturnType<typeof mount>;
  const reelNames = (wrapper: Wrapper) => wrapper.findAll(".reel").map((reel) => reel.findAll(".prize-item").map((row) => row.text()));
  const shiftOf = (wrapper: Wrapper, reel: number) => {
    const content = wrapper.findAll(".reel")[reel].find(".reel-content").element as HTMLElement;
    return -px(/translateY\((.*)px\)/.exec(content.style.transform)?.[1]);
  };
  const itemHeightOf = (wrapper: Wrapper) => px((wrapper.element as HTMLElement).style.getPropertyValue("--slot-item-h"));
  const setViewport = (width: number, height: number) => {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("innerHeight", height);
  };
  /** 描画された輪(窓の高さ分の重複を除いたもの)で、同じ名前が隣り合っていない。 */
  const expectNoAdjacentRepeat = (names: string[], label = "") => {
    const loop = names.slice(0, names.length - 3);
    loop.forEach((name, i) => expect(name, label).not.toBe(loop[(i + 1) % loop.length]));
  };

  describe("景品の並び", () => {
    it("用意済みの景品(当選景品 + ダミー)があれば、全景品ではなくそれを流す", () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, selectedPrize: prizes[0] } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      expect(api.getInternalItems().map((i) => i.id)).toEqual(prepared.map((p) => p.id));
      expect(new Set(reelNames(wrapper).flat())).toEqual(new Set(prepared.map((p) => p.name)));
    });

    it("用意済みの景品がまだ無いときは、全景品を流す。あとから届けば入れ替わる", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      expect(api.getInternalItems().map((i) => i.id)).toEqual(["p1", "p2", "p3"]);
      await wrapper.setProps({ preparedPrizes: prepared });
      expect(api.getInternalItems().map((i) => i.id)).toEqual(prepared.map((p) => p.id));
    });

    it("3本のリールは別の並びで、どれも同じ名前が隣り合わない(継ぎ目も含む)", () => {
      for (let seed = 1; seed <= 30; seed++) {
        const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, rng: rngOf(seed) } });
        const reels = reelNames(wrapper);
        expect(new Set(reels.map((r) => r.join(","))).size, `seed=${seed}`).toBe(3);
        for (const names of reels) expectNoAdjacentRepeat(names, `seed=${seed}`);
        wrapper.unmount();
      }
    });

    it("同じ名前の景品(確変の複製)も、隣り合わない", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, rng: rngOf(9) } });
      await (wrapper.vm as unknown as Required<AnimationRef>).updatePrizes([
        { id: "p1__k1", name: "賞1" },
        { id: "p1__k2", name: "賞1" },
        { id: "p2", name: "賞2" },
        { id: "p3", name: "賞3" },
      ]);
      for (const names of reelNames(wrapper)) expectNoAdjacentRepeat(names);
    });

    it("回し始めるたびに並びを組み直す(毎回同じ並びにならない)", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, rng: rngOf(3) } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      const before = reelNames(wrapper).map((r) => r.join(","));
      await api.startSpin();
      expect(reelNames(wrapper).map((r) => r.join(","))).not.toEqual(before);
    });

    it("同じ景品の一覧を入れ直されても(確変の途中)並びは変わらない。違う一覧なら組み直す", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, rng: rngOf(4) } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.updatePrizes(prepared);
      const once = reelNames(wrapper).map((r) => r.join(","));
      await api.updatePrizes(prepared.map((p) => ({ ...p })));
      expect(reelNames(wrapper).map((r) => r.join(","))).toEqual(once);
      await api.updatePrizes(prepared.slice(0, 5));
      expect(reelNames(wrapper).map((r) => r.join(","))).not.toEqual(once);
    });
  });

  describe("大きさ", () => {
    it("窓の高さと幅から決まり、1080p では旧(140px)より大きい", () => {
      setViewport(1920, 1080);
      const big = mount(SlotAnimation, { props: { prizes } });
      expect(itemHeightOf(big)).toBeGreaterThan(170);
      expect(px((big.element as HTMLElement).style.getPropertyValue("--slot-font"))).toBeGreaterThanOrEqual(58);
      setViewport(1280, 720);
      const small = mount(SlotAnimation, { props: { prizes } });
      expect(itemHeightOf(small)).toBeLessThan(itemHeightOf(big));
      // 幅が足りなければ幅に合わせる
      setViewport(600, 1200);
      const narrow = mount(SlotAnimation, { props: { prizes } });
      expect(itemHeightOf(narrow)).toBeLessThan(itemHeightOf(small));
    });

    it("窓の大きさが変わったら(resize)、大きさを組み直す。止まっているリールの景品はずれない", async () => {
      setViewport(1920, 1080);
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[2] } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      const stopped = api.stopSpin(3, "p3");
      await vi.advanceTimersByTimeAsync(5000);
      await stopped;
      const before = itemHeightOf(wrapper);
      const rowBefore = shiftOf(wrapper, 0) / before;

      setViewport(1280, 720);
      window.dispatchEvent(new Event("resize"));
      await wrapper.vm.$nextTick();
      const after = itemHeightOf(wrapper);
      expect(after).toBeLessThan(before);
      expect(shiftOf(wrapper, 0) / after).toBeCloseTo(rowBefore, 6);
      // 止まっている景品が、いまも当たりの行(真ん中)に見える
      const rows = wrapper.findAll(".reel")[0].findAll(".prize-item");
      expect(rows[Math.round(shiftOf(wrapper, 0) / after) + WIN_ROW].text()).toBe("賞3");
      wrapper.unmount();
    });

    it("外すと resize を聞かなくなる", () => {
      setViewport(1920, 1080);
      const remove = vi.spyOn(window, "removeEventListener");
      const wrapper = mount(SlotAnimation, { props: { prizes } });
      wrapper.unmount();
      expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    });
  });

  describe("回転と止まり方", () => {
    /** フレームを手で回す。 */
    function manualFrames() {
      const frames: Array<() => void> = [];
      vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
        frames.push(cb);
        return 0;
      });
      return async (wrapper: Wrapper) => {
        frames.splice(0).forEach((run) => run());
        await wrapper.vm.$nextTick();
      };
    }
    /** 1フレーム(約16ms)ずつ時刻とフレームを進める。 */
    const stepFor = async (wrapper: Wrapper, frame: (w: Wrapper) => Promise<void>, ms: number) => {
      for (let t = 0; t < ms; t += 16) {
        await vi.advanceTimersByTimeAsync(16);
        await frame(wrapper);
      }
    };

    it("回転は速い(旧: 1フレーム 10px @140px)", async () => {
      const frame = manualFrames();
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, rng: rngOf(1) } });
      await (wrapper.vm as unknown as Required<AnimationRef>).startSpin();
      const h = itemHeightOf(wrapper);
      const cycle = (wrapper.findAll(".reel")[0].findAll(".prize-item").length - 3) * h;
      await frame(wrapper);
      const p0 = shiftOf(wrapper, 0);
      await frame(wrapper);
      expect((shiftOf(wrapper, 0) - p0 + cycle) % cycle).toBeCloseTo(h * 0.16, 3);
    });

    it("左 → 中 → 右の順に止まる。先に止まったリールが止まっても、他は全速のまま回る・減速中で、最後は3本とも選ばれた景品が真ん中の行", async () => {
      const frame = manualFrames();
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, selectedPrize: prizes[0], rng: rngOf(5) } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      await stepFor(wrapper, frame, 200);
      const stopped = api.stopSpin(4, "q3"); // D = 4秒: 左 0〜1.4秒 / 中 0.8〜2.6秒 / 右 1.6〜4秒
      const h = itemHeightOf(wrapper);
      const cycle = (wrapper.findAll(".reel")[0].findAll(".prize-item").length - 3) * h;
      /** 1フレームの動き(px)。0 なら止まっている。 */
      const stepOf = async (r: number) => {
        const before = shiftOf(wrapper, r);
        await stepFor(wrapper, frame, 16);
        return (shiftOf(wrapper, r) - before + cycle) % cycle;
      };

      // 減速が始まる前(0.4秒): 左は減速中だが、右はまだ全速(回転の速さそのまま)
      await stepFor(wrapper, frame, 400);
      expect(await stepOf(2)).toBeCloseTo(h * 0.2, 1);

      // 1.9秒: 左は止まって(跳ね返りも終わって)いる。中・右は動いている
      await stepFor(wrapper, frame, 1500);
      expect(await stepOf(0)).toBe(0);
      expect(await stepOf(1)).toBeGreaterThan(0);
      expect(await stepOf(2)).toBeGreaterThan(0);
      expect(wrapper.classes()).toContain("spinning");
      expect(wrapper.classes()).not.toContain("hit");

      // 3.1秒: 中も止まったが、右はまだ動いている
      await stepFor(wrapper, frame, 1100);
      expect(await stepOf(1)).toBe(0);
      expect(await stepOf(2)).toBeGreaterThan(0);

      // 右が止まったら、結果を見せ続ける間 hit が付き、そのあと通知する
      await stepFor(wrapper, frame, 1000);
      expect(wrapper.classes()).not.toContain("spinning");
      expect(wrapper.classes()).toContain("hit");
      expect(wrapper.emitted("stopped")).toBeUndefined();
      for (let r = 0; r < 3; r++) {
        const rows = wrapper.findAll(".reel")[r].findAll(".prize-item");
        expect(rows[Math.round(shiftOf(wrapper, r) / h) + WIN_ROW].text()).toBe("三等");
      }
      await stepFor(wrapper, frame, 2100);
      await expect(stopped).resolves.toBe("q3");
      expect(wrapper.emitted("stopped")?.[0]).toEqual(["q3"]);
    });

    it("全部止まったら HOLD(2秒)のあいだ hit が付き、止まるまでの時間は指定した秒数(省略時は4秒)", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      let done = false;
      void api.stopSpin(undefined, "p2").then(() => (done = true));
      await vi.advanceTimersByTimeAsync(3900);
      expect(wrapper.classes()).toContain("spinning");
      await vi.advanceTimersByTimeAsync(200); // 4.1秒: 全部止まった
      expect(wrapper.classes()).not.toContain("spinning");
      expect(wrapper.classes()).toContain("hit");
      await vi.advanceTimersByTimeAsync(1800);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(300); // 6.2秒: 通知
      expect(done).toBe(true);

      // 指定した秒数に従う
      await api.startSpin();
      expect(wrapper.classes()).not.toContain("hit");
      done = false;
      void api.stopSpin(8, "p2").then(() => (done = true));
      await vi.advanceTimersByTimeAsync(7900);
      expect(wrapper.classes()).toContain("spinning");
      await vi.advanceTimersByTimeAsync(2200);
      expect(done).toBe(true);
    });

    it("止まった直後、そのリールだけが光り(landed)、少しして消える", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      void api.stopSpin(4, "p1"); // 左は 1.4秒
      await vi.advanceTimersByTimeAsync(1500);
      const reelsNow = wrapper.findAll(".reel");
      expect(reelsNow[0].classes()).toContain("landed");
      expect(reelsNow[1].classes()).not.toContain("landed");
      await vi.advanceTimersByTimeAsync(700);
      expect(wrapper.findAll(".reel")[0].classes()).not.toContain("landed");
      await vi.advanceTimersByTimeAsync(4000);
    });

    it("結果は枠の中に重ねて出す(場所を空けないので、出ても高さが変わらない)", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes, selectedPrize: prizes[0] } });
      expect(wrapper.find(".result").exists()).toBe(false);
      await wrapper.setProps({ showResult: true });
      expect(wrapper.find(".result").text()).toBe("賞1");
      const source = readFileSync(resolve(process.cwd(), "src/client/ui/pages/main-draw/slot/slot-animation.vue"), "utf-8");
      expect(/\.result-area\s*\{([^}]*)\}/.exec(source)?.[1]).toMatch(/position:\s*absolute/);
    });

    it("減速の間、1フレームに進む距離がだんだん小さくなる(いきなり止まらない)", async () => {
      const frame = manualFrames();
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, rng: rngOf(2) } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      await stepFor(wrapper, frame, 100);
      void api.stopSpin(3, "q0"); // 右は 1.2〜3秒かけて減速
      const h = itemHeightOf(wrapper);
      const cycle = (wrapper.findAll(".reel")[2].findAll(".prize-item").length - 3) * h;
      const steps: number[] = [];
      let last = shiftOf(wrapper, 2);
      for (let i = 0; i < 170; i++) {
        await stepFor(wrapper, frame, 16);
        const now = shiftOf(wrapper, 2);
        steps.push((now - last + cycle) % cycle);
        last = now;
      }
      const average = (from: number, to: number) => steps.slice(from, to).reduce((a, b) => a + b, 0) / (to - from);
      expect(average(150, 165)).toBeLessThan(average(80, 90));
      await vi.advanceTimersByTimeAsync(5000);
    });

    it("止まるまで、位置は前へだけ進む(行き過ぎて戻らない)", async () => {
      const frame = manualFrames();
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared, rng: rngOf(8) } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      await stepFor(wrapper, frame, 100);
      void api.stopSpin(3, "q6");
      const h = itemHeightOf(wrapper);
      const cycle = (wrapper.findAll(".reel")[0].findAll(".prize-item").length - 3) * h;
      let last = shiftOf(wrapper, 1);
      for (let i = 0; i < 100; i++) {
        await stepFor(wrapper, frame, 16);
        const now = shiftOf(wrapper, 1);
        // 戻ったら、折り返しで巨大な値になる
        expect((now - last + cycle) % cycle, `frame ${i}`).toBeLessThan(cycle / 2);
        last = now;
      }
      await vi.advanceTimersByTimeAsync(5000);
    });

    it("止まったあとは動かない", async () => {
      const frame = manualFrames();
      const wrapper = mount(SlotAnimation, { props: { prizes, preparedPrizes: prepared } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      const stopped = api.stopSpin(3, "q1");
      await stepFor(wrapper, frame, 5200);
      await stopped;
      const at = [0, 1, 2].map((r) => shiftOf(wrapper, r));
      await stepFor(wrapper, frame, 160);
      expect([0, 1, 2].map((r) => shiftOf(wrapper, r))).toEqual(at);
    });

    it("止める景品が指定されず、選ばれた景品も無いときは、例外にする", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes } });
      const api = wrapper.vm as unknown as Required<AnimationRef>;
      await api.startSpin();
      await expect(api.stopSpin(3, null)).rejects.toThrow("指定なし");
    });

    it("音源つきで回し始めても、回る", async () => {
      const wrapper = mount(SlotAnimation, { props: { prizes } });
      await (wrapper.vm as unknown as Required<AnimationRef>).startSpin(new Blob(["x"], { type: "audio/mpeg" }));
      expect(wrapper.classes()).toContain("spinning");
    });
  });

  // 最後のリールが止まって .spinning が外れた瞬間に CSS の移動(0.1秒)が掛かると、そのリールだけ止まった景品が
  // 窓の一番上からずれて見える(CI で「3本目の行が空」になった)。位置は JS が決めるので、CSS の移動は持たない。
  it("リールの位置に CSS の transition を掛けない(止まった瞬間に最後のリールだけ滑らない)", () => {
    const source = readFileSync(resolve(process.cwd(), "src/client/ui/pages/main-draw/slot/slot-animation.vue"), "utf-8");
    const rule = /\.reel-content\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(rule).toMatch(/transition:\s*none/);
    expect(source).not.toMatch(/transition:\s*transform/);
  });
});
