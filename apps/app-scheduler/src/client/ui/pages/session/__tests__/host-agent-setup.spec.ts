import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";

import HostAgentBadge from "../components/host-agent-badge.vue";
import { setupHostAgent } from "../../../../control/session/host-agent-setup";
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

async function hostedScene() {
  const meta = await env.repo.create({ name: "x" });
  const { agent, device } = registerHostAgent(env);
  const router = makeRouter("/session/host/" + meta.id);
  await router.isReady();
  setupHostAgent(router);
  await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(env.hub, { memberId: "admin2" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  return { meta, agent, device, router, admin };
}

describe("setupHostAgent: session.navigate", () => {
  it("許可された画面へ遷移する", async () => {
    const { router, admin } = await hostedScene();
    await admin.conn.issue("session", "navigate", { path: "/jackpot-opening" });
    await settle(5000);
    expect(router.currentRoute.value.fullPath).toBe("/execute/jackpot-opening");
  });

  it.each(["/settings", "https://evil.example/", "/jackpot-opening#/settings", "//evil.example", "/quiz-admin/quizzes"])(
    "許可リスト外(%s)へはホスト側で拒否し遷移しない",
    async (path) => {
      const { router, admin, meta } = await hostedScene();
      await admin.conn.issue("session", "navigate", { path });
      await settle(5000);
      expect(router.currentRoute.value.fullPath).toBe(`/session/host/${meta.id}`);
    },
  );

  it("パスが文字列でない・欠けているコマンドは無視する", async () => {
    const { router, admin, meta } = await hostedScene();
    await admin.conn.issue("session", "navigate", { path: 42 });
    await admin.conn.issue("session", "navigate");
    await admin.conn.issue("session", "unknownType", { path: "/jackpot-opening" });
    await settle(8000);
    expect(router.currentRoute.value.fullPath).toBe(`/session/host/${meta.id}`);
  });

  it("クイズの表示画面(/quiz/...)は /execute 配下のルートへ遷移する", async () => {
    const meta = await env.repo.create({ name: "q" });
    const { agent, device } = registerHostAgent(env);
    const router = makeRouter("/session/host/" + meta.id);
    router.addRoute({ path: "/execute/quiz/:id/play", component: { render: () => null } });
    await router.isReady();
    setupHostAgent(router);
    await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    const admin = makeDevice(env.hub, { memberId: "admin2" });
    await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
    await admin.conn.issue("session", "navigate", { path: "/quiz/q1/play" });
    await settle(5000);
    expect(router.currentRoute.value.fullPath).toBe("/execute/quiz/q1/play");
    void device;
  });

  it("すでに同じ画面なら遷移しない(重複ナビゲーション警告を出さない)", async () => {
    const { router, admin } = await hostedScene();
    await admin.conn.issue("session", "navigate", { path: "/jackpot-opening" });
    await settle(5000);
    const push = vi.spyOn(router, "push");
    await admin.conn.issue("session", "navigate", { path: "/jackpot-opening" });
    await settle(5000);
    expect(push).not.toHaveBeenCalled();
  });

  it("expectedPath が現在の画面と違う遷移(古い画面を見て押された主ボタン)は破棄する", async () => {
    const { router, admin } = await hostedScene();
    await admin.conn.issue("session", "navigate", { path: "/jackpot-description" });
    await settle(5000);
    expect(router.currentRoute.value.fullPath).toBe("/execute/jackpot-description");
    // 管理端末はまだオープニングを見ている → 「説明へ」ではなく、その次の画面として扱われてはいけない
    await admin.conn.issue("session", "navigate", { path: "/jackpot-draw", expectedPath: "/execute/jackpot-opening" });
    await settle(5000);
    expect(router.currentRoute.value.fullPath).toBe("/execute/jackpot-description");
  });

  it("expectedPath が現在の画面と同じなら遷移する", async () => {
    const { router, admin } = await hostedScene();
    await admin.conn.issue("session", "navigate", { path: "/jackpot-opening" });
    await settle(5000);
    await admin.conn.issue("session", "navigate", { path: "/jackpot-description", expectedPath: "/execute/jackpot-opening" });
    await settle(5000);
    expect(router.currentRoute.value.fullPath).toBe("/execute/jackpot-description");
  });

  it("名前空間を問わず expectedPath が違う操作(advance など)は、ゲームの処理に届く前に破棄する", async () => {
    const { agent, router, admin } = await hostedScene();
    const received: string[] = [];
    agent.router.register("jackpot", (c) => void received.push(c.type));
    await router.push("/jackpot-description");
    await admin.conn.issue("jackpot", "advance", { expectedPath: "/execute/jackpot-opening" });
    await admin.conn.issue("jackpot", "advance", { expectedPath: "/execute/jackpot-description" });
    await admin.conn.issue("jackpot", "back"); // 付けない操作は従来どおり通す
    await settle(8000);
    expect(received).toEqual(["advance", "back"]);
  });

  it("遷移のたびに現在の画面を状態として公開する", async () => {
    const { router, meta } = await hostedScene();
    await router.push("/jackpot-ending");
    await settle(100);
    const state = await env.hub.deps.repoFor(meta.id).getState();
    expect(state?.data).toEqual({ session: { path: "/execute/jackpot-ending" } });
  });

  it("ホストでない(未接続の)端末は遷移を公開しようとしない", async () => {
    const { agent } = registerHostAgent(env);
    const router = makeRouter("/");
    await router.isReady();
    setupHostAgent(router);
    const publish = vi.spyOn(agent, "publishSlice");
    await router.push("/jackpot-opening");
    await settle(100);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("setupHostAgent: ゲーム終了からロビーへ戻るとイベントを終了", () => {
  const eventOf = async (meta: { id: string }) => (await env.hub.deps.repoFor(meta.id).getState())?.data?.event;

  async function startedEvent() {
    const scene = await hostedScene();
    scene.router.addRoute({ path: "/execute/quiz/:id/result", name: "quiz-result", component: { render: () => null } });
    await scene.admin.conn.issue("event", "start", { title: "乾杯" });
    await scene.admin.conn.issue("event", "openEntry");
    await settle(5000);
    expect(await eventOf(scene.meta)).toMatchObject({ title: "乾杯", entry: { open: true } });
    return scene;
  }

  it.each(["/execute/quiz/q1/result", "/execute/jackpot-ending", "/jackpot-ending"])(
    "終了画面(%s)に入っただけではイベントを終了しない",
    async (path) => {
      const { router, meta } = await startedEvent();
      await router.push(path);
      await settle(5000);
      expect(await eventOf(meta)).toMatchObject({ title: "乾杯", entry: { open: true } });
    },
  );

  it.each(["/execute/quiz/q1/result", "/execute/jackpot-ending", "/jackpot-ending"])(
    "終了画面(%s)からロビーへ戻ると、受付を締め切ってイベントを終了する",
    async (path) => {
      const { router, meta } = await startedEvent();
      await router.push(path);
      await settle(5000);
      await router.push(`/session/host/${meta.id}`);
      await settle(5000);
      expect(await eventOf(meta)).toBeUndefined();
    },
  );

  it("終了画面以外からロビーへ戻ってもイベントは続く", async () => {
    const { router, meta } = await startedEvent();
    await router.push("/jackpot-opening");
    await settle(5000);
    await router.push(`/session/host/${meta.id}`);
    await settle(5000);
    expect(await eventOf(meta)).toMatchObject({ title: "乾杯" });
  });

  it("終了画面から、ロビー以外へ遷移してもイベントは続く", async () => {
    const { router, meta } = await startedEvent();
    await router.push("/execute/jackpot-ending");
    await settle(5000);
    await router.push("/home");
    await settle(5000);
    expect(await eventOf(meta)).toMatchObject({ title: "乾杯" });
  });
});

describe("setupHostAgent: リロード復帰", () => {
  it("保存済みのホスト入室情報から自動で復帰し、不在中のコマンドを適用する", async () => {
    const { meta, device, admin } = await hostedScene();
    device.conn.dispose(); // リロードでメモリが消える
    await admin.conn.issue("session", "navigate", { path: "/jackpot-ending" });
    await settle(1000);

    container.clearInstances();
    const device2 = makeDevice(env.hub, { memberId: "admin1", store: device.store });
    const { HostAgent } = await import("@octopus/session-hub");
    const agent2 = new HostAgent(device2.conn);
    container.register(HostAgent, { useValue: agent2 });
    const router2 = makeRouter("/");
    await router2.isReady();
    setupHostAgent(router2);
    await settle(5000);
    expect(agent2.active).toBe(true);
    expect(device2.conn.state.session?.id).toBe(meta.id);
    expect(router2.currentRoute.value.fullPath).toBe("/execute/jackpot-ending");
  });
});

describe("host-agent-badge", () => {
  it("ホストでない間は何も表示しない", async () => {
    registerHostAgent(env);
    const wrapper = mount(HostAgentBadge);
    expect(wrapper.find('[data-testid="host-badge"]').exists()).toBe(false);
  });

  it("ホストとして接続中はセッション名と状態を表示し、クリックを通す設定になっている", async () => {
    const { agent } = await hostedScene();
    const wrapper = mount(HostAgentBadge);
    await settle(4000);
    const badge = wrapper.find('[data-testid="host-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain("x・接続中");
    expect(badge.classes()).toContain("is-ok");
    expect(agent.active).toBe(true);
  });

  it("通信が途切れると警告の見た目に切り替わる", async () => {
    const meta = await env.repo.create({ name: "断線" });
    let down = false;
    const { agent } = registerHostAgent(env, "admin1", { decide: (e) => (down && e === "poll" ? "dropRequest" : "ok") });
    await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    const wrapper = mount(HostAgentBadge);
    await settle(3000);
    down = true;
    await settle(60_000);
    const badge = wrapper.find('[data-testid="host-badge"]');
    expect(badge.text()).toContain("再接続中");
    expect(badge.classes()).toContain("is-warn");
  });

  it("セッションが終了したら終了を表示する", async () => {
    const { meta } = await hostedScene();
    const wrapper = mount(HostAgentBadge);
    await env.repo.close(meta.id);
    await settle(20_000);
    expect(wrapper.find('[data-testid="host-badge"]').text()).toContain("終了");
    expect(wrapper.find('[data-testid="host-badge"]').classes()).toContain("is-error");
  });
});
