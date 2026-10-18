import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EndDialog, { END_MESSAGES } from "./end-dialog.vue";

describe("EndDialog(抽選の終了の画面)", () => {
  it("終了の理由ごとに、取り違えない文言を出す(景品が残っていてもメンバーが尽きれば終わる)", () => {
    const prizes = mount(EndDialog, { props: { reason: "prizes" } });
    const members = mount(EndDialog, { props: { reason: "members" } });
    expect(prizes.get('[data-testid="end-message"]').text()).toBe(END_MESSAGES.prizes);
    expect(members.get('[data-testid="end-message"]').text()).toBe(END_MESSAGES.members);
    expect(END_MESSAGES.members).not.toContain("景品");
  });

  it("OKボタンで close を通知する(親が、進行操作として結果の画面へ進める)", async () => {
    const wrapper = mount(EndDialog, { props: { reason: "members" } });
    await wrapper.get('[data-testid="end-ok"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("Enterでは閉じない(Enterは進行役が受ける。ダイアログが二重に反応して飛ばさない)", async () => {
    const wrapper = mount(EndDialog, { props: { reason: "prizes" }, attachTo: document.body });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeUndefined();
    wrapper.unmount();
  });
});
