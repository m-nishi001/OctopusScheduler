import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { entryRoundKey, parseHubErrorCode, readPortalEvent } from "@octopus/session-hub";
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

describe("registerEventHost: エントリー受付", () => {
  async function entryScene() {
    const base = await scene();
    await env.repo.setPortalSession(base.meta.id, true);
    const joinParticipant = async (id: string, name: string) => {
      const d = makeDevice(env.hub, { memberId: id, memberName: name });
      await d.conn.joinPortal();
      return d;
    };
    const eventNow = async () => (await base.published())!;
    const start = async (title = "ジャックポット抽選") => {
      await base.admin.conn.issue("event", "start", { title });
      await settle(5000);
    };
    const command = async (type: string) => {
      await base.admin.conn.issue("event", type);
      await settle(5000);
    };
    const round = () => env.hub.deps.repoFor(base.meta.id).getRound();
    const answers = async () => {
      const r = await round();
      return r ? env.hub.deps.repoFor(base.meta.id).listAnswers(r.key) : [];
    };
    return { ...base, joinParticipant, eventNow, start, command, round, answers };
  }

  const enterWith = async (d: Awaited<ReturnType<typeof makeDevice>>, key: string) => d.conn.answer(key, 1);

  it("イベントが無いときの openEntry は無視する", async () => {
    const { command, round, published } = await entryScene();
    await command("openEntry");
    expect(await round()).toBeNull();
    expect(await published()).toBeNull();
  });

  it("openEntry で受付を開始し、参加者がエントリーできる。公開されたイベントに受付の状態が入る", async () => {
    const { start, command, eventNow, joinParticipant, answers, round } = await entryScene();
    await start();
    await command("openEntry");
    const event = await eventNow();
    expect(event.entry).toEqual({ key: entryRoundKey(event.id), open: true });
    expect(await round()).toMatchObject({ key: event.entry!.key, closedAtMs: null });

    const alice = await joinParticipant("alice", "アリス");
    await settle(5000);
    expect((await enterWith(alice, event.entry!.key)).duplicate).toBe(false);
    expect((await answers()).map((a) => a.memberId)).toEqual(["alice"]);
  });

  it("受付中にもう一度 openEntry しても、何も変わらない(エントリーが消えない)", async () => {
    const { start, command, eventNow, joinParticipant, answers } = await entryScene();
    await start();
    await command("openEntry");
    const key = (await eventNow()).entry!.key;
    await enterWith(await joinParticipant("alice", "アリス"), key);
    await command("openEntry");
    expect(await answers()).toHaveLength(1);
    expect((await eventNow()).entry).toEqual({ key, open: true });
  });

  it("closeEntry で締め切ると、以後のエントリーは受け付けず、参加者の画面用に open=false で残る", async () => {
    const { start, command, eventNow, joinParticipant } = await entryScene();
    await start();
    await command("openEntry");
    const key = (await eventNow()).entry!.key;
    const alice = await joinParticipant("alice", "アリス");
    await enterWith(alice, key);

    await command("closeEntry");
    expect((await eventNow()).entry).toEqual({ key, open: false });
    const late = await joinParticipant("bob", "ボブ");
    const rejected = await enterWith(late, key).then(() => null, (e: Error) => e);
    expect(rejected && parseHubErrorCode(rejected.message)).toBe("ROUND_CLOSED");
    // エントリー済みの人には「済み」と返る
    expect((await enterWith(alice, key)).duplicate).toBe(true);
  });

  it("締め切ったあとの openEntry は、エントリー済みの人を残したまま再開する（途中参加を受け付け直す）", async () => {
    const { start, command, eventNow, joinParticipant, answers } = await entryScene();
    await start();
    await command("openEntry");
    const key = (await eventNow()).entry!.key;
    await enterWith(await joinParticipant("alice", "アリス"), key);
    await command("closeEntry");

    await command("openEntry");
    expect((await eventNow()).entry).toEqual({ key, open: true });
    await enterWith(await joinParticipant("bob", "ボブ"), key);
    expect((await answers()).map((a) => a.memberId).sort()).toEqual(["alice", "bob"]);
  });

  it("イベントを終了すると、受付中のエントリーも締め切る", async () => {
    const { start, command, eventNow, joinParticipant, round, published } = await entryScene();
    await start();
    await command("openEntry");
    const key = (await eventNow()).entry!.key;
    await command("end");
    expect(await published()).toBeNull();
    expect((await round())?.closedAtMs).not.toBeNull();
    await expect(enterWith(await joinParticipant("alice", "アリス"), key)).rejects.toThrow();
  });

  it("新しいイベントを開始すると、前のイベントの受付を締め切り、新しいイベントにはエントリーが無い", async () => {
    const { start, command, eventNow, round } = await entryScene();
    await start("第1部");
    await command("openEntry");
    const first = await eventNow();
    await start("第2部");
    const second = await eventNow();
    expect(second.id).not.toBe(first.id);
    expect(second.entry).toBeUndefined();
    expect((await round())?.closedAtMs).not.toBeNull();
  });

  it("ホストがリロードしても、受付中の状態を公開し直し、エントリー済みの人数も保たれる", async () => {
    const storage = memoryStorage();
    const first = await scene(storage);
    await env.repo.setPortalSession(first.meta.id, true);
    await first.admin.conn.issue("event", "start", { title: "第1部" });
    await settle(5000);
    await first.admin.conn.issue("event", "openEntry");
    await settle(5000);
    const before = (await first.published())!;
    const alice = makeDevice(env.hub, { memberId: "alice", memberName: "アリス" });
    await alice.conn.joinPortal();
    await alice.conn.answer(before.entry!.key, 1);
    first.agent.connection.dispose();

    container.clearInstances();
    const { agent } = registerHostAgent(env);
    registerEventHost(agent, options(storage));
    await agent.connection.joinOperator({ sessionId: first.meta.id, role: "host", label: "PC", takeover: true });
    await settle(5000);
    expect(await first.published()).toEqual(before);
    const r = await env.hub.deps.repoFor(first.meta.id).getRound();
    expect(r?.answerCount).toBe(1);
  });
});
