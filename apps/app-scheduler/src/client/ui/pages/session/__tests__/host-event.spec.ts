import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { readPortalEvent } from "@octopus/session-hub";
import { registerEventHost } from "../../../../control/session/event-host";
import type { EventStorage } from "../../../../control/session/event-host";
import { makeDevice, registerHostAgent, setupSessionEnv, settle } from "./session-test-kit";
import type { SessionEnv } from "./session-test-kit";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

function memoryStorage(): EventStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

let idCounter = 0;
const options = (storage: EventStorage) => ({ storage, now: () => Date.now(), newId: () => `event-${++idCounter}` });

async function scene(storage = memoryStorage()) {
  const meta = await env.repo.create({ name: "受付会場" });
  const { agent } = registerHostAgent(env);
  registerEventHost(agent, options(storage));
  await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(env.hub, { memberId: "admin2" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  const published = async () => {
    const state = await env.hub.deps.repoFor(meta.id).getState();
    return readPortalEvent(state?.data);
  };
  return { meta, agent, admin, storage, published };
}

describe("registerEventHost", () => {
  it("event.start でイベントを公開し、event.end で取り下げる", async () => {
    const { admin, published } = await scene();
    expect(await published()).toBeNull();

    await admin.conn.issue("event", "start", { title: "ジャックポット抽選" });
    await settle(5000);
    expect(await published()).toEqual({ id: expect.any(String), title: "ジャックポット抽選", startedAtMs: 1_700_000_000_000 });

    await admin.conn.issue("event", "end");
    await settle(5000);
    expect(await published()).toBeNull();
  });

  it("タイトルを整えて公開し、空・不正なペイロードは無視する", async () => {
    const { admin, published } = await scene();
    await admin.conn.issue("event", "start", { title: "  乾杯   クイズ " });
    await settle(5000);
    expect((await published())?.title).toBe("乾杯 クイズ");

    await admin.conn.issue("event", "start", { title: "   " });
    await admin.conn.issue("event", "start", { title: 42 });
    await admin.conn.issue("event", "start");
    await settle(8000);
    expect((await published())?.title).toBe("乾杯 クイズ");
  });

  it("発生中に新しく開始すると、新しいイベントに置き換わる", async () => {
    const { admin, published } = await scene();
    await admin.conn.issue("event", "start", { title: "第1部" });
    await settle(5000);
    const first = await published();
    await admin.conn.issue("event", "start", { title: "第2部" });
    await settle(5000);
    const second = await published();
    expect(second?.title).toBe("第2部");
    expect(second?.id).not.toBe(first?.id);
  });

  it("知らない種別のコマンドは無視する", async () => {
    const { admin, published } = await scene();
    await admin.conn.issue("event", "bogus", { title: "x" });
    await settle(5000);
    expect(await published()).toBeNull();
  });

  it("セッションごとにイベントを保存し、終了すると消す", async () => {
    const { admin, meta, storage } = await scene();
    await admin.conn.issue("event", "start", { title: "第1部" });
    await settle(5000);
    expect(JSON.parse(storage.data.get(`octopus.host.event:${meta.id}`)!)).toMatchObject({ title: "第1部" });
    await admin.conn.issue("event", "end");
    await settle(5000);
    expect(storage.data.size).toBe(0);
  });

  it("ホストがリロードして入り直しても、発生中のイベントを公開し直す", async () => {
    const storage = memoryStorage();
    const first = await scene(storage);
    await first.admin.conn.issue("event", "start", { title: "第1部" });
    await settle(5000);
    const before = await first.published();
    first.agent.connection.dispose();

    // リロード後の新しいホスト(同じ端末の保存先を共有する)
    container.clearInstances();
    const { agent } = registerHostAgent(env);
    registerEventHost(agent, options(storage));
    await agent.connection.joinOperator({ sessionId: first.meta.id, role: "host", label: "PC", takeover: true });
    await settle(5000);
    expect(await first.published()).toEqual(before);
  });

  it("壊れた保存データは捨てて、イベント無しで始める", async () => {
    const storage = memoryStorage();
    const meta = await env.repo.create({ name: "受付会場" });
    storage.set(`octopus.host.event:${meta.id}`, "{broken");
    const { agent } = registerHostAgent(env);
    registerEventHost(agent, options(storage));
    await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await settle(5000);
    const state = await env.hub.deps.repoFor(meta.id).getState();
    expect(readPortalEvent(state?.data)).toBeNull();
    expect(storage.data.size).toBe(0);
  });
});
