import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../server/engine/session-service";
import type { Command } from "../../../shared/session-types";
import { loadCredentials } from "../device-store";
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
  const oldHost = makeDevice(hub, { memberId: "a" });
  const oldApplied: Command[] = [];
  oldHost.conn.onCommand((c) => void oldApplied.push(c));
  await oldHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "旧PC" });
  const newHost = makeDevice(hub, { memberId: "a" });
  const newApplied: Command[] = [];
  newHost.conn.onCommand((c) => void newApplied.push(c));
  const admin = makeDevice(hub, { memberId: "b" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  return { hub, meta, oldHost, newHost, admin, oldApplied, newApplied };
}

describe("ホストの引き継ぎ", () => {
  it("引き継がれた旧ホストは replaced になり、以後コマンドを適用せず、入室情報を消して停止する", async () => {
    const { meta, oldHost, newHost, admin, oldApplied, newApplied } = await scene();
    await newHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "新PC", takeover: true });
    await tick(5000);
    expect(oldHost.conn.state.phase).toBe("replaced");
    expect(loadCredentials(oldHost.store, "host")).toBeNull();

    await admin.conn.issue("jackpot", "advance");
    await tick(5000);
    expect(newApplied.map((c) => c.type)).toEqual(["advance"]);
    expect(oldApplied).toEqual([]); // 二重に演出が走らない

    const calls = oldHost.api.calls.poll;
    await tick(60_000);
    expect(oldHost.api.calls.poll).toBe(calls);
  });

  it("引き継ぎの瞬間に旧ホストの適用待ちだったコマンドも、旧ホストでは実行されない", async () => {
    const { meta, oldHost, newHost, admin, oldApplied } = await scene();
    await admin.conn.issue("jackpot", "advance"); // 旧ホストがまだ受け取る前
    await newHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "新PC", takeover: true });
    await tick(5000);
    expect(oldHost.conn.state.phase).toBe("replaced");
    expect(oldApplied).toEqual([]);
  });

  it("旧ホストの状態公開は拒否され、公開待ちの呼び出しは失敗として返る(宙に浮かない)", async () => {
    const { meta, oldHost, newHost } = await scene();
    const agent = new HostAgent(oldHost.conn);
    await newHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "新PC", takeover: true });
    await tick(5000);
    expect(agent.active).toBe(false);
    await expect(oldHost.conn.publish({ a: 1 })).rejects.toThrow();
  });

  it("引き継いだ側は通常どおりホストとして動作する", async () => {
    const { meta, newHost, admin, newApplied } = await scene();
    await newHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "新PC", takeover: true });
    await admin.conn.issue("jackpot", "advance");
    await tick(4000);
    expect(newHost.conn.state.phase).toBe("connected");
    expect(newApplied).toHaveLength(1);
  });

  it("旧ホストが引き継ぎ返す(takeover)と、今度は新ホストが replaced になる", async () => {
    const { meta, oldHost, newHost } = await scene();
    await newHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "新PC", takeover: true });
    await tick(5000);
    expect(oldHost.conn.state.phase).toBe("replaced");
    await oldHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "旧PC", takeover: true });
    await tick(5000);
    expect(oldHost.conn.state.phase).toBe("connected");
    expect(newHost.conn.state.phase).toBe("replaced");
  });

  it("管理端末・参加者は影響を受けない", async () => {
    const { meta, newHost, admin } = await scene();
    await newHost.conn.joinOperator({ sessionId: meta.id, role: "host", label: "新PC", takeover: true });
    await tick(5000);
    expect(admin.conn.state.phase).toBe("connected");
    expect(admin.conn.state.session?.hostDeviceId).toBe(newHost.conn.state.deviceId);
  });
});
