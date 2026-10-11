import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";

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
  agent.router.register("jackpot", (c) => void calls.push(c.type));
  return { meta, agent, calls };
}

async function mountConsole(sessionId: string) {
  const device = makeDevice(env.hub, { memberId: "admin2" });
  const router = makeRouter(`/session/console/${sessionId}`);
  await router.isReady();
  const wrapper = mount(SessionConsoleView, { props: { connection: device.conn }, global: { plugins: [router] } });
  await settle();
  return { wrapper, device };
}

const btn = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll("button").find((b) => b.text().includes(text))!;

describe("管理コンソールのジャックポット操作", () => {
  it("本抽選の画面が開かれていない間は案内を表示し、「止める」は押せない", async () => {
    const { meta } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("本抽選の画面を開くと");
    expect(btn(wrapper, "止める").attributes("disabled")).toBeDefined();
    expect(btn(wrapper, "次へ").attributes("disabled")).toBeUndefined();
  });

  it("「次へ」でホストに jackpot.advance が届く。連打しても1件", async () => {
    const { meta, calls } = await setupHosted();
    const { wrapper, device } = await mountConsole(meta.id);
    const next = btn(wrapper, "次へ");
    await next.trigger("click");
    await next.trigger("click");
    await next.trigger("click");
    await settle(5000);
    expect(device.api.calls.issueCommand).toBe(1);
    expect(calls).toEqual(["advance"]);
  });

  it("ホストの公開した進行状況(段階・当選者・賞品)を表示する。止められる間だけ「止める」が押せる", async () => {
    const { meta, agent, calls } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);

    await agent.publishSlice("jackpot", jackpotState({ phase: "member", canStop: true }), ["jackpot.stopRoulette"]);
    await settle(5000);
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("メンバー抽選");
    const stop = btn(wrapper, "止める");
    expect(stop.attributes("disabled")).toBeUndefined();
    await stop.trigger("click");
    await settle(5000);
    expect(calls).toEqual(["stopRoulette"]);

    await agent.publishSlice("jackpot", jackpotState({ phase: "prize", member: "太郎", prize: "特賞" }), []);
    await settle(5000);
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("賞品抽選");
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("当選者: 太郎");
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("賞品: 特賞");
    expect(btn(wrapper, "止める").attributes("disabled")).toBeDefined();
  });

  it("本抽選の画面を離れたら進行状況の表示が案内に戻る", async () => {
    const { meta, agent } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    await agent.publishSlice("jackpot", jackpotState({ member: "太郎" }));
    await settle(5000);
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("太郎");
    await agent.clearSlice("jackpot");
    await settle(5000);
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("本抽選の画面を開くと");
  });
});
