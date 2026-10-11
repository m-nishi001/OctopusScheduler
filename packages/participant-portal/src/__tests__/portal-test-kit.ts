import { createFakeHubApi, makeDevice, makeHub } from "@octopus/session-hub/testing";
import type { Device, FaultInjector, TestHub } from "@octopus/session-hub/testing";
import { MemoryDeviceStore, SessionAdminRepository } from "@octopus/session-hub";
import type { PortalEvent } from "@octopus/session-hub";

export { makeDevice, makeHub };
export type { Device, TestHub };

/** 管理者(admin1)として、セッションを作ってポータルに公開し、ホスト端末を接続した環境。 */
export async function portalEnv(options: { publish?: boolean } = {}) {
  const hub = makeHub();
  const admin = new SessionAdminRepository(createFakeHubApi(hub, "admin1"));
  const meta = await admin.create({ name: "受付会場" });
  if (options.publish ?? true) await admin.setPortalSession(meta.id, true);
  const host = makeDevice(hub, { memberId: "admin1" });
  await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  return {
    hub,
    admin,
    meta,
    host,
    /** ホストが「イベント発生中」を公開する/取り下げる(本番ではホストの event.start / event.end が行う)。 */
    publishEvent: (event: PortalEvent | null) => host.conn.publish(event ? { event } : {}),
  };
}

/** ログイン済みの参加者の端末。保存先(store)を共有すると、同じブラウザのリロードを再現できる。 */
export function participantDevice(
  hub: TestHub,
  member: { id: string; name: string },
  options: { store?: MemoryDeviceStore; faults?: FaultInjector } = {}
): Device {
  return makeDevice(hub, { memberId: member.id, memberName: member.name, store: options.store, faults: options.faults });
}

export const ALICE = { id: "alice", name: "アリス" };
export const BOB = { id: "bob", name: "ボブ" };
export { MemoryDeviceStore };

export const sampleEvent = (patch: Partial<PortalEvent> = {}): PortalEvent => ({
  id: "event-1",
  title: "ジャックポット抽選",
  startedAtMs: 1_700_000_000_000,
  ...patch,
});
