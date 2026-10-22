import { describe, expect, it } from "vitest";
import { FakeClock, FakeRoom } from "../../../testing";
import { createRoomRepo } from "../room-repo";
import type { RoomStorage } from "../room-types";
import type { JoinResult, ListParticipantsResult } from "../../../shared/protocol";
import type { SessionMeta } from "../../../shared/session-types";

const SID = "session-participants";

function meta(): SessionMeta {
  return {
    id: SID,
    name: "受付会場",
    ownerMemberId: "admin1",
    status: "lobby",
    mode: "live",
    createdAtMs: 1_700_000_000_000,
    expiresAtMs: 1_700_000_000_000 + 12 * 3600 * 1000,
    hostDeviceId: null,
  };
}

function recordingStorage() {
  const data = new Map<string, unknown>();
  const puts: string[] = [];
  const storage: RoomStorage = {
    get: async <T,>(key: string) => data.get(key) as T | undefined,
    put: async (key, value) => {
      puts.push(key);
      data.set(key, value);
    },
    setAlarm: async () => undefined,
    getAlarm: async () => null,
  };
  return { storage, puts, data };
}

describe("参加者名簿(Durable Object 実装)", () => {
  it("新しいメンバーのときだけ、キー participants に1回書く(重複・再読み込み後も書かない)", async () => {
    const { storage, puts, data } = recordingStorage();
    const repo = createRoomRepo(storage);
    await repo.addParticipant("alice");
    await repo.addParticipant("alice");
    await repo.addParticipant("bob");
    await repo.addParticipant("alice");
    expect(puts.filter((k) => k === "participants")).toHaveLength(2);
    expect(await repo.listParticipantIds()).toEqual(["alice", "bob"]);
    expect(data.get("participants")).toEqual(["alice", "bob"]);

    // DO が再起動しても、保存済みの名簿を読んでから判定する
    const restarted = createRoomRepo(storage);
    await restarted.addParticipant("bob");
    expect(puts.filter((k) => k === "participants")).toHaveLength(2);
    await restarted.addParticipant("carol");
    expect(await restarted.listParticipantIds()).toEqual(["alice", "bob", "carol"]);
  });

  it("listParticipantIds の戻り値を書き換えても名簿は変わらない", async () => {
    const repo = createRoomRepo(recordingStorage().storage);
    await repo.addParticipant("alice");
    (await repo.listParticipantIds()).push("evil");
    expect(await repo.listParticipantIds()).toEqual(["alice"]);
  });
});

describe("SessionRoomCore: listParticipants", () => {
  it("ポータルから入室したメンバーを、ホスト/管理の端末だけが取得できる", async () => {
    const room = new FakeRoom(new FakeClock(1_700_000_000_000));
    await room.init(meta());
    const host = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "host", label: "PC" }, "admin1");
    const alice = await room.call<JoinResult>("joinPortal", { label: "アリス" }, "alice");
    await room.call<JoinResult>("joinPortal", { label: "アリス2", deviceId: alice.deviceId, token: alice.token }, "alice");
    await room.call<JoinResult>("joinPortal", { label: "ボブ" }, "bob");

    const result = await room.call<ListParticipantsResult>("listParticipants", {
      sessionId: SID,
      deviceId: host.deviceId,
      token: host.token,
    });
    expect(result.memberIds).toEqual(["alice", "bob"]);

    await expect(
      room.call("listParticipants", { sessionId: SID, deviceId: alice.deviceId, token: alice.token })
    ).rejects.toThrow(/FORBIDDEN/);
  });
});
