import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { entryRoundKey } from "@octopus/session-hub";
import { registerEventHost } from "../../../control/session/event-host";
import type { EventStorage } from "../../../control/session/event-host";
import { makeDevice, registerHostAgent, setupSessionEnv, settle } from "../session/__tests__/session-test-kit";
import type { SessionEnv } from "../session/__tests__/session-test-kit";

// 顔写真は、ジャックポットのデータの代わりに用意した対応表から引く
const photoOf: Record<string, string> = { alice: "blob:photo-alice" };
const disposed = vi.fn();
vi.mock("@octopus/game-jackpot", () => ({
  createMemberPhotoCache: () => ({
    ensure: async () => undefined,
    get: (id: string) => photoOf[id],
    dispose: disposed,
  }),
}));

import EntryStageView from "./entry-stage-view.vue";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  disposed.mockClear();
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

function memoryStorage(): EventStorage {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
}

async function stageScene() {
  const meta = await env.repo.create({ name: "受付会場" });
  await env.repo.setPortalSession(meta.id, true);
  const { agent } = registerHostAgent(env);
  let n = 0;
  registerEventHost(agent, { storage: memoryStorage(), now: () => Date.now(), newId: () => `event-${++n}` });
  await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(env.hub, { memberId: "admin2" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  const wrapper = mount(EntryStageView);
  await settle(0);
  const command = async (type: string, payload?: unknown) => {
    await admin.conn.issue("event", type, payload);
    await settle(8000);
  };
  const enter = async (id: string, name: string) => {
    const d = makeDevice(env.hub, { memberId: id, memberName: name });
    await d.conn.joinPortal();
    await d.conn.answer(entryRoundKey("event-1"), 1);
    await settle(8000);
  };
  const names = () => wrapper.findAll('[data-testid="entry-bubble"]').map((b) => b.find(".bubble__name").text());
  const text = (id: string) => wrapper.get(`[data-testid="${id}"]`).text();
  return { wrapper, command, enter, names, text };
}

describe("entry-stage-view", () => {
  it("イベントが始まる前は、その旨と0人を表示する", async () => {
    const s = await stageScene();
    expect(s.text("stage-label")).toBe("イベントはまだ始まっていません");
    expect(s.text("stage-count")).toBe("0");
    expect(s.names()).toEqual([]);
    s.wrapper.unmount();
  });

  it("イベントを始めると、タイトルと「まもなく」を表示する。受付を開くと「受付中!」に変わる", async () => {
    const s = await stageScene();
    await s.command("start", { title: "ジャックポット抽選" });
    expect(s.text("stage-title")).toBe("ジャックポット抽選");
    expect(s.text("stage-label")).toContain("まもなく");

    await s.command("openEntry");
    expect(s.text("stage-label")).toBe("エントリー受付中!");
    s.wrapper.unmount();
  });

  it("参加者がエントリーするたびに、名前つきのバブルが増え、人数が更新される（顔写真は名簿から）", async () => {
    const s = await stageScene();
    await s.command("start", { title: "抽選" });
    await s.command("openEntry");

    await s.enter("alice", "アリス");
    expect(s.names()).toEqual(["アリス"]);
    expect(s.text("stage-count")).toBe("1");
    expect(s.wrapper.get('[data-testid="entry-bubble"] img').attributes("src")).toBe("blob:photo-alice");

    await s.enter("bob", "ボブ");
    expect(s.names()).toEqual(["アリス", "ボブ"]);
    expect(s.text("stage-count")).toBe("2");
    // 顔写真が無いボブは頭文字のアバター
    expect(s.wrapper.findAll('[data-testid="entry-bubble"]')[1].find("img").exists()).toBe(false);
    s.wrapper.unmount();
  });

  it("締め切っても、エントリー済みの人は残り、表示は「受付は終了しました」になる", async () => {
    const s = await stageScene();
    await s.command("start", { title: "抽選" });
    await s.command("openEntry");
    await s.enter("alice", "アリス");

    await s.command("closeEntry");
    expect(s.text("stage-label")).toBe("エントリー受付は終了しました");
    expect(s.names()).toEqual(["アリス"]);
    s.wrapper.unmount();
  });

  it("画面を閉じると、読み込んだ顔写真を解放する", async () => {
    const s = await stageScene();
    s.wrapper.unmount();
    expect(disposed).toHaveBeenCalledTimes(1);
  });
});
