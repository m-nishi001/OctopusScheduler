import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { makeDevice, makeHub } from "@octopus/session-hub/testing";
import { sessionService as svc } from "@octopus/session-hub/engine";
import { useJackpotHost } from "./use-jackpot-host";
import type { JackpotHostState } from "@model/jackpot-host-state";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

const state = (over: Partial<JackpotHostState> = {}): JackpotHostState => ({
  page: "main-draw",
  phase: "member",
  canStop: false,
  member: null,
  prize: null,
  ...over,
});

async function scene() {
  const hub = makeHub();
  const meta = await svc.createSession(hub.deps, { name: "x" }, "a");
  const hostDevice = makeDevice(hub, { memberId: "a" });
  const agent = new HostAgent(hostDevice.conn);
  container.register(HostAgent, { useValue: agent });
  await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(hub, { memberId: "b" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  const client = makeDevice(hub);
  await client.conn.joinClient({ code: meta.code });
  return { hub, meta, agent, admin, client, hostDevice };
}

function mountHost(handlers: { advance: () => void; stopRoulette: () => void }) {
  const scope = effectScope();
  const host = scope.run(() => useJackpotHost(handlers))!;
  return { host, stop: () => scope.stop() };
}

describe("useJackpotHost", () => {
  it("ホストとして接続していない端末(HostAgent 未登録)では何もしない", () => {
    container.clearInstances();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    expect(() => host.publish(state())).not.toThrow();
  });

  it("管理端末の advance でハンドラが呼ばれる", async () => {
    const { admin } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    mountHost(handlers);
    await admin.conn.issue("jackpot", "advance");
    await tick(4000);
    expect(handlers.advance).toHaveBeenCalledTimes(1);
    expect(handlers.stopRoulette).not.toHaveBeenCalled();
  });

  it("stopRoulette は止められる場面(canStop)でだけ実行される。管理端末からでも同じ", async () => {
    const { admin } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).not.toHaveBeenCalled(); // まだ止められる場面ではない

    host.publish(state({ canStop: true }));
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);

    host.publish(state({ canStop: false }));
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);
  });

  it("canStop の間だけ参加者に停止ボタン(clientInput)が公開され、参加者の押下がホストに届く", async () => {
    const { hub, meta, client } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);

    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);

    host.publish(state({ canStop: true }));
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual(["jackpot.stopRoulette"]);
    await client.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);

    host.publish(state({ canStop: false }));
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual([]);
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    void hub;
    void meta;
  });

  it("複数の参加者が同時に止めても、ホストの進行は1回分(ハンドラ側の二重実行ガードに任せず、canStop 解除で後続を無視)", async () => {
    const { hub, meta } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    host.publish(state({ canStop: true }));
    // ハンドラ内で止めた瞬間に次の場面へ進む想定: 最初の呼び出しで canStop を false にする
    handlers.stopRoulette.mockImplementation(() => host.publish(state({ canStop: false })));
    const clients = await Promise.all(
      [1, 2, 3].map(async () => {
        const c = makeDevice(hub);
        await c.conn.joinClient({ code: meta.code });
        return c;
      })
    );
    await tick(4000);
    await Promise.all(clients.map((c) => c.conn.issue("jackpot", "stopRoulette").catch(() => undefined)));
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);
  });

  it("公開した状態が参加者・管理端末の画面に届く(名前空間 jackpot)", async () => {
    const { admin, client } = await scene();
    const { host } = mountHost({ advance: vi.fn(), stopRoulette: vi.fn() });
    host.publish(state({ member: "太郎", prize: "特賞" }));
    await tick(4000);
    expect((client.conn.state.roomState?.data as { jackpot?: JackpotHostState }).jackpot).toMatchObject({ member: "太郎", prize: "特賞" });
    expect((admin.conn.state.roomState?.data as { jackpot?: JackpotHostState }).jackpot?.phase).toBe("member");
  });

  it("画面を離れると、コマンドの受付を止め、公開していた状態と停止ボタンを取り下げる", async () => {
    const { admin, client } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host, stop } = mountHost(handlers);
    host.publish(state({ canStop: true }));
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual(["jackpot.stopRoulette"]);

    stop(); // 画面を離れた
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual([]);
    expect((client.conn.state.roomState?.data as { jackpot?: unknown }).jackpot).toBeUndefined();
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    await admin.conn.issue("jackpot", "advance");
    await tick(4000);
    expect(handlers.advance).not.toHaveBeenCalled();
  });
});
