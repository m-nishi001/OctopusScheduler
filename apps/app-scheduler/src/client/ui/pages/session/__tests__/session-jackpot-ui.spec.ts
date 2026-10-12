import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";
import { PORTAL_EVENT_NS } from "@octopus/session-hub";

vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin2", name: "田中", isAdmin: true }) }),
}));

import SessionConsoleView from "../session-console-view.vue";
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

const jackpotState = (over: Record<string, unknown> = {}) => ({
  page: "main-draw",
  phase: "member",
  canStop: false,
  member: null,
  prize: null,
  ...over,
});

async function setupHosted() {
  const meta = await env.repo.create({ name: "抽選会場" });
  const { agent, device } = registerHostAgent(env);
  await device.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const calls: string[] = [];
  const nav: unknown[] = [];
  const events: string[] = [];
  agent.router.register("jackpot", (c) => void calls.push(c.type));
  agent.router.register("session", (c) => void nav.push(c.payload));
  agent.router.register(PORTAL_EVENT_NS, (c) => void events.push(c.type));
  return { meta, agent, calls, nav, events };
}

async function mountConsole(sessionId: string) {
  const device = makeDevice(env.hub, { memberId: "admin2" });
  const router = makeRouter(`/session/console/${sessionId}`);
  await router.isReady();
  const wrapper = mount(SessionConsoleView, { props: { connection: device.conn }, global: { plugins: [router] } });
  await settle();
  return { wrapper, device };
}

const next = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="next-button"]');

/** ホストが抽選画面を開いて、状態を公開した状態にする。 */
async function openDraw(agent: Awaited<ReturnType<typeof setupHosted>>["agent"], over: Record<string, unknown> = {}, clientInput: string[] = []) {
  await agent.publishSlice("session", { path: "/execute/jackpot-draw" });
  await agent.publishSlice("jackpot", jackpotState(over), clientInput);
  await settle(5000);
}

describe("管理コンソールのジャックポット操作", () => {
  it("ホストが抽選画面にいない間は主ボタンを出さず、「ジャックポットを始める」だけが押せる", async () => {
    const { meta } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    expect(next(wrapper).exists()).toBe(false);
    expect(wrapper.find('[data-testid="start-jackpot"]').attributes("disabled")).toBeUndefined();
  });

  it("「ジャックポットを始める」1回で、イベントの開催とオープニング画面への切り替えが済む。もう一度押してもイベントは重ねない", async () => {
    const { meta, agent, nav, events } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    await wrapper.find('[data-testid="start-jackpot"]').trigger("click");
    await settle(8000);
    expect(events).toEqual(["start"]);
    expect(nav).toEqual([{ path: "/jackpot-opening" }]);

    // ホストがイベントを公開した後に再度押すと、イベントは作らず画面だけ切り替える
    await agent.publishSlice(PORTAL_EVENT_NS, { id: "e1", title: "ジャックポット抽選", startedAtMs: Date.now() });
    await settle(5000);
    await wrapper.find('[data-testid="start-jackpot"]').trigger("click");
    await settle(8000);
    expect(events).toEqual(["start"]);
    expect(nav).toEqual([{ path: "/jackpot-opening" }, { path: "/jackpot-opening" }]);
  });

  it("オープニング → 説明 → 抽選 の順に、主ボタンで画面が進む", async () => {
    const { meta, agent, nav } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);

    await agent.publishSlice("session", { path: "/jackpot-opening" });
    await settle(5000);
    expect(next(wrapper).text()).toContain("説明へ");
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(nav).toEqual([{ path: "/jackpot-description" }]);

    await agent.publishSlice("session", { path: "/jackpot-description" });
    await settle(5000);
    expect(next(wrapper).text()).toContain("抽選を始める");
    expect(wrapper.find('[data-testid="next-hint"]').text()).toContain("まだ抽選は始まりません");
  });

  it("抽選画面では「次へ」でホストに jackpot.advance が届く。連打しても1件", async () => {
    const { meta, agent, calls } = await setupHosted();
    const { wrapper, device } = await mountConsole(meta.id);
    await openDraw(agent);
    const button = next(wrapper);
    expect(button.text()).toContain("次へ");
    await button.trigger("click");
    await button.trigger("click");
    await button.trigger("click");
    await settle(5000);
    expect(device.api.calls.issueCommand).toBe(1);
    expect(calls).toEqual(["advance"]);
  });

  it("止められる間は主ボタンが「止める」になり、押すと進行(advance)が届く。止められない間は「次へ」に戻る", async () => {
    const { meta, agent, calls } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);

    await openDraw(agent, { phase: "member", canStop: true }, ["jackpot.stopRoulette"]);
    expect(wrapper.find('[data-testid="now"]').text()).toContain("メンバー抽選");
    expect(next(wrapper).text()).toContain("止める");
    expect(wrapper.find('[data-testid="next-hint"]').text()).toContain("メンバー");
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(calls).toEqual(["advance"]);

    await openDraw(agent, { phase: "prize", member: "太郎", prize: "特賞" });
    expect(wrapper.find('[data-testid="now"]').text()).toContain("景品抽選");
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("当選者: 太郎");
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("賞品: 特賞");
    expect(next(wrapper).text()).toContain("次へ");
  });

  it("抽選画面を離れたら、進行状況の表示が消え、主ボタンも無くなる", async () => {
    const { meta, agent } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    await openDraw(agent, { member: "太郎" });
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("太郎");
    await agent.clearSlice("jackpot");
    await agent.publishSlice("session", { path: "/session/host/x" });
    await settle(5000);
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toBe("");
    expect(next(wrapper).exists()).toBe(false);
  });
});
