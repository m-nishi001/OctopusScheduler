import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EndDialog, { endMessage } from "./end-dialog.vue";

describe("EndDialog(抽選の終了の画面)", () => {
  it("終了の理由ごとに、取り違えない文言を出す(景品が残っていてもメンバーが尽きれば終わる)", () => {
    const prizes = mount(EndDialog, { props: { reason: "prizes" } });
    const members = mount(EndDialog, { props: { reason: "members", eligibleMembers: 3 } });
    expect(prizes.get('[data-testid="end-message"]').text()).toBe(endMessage("prizes", null));
    expect(members.get('[data-testid="end-message"]').text()).toBe("対象の 3 名全員の抽選が終わりました。");
    expect(endMessage("members", 3)).not.toContain("景品");
  });

  it("人数が分かるときは文言に出し、分からないときは人数なしの文言にする", () => {
    expect(endMessage("members", 1)).toContain("対象の 1 名");
    expect(endMessage("members", null)).toBe("対象のメンバー全員の抽選が終わりました。");
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
