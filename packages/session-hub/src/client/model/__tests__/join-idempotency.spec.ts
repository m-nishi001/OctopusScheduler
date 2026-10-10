import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../server/engine/session-service";
import type { FaultInjector } from "../../../testing";
import { makeDevice, makeHub } from "./harness";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

describe("運営者の入室は応答が失われて再送しても冪等", () => {
  it("ホスト入室の応答が失われても、再送で同じ端末として入室でき HOST_ALREADY_CONNECTED にならない", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    let dropOnce = true;
    const faults: FaultInjector = {
      decide: (e) => {
        if (e === "joinOperator" && dropOnce) {
          dropOnce = false;
          return "dropResponse";
        }
        return "ok";
      },
    };
    const host = makeDevice(hub, { memberId: "a", faults });
    await expect(host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" })).rejects.toThrow();
    // 1回目はサーバでは成功済み(ホスト枠が埋まっている)
    expect((await hub.deps.repoFor(meta.id).getMeta())?.hostDeviceId).not.toBeNull();

    const result = await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    expect(result.session.hostDeviceId).toBe(result.deviceId);
    expect(host.conn.state.phase).toBe("connected");
  });

  it("サーバが二重実行(duplicate)しても端末は1つだけ", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const faults: FaultInjector = { decide: (e) => (e === "joinOperator" ? "duplicate" : "ok") };
    const admin = makeDevice(hub, { memberId: "a", faults });
    const result = await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
    expect(admin.conn.state.deviceId).toBe(result.deviceId);
    const dev = await hub.deps.repoFor(meta.id).getDevice(result.deviceId);
    expect(dev?.memberId).toBe("a");
  });

  it("他の管理者が同じ deviceId を名乗っても乗っ取れず、別の端末として入室する", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const first = await service.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "A", deviceId: "shared-device-id" }, "a");
    expect(first.deviceId).toBe("shared-device-id");
    const other = await service.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "B", deviceId: "shared-device-id" }, "b");
    expect(other.deviceId).not.toBe("shared-device-id");
    expect(other.token).not.toBe(first.token);
  });

  it("不正な形式の deviceId は無視されサーバが採番する", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const r = await service.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "A", deviceId: "bad id!" }, "a");
    expect(r.deviceId).not.toBe("bad id!");
  });
});
