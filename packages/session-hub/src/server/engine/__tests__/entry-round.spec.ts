import { describe, expect, it } from "vitest";
import { createTestHub } from "../../../testing";
import * as svc from "../session-service";
import { parseHubErrorCode } from "../hub-error";
import { MAX_OPEN_ROUND_MS, SESSION_TTL_MS } from "../../../shared/session-types";
import type { JoinResult, RoundOption } from "../../../shared/protocol";

const ENTRY: RoundOption[] = [{ no: 1, text: "エントリー" }];
const KEY = "entry:event-1";

async function code(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (e) {
    return parseHubErrorCode((e as Error).message) ?? (e as Error).message;
  }
}

async function setup() {
  const hub = createTestHub();
  const meta = await svc.createSession(hub.deps, { name: "受付会場" }, "admin1");
  await svc.setPortalSession(hub.deps, { sessionId: meta.id, published: true });
  const host = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "PC" }, "admin1");
  const admin = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "A" }, "admin2");
  const creds = (j: JoinResult) => ({ sessionId: meta.id, deviceId: j.deviceId, token: j.token });
  /** ログイン済みの参加者(ポータル入室)。同じメンバーでも、呼ぶたびに別の端末になる(保存情報を渡さないため)。 */
  const portal = (id: string, name = id) => svc.joinPortal(hub.deps, {}, { id, name });
  const openEntry = (resume = false) =>
    svc.openRound(hub.deps, { ...creds(host), key: KEY, options: ENTRY, mode: "open", resume });
  const enter = (who: JoinResult) => svc.submitAnswer(hub.deps, { ...creds(who), key: KEY, no: 1 });
  const answers = async () => (await svc.getAnswers(hub.deps, { ...creds(host), key: KEY })).answers;
  return { hub, meta, host, admin, creds, portal, openEntry, enter, answers };
}

describe("オープン型ラウンド(運営が締め切るまで開き続ける)", () => {
  it("選択肢1個・受付時間なしで開始でき、締切は十分先になる", async () => {
    const { hub, openEntry } = await setup();
    const r = await openEntry();
    expect(r.deadlineMs).toBe(hub.clock.now() + MAX_OPEN_ROUND_MS);
    expect(MAX_OPEN_ROUND_MS).toBeLessThan(SESSION_TTL_MS);
  });

  it("数時間たっても受付中で、運営が締め切るまで開き続ける", async () => {
    const { hub, openEntry, portal, enter, admin, creds } = await setup();
    await openEntry();
    const alice = await portal("alice");
    hub.clock.advance(3 * 60 * 60 * 1000);
    expect((await enter(alice)).duplicate).toBe(false);

    const summary = await svc.closeRound(hub.deps, { ...creds(admin), key: KEY });
    expect(summary.open).toBe(false);
    const late = await portal("bob");
    expect(await code(enter(late))).toBe("ROUND_CLOSED");
  });

  it("従来の時間を競うラウンド(timed)は選択肢2個以上・受付時間が必須のまま", async () => {
    const { hub, host, creds } = await setup();
    const open = (patch: object) => svc.openRound(hub.deps, { ...creds(host), key: "q1", options: ENTRY, durationMs: 10_000, ...patch });
    expect(await code(open({}))).toBe("INVALID_ARGUMENT");
    expect(await code(open({ mode: "timed" }))).toBe("INVALID_ARGUMENT");
    expect(await code(svc.openRound(hub.deps, { ...creds(host), key: "q1", options: [...ENTRY, { no: 2, text: "b" }] }))).toBe("INVALID_ARGUMENT");
    expect(await code(open({ options: [...ENTRY, { no: 2, text: "b" }] }))).toBeNull();
  });

  it("オープン型でも、選択肢0個や不正な mode は拒否する", async () => {
    const { hub, host, creds } = await setup();
    const args = { ...creds(host), key: "e1", mode: "open" as const };
    expect(await code(svc.openRound(hub.deps, { ...args, options: [] }))).toBe("INVALID_ARGUMENT");
    expect(await code(svc.openRound(hub.deps, { ...args, options: ENTRY, mode: "forever" as never }))).toBe("INVALID_ARGUMENT");
  });

  it("ホスト以外は開始できない", async () => {
    const { hub, admin, creds } = await setup();
    expect(await code(svc.openRound(hub.deps, { ...creds(admin), key: KEY, options: ENTRY, mode: "open" }))).toBe("NOT_HOST");
  });
});

describe("受付の再開(途中参加を受け付け直す)", () => {
  it("締め切ったあと resume で再開すると、回答を残したまま新しい人もエントリーできる", async () => {
    const { hub, openEntry, portal, enter, answers, admin, creds } = await setup();
    await openEntry();
    await enter(await portal("alice"));
    await svc.closeRound(hub.deps, { ...creds(admin), key: KEY });
    const bob = await portal("bob");
    expect(await code(enter(bob))).toBe("ROUND_CLOSED");

    hub.clock.advance(60_000);
    const reopened = await openEntry(true);
    expect(reopened.deadlineMs).toBe(hub.clock.now() + MAX_OPEN_ROUND_MS);
    expect((await enter(bob)).duplicate).toBe(false);
    expect((await answers()).map((a) => a.memberId)).toEqual(["alice", "bob"]);
    const summary = (await svc.getAnswers(hub.deps, { ...creds(admin), key: KEY })).round;
    expect(summary).toMatchObject({ open: true, answerCount: 2 });
  });

  it("resume を付けずに開き直すと、従来どおり新しいラウンドとして回答が消える", async () => {
    const { hub, openEntry, portal, enter, answers, admin, creds } = await setup();
    await openEntry();
    await enter(await portal("alice"));
    await svc.closeRound(hub.deps, { ...creds(admin), key: KEY });
    await openEntry(false);
    expect(await answers()).toEqual([]);
  });

  it("受付中に resume を付けて呼んでも何も変わらない(ホストのリロードの再送を安全に扱う)", async () => {
    const { hub, openEntry, portal, enter, answers } = await setup();
    const first = await openEntry();
    await enter(await portal("alice"));
    hub.clock.advance(5_000);
    const again = await openEntry(true);
    expect(again.deadlineMs).toBe(first.deadlineMs);
    expect(await answers()).toHaveLength(1);
  });

  it("別のラウンド(別の key)を resume で開いても、新しいラウンドとして始まる", async () => {
    const { hub, host, openEntry, portal, enter, answers, creds } = await setup();
    await openEntry();
    await enter(await portal("alice"));
    await svc.openRound(hub.deps, { ...creds(host), key: "entry:event-2", options: ENTRY, mode: "open", resume: true });
    expect(await answers().catch(() => "gone")).toBe("gone");
  });
});

describe("ログイン済みメンバーは1人1回（端末が違っても）", () => {
  it("同じメンバーが2台でエントリーしても、1件だけ。2台目は「済み」と返る", async () => {
    const { openEntry, portal, enter, answers } = await setup();
    await openEntry();
    const phone = await portal("alice", "アリス");
    const tablet = await portal("alice", "アリス");
    expect(tablet.deviceId).not.toBe(phone.deviceId);

    const first = await enter(phone);
    const second = await enter(tablet);
    expect(first.duplicate).toBe(false);
    expect(second).toMatchObject({ duplicate: true, no: 1, atMs: first.atMs });
    expect(await answers()).toHaveLength(1);
  });

  it("締切後でも、別の端末から「済み」の表示を揃えて返す", async () => {
    const { hub, openEntry, portal, enter, admin, creds } = await setup();
    await openEntry();
    const phone = await portal("alice");
    const tablet = await portal("alice");
    await enter(phone);
    await svc.closeRound(hub.deps, { ...creds(admin), key: KEY });
    expect((await enter(tablet)).duplicate).toBe(true);
  });

  it("別のメンバーはそれぞれ数えられ、同じ端末の連打は1件", async () => {
    const { openEntry, portal, enter, answers } = await setup();
    await openEntry();
    const alice = await portal("alice");
    await enter(alice);
    await enter(alice);
    await enter(await portal("bob"));
    expect((await answers()).map((a) => a.memberId).sort()).toEqual(["alice", "bob"]);
  });

  it("回答にはログイン確定の印(verified)が付く", async () => {
    const { openEntry, portal, enter, answers } = await setup();
    await openEntry();
    await enter(await portal("alice"));
    await enter(await portal("carol"));
    const byMember = Object.fromEntries((await answers()).map((a) => [a.memberId, a.verified]));
    expect(byMember).toEqual({ alice: true, carol: true });
  });

  it("時間を競うラウンドでも、ログイン済みメンバーは1人1件(別の端末から選び直すと置き換わる)", async () => {
    const { hub, meta, host, portal, creds } = await setup();
    const options = [{ no: 1, text: "a" }, { no: 2, text: "b" }];
    await svc.openRound(hub.deps, { ...creds(host), key: "q1", options, durationMs: 20_000 });
    const phone = await portal("alice");
    const tablet = await portal("alice");
    const first = await svc.submitAnswer(hub.deps, { ...creds(phone), key: "q1", no: 1 });
    hub.clock.advance(300);
    // 別の端末から選び直しても、同じメンバーの1件が置き換わる(2件にならない)
    const second = await svc.submitAnswer(hub.deps, { ...creds(tablet), key: "q1", no: 2 });
    expect(first.duplicate).toBe(false);
    expect(second).toMatchObject({ duplicate: false, no: 2, atMs: hub.clock.now() });
    expect(await hub.deps.repoFor(meta.id).listAnswers("q1")).toMatchObject([{ memberId: "alice", no: 2 }]);
  });
});
