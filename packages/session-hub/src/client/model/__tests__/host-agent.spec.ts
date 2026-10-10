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

describe("SessionAdminRepository", () => {
  it("作成・一覧・終了を API に委譲する", async () => {
    const hub = makeHub();
    const repo = new SessionAdminRepository(createFakeHubApi(hub, "a"));
    const created = await repo.create({ name: "宴会" });
    expect((await repo.list()).map((s) => s.id)).toEqual([created.id]);
    await repo.close(created.id);
    expect((await repo.list())[0].status).toBe("closed");
  });

  it("GAS のデプロイURLがあればそれを基点に、無ければ現在のURLで参加URLを作る", async () => {
    const hub = makeHub();
    const withUrl = new SessionAdminRepository(createFakeHubApi(hub, "a", undefined, "https://script.example/exec#/x"));
    expect(await withUrl.portalUrl("ABC234", { origin: "https://inner", pathname: "/p" })).toBe("https://script.example/exec#/portal/ABC234");
    const without = new SessionAdminRepository(createFakeHubApi(hub, "a"));
    expect(await without.portalUrl("ABC234", { origin: "https://app.example", pathname: "/" })).toBe("https://app.example/#/portal/ABC234");
  });

  it("URL取得に失敗しても現在のURLにフォールバックする", async () => {
    const hub = makeHub();
    const api = createFakeHubApi(hub, "a", { decide: (e) => (e === "getWebAppUrl" ? "dropRequest" : "ok") });
    const repo = new SessionAdminRepository(api);
    expect(await repo.portalUrl("ABC234", { origin: "https://app.example", pathname: "/" })).toBe("https://app.example/#/portal/ABC234");
  });
});
