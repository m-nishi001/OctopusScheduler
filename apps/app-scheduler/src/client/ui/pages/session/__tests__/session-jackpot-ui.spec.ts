import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";

vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin2", name: "田中", isAdmin: true }) }),
}));

import SessionConsoleView from "../session-console-view.vue";
import PortalView from "../portal-view.vue";
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

async function mountPortal(code: string) {
  const device = makeDevice(env.hub);
  const router = makeRouter(`/portal/${code}`);
  await router.isReady();
  const wrapper = mount(PortalView, { props: { connection: device.conn }, global: { plugins: [router] } });
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

describe("参加ポータルのジャックポット", () => {
  it("当選者・賞品は公開されるまで表示されない(ネタバレしない)。公開後に表示される", async () => {
    const { meta, agent } = await setupHosted();
    const { wrapper } = await mountPortal(meta.code);
    await agent.publishSlice("jackpot", jackpotState({ phase: "member" }));
    await settle(8000);
    expect(wrapper.find('[data-testid="winner"]').exists()).toBe(false);

    await agent.publishSlice("jackpot", jackpotState({ phase: "member", member: "太郎" }));
    await settle(8000);
    expect(wrapper.find('[data-testid="winner"]').text()).toContain("当選者: 太郎");
    expect(wrapper.find('[data-testid="winner"]').text()).not.toContain("賞品");

    await agent.publishSlice("jackpot", jackpotState({ phase: "prize", member: "太郎", prize: "特賞" }));
    await settle(8000);
    expect(wrapper.find('[data-testid="winner"]').text()).toContain("賞品: 特賞");
  });

  it("止められる場面でだけ「ルーレットを止める」が出て、押すとホストに届く。止まったら消える", async () => {
    const { meta, agent, calls } = await setupHosted();
    const { wrapper } = await mountPortal(meta.code);
    expect(wrapper.text()).toContain("受付が始まるまでお待ちください");

    await agent.publishSlice("jackpot", jackpotState({ canStop: true }), ["jackpot.stopRoulette"]);
    await settle(8000);
    const stop = btn(wrapper, "ルーレットを止める");
    expect(stop.exists()).toBe(true);
    await stop.trigger("click");
    await stop.trigger("click"); // 連打
    await settle(5000);
    expect(calls).toEqual(["stopRoulette"]);

    await agent.publishSlice("jackpot", jackpotState({ canStop: false, member: "花子" }), []);
    await settle(8000);
    expect(wrapper.findAll("button").some((b) => b.text().includes("ルーレットを止める"))).toBe(false);
    expect(wrapper.find('[data-testid="winner"]').text()).toContain("花子");
  });

  it("遅れて押された(すでに止まった後の)停止は「受付が終了しました」と案内される", async () => {
    const { meta, agent } = await setupHosted();
    const { wrapper } = await mountPortal(meta.code);
    await agent.publishSlice("jackpot", jackpotState({ canStop: true }), ["jackpot.stopRoulette"]);
    await settle(8000);
    const stop = btn(wrapper, "ルーレットを止める");
    // 参加者の画面にはまだボタンが残っているが、ホストはすでに受付を閉じた
    await agent.publishSlice("jackpot", jackpotState({ canStop: false }), []);
    await stop.trigger("click");
    await settle(100);
    expect(wrapper.find(".portal__action").text()).toBe("受付が終了しました");
  });
});
