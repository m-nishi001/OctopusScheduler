import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";
import { tick } from "@octopus/session-hub/testing";
import { usePortalSession } from "../use-portal-session";
import type { PortalSession } from "../use-portal-session";
import { useResults } from "../use-results";
import type { ResultsOptions, ResultsState } from "../use-results";
import { ALICE, participantDevice, portalEnv, sampleDraw, sampleRound } from "../../__tests__/portal-test-kit";
import type { Device } from "../../__tests__/portal-test-kit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

async function connect(device: Device, options: ResultsOptions = { random: () => 0.5 }) {
  let session!: PortalSession;
  let results!: ResultsState;
  const app = createApp(
    defineComponent({
      setup() {
        session = usePortalSession(device.conn);
        results = useResults(session, options);
        return () => h("div");
      },
    })
  );
  app.mount(document.createElement("div"));
  await session.join();
  await tick(5000);
  return { session, results, unmount: () => app.unmount() };
}

const fetches = (device: Device) => device.api.calls.getResults ?? 0;

describe("useResults: 順位発表の途中(held)", () => {
  it("held の間は新しい結果の印(stale)を出さず、解けたら(画面を開いていれば)取得する", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const held = ref(true);
    const alice = await connect(device, { random: () => 0, held: () => held.value });
    alice.results.setVisible(true);
    await tick(100);
    expect(fetches(device)).toBe(1);

    await env.saveQuizResult(sampleRound());
    await tick(5000);
    expect(alice.results.held.value).toBe(true);
    expect(alice.results.stale.value).toBe(false);
    expect(fetches(device)).toBe(1);

    held.value = false;
    await tick(100);
    expect(fetches(device)).toBe(2);
    expect(alice.results.stale.value).toBe(false);
    expect(alice.results.view.value?.quiz.rounds).toHaveLength(1);
    alice.unmount();
  });
});

describe("useResults", () => {
  it("結果がまだ無いときは、画面を開くと空の結果を取得する(新しい結果の印は出ない)", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    expect(alice.results.view.value).toBeNull();
    expect(alice.results.stale.value).toBe(false);
    alice.results.setVisible(true);
    await tick(100);
    expect(alice.results.view.value).toMatchObject({ rev: 0 });
    expect(alice.results.view.value?.quiz.rounds).toEqual([]);
    expect(fetches(device)).toBe(1);
    alice.unmount();
  });

  it("画面を開いていない間は取得せず、新しい結果の印(stale)だけが付く。開くとすぐ取得する", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    await env.saveQuizResult(sampleRound());
    await tick(5000);
    expect(alice.results.stale.value).toBe(true);
    expect(fetches(device)).toBe(0);

    alice.results.setVisible(true);
    await tick(100);
    expect(fetches(device)).toBe(1);
    expect(alice.results.stale.value).toBe(false);
    expect(alice.results.view.value?.quiz.rounds[0]).toMatchObject({ title: "果物クイズ", me: { answered: true, correct: true, rank: 1 } });
    alice.unmount();
  });

  it("画面を開いている間に結果が増えたら、少し待って(ばらつき付きで)取り直す。続けて通知が来ても1回にまとめる", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device, { random: () => 0.5, jitterMs: 2000 });
    alice.results.setVisible(true);
    await tick(100);
    expect(fetches(device)).toBe(1);

    await env.saveQuizResult(sampleRound());
    await tick(3000);
    // 通知は届いたが、ばらつき(0.5 × 2000ms)の間はまだ取りに行かない… ではなく、通知の到着までにすでに時間が経っている
    await env.saveJackpotDraw(sampleDraw());
    await tick(5000);
    expect(alice.results.stale.value).toBe(false);
    expect(alice.results.view.value?.jackpot.draws).toHaveLength(1);
    expect(alice.results.view.value?.quiz.rounds).toHaveLength(1);
    // 初回 + 通知2回ぶん(まとめて 1〜2 回)。通知のたびに毎回取りに行かない
    expect(fetches(device)).toBeLessThanOrEqual(3);
    alice.unmount();
  });

  it("ばらつきの時間が経つまでは取り直さない", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device, { random: () => 0.9, jitterMs: 60_000 });
    alice.results.setVisible(true);
    await tick(100);
    const before = fetches(device);
    await env.saveQuizResult(sampleRound());
    await tick(10_000);
    expect(alice.results.stale.value).toBe(true);
    expect(fetches(device)).toBe(before);
    await tick(60_000);
    expect(fetches(device)).toBe(before + 1);
    expect(alice.results.stale.value).toBe(false);
    alice.unmount();
  });

  it("画面を閉じたら、待っていた取得はやめる", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device, { random: () => 0.9, jitterMs: 60_000 });
    alice.results.setVisible(true);
    await tick(100);
    await env.saveQuizResult(sampleRound());
    await tick(5000);
    alice.results.setVisible(false);
    const before = fetches(device);
    await tick(120_000);
    expect(fetches(device)).toBe(before);
    expect(alice.results.stale.value).toBe(true);
    alice.unmount();
  });

  it("取得に失敗したら error になり、自動では再試行しない。refresh で取り直せる", async () => {
    const env = await portalEnv();
    let fail = true;
    const device = participantDevice(env.hub, ALICE, { faults: { decide: (e) => (e === "getResults" && fail ? "fail" : "ok") } });
    const alice = await connect(device);
    alice.results.setVisible(true);
    // 通信の一時的な失敗は接続が数回だけ再送する。それでも駄目なら error になる
    await tick(120_000);
    expect(alice.results.error.value).toBe(true);
    expect(alice.results.view.value).toBeNull();
    const calls = fetches(device);
    expect(calls).toBeGreaterThanOrEqual(1);
    // その後は、画面側から自動では取り直さない
    await tick(300_000);
    expect(fetches(device)).toBe(calls);

    fail = false;
    await alice.results.refresh();
    expect(alice.results.error.value).toBe(false);
    expect(alice.results.view.value).not.toBeNull();
    alice.unmount();
  });

  it("取得中に重ねて refresh しても、通信は1回", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    await Promise.all([alice.results.refresh(), alice.results.refresh(), alice.results.refresh()]);
    expect(fetches(device)).toBe(1);
    alice.unmount();
  });

  it("他の人の結果は自分向けに整形される(他人のIDは含まれない)", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, { id: "bob", name: "ボブ" });
    const bob = await connect(device);
    await env.saveQuizResult(sampleRound());
    await env.saveJackpotDraw(sampleDraw());
    bob.results.setVisible(true);
    await tick(100);
    const view = bob.results.view.value!;
    expect(view.quiz.rounds[0].me).toMatchObject({ correct: true, rank: 2 });
    expect(view.jackpot.myWins).toBe(0);
    expect(JSON.stringify(view)).not.toContain('"memberId"');
    bob.unmount();
  });
});
