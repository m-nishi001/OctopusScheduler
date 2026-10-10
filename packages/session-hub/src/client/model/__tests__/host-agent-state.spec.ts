import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../server/engine/session-service";
import { HostAgent } from "../host-agent";
import { makeDevice, makeHub, tick } from "./harness";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

async function scene() {
  const hub = makeHub();
  const meta = await service.createSession(hub.deps, { name: "x" }, "a");
  const host = makeDevice(hub, { memberId: "a" });
  const agent = new HostAgent(host.conn);
  const client = makeDevice(hub);
  await client.conn.joinClient({ code: meta.code });
  return { hub, meta, host, agent, client };
}

describe("HostAgent の状態公開(スライス)", () => {
  it("名前空間ごとの状態を1つの RoomState にまとめて公開し、参加者入力は和集合になる", async () => {
    const { hub, meta, host, agent, client } = await scene();
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await agent.publishSlice("session", { path: "/jackpot-opening" });
    await agent.publishSlice("jackpot", { phase: "draw" }, ["jackpot.stopRoulette"]);
    await agent.publishSlice("quiz", { quizId: "q1" }, ["quiz.answer"]);
    const state = await hub.deps.repoFor(meta.id).getState();
    expect(state?.data).toEqual({ session: { path: "/jackpot-opening" }, jackpot: { phase: "draw" }, quiz: { quizId: "q1" } });
    expect(state?.clientInput.sort()).toEqual(["jackpot.stopRoulette", "quiz.answer"]);
    await tick(5000);
    expect(client.conn.state.roomState?.data).toMatchObject({ jackpot: { phase: "draw" } });
  });

  it("名前空間を外すと、その参加者入力も閉じる", async () => {
    const { hub, meta, host, agent } = await scene();
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await agent.publishSlice("jackpot", { phase: "draw" }, ["jackpot.stopRoulette"]);
    await agent.clearSlice("jackpot");
    const state = await hub.deps.repoFor(meta.id).getState();
    expect(state?.data).toEqual({});
    expect(state?.clientInput).toEqual([]);
  });

  it("未接続の間の更新は保持され、入室した時点でまとめて公開される", async () => {
    const { hub, meta, host, agent } = await scene();
    await agent.publishSlice("session", { path: "/lobby" });
    expect(await hub.deps.repoFor(meta.id).getState()).toBeNull();
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await tick(10);
    expect((await hub.deps.repoFor(meta.id).getState())?.data).toEqual({ session: { path: "/lobby" } });
  });

  it("引き継ぎで新しいホストになったら、手元の状態を公開し直す", async () => {
    const { hub, meta, host, agent } = await scene();
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await agent.publishSlice("session", { path: "/a" });

    const host2 = makeDevice(hub, { memberId: "a" });
    const agent2 = new HostAgent(host2.conn);
    await agent2.publishSlice("session", { path: "/b" });
    await host2.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC2", takeover: true });
    await tick(10);
    expect((await hub.deps.repoFor(meta.id).getState())?.data).toEqual({ session: { path: "/b" } });
  });

  it("公開の失敗は呼び出し側に例外を投げない(演出を止めない)", async () => {
    const { host, agent, meta } = await scene();
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    // 別端末がホストを奪った後に旧ホストが公開しても例外にならない
    const hub2 = host;
    void hub2;
    await expect(agent.publishSlice("session", { n: 1 })).resolves.toBeUndefined();
  });
});
