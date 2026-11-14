import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { createMemoryHistory, createRouter } from "vue-router";
import { HostAgent } from "@octopus/session-hub";
import { makeDevice, makeHub } from "@octopus/session-hub/testing";
import { sessionService as svc } from "@octopus/session-hub/engine";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";
import DescriptionContent from "./description-content.vue";
import { buildJackpotDescriptionState } from "@model/jackpot-host-state";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const pages = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: "テキスト", text: `ページ${i + 1}` }));

async function scene(pageCount: number, demo: { enabled?: boolean } = {}) {
  container.register(ScreenSettingsService, {
    useValue: {
      fetchScreenSetting: async (screen: string) => (screen === "demo" ? { enabled: true, rounds: 1, bgm: "", ...demo } : { bgm: "", pages: pages(pageCount) }),
    } as unknown as ScreenSettingsService,
  });

  const hub = makeHub();
  const meta = await svc.createSession(hub.deps, { name: "x" }, "a");
  const hostDevice = makeDevice(hub, { memberId: "a" });
  container.register(HostAgent, { useValue: new HostAgent(hostDevice.conn) });
  await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(hub, { memberId: "b" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/jackpot-description", component: DescriptionContent },
      { path: "/jackpot-demo-draw", component: { template: "<div>demo</div>" } },
      { path: "/jackpot-draw", component: { template: "<div>draw</div>" } },
    ],
  });
  await router.push("/jackpot-description");
  await router.isReady();
  const wrapper = mount(DescriptionContent, { global: { plugins: [router] } });
  await flushPromises();
  await tick(4000);
  const published = () => admin.conn.state.roomState?.data?.jackpot;
  const issue = async (type: "advance" | "back") => {
    await admin.conn.issue("jackpot", type);
    await tick(4000);
    await flushPromises();
  };
  return { wrapper, router, published, issue };
}

describe("説明画面: 1ページずつ。Enter と管理端末の「次へ/前へ」で進む", () => {
  it("読み込み後に、最初のページ(index 0)とページ数を公開する。固定の導入ページは無い", async () => {
    const { published, wrapper } = await scene(3);
    expect(published()).toEqual(buildJackpotDescriptionState(0, 3));
    expect(wrapper.text()).toContain("ページ1");
    expect(wrapper.text()).not.toContain("ここにゲームの説明を記載します");
    wrapper.unmount();
  });

  it("advance で1ページずつ進み、位置が公開される。back で戻り、最初のページより前には戻らない", async () => {
    const { published, issue, wrapper } = await scene(3);
    await issue("advance");
    expect(published()).toMatchObject({ index: 1 });
    expect(wrapper.text()).toContain("ページ2");
    await issue("advance");
    expect(published()).toMatchObject({ index: 2 });

    await issue("back");
    expect(published()).toMatchObject({ index: 1 });
    await issue("back");
    expect(published()).toMatchObject({ index: 0 });
    await issue("back");
    expect(published()).toMatchObject({ index: 0 });
    wrapper.unmount();
  });

  it("最後のページの次の advance で、デモ抽選 ON ならデモ抽選へ進む", async () => {
    const { published, issue, router, wrapper } = await scene(2);
    await issue("advance");
    expect(published()).toMatchObject({ index: 1, total: 2 });
    expect(router.currentRoute.value.path).toBe("/jackpot-description");
    await issue("advance");
    expect(router.currentRoute.value.path).toBe("/jackpot-demo-draw");
    wrapper.unmount();
  });

  it("デモ抽選が OFF なら、最後のページの次は本抽選へ直行する", async () => {
    const { issue, router, wrapper } = await scene(2, { enabled: false });
    await issue("advance");
    await issue("advance");
    expect(router.currentRoute.value.path).toBe("/jackpot-draw");
    wrapper.unmount();
  });

  it("ホストの Enter キーでも同じように進む", async () => {
    const { published, wrapper } = await scene(2);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await tick(4000);
    expect(published()).toMatchObject({ index: 1 });
    wrapper.unmount();
  });

  it("ページが0枚でも、最初の advance で次の画面へ進む", async () => {
    const { published, issue, router, wrapper } = await scene(0);
    expect(published()).toEqual(buildJackpotDescriptionState(0, 0));
    await issue("advance");
    expect(router.currentRoute.value.path).toBe("/jackpot-demo-draw");
    wrapper.unmount();
  });

  it("画面を離れると公開していた状態を片付ける", async () => {
    const { published, wrapper } = await scene(2);
    wrapper.unmount();
    await tick(4000);
    expect(published() ?? null).toBeNull();
  });
});
