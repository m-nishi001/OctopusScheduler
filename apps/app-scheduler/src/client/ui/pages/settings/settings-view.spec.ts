import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

// 各タブの中身は別のテストで確かめる。ここでは、どのタブが選ばれるかだけを見る。
const stub = vi.hoisted(() => async (name: string) => {
  const { h } = await import("vue");
  return { default: { name, render: () => h("div", { "data-testid": name }) } };
});
vi.mock("./event-list/event-list.vue", () => stub("events-tab"));
vi.mock("./asset-list/asset-list-editor.vue", () => stub("assets-tab"));
vi.mock("./members/members-editor.vue", () => stub("members-tab"));
vi.mock("./keyboard-shortcut/keyboard-shortcut-editor.vue", () => stub("shortcuts-tab"));
vi.mock("./frames/settings-header-actions.vue", () => stub("header-actions"));

import SettingsView from "./settings-view.vue";

async function open(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/settings", component: SettingsView }] });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(SettingsView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

describe("settings-view のタブ", () => {
  it("タブは イベント / アセット / メンバー / ショートカット の4つで、「アカウント」は無い", async () => {
    const { wrapper } = await open("/settings");
    const labels = wrapper.findAll('[role="tab"]').map((t) => t.text());
    expect(labels).toEqual(["イベント", "アセット", "メンバー", "ショートカット"]);
  });

  it("?tab=members でメンバーの画面を出す", async () => {
    const { wrapper } = await open("/settings?tab=members");
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(true);
  });

  it("古いリンクの ?tab=accounts は、メンバーの画面に移す(URLも書き換える)", async () => {
    const { wrapper, router } = await open("/settings?tab=accounts");
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(true);
    expect(router.currentRoute.value.query.tab).toBe("members");
    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toBe("メンバー");
  });

  it("知らない ?tab= は、先頭のイベントに戻す", async () => {
    const { wrapper } = await open("/settings?tab=nope");
    expect(wrapper.find('[data-testid="events-tab"]').exists()).toBe(true);
  });
});
