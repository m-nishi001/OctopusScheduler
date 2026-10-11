import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import type { SessionConnection } from "@octopus/session-hub";
import { tick } from "@octopus/session-hub/testing";
import { ALICE, MemoryDeviceStore, participantDevice, portalEnv, sampleEvent } from "../../__tests__/portal-test-kit";
import type { Device } from "../../__tests__/portal-test-kit";
import { PARTICIPANT_AUTH_KEY } from "../../model/participant-auth";
import { participantPortalRoutes } from "../../routes";

// レイアウトは自分で接続を作る。テストでは用意した接続に差し替える。
let nextConnection: SessionConnection | null = null;
vi.mock("@octopus/session-hub", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/session-hub")>();
  return { ...actual, createSessionConnection: () => nextConnection! };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

const Stub = defineComponent({ render: () => h("div", "stub") });

interface Mounted {
  wrapper: VueWrapper;
  router: ReturnType<typeof createRouter>;
  device: Device;
  signOut: ReturnType<typeof vi.fn>;
}

async function mountPortal(device: Device, path = "/p"): Promise<Mounted> {
  nextConnection = device.conn;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [...participantPortalRoutes, { path: "/login", component: Stub }],
  });
  const signOut = vi.fn(async () => undefined);
  await router.push(path);
  await router.isReady();
  const wrapper = mount(
    defineComponent({ render: () => h(RouterView) }),
    {
      global: {
        plugins: [router],
        provide: { [PARTICIPANT_AUTH_KEY as symbol]: { currentMember: ref(ALICE), signOut } },
      },
      attachTo: document.body,
    }
  );
  await flushPromises();
  await tick(0);
  return { wrapper, router, device, signOut };
}

const text = (m: Mounted, testId: string) => m.wrapper.find(`[data-testid="${testId}"]`).text();
const has = (m: Mounted, testId: string) => m.wrapper.find(`[data-testid="${testId}"]`).exists();

describe("参加者ポータル: 接続とホーム", () => {
  it("公開中のセッションに入り、あいさつと会場の参加者数を表示する(イベントが無いときの案内つき)", async () => {
    const { hub } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(text(m, "home-greeting")).toContain("アリス さん、ようこそ");
    expect(text(m, "portal-conn")).toContain("接続中");
    expect(text(m, "home-status")).toContain("いまイベントは行われていません");
    expect(has(m, "event-banner")).toBe(false);
    expect(has(m, "home-join")).toBe(false);
    m.wrapper.unmount();
  });

  it("公開中のセッションが無いと待機の案内とつなぎ直すボタンを出し、公開後に押すと接続できる", async () => {
    const { hub, admin, meta } = await portalEnv({ publish: false });
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(text(m, "portal-conn")).toContain("イベント待ち");
    expect(text(m, "home-status")).toContain("参加できるイベントはありません");

    await admin.setPortalSession(meta.id, true);
    await m.wrapper.find('[data-testid="home-retry"]').trigger("click");
    await flushPromises();
    await tick(0);
    expect(text(m, "portal-conn")).toContain("接続中");
    expect(has(m, "home-retry")).toBe(false);
    m.wrapper.unmount();
  });

  it("下のタブで現在地が分かり、マイページへ移動できる", async () => {
    const { hub } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    const tabs = () => m.wrapper.findAll(".pp-tabs__item");
    expect(tabs().map((t) => t.text())).toEqual(["ホーム", "マイページ"]);
    expect(tabs()[0].classes()).toContain("is-active");
    expect(tabs()[1].classes()).not.toContain("is-active");

    await tabs()[1].trigger("click");
    await flushPromises();
    expect(m.router.currentRoute.value.fullPath).toBe("/p/me");
    expect(tabs()[0].classes()).not.toContain("is-active");
    expect(tabs()[1].classes()).toContain("is-active");
    m.wrapper.unmount();
  });
});

describe("参加者ポータル: イベント発生中のお知らせ", () => {
  it("ホストがイベントを公開すると、画面上部のバナーとホームの「参加する」に出る", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(has(m, "event-banner")).toBe(false);

    await publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-banner")).toContain("イベント発生中!");
    expect(text(m, "event-banner")).toContain("ジャックポット抽選");
    expect(text(m, "home-event-title")).toBe("ジャックポット抽選");
    expect(has(m, "home-join")).toBe(true);
    m.wrapper.unmount();
  });

  it("バナーを押すとイベント画面へ。イベント画面ではバナーを重ねて出さない", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    await publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();

    await m.wrapper.find('[data-testid="event-banner"]').trigger("click");
    await flushPromises();
    expect(m.router.currentRoute.value.name).toBe("participant-event");
    expect(text(m, "event-title")).toBe("ジャックポット抽選");
    expect(has(m, "event-banner")).toBe(false);
    m.wrapper.unmount();
  });

  it("イベントが取り下げられると、バナーが消え、イベント画面は終了の案内に変わる", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE), "/p/event");
    await publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-title")).toBe("ジャックポット抽選");

    await publishEvent(null);
    await tick(5000);
    await flushPromises();
    expect(has(m, "event-title")).toBe(false);
    expect(text(m, "event-none")).toContain("イベントは終了しました");
    expect(has(m, "event-banner")).toBe(false);
    m.wrapper.unmount();
  });

  it("イベントが新しいものに切り替わると、タイトルが更新される", async () => {
    const { hub, publishEvent } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE));
    await publishEvent(sampleEvent());
    await tick(5000);
    await publishEvent(sampleEvent({ id: "event-2", title: "乾杯クイズ" }));
    await tick(5000);
    await flushPromises();
    expect(text(m, "event-banner")).toContain("乾杯クイズ");
    m.wrapper.unmount();
  });

  it("接続できていない間は、古いイベントのバナーを出さない", async () => {
    const { hub } = await portalEnv({ publish: false });
    const m = await mountPortal(participantDevice(hub, ALICE));
    expect(has(m, "event-banner")).toBe(false);
    m.wrapper.unmount();
  });
});

describe("参加者ポータル: マイページ", () => {
  it("名前とIDを表示する", async () => {
    const { hub } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE), "/p/me");
    expect(text(m, "me-name")).toBe("アリス");
    expect(text(m, "me-id")).toBe("ID: alice");
    m.wrapper.unmount();
  });

  it("ログアウトすると、入室情報を消してログアウトし、ログイン画面へ戻る", async () => {
    const { hub } = await portalEnv();
    const store = new MemoryDeviceStore();
    const m = await mountPortal(participantDevice(hub, ALICE, { store }), "/p/me");
    const before = m.device.conn.state.deviceId;
    expect(before).toBeTruthy();

    await m.wrapper.find('[data-testid="me-signout"]').trigger("click");
    await flushPromises();
    expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(m.router.currentRoute.value.fullPath).toBe("/login");
    expect(m.device.conn.state.phase).toBe("idle");

    // 同じ端末で次に入ると、前の端末情報は引き継がれず新しい端末になる
    const next = participantDevice(hub, ALICE, { store });
    await next.conn.joinPortal();
    expect(next.conn.state.deviceId).not.toBe(before);
    next.conn.dispose();
    m.wrapper.unmount();
  });
});
