import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../server/engine/session-service";
import type { Command } from "../../../shared/session-types";
import { HostAgent } from "../host-agent";
import { HostCommandRouter } from "../host-command-router";
import { SessionAdminRepository } from "../session-admin-repository";
import { createFakeHubApi } from "../../../testing";
import { makeDevice, makeHub, tick } from "./harness";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

const cmd = (game: string, type: string): Command => ({
  seq: 1,
  requestId: "r",
  game,
  type,
  payload: null,
  issuedBy: "d",
  issuerRole: "admin",
  atMs: 0,
});

describe("HostCommandRouter", () => {
  it("名前空間ごとにハンドラへ振り分け、未登録は無視する", async () => {
    const router = new HostCommandRouter();
    const seen: string[] = [];
    router.register("jackpot", (c) => void seen.push(`j:${c.type}`));
    router.register("quiz", async (c) => {
      await Promise.resolve();
      seen.push(`q:${c.type}`);
    });
    await router.dispatch(cmd("jackpot", "advance"));
    await router.dispatch(cmd("quiz", "next"));
    await router.dispatch(cmd("unknown", "x"));
    expect(seen).toEqual(["j:advance", "q:next"]);
  });

  it("ガードが false を返したコマンドは破棄し、解除すれば再び通る", async () => {
    const router = new HostCommandRouter();
    const seen: string[] = [];
    router.register("jackpot", (c) => void seen.push(c.type));
    router.setGuard((c) => c.type !== "advance");
    await router.dispatch(cmd("jackpot", "advance"));
    await router.dispatch(cmd("jackpot", "back"));
    router.setGuard(null);
    await router.dispatch(cmd("jackpot", "advance"));
    expect(seen).toEqual(["back", "advance"]);
  });

  it("登録解除後は呼ばれず、同じ名前空間は後勝ち。古い解除関数は新しい登録を消さない", async () => {
    const router = new HostCommandRouter();
    const calls: string[] = [];
    const offOld = router.register("g", () => void calls.push("old"));
    router.register("g", () => void calls.push("new"));
    offOld();
    await router.dispatch(cmd("g", "x"));
    expect(calls).toEqual(["new"]);
    expect(router.has("g")).toBe(true);
  });
});

describe("HostAgent", () => {
  it("受け取ったコマンドを名前空間のハンドラへ渡し、リロード後も保存情報から復帰する", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const admin = makeDevice(hub, { memberId: "b" });
    await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });

    const host = makeDevice(hub, { memberId: "a" });
    const agent = new HostAgent(host.conn);
    const got: string[] = [];
    agent.router.register("session", (c) => void got.push(c.type));
    expect(agent.restore()).toBe(false); // 保存情報なし
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    expect(agent.active).toBe(true);

    await admin.conn.issue("session", "navigate", { path: "/jackpot-opening" });
    await tick(4000);
    expect(got).toEqual(["navigate"]);

    // アプリのリロード相当: 新しいエージェントが同じストアから復帰する
    host.conn.dispose();
    const host2 = makeDevice(hub, { memberId: "a", store: host.store });
    const agent2 = new HostAgent(host2.conn);
    const got2: string[] = [];
    agent2.router.register("session", (c) => void got2.push(c.type));
    expect(agent2.restore()).toBe(true);
    await admin.conn.issue("session", "navigate", { path: "/jackpot-ending" });
    await tick(4000);
    expect(got2).toEqual(["navigate"]);
    expect(agent2.active).toBe(true);
  });

  it("restore は二重に呼んでも接続を作り直さない", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const host = makeDevice(hub, { memberId: "a" });
    const agent = new HostAgent(host.conn);
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    expect(agent.restore()).toBe(true);
    expect(agent.restore()).toBe(true);
    await tick(3000);
    expect(host.api.calls.joinOperator).toBe(1);
  });

  it("lobbyPath: ホストとして接続中だけ、そのセッションのロビーのパスを返す(ゲーム終了後に管理画面へ出さないため)", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const host = makeDevice(hub, { memberId: "a" });
    const agent = new HostAgent(host.conn);
    expect(agent.lobbyPath).toBeNull();
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    expect(agent.lobbyPath).toBe(`/session/host/${meta.id}`);

    const admin = makeDevice(hub, { memberId: "b" });
    const adminAgent = new HostAgent(admin.conn);
    await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
    expect(adminAgent.lobbyPath).toBeNull();
  });

  it("セッションが終了したら active ではなくなる", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const host = makeDevice(hub, { memberId: "a" });
    const agent = new HostAgent(host.conn);
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await service.closeSession(hub.deps, { sessionId: meta.id });
    await tick(10_000);
    expect(agent.active).toBe(false);
  });
});

describe("HostAgent: 結果の保存と更新通知", () => {
  const quizResult = (over: Record<string, unknown> = {}) => ({
    roundKey: "q1:live",
    quizId: "q1",
    title: "第1問",
    correctNo: 2,
    closedAtMs: 1000,
    answeredCount: 2,
    correct: [{ memberId: "p1", name: "太郎", sec: 1.5 }],
    wrongMemberIds: ["p2"],
    ...over,
  });
  const draw = { drawId: "d1", memberId: "p1", memberName: "太郎", prizeId: "x", prizeName: "1等", isKakuhen: false, atMs: 10 };

  async function setup() {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const host = makeDevice(hub, { memberId: "a" });
    const agent = new HostAgent(host.conn);
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await tick(3000);
    return { hub, meta, host, agent };
  }

  it("保存すると、結果は R2 側に入り、DO の状態には rev だけが載る", async () => {
    const { host, agent } = await setup();
    await agent.recordQuizResult(quizResult());
    await tick(3000);
    expect(host.conn.state.roomState?.data.results).toEqual({ rev: 1 });
    await agent.commitJackpotDraw(draw);
    await agent.revealJackpotDraw(draw.drawId);
    await tick(3000);
    expect(host.conn.state.roomState?.data.results).toEqual({ rev: 2 });
    // DO の状態に結果の中身(名前など)は入らない
    expect(JSON.stringify(host.conn.state.roomState?.data)).not.toContain("太郎");
    const view = await host.conn.getResults();
    expect(view.quiz.rounds[0].top[0].name).toBe("太郎");
    expect(view.jackpot.draws[0].prizeName).toBe("1等");
  });

  it("同じ内容の再保存では rev が進まず、リセットすると進む", async () => {
    const { host, agent } = await setup();
    await agent.commitJackpotDraw(draw);
    await agent.revealJackpotDraw(draw.drawId);
    await agent.revealJackpotDraw(draw.drawId);
    await tick(3000);
    expect(host.conn.state.roomState?.data.results).toEqual({ rev: 1 });
    await agent.resetJackpot();
    await tick(3000);
    expect(host.conn.state.roomState?.data.results).toEqual({ rev: 2 });
    expect((await host.conn.getResults()).jackpot.draws).toEqual([]);
  });

  it("抽選の確定(commit)では rev を公開せず、公開(reveal)で公開する。予定は先に保存されたものが返る", async () => {
    const { host, agent } = await setup();
    const plan = await agent.ensureJackpotPlan({ kakuhenTimings: [2], reservedPrizeIds: ["k"] });
    expect(await agent.ensureJackpotPlan({ kakuhenTimings: [9], reservedPrizeIds: [] })).toEqual(plan);
    await agent.commitJackpotDraw(draw);
    await tick(3000);
    expect(host.conn.state.roomState?.data.results).toBeUndefined();
    expect((await agent.getJackpotState()).draws).toMatchObject([{ drawId: "d1", revealedAtMs: null }]);
    expect((await host.conn.getResults()).jackpot.draws).toEqual([]);
    await agent.revealJackpotDraw("d1");
    await tick(3000);
    expect(host.conn.state.roomState?.data.results).toEqual({ rev: 1 });
    expect((await host.conn.getResults()).jackpot.draws).toHaveLength(1);
  });

  it("ホストを再読み込みしても、保存済みの rev を公開し直す", async () => {
    const { hub, meta, host, agent } = await setup();
    await agent.recordQuizResult(quizResult());
    await tick(3000);
    host.conn.dispose();

    const host2 = makeDevice(hub, { memberId: "a", store: host.store });
    const agent2 = new HostAgent(host2.conn);
    expect(agent2.restore()).toBe(true);
    await tick(5000);
    expect(host2.conn.state.roomState?.data.results).toEqual({ rev: 1 });
    expect(meta.id).toBeTruthy();
  });

  it("結果がまだ無いセッションでは、何も公開しない", async () => {
    const { host } = await setup();
    await tick(3000);
    expect(host.conn.state.roomState?.data.results).toBeUndefined();
  });

  it("ホストとして接続していなければ、何もしない", async () => {
    const hub = makeHub();
    const host = makeDevice(hub, { memberId: "a" });
    const agent = new HostAgent(host.conn);
    await expect(agent.recordQuizResult(quizResult())).resolves.toBeUndefined();
    expect(host.api.calls.putQuizResult).toBeUndefined();
  });
});

describe("SessionAdminRepository", () => {
  it("作成・一覧・終了を API に委譲する", async () => {
    const hub = makeHub();
    const repo = new SessionAdminRepository(createFakeHubApi(hub, "a"));
    const created = await repo.create({ name: "宴会" });
    expect((await repo.list()).map((s) => s.id)).toEqual([created.id]);
    await repo.close(created.id);
    expect((await repo.list())[0].status).toBe("closed");
  });

  it("GAS のデプロイURLがあればそれを基点に、無ければ現在のURLをアプリのURLとする", async () => {
    const hub = makeHub();
    const withUrl = new SessionAdminRepository(createFakeHubApi(hub, "a", undefined, "https://script.example/exec"));
    expect(await withUrl.appBaseUrl({ origin: "https://inner", pathname: "/p" })).toBe("https://script.example/exec");
    const without = new SessionAdminRepository(createFakeHubApi(hub, "a"));
    expect(await without.appBaseUrl({ origin: "https://app.example", pathname: "/" })).toBe("https://app.example/");
  });

  it("URL取得に失敗しても現在のURLにフォールバックする", async () => {
    const hub = makeHub();
    const api = createFakeHubApi(hub, "a", { decide: (e) => (e === "getWebAppUrl" ? "dropRequest" : "ok") });
    const repo = new SessionAdminRepository(api);
    expect(await repo.appBaseUrl({ origin: "https://app.example", pathname: "/" })).toBe("https://app.example/");
  });
});
