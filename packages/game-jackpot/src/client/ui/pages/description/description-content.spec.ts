import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { createMemoryHistory, createRouter } from "vue-router";
import { HostAgent } from "@octopus/session-hub";
import { makeDevice, makeHub } from "@octopus/session-hub/testing";
import { sessionService as svc } from "@octopus/session-hub/engine";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";
import { AssetDataService } from "@control/asset/asset-data-service";
import DescriptionContent from "./description-content.vue";
import { buildJackpotDescriptionState } from "@model/jackpot-host-state";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const slides = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, type: "text", content: `スライド${i + 1}` }));

async function scene(slideCount: number) {
  container.register(ScreenSettingsService, {
    useValue: { fetchScreenSetting: async () => ({ descriptionBgm: "", screenElements: slides(slideCount) }) } as unknown as ScreenSettingsService,
  });
  container.register(AssetDataService, { useValue: { getAssetDataById: async () => null } as unknown as AssetDataService });

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

describe("説明画面: 管理端末からのスライド操作", () => {
  it("読み込み後に、導入画面(index -1)とスライド枚数を公開する", async () => {
    const { published, wrapper } = await scene(3);
    expect(published()).toEqual(buildJackpotDescriptionState(-1, 3));
    wrapper.unmount();
  });

  it("advance で1枚ずつ進み、位置が公開される。back で戻り、導入より前には戻らない", async () => {
    const { published, issue, wrapper } = await scene(3);
    await issue("advance");
    expect(published()).toMatchObject({ index: 0 });
    expect(wrapper.text()).toContain("スライド1");
    await issue("advance");
    expect(published()).toMatchObject({ index: 1 });
    expect(wrapper.text()).toContain("スライド2");

    await issue("back");
    expect(published()).toMatchObject({ index: 0 });
    expect(wrapper.text()).toContain("スライド1");
    await issue("back");
    expect(published()).toMatchObject({ index: -1 });
    await issue("back");
    expect(published()).toMatchObject({ index: -1 });
    wrapper.unmount();
  });

  it("最後のスライドの次の advance で抽選画面へ進む(ホストの Enter と同じ)", async () => {
    const { published, issue, router, wrapper } = await scene(2);
    await issue("advance");
    await issue("advance");
    expect(published()).toMatchObject({ index: 1, total: 2 });
    expect(router.currentRoute.value.path).toBe("/jackpot-description");
    await issue("advance");
    expect(router.currentRoute.value.path).toBe("/jackpot-draw");
    wrapper.unmount();
  });

  it("ホストの Enter キーでも同じように進む(従来どおり)", async () => {
    const { published, wrapper } = await scene(2);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await tick(4000);
    expect(published()).toMatchObject({ index: 0 });
    wrapper.unmount();
  });

  it("スライドが0枚でも、最初の advance で抽選画面へ進む", async () => {
    const { published, issue, router, wrapper } = await scene(0);
    expect(published()).toEqual(buildJackpotDescriptionState(-1, 0));
    await issue("advance");
    expect(router.currentRoute.value.path).toBe("/jackpot-draw");
    wrapper.unmount();
  });

  it("画面を離れると公開していた状態を片付ける", async () => {
    const { published, wrapper } = await scene(2);
    wrapper.unmount();
    await tick(4000);
    expect(published() ?? null).toBeNull();
  });
});
