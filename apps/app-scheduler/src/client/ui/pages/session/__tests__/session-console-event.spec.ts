import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";

vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin2", name: "田中", isAdmin: true }) }),
}));

import SessionConsoleView from "../session-console-view.vue";
import { registerEventHost } from "../../../../control/session/event-host";
import type { EventStorage } from "../../../../control/session/event-host";
import { makeDevice, makeRouter, registerHostAgent, setupSessionEnv, settle } from "./session-test-kit";
import type { SessionEnv } from "./session-test-kit";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

function memoryStorage(): EventStorage {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
}

async function consoleScene() {
  const meta = await env.repo.create({ name: "受付会場" });
  await env.repo.setPortalSession(meta.id, true);
  const { agent } = registerHostAgent(env);
  let n = 0;
  registerEventHost(agent, { storage: memoryStorage(), now: () => Date.now(), newId: () => `event-${++n}` });
  const navigations: unknown[] = [];
  agent.router.register("session", (c) => void navigations.push(c.payload));
  await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });

  const device = makeDevice(env.hub, { memberId: "admin2" });
  const router = makeRouter(`/session/console/${meta.id}`);
  await router.isReady();
  const wrapper = mount(SessionConsoleView, { props: { connection: device.conn }, global: { plugins: [router] } });
  await settle(6000);

  const byTestId = (id: string) => wrapper.find(`[data-testid="${id}"]`);
  const button = (label: string | RegExp) =>
    wrapper.findAll("button").find((b) => (typeof label === "string" ? b.text().includes(label) : label.test(b.text())));
  const click = async (label: string | RegExp) => {
    const b = button(label);
    if (!b) throw new Error(`ボタンが見つかりません: ${String(label)}`);
    await b.trigger("click");
    await settle(8000);
  };
  const startEvent = async (title: string) => {
    await byTestId("event-title").setValue(title);
    // 文書に接続していない要素では、送信ボタンのクリックがフォーム送信にならないため、送信を直接発火する
    await wrapper.get("form.console__event-form").trigger("submit");
    await settle(8000);
  };
  const enter = async (id: string, name: string) => {
    const p = makeDevice(env.hub, { memberId: id, memberName: name });
    await p.conn.joinPortal();
    const round = await env.hub.deps.repoFor(meta.id).getRound();
    await p.conn.answer(round!.key, 1);
    await settle(8000);
  };
  return { wrapper, byTestId, button, click, startEvent, enter, navigations };
}

describe("session-console-view: 参加者ポータルのイベント", () => {
  it("イベント名が空の間は開始できない。入力して開始すると「発生中」の表示になり、終了できる", async () => {
    const s = await consoleScene();
    expect(s.byTestId("event-state").text()).toContain("イベントは発生していません");
    expect(s.button("イベントを開始")!.attributes("disabled")).toBeDefined();
    expect(s.button("イベントを終了")).toBeUndefined();

    await s.startEvent("  ジャックポット抽選  ");
    expect(s.byTestId("event-state").text()).toContain("ジャックポット抽選");
    expect((s.byTestId("event-title").element as HTMLInputElement).value).toBe("");
    expect(s.button("イベントを切り替える")).toBeDefined();

    await s.click("イベントを終了");
    expect(s.byTestId("event-state").text()).toContain("イベントは発生していません");
    expect(s.button("イベントを終了")).toBeUndefined();
  });

  it("発生中にもう一度開始すると、別のイベントに切り替わる", async () => {
    const s = await consoleScene();
    await s.startEvent("第1部");
    await s.startEvent("第2部");
    expect(s.byTestId("event-state").text()).toContain("第2部");
    expect(s.byTestId("event-state").text()).not.toContain("第1部");
  });
});

describe("session-console-view: エントリー受付", () => {
  it("イベントが無い間はエントリーの操作を出さない", async () => {
    const s = await consoleScene();
    expect(s.byTestId("entry-panel").exists()).toBe(false);
  });

  it("イベントを始めると操作が出る。受付を開始すると「受付中」と人数0が出て、参加者のエントリーが一覧に載る", async () => {
    const s = await consoleScene();
    await s.startEvent("ジャックポット抽選");
    expect(s.byTestId("entry-state").text()).toContain("エントリー受付は始まっていません");

    await s.click("エントリー受付を開始");
    expect(s.byTestId("entry-state").text()).toContain("エントリー受付中");
    expect(s.byTestId("entry-count").text()).toBe("0");
    expect(s.byTestId("entrants").exists()).toBe(false);

    await s.enter("alice", "アリス");
    await s.enter("bob", "ボブ");
    expect(s.byTestId("entry-count").text()).toBe("2");
    const rows = s.byTestId("entrants").findAll("li").map((li) => li.text());
    // 新しい人が上
    expect(rows[0]).toContain("ボブ");
    expect(rows[0]).toContain("#2");
    expect(rows[1]).toContain("アリス");
    expect(rows[1]).toContain("#1");
  });

  it("締め切ると「終了」の表示になり、再開できる。再開してもエントリー済みの人は残る", async () => {
    const s = await consoleScene();
    await s.startEvent("抽選");
    await s.click("エントリー受付を開始");
    await s.enter("alice", "アリス");

    await s.click("エントリーを締め切る");
    expect(s.byTestId("entry-state").text()).toContain("エントリー受付は終了");
    expect(s.byTestId("entry-count").text()).toBe("1");
    expect(s.button("エントリーを締め切る")).toBeUndefined();

    await s.click("エントリー受付を再開");
    expect(s.byTestId("entry-state").text()).toContain("エントリー受付中");
    await s.enter("bob", "ボブ");
    expect(s.byTestId("entry-count").text()).toBe("2");
    expect(s.byTestId("entrants").findAll("li")).toHaveLength(2);
  });

  it("イベントを終了すると、エントリーの操作も消える", async () => {
    const s = await consoleScene();
    await s.startEvent("抽選");
    await s.click("エントリー受付を開始");
    await s.click("イベントを終了");
    expect(s.byTestId("entry-panel").exists()).toBe(false);
  });

  it("「エントリー受付(バブル)」を押すと、会場の画面を /event-entry に切り替える指示がホストに届く", async () => {
    const s = await consoleScene();
    await s.click("エントリー受付(バブル)");
    expect(s.navigations).toEqual([{ path: "/event-entry" }]);
  });

  it("イベント中の「会場の画面にエントリーを映す」でも同じ切り替えができる", async () => {
    const s = await consoleScene();
    await s.startEvent("抽選");
    await s.click("会場の画面にエントリーを映す");
    expect(s.navigations).toEqual([{ path: "/event-entry" }]);
  });
});

describe("session-console-view: ジャックポットの抽選の対象", () => {
  it("イベントが無い間は出さない。始めると「全メンバー」で、切り替えボタンが出る", async () => {
    const s = await consoleScene();
    expect(s.byTestId("pool-panel").exists()).toBe(false);
    await s.startEvent("ジャックポット抽選");
    expect(s.byTestId("pool-state").text()).toContain("全メンバー");
    expect(s.button("エントリーした人だけに切り替える")).toBeDefined();
  });

  it("エントリー受付を始めると、対象が「エントリーした人だけ」になり、人数が出る。全メンバーに戻せて、また切り替えられる", async () => {
    const s = await consoleScene();
    await s.startEvent("ジャックポット抽選");
    await s.click("エントリー受付を開始");
    expect(s.byTestId("pool-state").text()).toContain("エントリーした人だけ(0人)");

    await s.enter("alice", "アリス");
    await s.enter("bob", "ボブ");
    expect(s.byTestId("pool-state").text()).toContain("エントリーした人だけ(2人)");

    await s.click("全メンバーに切り替える");
    expect(s.byTestId("pool-state").text()).toContain("全メンバー");
    await s.click("エントリーした人だけに切り替える");
    expect(s.byTestId("pool-state").text()).toContain("エントリーした人だけ(2人)");
  });

  it("エントリー受付を始める前に「エントリーした人だけ」にすると、対象が0人であることを知らせる", async () => {
    const s = await consoleScene();
    await s.startEvent("ジャックポット抽選");
    await s.click("エントリーした人だけに切り替える");
    expect(s.byTestId("pool-hint").text()).toContain("エントリー受付を始めるまで");
    await s.click("エントリー受付を開始");
    expect(s.byTestId("pool-hint").exists()).toBe(false);
  });
});
