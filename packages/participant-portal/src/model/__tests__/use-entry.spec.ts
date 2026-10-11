import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { FaultInjector } from "@octopus/session-hub/testing";
import { tick } from "@octopus/session-hub/testing";
import { useEntry } from "../use-entry";
import type { EntryState, EntryStorage } from "../use-entry";
import { usePortalSession } from "../use-portal-session";
import type { PortalSession } from "../use-portal-session";
import { ALICE, BOB, MemoryDeviceStore, participantDevice, portalEnv, sampleEvent } from "../../__tests__/portal-test-kit";
import type { Device } from "../../__tests__/portal-test-kit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

function memoryStorage(): EntryStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

/** 参加者の端末をポータルとして接続し、エントリーの状態を取り出す。 */
async function connect(device: Device, storage: EntryStorage = memoryStorage(), memberId: string | null = "alice") {
  let session!: PortalSession;
  let entry!: EntryState;
  const app = createApp(
    defineComponent({
      setup() {
        session = usePortalSession(device.conn);
        entry = useEntry(session, { memberId: () => memberId, storage });
        return () => h("div");
      },
    })
  );
  app.mount(document.createElement("div"));
  await session.join();
  await tick(5000);
  return { session, entry, unmount: () => app.unmount() };
}

describe("useEntry: 受付の状態", () => {
  it("イベントにエントリー受付が無い間は none、始まると open、締め切ると closed", async () => {
    const env = await portalEnv();
    const { entry, unmount } = await connect(participantDevice(env.hub, ALICE));
    expect(entry.phase.value).toBe("none");

    await env.publishEvent(sampleEvent());
    await tick(5000);
    expect(entry.phase.value).toBe("none");

    const opened = await env.openEntry(sampleEvent());
    await tick(5000);
    expect(entry.phase.value).toBe("open");

    await env.closeEntry(opened);
    await tick(5000);
    expect(entry.phase.value).toBe("closed");
    unmount();
  });
});

describe("useEntry: エントリーする", () => {
  it("受付中に押すとエントリー済みになり、運営側の一覧にメンバーとして載る", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    const event = await env.openEntry(sampleEvent());
    await tick(5000);

    await alice.entry.enter();
    expect(alice.entry.entered.value).toBe(true);
    expect(alice.entry.message.value).toBe("");
    expect(await env.entrants(event.entry!.key)).toEqual(["alice"]);
    alice.unmount();
  });

  it("連打しても送信は1回。済みになったら押せない", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    await env.openEntry(sampleEvent());
    await tick(5000);

    await Promise.all([alice.entry.enter(), alice.entry.enter(), alice.entry.enter()]);
    await alice.entry.enter();
    expect(device.api.calls.submitAnswer).toBe(1);
  });

  it("受付が始まっていない・締め切った・まだ接続していないときは何も送らない", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    await alice.entry.enter();
    expect(device.api.calls.submitAnswer ?? 0).toBe(0);

    const opened = await env.openEntry(sampleEvent());
    await env.closeEntry(opened);
    await tick(5000);
    await alice.entry.enter();
    expect(device.api.calls.submitAnswer ?? 0).toBe(0);
    expect(alice.entry.entered.value).toBe(false);
  });

  it("別の端末ですでにエントリー済みの人は、押すと「済み」になり、運営側には1件のまま", async () => {
    const env = await portalEnv();
    const phone = await connect(participantDevice(env.hub, ALICE));
    const tablet = await connect(participantDevice(env.hub, ALICE));
    const event = await env.openEntry(sampleEvent());
    await tick(5000);

    await phone.entry.enter();
    await tablet.entry.enter();
    expect(tablet.entry.entered.value).toBe(true);
    expect(await env.entrants(event.entry!.key)).toEqual(["alice"]);
  });

  it("締め切られた直後に押すと、受付終了の案内を出し、エントリー済みにはならない", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    const event = await env.openEntry(sampleEvent());
    await tick(5000);
    // ホストが締め切ったが、参加者の画面にはまだ反映されていない状況
    await env.host.conn.closeRound(event.entry!.key);

    await alice.entry.enter();
    expect(alice.entry.entered.value).toBe(false);
    expect(alice.entry.message.value).toContain("受付は終了しました");
  });

  it("通信に失敗したら案内を出し、つながってからもう一度押せる", async () => {
    const env = await portalEnv();
    let offline = true;
    const faults: FaultInjector = { decide: (endpoint) => (offline && endpoint === "submitAnswer" ? "dropRequest" : "ok") };
    const alice = await connect(participantDevice(env.hub, ALICE, { faults }));
    const event = await env.openEntry(sampleEvent());
    await tick(5000);

    const attempt = alice.entry.enter();
    await tick(10_000);
    await attempt;
    expect(alice.entry.entered.value).toBe(false);
    expect(alice.entry.message.value).toContain("通信できませんでした");
    expect(await env.entrants(event.entry!.key)).toEqual([]);

    offline = false;
    await alice.entry.enter();
    expect(alice.entry.entered.value).toBe(true);
    expect(alice.entry.message.value).toBe("");
    expect(await env.entrants(event.entry!.key)).toEqual(["alice"]);
  });
});

describe("useEntry: エントリー済みの保存", () => {
  it("リロードしても「済み」が保たれる（同じ受付の間だけ）", async () => {
    const env = await portalEnv();
    const storage = memoryStorage();
    const store = new MemoryDeviceStore();
    const first = await connect(participantDevice(env.hub, ALICE, { store }), storage);
    const event = await env.openEntry(sampleEvent());
    await tick(5000);
    await first.entry.enter();
    first.unmount();

    const reloaded = await connect(participantDevice(env.hub, ALICE, { store }), storage);
    expect(reloaded.entry.entered.value).toBe(true);
    reloaded.unmount();

    // 受付が別のイベントのものに変わったら、済みではなくなる
    const next = sampleEvent({ id: "event-2", title: "次のイベント" });
    await env.closeEntry(event);
    await env.openEntry(next);
    await tick(5000);
    const later = await connect(participantDevice(env.hub, ALICE, { store }), storage);
    expect(later.entry.entered.value).toBe(false);
  });

  it("1台のスマホを何人かで使っても、前の人の「済み」を引き継がない（保存は人ごと）", async () => {
    const env = await portalEnv();
    const storage = memoryStorage();
    const store = new MemoryDeviceStore();
    const alice = await connect(participantDevice(env.hub, ALICE, { store }), storage, "alice");
    await env.openEntry(sampleEvent());
    await tick(5000);
    await alice.entry.enter();
    expect(alice.entry.entered.value).toBe(true);
    alice.unmount();

    // 同じ端末・同じ保存先で、ボブがログインし直した
    const bob = await connect(participantDevice(env.hub, BOB, { store }), storage, "bob");
    await tick(5000);
    expect(bob.entry.entered.value).toBe(false);
    await bob.entry.enter();
    expect(bob.entry.entered.value).toBe(true);
    bob.unmount();

    // アリスが戻ってくると、アリスの「済み」は残っている
    const again = await connect(participantDevice(env.hub, ALICE, { store: new MemoryDeviceStore() }), storage, "alice");
    expect(again.entry.entered.value).toBe(true);
    again.unmount();
  });

  it("ログイン中のメンバーが分からないときは保存せず、毎回サーバーの回答（重複なら「済み」）に任せる", async () => {
    const env = await portalEnv();
    const storage = memoryStorage();
    const alice = await connect(participantDevice(env.hub, ALICE), storage, null);
    await env.openEntry(sampleEvent());
    await tick(5000);
    await alice.entry.enter();
    expect(alice.entry.entered.value).toBe(true);
    expect(storage.data.size).toBe(0);
  });
});
