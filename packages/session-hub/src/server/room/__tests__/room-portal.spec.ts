import { describe, expect, it } from "vitest";
import { FakeClock, FakeRoom } from "../../../testing";
import type { JoinResult } from "../../../shared/protocol";
import type { SessionMeta } from "../../../shared/session-types";

const SID = "session-portal";

function meta(): SessionMeta {
  return {
    id: SID,
    code: "PRT234",
    name: "受付会場",
    ownerMemberId: "admin1",
    status: "lobby",
    mode: "live",
    createdAtMs: 1_700_000_000_000,
    expiresAtMs: 1_700_000_000_000 + 12 * 3600 * 1000,
    hostDeviceId: null,
  };
}

async function scene() {
  const room = new FakeRoom(new FakeClock(1_700_000_000_000));
  await room.init(meta());
  return room;
}

describe("SessionRoomCore: joinPortal(Durable Object 経由)", () => {
  it("Worker が渡した memberId と表示名で端末を作り、そのまま WebSocket で更新を受け取れる", async () => {
    const room = await scene();
    const joined = await room.call<JoinResult>("joinPortal", { code: "PRT234", label: "アリス" }, "alice");
    expect(joined.role).toBe("client");
    const ws = await room.connectAndAuth({ sessionId: SID, deviceId: joined.deviceId, token: joined.token });
    expect(ws.updates()).toHaveLength(1);
  });

  it("memberId が無い呼び出しは拒否する(クライアントの申告だけでは入れない)", async () => {
    const room = await scene();
    await expect(room.call("joinPortal", { code: "PRT234", label: "アリス" })).rejects.toThrow(/memberId/);
  });

  it("同じメンバーなら復帰し、別のメンバーは前の人の入室情報では復帰しない", async () => {
    const room = await scene();
    const alice = await room.call<JoinResult>("joinPortal", { code: "PRT234", label: "アリス" }, "alice");
    const again = await room.call<JoinResult>(
      "joinPortal",
      { code: "PRT234", label: "アリス", deviceId: alice.deviceId, token: alice.token },
      "alice"
    );
    expect(again.deviceId).toBe(alice.deviceId);

    const bob = await room.call<JoinResult>(
      "joinPortal",
      { code: "PRT234", label: "ボブ", deviceId: alice.deviceId, token: alice.token },
      "bob"
    );
    expect(bob.deviceId).not.toBe(alice.deviceId);
  });

  it("入室すると在席人数に数えられる", async () => {
    const room = await scene();
    const host = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "host", label: "PC" }, "admin1");
    const ws = await room.connectAndAuth({ sessionId: SID, deviceId: host.deviceId, token: host.token });
    await room.call("joinPortal", { code: "PRT234", label: "アリス" }, "alice");
    await room.call("joinPortal", { code: "PRT234", label: "ボブ" }, "bob");
    await room.runAlarm();
    expect(ws.lastUpdate()?.presence.clientCount).toBe(2);
  });
});
