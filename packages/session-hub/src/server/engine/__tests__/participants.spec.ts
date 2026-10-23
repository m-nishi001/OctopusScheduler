import { describe, expect, it } from "vitest";
import { GAS_LIKE_LIMITS, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { createTestHub } from "../../../testing";
import * as svc from "../session-service";
import { PARTICIPANT_CHUNK_SIZE, createKvSessionRepo } from "../session-repo";
import { parseHubErrorCode } from "../../../shared/hub-error";
import type { JoinResult } from "../../../shared/protocol";

/** UUID と同じ長さのメンバーID(1件あたりの大きさが最悪に近いケース)。 */
const memberId = (i: number): string => `${i.toString(16).padStart(8, "0")}-aaaa-bbbb-cccc-${i.toString(16).padStart(12, "0")}`;

async function code(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (e) {
    return parseHubErrorCode((e as Error).message) ?? (e as Error).message;
  }
}

describe("参加者名簿(KV 実装)", () => {
  it("同じメンバーを何度追加しても1件で、入室した順に並ぶ", async () => {
    const repo = createKvSessionRepo(new InMemoryKeyValueStorage(), "s1");
    expect(await repo.listParticipantIds()).toEqual([]);
    await repo.addParticipant("b");
    await repo.addParticipant("a");
    await repo.addParticipant("b");
    expect(await repo.listParticipantIds()).toEqual(["b", "a"]);
  });

  it(`${PARTICIPANT_CHUNK_SIZE}件ごとのキーに分けて保存し、GAS の1値の上限に収まる`, async () => {
    const storage = new InMemoryKeyValueStorage(GAS_LIKE_LIMITS);
    const repo = createKvSessionRepo(storage, "s1");
    const total = PARTICIPANT_CHUNK_SIZE * 2 + 30;
    for (let i = 0; i < total; i++) await repo.addParticipant(memberId(i));
    // 途中のメンバーを再追加しても増えない
    await repo.addParticipant(memberId(150));
    const ids = await repo.listParticipantIds();
    expect(ids).toHaveLength(total);
    expect(ids[0]).toBe(memberId(0));
    expect(ids[total - 1]).toBe(memberId(total - 1));
    expect(new Set(ids).size).toBe(total);
    expect(JSON.parse((await storage.get("session-hub/s/s1/participants/0"))!)).toHaveLength(PARTICIPANT_CHUNK_SIZE);
    expect(JSON.parse((await storage.get("session-hub/s/s1/participants/2"))!)).toHaveLength(30);
    expect(await storage.get("session-hub/s/s1/participants/3")).toBeNull();
  });

  it("ちょうど満杯のかたまりの次は、新しいキーに書く", async () => {
    const storage = new InMemoryKeyValueStorage();
    const repo = createKvSessionRepo(storage, "s1");
    for (let i = 0; i < PARTICIPANT_CHUNK_SIZE; i++) await repo.addParticipant(memberId(i));
    expect(await storage.get("session-hub/s/s1/participants/1")).toBeNull();
    await repo.addParticipant(memberId(999));
    expect(JSON.parse((await storage.get("session-hub/s/s1/participants/1"))!)).toEqual([memberId(999)]);
  });

  it("セッションごとに別の名簿で、purge で一緒に消える(他のセッションは残る)", async () => {
    const storage = new InMemoryKeyValueStorage();
    const a = createKvSessionRepo(storage, "a");
    const b = createKvSessionRepo(storage, "b");
    for (let i = 0; i < PARTICIPANT_CHUNK_SIZE + 5; i++) await a.addParticipant(memberId(i));
    await b.addParticipant("only-b");
    await a.purge?.();
    expect(await a.listParticipantIds()).toEqual([]);
    expect(await storage.get("session-hub/s/a/participants/0")).toBeNull();
    expect(await storage.get("session-hub/s/a/participants/1")).toBeNull();
    expect(await b.listParticipantIds()).toEqual(["only-b"]);
  });
});

async function startSession(hub: ReturnType<typeof createTestHub>) {
  const meta = await svc.createSession(hub.deps, { name: "会場" }, "a");
  const host = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "PC" }, "a");
  const admin = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "管理" }, "a");
  await svc.setPortalSession(hub.deps, { sessionId: meta.id, published: true });
  const creds = (j: JoinResult) => ({ sessionId: meta.id, deviceId: j.deviceId, token: j.token });
  return { meta, host, admin, creds };
}

describe("参加者名簿: 入室と listParticipants", () => {
  it("ポータルから入室したメンバーだけが載り(ホスト/管理は載らない)、復帰した端末では増えず書き込みも起きない", async () => {
    const hub = createTestHub();
    const { host, admin, creds } = await startSession(hub);
    expect((await svc.listParticipants(hub.deps, creds(host))).memberIds).toEqual([]);

    const alice = await svc.joinPortal(hub.deps, {}, { id: "alice", name: "アリス" });
    await svc.joinPortal(hub.deps, {}, { id: "bob", name: "ボブ" });
    expect((await svc.listParticipants(hub.deps, creds(admin))).memberIds).toEqual(["alice", "bob"]);

    // 復帰(同じ端末)は名簿に触れない
    const setsBefore = hub.counts.kvSet;
    const again = await svc.joinPortal(hub.deps, { deviceId: alice.deviceId, token: alice.token }, { id: "alice", name: "アリス" });
    expect(again.deviceId).toBe(alice.deviceId);
    expect(hub.counts.kvSet).toBe(setsBefore);

    // 別の端末で入り直しても、同じメンバーは1件のまま
    const second = await svc.joinPortal(hub.deps, {}, { id: "alice", name: "アリス" });
    expect(second.deviceId).not.toBe(alice.deviceId);
    expect((await svc.listParticipants(hub.deps, creds(host))).memberIds).toEqual(["alice", "bob"]);
  });

  it("参加者(client)の端末は名簿を取得できない。資格情報が違っても取得できない", async () => {
    const hub = createTestHub();
    const { meta, creds, host } = await startSession(hub);
    const alice = await svc.joinPortal(hub.deps, {}, { id: "alice", name: "アリス" });
    expect(await code(svc.listParticipants(hub.deps, creds(alice)))).toBe("FORBIDDEN");
    expect(await code(svc.listParticipants(hub.deps, { ...creds(host), token: "wrong" }))).toBe("DEVICE_UNAUTHORIZED");
    expect(await code(svc.listParticipants(hub.deps, { sessionId: meta.id, deviceId: "nope", token: "x" }))).toBe("DEVICE_UNAUTHORIZED");
  });

  it("GAS の容量の上限のもとで、数百人が入室しても名簿に全員載る", async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    const { host, creds } = await startSession(hub);
    const total = PARTICIPANT_CHUNK_SIZE * 3 + 7;
    for (let i = 0; i < total; i++) await svc.joinPortal(hub.deps, {}, { id: memberId(i), name: `p${i}` });
    const { memberIds } = await svc.listParticipants(hub.deps, creds(host));
    expect(memberIds).toHaveLength(total);
    expect(new Set(memberIds).size).toBe(total);
    expect((hub.storage as InMemoryKeyValueStorage).scalarBytesUsed()).toBeLessThan(GAS_LIKE_LIMITS.maxTotalScalarBytes);
  });
});
