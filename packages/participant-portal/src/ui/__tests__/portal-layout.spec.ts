import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import type { SessionConnection } from "@octopus/session-hub";
import { tick } from "@octopus/session-hub/testing";
import { ALICE, BOB, MemoryDeviceStore, participantDevice, portalEnv, sampleEvent } from "../../__tests__/portal-test-kit";
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
  // エントリー済みの保存（localStorage）が、同じIDを使うテストへ持ち越されないようにする
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

const Stub = defineComponent({ render: () => h("div", "stub") });

interface Mounted {
  wrapper: VueWrapper;
  router: ReturnType<typeof createRouter>;
  device: Device;
  signOut: ReturnType<typeof vi.fn>;
}

async function mountPortal(device: Device, path = "/p", member: { id: string; name: string } = ALICE): Promise<Mounted> {
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
        provide: { [PARTICIPANT_AUTH_KEY as symbol]: { currentMember: ref(member), signOut } },
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

describe("参加者ポータル: エントリー", () => {
  it("受付が始まる前は案内だけ。始まるとバナー・ホーム・イベント画面でエントリーを促す", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    await env.publishEvent(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(has(m, "entry-none")).toBe(true);
    expect(has(m, "entry-button")).toBe(false);

    await env.openEntry(sampleEvent());
    await tick(5000);
    await flushPromises();
    expect(has(m, "entry-open")).toBe(true);
    expect(text(m, "entry-button")).toContain("エントリー");

    await m.router.push("/p");
    await flushPromises();
    expect(text(m, "event-banner")).toContain("エントリー受付中!");
    expect(text(m, "home-entry-open")).toContain("エントリー受付中!");
    expect(text(m, "home-join")).toBe("エントリーする");
    m.wrapper.unmount();
  });

  it("エントリーするボタンを押すと「エントリーしました!」になり、バナーとホームは済みの表示に変わる", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    const event = await env.openEntry(sampleEvent());
    await tick(5000);
    await flushPromises();

    await m.wrapper.find('[data-testid="entry-button"]').trigger("click");
    await flushPromises();
    await tick(0);
    expect(text(m, "entry-done")).toContain("エントリーしました!");
    expect(has(m, "entry-button")).toBe(false);
    expect(await env.entrants(event.entry!.key)).toEqual(["alice"]);

    await m.router.push("/p");
    await flushPromises();
    expect(text(m, "event-banner")).toContain("イベント発生中!");
    expect(text(m, "home-entry-done")).toContain("エントリー済み");
    expect(text(m, "home-join")).toBe("参加する");
    m.wrapper.unmount();
  });

  it("締め切ると、未エントリーの人には終了の案内、エントリー済みの人には受付終了と結果待ちの案内", async () => {
    const env = await portalEnv();
    const alice = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    const event = await env.openEntry(sampleEvent());
    await tick(5000);
    await flushPromises();
    await alice.wrapper.find('[data-testid="entry-button"]').trigger("click");
    await flushPromises();

    await env.closeEntry(event);
    await tick(5000);
    await flushPromises();
    expect(text(alice, "entry-done")).toContain("受付は終了しました");
    expect(has(alice, "entry-button")).toBe(false);
    alice.wrapper.unmount();

    // 未エントリーのボブ（同じ端末の別の人ではなく、別のスマホ）には、終了の案内だけが出る
    const bob = await mountPortal(participantDevice(env.hub, BOB), "/p/event", BOB);
    expect(has(bob, "entry-button")).toBe(false);
    expect(has(bob, "entry-done")).toBe(false);
    expect(text(bob, "entry-closed")).toContain("エントリーの受付は終了しました");
    bob.wrapper.unmount();
  });

  it("受付を再開すると、締切後に来た人もエントリーできる", async () => {
    const env = await portalEnv();
    const event = await env.openEntry(sampleEvent());
    const closed = await env.closeEntry(event);
    const late = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    expect(has(late, "entry-closed")).toBe(true);

    await env.openEntry(closed, true);
    await tick(5000);
    await flushPromises();
    expect(has(late, "entry-open")).toBe(true);
    await late.wrapper.find('[data-testid="entry-button"]').trigger("click");
    await flushPromises();
    expect(text(late, "entry-done")).toContain("エントリーしました!");
    expect(await env.entrants(event.entry!.key)).toEqual(["alice"]);
    late.wrapper.unmount();
  });

  it("イベントが終わると、エントリーの表示は出さず終了の案内になる", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/event");
    await env.openEntry(sampleEvent());
    await tick(5000);
    await env.publishEvent(null);
    await tick(5000);
    await flushPromises();
    expect(has(m, "entry-open")).toBe(false);
    expect(text(m, "event-none")).toContain("イベントは終了しました");
    m.wrapper.unmount();
  });
});
