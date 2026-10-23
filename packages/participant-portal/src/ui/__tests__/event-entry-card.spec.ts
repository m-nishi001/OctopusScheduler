import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import type { EntryPhase, EntryState } from "../../model/use-entry";
import { ENTRY_KEY } from "../../model/use-entry";
import EventEntryCard from "../components/event-entry-card.vue";

/** useEntry() の状態だけでカードが決まることを確かめるため、状態を直接差し込む。 */
function mountCard(init: { phase: EntryPhase; entered?: boolean; auto?: boolean }, size?: "full" | "compact") {
  const phase = ref<EntryPhase>(init.phase);
  const entered = ref(init.entered ?? false);
  const auto = ref(init.auto ?? false);
  let enterCalls = 0;
  const entry: EntryState = {
    phase: computed(() => phase.value),
    entered,
    autoEntered: computed(() => auto.value),
    isIn: computed(() => entered.value || auto.value),
    submitting: ref(false),
    message: ref(""),
    async enter() {
      enterCalls += 1;
      entered.value = true;
    },
  };
  const wrapper = mount(EventEntryCard, { props: { size }, global: { provide: { [ENTRY_KEY as symbol]: entry } } });
  return { wrapper, phase, entered, calls: () => enterCalls };
}

const state = (m: ReturnType<typeof mountCard>) => m.wrapper.get('[data-testid="event-entry-card"]').attributes("data-state");

describe("EventEntryCard", () => {
  it("受付前は「お待ちください」で、ボタンは無い", () => {
    const m = mountCard({ phase: "none" });
    expect(state(m)).toBe("wait");
    expect(m.wrapper.text()).toContain("お待ちください");
    expect(m.wrapper.find('[data-testid="entry-button"]').exists()).toBe(false);
  });

  it("受付中は「エントリーする」ボタン。押すとその場で enter() を1回呼び、「エントリー済み ✓」に変わる", async () => {
    const m = mountCard({ phase: "open" });
    const button = m.wrapper.get('[data-testid="entry-button"]');
    expect(button.element.tagName).toBe("BUTTON");
    expect(button.text()).toContain("エントリーする");
    await button.trigger("click");
    expect(m.calls()).toBe(1);
    expect(state(m)).toBe("done");
    expect(m.wrapper.text()).toContain("エントリー済み ✓");
    expect(m.wrapper.find('[data-testid="entry-button"]').exists()).toBe(false);
  });

  it("受付前から受付中に変わると、そのまま押せるボタンになる", async () => {
    const m = mountCard({ phase: "none" });
    m.phase.value = "open";
    await m.wrapper.vm.$nextTick();
    expect(state(m)).toBe("open");
  });

  it("自動エントリーは受付前でも「エントリー済み ✓」", () => {
    const m = mountCard({ phase: "none", auto: true });
    expect(state(m)).toBe("done");
    expect(m.wrapper.text()).toContain("エントリー済み ✓");
  });

  it("締切後は、未エントリーなら「受付終了」、エントリー済みなら「エントリー済み ✓」", () => {
    const closed = mountCard({ phase: "closed" });
    expect(state(closed)).toBe("closed");
    expect(closed.wrapper.text()).toContain("受付終了");
    const done = mountCard({ phase: "closed", entered: true });
    expect(state(done)).toBe("done");
    expect(done.wrapper.text()).toContain("エントリー済み ✓");
  });

  it("compact(バナー用)でも同じ状態を出す", () => {
    const m = mountCard({ phase: "open" }, "compact");
    expect(m.wrapper.classes()).toContain("is-compact");
    expect(m.wrapper.get('[data-testid="entry-button"]').text()).toBe("エントリーする");
  });
});
