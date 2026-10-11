import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EntryBubbles from "./entry-bubbles.vue";
import type { Entrant } from "./entry-bubbles.vue";

const people = (n: number): Entrant[] => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, name: `参加者${i}` }));
const mountBubbles = (entrants: Entrant[]) => mount(EntryBubbles, { props: { entrants } });
const size = (wrapper: ReturnType<typeof mountBubbles>) => wrapper.get('[data-testid="entry-bubbles"]').attributes("style");

describe("EntryBubbles", () => {
  it("エントリーした人を1人1つのバブルで表示し、名前を出す", () => {
    const wrapper = mountBubbles(people(3));
    const bubbles = wrapper.findAll('[data-testid="entry-bubble"]');
    expect(bubbles).toHaveLength(3);
    expect(bubbles.map((b) => b.text())).toEqual(expect.arrayContaining(["参加者0", "参加者1", "参加者2"].map((n) => expect.stringContaining(n))));
  });

  it("顔写真があれば写真を、無ければ名前の頭文字を出す", () => {
    const wrapper = mountBubbles([
      { id: "a", name: "アリス", photoUrl: "blob:photo-a" },
      { id: "b", name: "ボブ" },
    ]);
    const [a, b] = wrapper.findAll('[data-testid="entry-bubble"]');
    expect(a.find("img").attributes("src")).toBe("blob:photo-a");
    expect(a.find("img").attributes("alt")).toBe("アリス");
    expect(b.find("img").exists()).toBe(false);
    expect(b.find(".bubble__initial").text()).toBe("ボ");
  });

  it("最後に入った人だけが強調される", () => {
    const wrapper = mountBubbles(people(4));
    const latest = wrapper.findAll(".bubble.is-latest");
    expect(latest).toHaveLength(1);
    expect(latest[0].text()).toContain("参加者3");
  });

  it("人数が増えるほどバブルを小さくして収める", () => {
    const sizes = [1, 8, 9, 20, 21, 40, 41, 80, 81, 150, 151, 300].map((n) => Number(/--bubble-size:\s*(\d+)px/.exec(size(mountBubbles(people(n))) ?? "")?.[1]));
    expect(sizes).toEqual([168, 168, 132, 132, 104, 104, 80, 80, 64, 64, 48, 48]);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
  });

  it("0人でも壊れない", () => {
    const wrapper = mountBubbles([]);
    expect(wrapper.findAll('[data-testid="entry-bubble"]')).toHaveLength(0);
  });

  it("人が増えても既存のバブルは作り直さず、見た目（色・動きの位相）は同じIDなら変わらない", async () => {
    const wrapper = mountBubbles(people(2));
    const before = wrapper.findAll('[data-testid="entry-bubble"]').map((b) => b.attributes("style"));
    await wrapper.setProps({ entrants: people(3) });
    const after = wrapper.findAll('[data-testid="entry-bubble"]').map((b) => b.attributes("style"));
    expect(after).toHaveLength(3);
    expect(after.slice(0, 2)).toEqual(before);
  });

  it("空白だけの名前や記号の名前でも頭文字を出せる", () => {
    const wrapper = mountBubbles([
      { id: "x", name: "   " },
      { id: "y", name: "😀テスト" },
    ]);
    const initials = wrapper.findAll(".bubble__initial").map((e) => e.text());
    expect(initials[0]).toBe("?");
    expect(initials[1]).toBe("😀");
  });
});
