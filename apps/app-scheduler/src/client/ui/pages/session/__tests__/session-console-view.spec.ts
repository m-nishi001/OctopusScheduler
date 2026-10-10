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
import { toasts } from "../../../../../../../../packages/ui-kit/src/composables/use-feedback";
import type { FaultInjector } from "@octopus/session-hub/testing";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  toasts.value = [];
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

async function mountConsole(sessionId: string, faults?: FaultInjector) {
  const device = makeDevice(env.hub, { memberId: "admin2", faults });
  const router = makeRouter(`/session/console/${sessionId}`);
  await router.isReady();
  const wrapper = mount(SessionConsoleView, {
    props: { connection: device.conn },
    global: { plugins: [router] },
  });
  await settle();
  return { wrapper, router, device };
}

const button = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll("button").find((b) => b.text().includes(text))!;

describe("session-console-view", () => {
  it("管理端末として入室し、セッション名・参加コード・接続状態を表示する", async () => {
    const meta = await env.repo.create({ name: "夏祭り" });
    const { wrapper, device } = await mountConsole(meta.id);
    expect(device.conn.state.role).toBe("admin");
    expect(wrapper.text()).toContain("操作: 夏祭り");
    expect(wrapper.find('[data-testid="people-card"]').text()).toContain(meta.code);
    expect(wrapper.text()).toContain("接続中");
  });

  it("ホストが居ない間は警告を出し、居れば消える", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper } = await mountConsole(meta.id);
    expect(wrapper.find('[data-testid="host-warning"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="host-card"]').text()).toContain("ホスト未接続");

    registerHostAgent(env).device.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await settle(6000);
    expect(wrapper.find('[data-testid="host-warning"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="host-card"]').text()).toContain("ホスト接続中");
  });

  it("ホストの応答が途絶えると経過秒を警告として表示する", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { device: hostDevice } = registerHostAgent(env);
    await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    const { wrapper } = await mountConsole(meta.id);
    await settle(5000);
    expect(wrapper.find('[data-testid="host-card"]').text()).toContain("ホスト接続中");
    hostDevice.conn.dispose(); // ホストのタブが閉じた
    await settle(60_000);
    expect(wrapper.find('[data-testid="host-card"]').text()).toMatch(/ホストの応答が\d+秒途絶えています/);
    expect(wrapper.find('[data-testid="host-warning"]').exists()).toBe(true);
  });

  it("プリセットを押すと session.navigate がホストに届き、ホストの表示中パスが更新される", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { agent, device: hostDevice } = registerHostAgent(env);
    const seen: unknown[] = [];
    agent.router.register("session", (c) => void seen.push(c.payload));
    await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    const { wrapper } = await mountConsole(meta.id);

    await button(wrapper, "ジャックポット: オープニング").trigger("click");
    await settle(5000);
    expect(seen).toEqual([{ path: "/jackpot-opening" }]);

    await agent.publishSlice("session", { path: "/jackpot-opening" });
    await settle(5000);
    expect(wrapper.find('[data-testid="host-card"]').text()).toContain("/jackpot-opening");
    expect(wrapper.find('[data-testid="log"]').text()).toContain("session.navigate");
  });

  it("デモのセッションでは遷移先に ?demo=1 が付く", async () => {
    const meta = await env.repo.create({ name: "リハ", mode: "demo" });
    const { agent, device: hostDevice } = registerHostAgent(env);
    const seen: unknown[] = [];
    agent.router.register("session", (c) => void seen.push(c.payload));
    await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    const { wrapper } = await mountConsole(meta.id);
    await button(wrapper, "ジャックポット: 抽選").trigger("click");
    await settle(5000);
    expect(seen).toEqual([{ path: "/jackpot-main-draw?demo=1" }]);
  });

  it("送信中は他のプリセットを押せず、連打しても1件しか発行されない", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper, device } = await mountConsole(meta.id);
    const btn = button(wrapper, "ジャックポット: 結果");
    await btn.trigger("click");
    await btn.trigger("click");
    await btn.trigger("click");
    await settle(100);
    expect(device.api.calls.issueCommand).toBe(1);
    expect((await env.hub.deps.repoFor(meta.id).getHead())?.seq).toBe(1);
  });

  it("送信が通信失敗したらトーストで知らせ、ボタンは再び押せる", async () => {
    const meta = await env.repo.create({ name: "x" });
    let down = false;
    const { wrapper } = await mountConsole(meta.id, { decide: (e) => (down && e === "issueCommand" ? "dropRequest" : "ok") });
    down = true;
    await button(wrapper, "ジャックポット: 説明").trigger("click");
    await settle(2_000);
    expect(toasts.value.some((t) => t.kind === "error" && t.message.includes("送信できませんでした"))).toBe(true);
    expect(button(wrapper, "ジャックポット: 説明").attributes("disabled")).toBeUndefined();
  });

  it("未適用のコマンド件数を表示する", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { device: hostDevice } = registerHostAgent(env);
    await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    hostDevice.conn.dispose(); // ホストは存在するが応答しない
    const { wrapper } = await mountConsole(meta.id);
    await button(wrapper, "ロビー").trigger("click");
    await settle(5000);
    await button(wrapper, "ジャックポット: エンディング").trigger("click");
    await settle(5000);
    expect(wrapper.find('[data-testid="host-card"]').text()).toContain("未適用のコマンド 2 件");
  });

  it("参加者が許可入力を送るとログに「参加者」として出る", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { agent, device: hostDevice } = registerHostAgent(env);
    await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await agent.publishSlice("jackpot", { phase: "draw" }, ["jackpot.stopRoulette"]);
    const { wrapper } = await mountConsole(meta.id);
    const client = makeDevice(env.hub);
    await client.conn.joinClient({ code: meta.code });
    await settle(5000);
    await client.conn.issue("jackpot", "stopRoulette");
    await settle(5000);
    expect(wrapper.find('[data-testid="log"]').text()).toContain("jackpot.stopRoulette");
    expect(wrapper.find('[data-testid="log"]').text()).toContain("参加者");
  });

  it("セッションが終了したら終了を表示し、操作パネルを隠す", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper } = await mountConsole(meta.id);
    await env.repo.close(meta.id);
    await settle(10_000);
    expect(wrapper.text()).toContain("このセッションは終了しました");
    expect(wrapper.find('[data-testid="presets"]').exists()).toBe(false);
  });

  it("端末認証が切れたら「入り直す」で復帰できる", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper, device } = await mountConsole(meta.id);
    const dev = await env.hub.deps.repoFor(meta.id).getDevice(device.conn.state.deviceId!);
    await env.hub.deps.repoFor(meta.id).putDevice({ ...dev!, token: "rotated" });
    await settle(10_000);
    expect(wrapper.text()).toContain("認証が切れました");
    await button(wrapper, "入り直す").trigger("click");
    await settle(100);
    expect(device.conn.state.phase).toBe("connected");
  });

  it("存在しないセッションではエラーを表示する", async () => {
    const { wrapper } = await mountConsole("missing");
    expect(wrapper.find(".console__error").text()).toContain("セッションが見つかりません");
  });

  it("画面を閉じるとポーリングが止まる", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper, device } = await mountConsole(meta.id);
    await settle(5000);
    wrapper.unmount();
    const calls = device.api.calls.poll;
    await settle(60_000);
    expect(device.api.calls.poll).toBe(calls);
  });

  it("リロード相当(再マウント)でも同じ端末として入室する", async () => {
    const meta = await env.repo.create({ name: "x" });
    const first = await mountConsole(meta.id);
    const firstId = first.device.conn.state.deviceId;
    first.wrapper.unmount();
    const device = makeDevice(env.hub, { memberId: "admin2", store: first.device.store });
    const router = makeRouter(`/session/console/${meta.id}`);
    await router.isReady();
    mount(SessionConsoleView, { props: { connection: device.conn }, global: { plugins: [router] } });
    await settle();
    expect(device.conn.state.deviceId).toBe(firstId);
  });
});
