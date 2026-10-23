import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent, h } from "vue";
import { RouterView } from "vue-router";
import { AccountsRepository } from "@octopus/accounts";
import { entryRoundKey, readPortalEvent } from "@octopus/session-hub";
import { registerEventHost } from "../../../control/session/event-host";
import type { EventStorage } from "../../../control/session/event-host";
import { makeDevice, registerHostAgent, setupSessionEnv, settle } from "../session/__tests__/session-test-kit";
import type { SessionEnv } from "../session/__tests__/session-test-kit";

vi.mock("@octopus/game-jackpot", () => ({
  createMemberPhotoCache: () => ({ ensure: async () => undefined, get: () => undefined, dispose: () => undefined }),
}));

import JackpotEntryView from "./jackpot-entry-view.vue";

let env: SessionEnv;

const members = [
  { id: "admin2", name: "管理者2", isAdmin: true },
  { id: "alice", name: "アリス" },
  { id: "bob", name: "ボブ" },
  { id: "carol", name: "キャロル" },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  env = setupSessionEnv();
  container.registerInstance(AccountsRepository, { listAccounts: async () => members } as unknown as AccountsRepository);
});
afterEach(() => vi.useRealTimers());

function memoryStorage(): EventStorage {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
}

const Stub = defineComponent({ render: () => h("div", "stub") });

async function scene() {
  const meta = await env.repo.create({ name: "会場" });
  await env.repo.setPortalSession(meta.id, true);
  const { agent } = registerHostAgent(env);
  let n = 0;
  registerEventHost(agent, { storage: memoryStorage(), now: () => Date.now(), newId: () => `event-${++n}` });
  await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(env.hub, { memberId: "admin2" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  const command = async (type: string, payload?: unknown) => {
    await admin.conn.issue("event", type, payload);
    await settle(8000);
  };
  await command("start", { title: "ジャックポット抽選" });

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/execute/jackpot-entry", component: JackpotEntryView },
      { path: "/execute/jackpot-description", component: Stub },
    ],
  });
  await router.push("/execute/jackpot-entry");
  await router.isReady();
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } });
  await settle(8000);

  const join = async (id: string, name: string, enter = false) => {
    const d = makeDevice(env.hub, { memberId: id, memberName: name });
    await d.conn.joinPortal();
    if (enter) await d.conn.answer(entryRoundKey("event-1"), 1);
    await settle(8000);
    return d;
  };
  const names = () => wrapper.findAll('[data-testid="entry-bubble"]').map((b) => b.find(".bubble__name").text());
  const text = (id: string) => wrapper.get(`[data-testid="${id}"]`).text();
  const published = () => readPortalEvent(agent.connection.state.roomState?.data);
  return { wrapper, router, command, join, names, text, published };
}

describe("jackpot-entry-view", () => {
  it("自動: 管理者を除く、ポータルに参加した人が自動でエントリー済みとして並び、途中参加の人も増える。受付は始めない", async () => {
    const s = await scene();
    await s.join("admin2", "管理者2");
    await s.join("alice", "アリス");
    await s.join("bob", "ボブ");

    expect(s.text("stage-label")).toBe("参加者は自動でエントリーされます");
    expect(s.names().sort()).toEqual(["アリス", "ボブ"]);
    expect(s.text("stage-count")).toBe("2");

    await s.join("carol", "キャロル");
    expect(s.names().sort()).toEqual(["アリス", "キャロル", "ボブ"]);
    expect(s.text("stage-count")).toBe("3");

    // 書き込みは無い: エントリー受付は始まらない
    expect(s.published()?.entry).toBeUndefined();
    s.wrapper.unmount();
  });

  it("自動: 画面を離れても、受付の締切などの書き込みはしない", async () => {
    const s = await scene();
    await s.join("alice", "アリス");
    await s.router.push("/execute/jackpot-description");
    await settle(8000);
    expect(s.published()?.entry).toBeUndefined();
    s.wrapper.unmount();
  });

  it("エントリーした人のみに切り替えると、その場で受付を始め、エントリーした人だけが並ぶ。離れると受付を締め切る", async () => {
    const s = await scene();
    await s.join("alice", "アリス");
    await s.join("bob", "ボブ");
    expect(s.names().sort()).toEqual(["アリス", "ボブ"]);

    await s.command("setPool", { mode: "entrants" });
    expect(s.published()?.pool).toBe("entrants");
    expect(s.published()?.entry?.open).toBe(true);
    expect(s.text("stage-label")).toBe("エントリー受付中!");
    expect(s.names()).toEqual([]);

    const carol = makeDevice(env.hub, { memberId: "carol", memberName: "キャロル" });
    await carol.conn.joinPortal();
    await carol.conn.answer(entryRoundKey("event-1"), 1);
    await settle(8000);
    expect(s.names()).toEqual(["キャロル"]);

    await s.router.push("/execute/jackpot-description");
    await settle(8000);
    expect(s.published()?.entry?.open).toBe(false);
    s.wrapper.unmount();
  });

  it("エントリーした人のみに切り替えて、また自動に戻すと、全員の一覧に戻る", async () => {
    const s = await scene();
    await s.join("alice", "アリス");
    await s.command("setPool", { mode: "entrants" });
    expect(s.names()).toEqual([]);
    await s.command("setPool", { mode: "auto" });
    expect(s.names()).toEqual(["アリス"]);
    expect(s.text("stage-label")).toBe("参加者は自動でエントリーされます");
    s.wrapper.unmount();
  });
});
