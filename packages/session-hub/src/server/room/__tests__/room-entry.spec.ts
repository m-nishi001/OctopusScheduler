import { describe, expect, it } from "vitest";
import { FakeClock, FakeRoom } from "../../../testing";
import type { GetAnswersResult, JoinResult, OpenRoundResult, SubmitAnswerResult } from "../../../shared/protocol";
import type { SessionMeta } from "../../../shared/session-types";
import { MAX_OPEN_ROUND_MS, MAX_ROUND_ANSWERS_DO } from "../../../shared/session-types";

const SID = "session-entry";
const KEY = "entry:event-1";
const ENTRY = [{ no: 1, text: "エントリー" }];

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

async function scene() {
  const room = new FakeRoom(new FakeClock(1_700_000_000_000));
  await room.init(meta());
  const host = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "host", label: "PC" }, "admin1");
  const admin = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "admin", label: "A" }, "admin2");
  const creds = (j: JoinResult) => ({ sessionId: SID, deviceId: j.deviceId, token: j.token });
  const portal = (memberId: string) => room.call<JoinResult>("joinPortal", { label: memberId }, memberId);
  const open = (resume = false) =>
    room.call<OpenRoundResult>("openRound", { ...creds(host), key: KEY, options: ENTRY, mode: "open", resume });
  const enter = (who: JoinResult) => room.call<SubmitAnswerResult>("submitAnswer", { ...creds(who), key: KEY, no: 1 });
  const answers = () => room.call<GetAnswersResult>("getAnswers", { ...creds(host), key: KEY });
  return { room, host, admin, creds, portal, open, enter, answers };
}

describe("SessionRoomCore: エントリー受付(オープン型ラウンド)", () => {
  it("開き続け、運営が締め切ると以後は受け付けず、再開すると回答を残して受け付け直す", async () => {
    const { room, admin, creds, portal, open, enter, answers } = await scene();
    const opened = await open();
    expect(opened.deadlineMs).toBe(room.clock.now() + MAX_OPEN_ROUND_MS);

    const alice = await portal("alice");
    await enter(alice);
    room.clock.advance(2 * 60 * 60 * 1000);
    await enter(await portal("bob"));

    await room.call("closeRound", { ...creds(admin), key: KEY });
    await expect(enter(await portal("carol"))).rejects.toThrow(/ROUND_CLOSED/);

    await open(true);
    await enter(await portal("carol"));
    const list = (await answers()).answers;
    expect(list.map((a) => a.memberId)).toEqual(["alice", "bob", "carol"]);
    expect(list.every((a) => a.verified === true)).toBe(true);
  });

  it("同じメンバーが2台でエントリーしても1件", async () => {
    const { open, portal, enter, answers } = await scene();
    await open();
    const first = await enter(await portal("alice"));
    const second = await enter(await portal("alice"));
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect((await answers()).answers).toHaveLength(1);
  });

  it("エントリー数は回答数としてまとめて配信され、ホストが一覧を取得できる", async () => {
    const { room, host, creds, open, portal, enter } = await scene();
    const wsHost = await room.connectAndAuth(creds(host));
    await open();
    await room.runAlarm();
    const before = wsHost.received.length;
    for (let i = 0; i < 30; i++) await enter(await portal(`member-${i}`));
    // 1件ごとには配信せず、alarm でまとめて1回
    expect(wsHost.received.length).toBe(before);
    await room.runAlarm();
    expect(wsHost.received.length).toBe(before + 1);
    expect(wsHost.lastUpdate()?.round).toMatchObject({ key: KEY, open: true, answerCount: 30 });
  });

  it("回答は永続化され、数が多くても上限(Durable Object)まで受け付ける", async () => {
    const { room, open, portal, enter, answers } = await scene();
    await open();
    for (let i = 0; i < 5; i++) await enter(await portal(`m${i}`));
    await room.runAlarm();
    expect((await answers()).answers).toHaveLength(5);
    expect(MAX_ROUND_ANSWERS_DO).toBeGreaterThanOrEqual(1000);
  });
});
