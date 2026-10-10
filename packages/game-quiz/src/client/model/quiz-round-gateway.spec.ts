import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { HostAgent, SessionAdminRepository } from "@octopus/session-hub";
import { createFakeHubApi, makeDevice, makeHub } from "@octopus/session-hub/testing";
import { sessionService as svc } from "@octopus/session-hub/engine";
import { QuizRoundGateway } from "./quiz-round-gateway";
import { buildQuizHostState } from "./quiz-host-state";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const OPTIONS = [
  { no: 1, text: "A" },
  { no: 2, text: "B" },
];

async function scene(options: { host?: boolean } = {}) {
  const hub = makeHub();
  const meta = await svc.createSession(hub.deps, { name: "x" }, "a");
  const hostDevice = makeDevice(hub, { memberId: "a" });
  const agent = new HostAgent(hostDevice.conn);
  container.register(HostAgent, { useValue: agent });
  container.register(SessionAdminRepository, { useValue: new SessionAdminRepository(createFakeHubApi(hub, "a", undefined, "https://app.example/exec")) });
  if (options.host !== false) await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const players = [] as ReturnType<typeof makeDevice>[];
  for (const [i, name] of ["太郎", "花子", "次郎"].entries()) {
    const p = makeDevice(hub);
    await p.conn.joinClient({ code: meta.code, label: name, memberId: `m${i + 1}` });
    players.push(p);
  }
  return { hub, meta, agent, players, gateway: new QuizRoundGateway() };
}

describe("QuizRoundGateway", () => {
  it("ホストとして接続していない端末では何もしない(open/close/answers は null や何もしない)", async () => {
    const { gateway } = await scene({ host: false });
    expect(gateway.isActive()).toBe(false);
    expect(await gateway.open("q1", "live", OPTIONS, 20)).toBeNull();
    await expect(gateway.close("q1", "live")).resolves.toBeUndefined();
    expect(await gateway.answers("q1", "live")).toBeNull();
    expect(await gateway.portalUrl()).toBeNull();
    expect(() => gateway.publish(buildQuizHostState({ page: "intro", quizId: "q1" }))).not.toThrow();
  });

  it("HostAgent が未登録でも例外にならない", async () => {
    container.clearInstances();
    const gateway = new QuizRoundGateway();
    expect(gateway.isActive()).toBe(false);
    expect(await gateway.open("q1", "live", OPTIONS, 20)).toBeNull();
    expect(gateway.sessionCode()).toBeNull();
  });

  it("開始すると締切(サーバ時刻)と残り時間が返り、参加者の回答がランキング入力の形で取れる", async () => {
    const { gateway, players } = await scene();
    const round = await gateway.open("q1", "live", OPTIONS, 20);
    expect(round).toMatchObject({ key: "q1:live", remainingMs: 20_000 });
    await players[0].conn.answer("q1:live", 2);
    await tick(100);
    await players[1].conn.answer("q1:live", 1);
    const result = await gateway.answers("q1", "live");
    expect(result!.openedAtMs).toBe(round!.deadlineMs - 20_000);
    expect(result!.answers.map((a) => [a.userId, a.displayName, a.optionNo])).toEqual([
      ["m1", "太郎", 2],
      ["m2", "花子", 1],
    ]);
    expect(result!.answers[0].serverTimestampMs).toBeLessThan(result!.answers[1].serverTimestampMs);
  });

  it("メンバーを選ばないゲストは端末IDで区別され、表示名は入力した名前になる", async () => {
    const { gateway, hub, meta } = await scene();
    const guest = makeDevice(hub);
    await guest.conn.joinClient({ code: meta.code, label: "ゲスト花" });
    await gateway.open("q1", "live", OPTIONS, 20);
    await guest.conn.answer("q1:live", 1);
    const result = await gateway.answers("q1", "live");
    expect(result!.answers[0].userId).toBe(guest.conn.state.deviceId);
    expect(result!.answers[0].displayName).toBe("ゲスト花");
  });

  it("受付を締め切ると以後の回答は拒否され、ホストの再読込(同じラウンドの再開始)では回答が消えない", async () => {
    const { gateway, players } = await scene();
    await gateway.open("q1", "live", OPTIONS, 30);
    await players[0].conn.answer("q1:live", 1);
    const again = await gateway.open("q1", "live", OPTIONS, 30); // リロード
    expect(again!.remainingMs).toBe(30_000);
    expect((await gateway.answers("q1", "live"))!.answers).toHaveLength(1);
    await gateway.close("q1", "live");
    await expect(players[1].conn.answer("q1:live", 2)).rejects.toThrow(/ROUND_CLOSED/);
  });

  it("本番とデモは別のラウンド(デモの回答が本番に混ざらない)", async () => {
    const { gateway, players } = await scene();
    await gateway.open("q1", "demo", OPTIONS, 20);
    await players[0].conn.answer("q1:demo", 1);
    await expect(gateway.answers("q1", "live")).resolves.toBeNull(); // live のラウンドは無い(エラーは握りつぶして null)
    expect((await gateway.answers("q1", "demo"))!.answers).toHaveLength(1);
  });

  it("状態の公開はクイズ名前空間で参加者に届き、clear で取り下げられる", async () => {
    const { gateway, players } = await scene();
    gateway.publish(buildQuizHostState({ page: "play", quizId: "q1", title: "T", question: "Q?", options: [{ no: 1, text: "A" }, { no: 2, text: "B" }], phase: "answering", deadlineMs: 123, roundKey: "q1:live" }));
    await tick(5000);
    expect((players[0].conn.state.roomState?.data as { quiz?: { question: string } }).quiz?.question).toBe("Q?");
    gateway.clear();
    await tick(5000);
    expect((players[0].conn.state.roomState?.data as { quiz?: unknown }).quiz).toBeUndefined();
  });

  it("QR用のポータルURLは、セッションの参加コード入りで返る", async () => {
    const { gateway, meta } = await scene();
    expect(gateway.sessionCode()).toBe(meta.code);
    expect(await gateway.portalUrl()).toEqual({ url: `https://app.example/exec#/portal/${meta.code}`, code: meta.code });
  });

  it("回答一覧の取得に失敗しても例外にせず null(結果画面は「正答者なし」で続行できる)", async () => {
    const { gateway } = await scene();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await gateway.answers("none", "live")).toBeNull();
  });
});
