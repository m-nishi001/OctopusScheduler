import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import * as service from "../../../server/engine/session-service";
import type { FaultInjector } from "../../../testing";
import type { RoundAnswer } from "../../../shared/protocol";
import { makeDevice, makeHub, tick } from "../../model/__tests__/harness";
import type { Device } from "../../model/__tests__/harness";
import { MIN_ANSWERS_REFRESH_MS, useRoundAnswers } from "../use-round-answers";
import type { RoundAnswers } from "../use-round-answers";
import { useSessionConnection } from "../use-session-connection";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

const KEY = "entry:event-1";
const ENTRY = [{ no: 1, text: "エントリー" }];

async function setup(faults?: FaultInjector) {
  const hub = makeHub();
  const meta = await service.createSession(hub.deps, { name: "受付会場" }, "admin1");
  await service.setPortalSession(hub.deps, { sessionId: meta.id, published: true });
  const host = makeDevice(hub, { memberId: "admin1", faults });
  await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  await host.conn.openEntryRound(KEY, ENTRY);
  const participant = async (id: string, enter = true): Promise<Device> => {
    const d = makeDevice(hub, { memberId: id, memberName: id });
    await d.conn.joinPortal();
    if (enter) await d.conn.answer(KEY, 1);
    return d;
  };
  const key = ref<string | null>(KEY);
  let roster!: RoundAnswers;
  const scope = effectScope();
  scope.run(() => {
    const { state } = useSessionConnection(host.conn);
    roster = useRoundAnswers(host.conn, state, key);
  });
  return { hub, host, participant, key, roster: () => roster, unmount: () => scope.stop() };
}

const ids = (r: RoundAnswers) => r.answers.value.map((a) => a.memberId);

describe("useRoundAnswers", () => {
  it("最初に一覧を取得し、エントリーが増えるたびに（通知をきっかけに）更新する", async () => {
    const s = await setup();
    await s.participant("alice");
    await tick(5000);
    expect(ids(s.roster())).toEqual(["alice"]);
    expect(s.roster().count.value).toBe(1);

    await s.participant("bob");
    await tick(5000);
    expect(ids(s.roster())).toEqual(["alice", "bob"]);
    s.unmount();
  });

  it("回答を選び直すと(回答数は同じでも)通知をきっかけに一覧が更新される", async () => {
    const s = await setup();
    await s.host.conn.openEntryRound("q1", [{ no: 1, text: "A" }, { no: 2, text: "B" }]);
    s.key.value = "q1";
    const alice = makeDevice(s.hub, { memberId: "alice", memberName: "alice" });
    await alice.conn.joinPortal();
    await alice.conn.answer("q1", 1);
    await tick(5000);
    expect(s.roster().answers.value.map((a) => a.no)).toEqual([1]);

    await alice.conn.answer("q1", 2);
    await tick(5000);
    expect(s.roster().answers.value.map((a) => a.no)).toEqual([2]);
    expect(s.roster().count.value).toBe(1);
    s.unmount();
  });

  it("エントリーが殺到しても、取得は最短間隔にまとめる（1人ごとに取りに行かない）", async () => {
    const s = await setup();
    await tick(5000);
    const before = s.host.api.calls.getAnswers ?? 0;
    for (let i = 0; i < 30; i++) await s.participant(`member-${i}`);
    await tick(12_000);
    const fetches = (s.host.api.calls.getAnswers ?? 0) - before;
    expect(ids(s.roster())).toHaveLength(30);
    // 12秒の間に、最短間隔(1.5秒)ごとに1回まで
    expect(fetches).toBeGreaterThan(0);
    expect(fetches).toBeLessThanOrEqual(Math.ceil(12_000 / MIN_ANSWERS_REFRESH_MS) + 1);
    s.unmount();
  });

  it("エントリーが無いまま何も起きなければ、定期的な取得はしない", async () => {
    const s = await setup();
    await tick(5000);
    const before = s.host.api.calls.getAnswers ?? 0;
    await tick(10 * 60_000);
    expect((s.host.api.calls.getAnswers ?? 0) - before).toBe(0);
    s.unmount();
  });

  it("受付（key）が無い間は取得しない。決まったら取得する", async () => {
    const s = await setup();
    await tick(5000);
    await s.participant("alice");
    s.key.value = null;
    await tick(5000);
    expect(s.roster().answers.value).toEqual([]);
    const idle = s.host.api.calls.getAnswers ?? 0;
    await tick(10_000);
    expect(s.host.api.calls.getAnswers ?? 0).toBe(idle);

    s.key.value = KEY;
    await tick(5000);
    expect(ids(s.roster())).toEqual(["alice"]);
    s.unmount();
  });

  it("取得に失敗しても一覧は残し、自動で再試行を繰り返さない。次の変化で取り直す", async () => {
    let failing = false;
    const faults: FaultInjector = { decide: (e) => (failing && e === "getAnswers" ? "fail" : "ok") };
    const s = await setup(faults);
    await s.participant("alice");
    await tick(5000);
    expect(ids(s.roster())).toEqual(["alice"]);

    failing = true;
    await s.participant("bob");
    await tick(5000);
    expect(s.roster().error.value).toBeTruthy();
    expect(ids(s.roster())).toEqual(["alice"]);
    const afterFail = s.host.api.calls.getAnswers ?? 0;
    await tick(60_000);
    // 失敗の再試行（クライアント内の短い再送）のあと、無限には繰り返さない
    expect((s.host.api.calls.getAnswers ?? 0) - afterFail).toBeLessThanOrEqual(1);

    failing = false;
    await s.participant("carol");
    await tick(8000);
    expect(s.roster().error.value).toBeNull();
    expect(ids(s.roster())).toEqual(["alice", "bob", "carol"]);
    s.unmount();
  });

  it("破棄したあとは何も取得しない", async () => {
    const s = await setup();
    await s.participant("alice");
    await tick(5000);
    s.unmount();
    const before = s.host.api.calls.getAnswers ?? 0;
    await s.participant("bob");
    await tick(30_000);
    expect(s.host.api.calls.getAnswers ?? 0).toBe(before);
  });
});
