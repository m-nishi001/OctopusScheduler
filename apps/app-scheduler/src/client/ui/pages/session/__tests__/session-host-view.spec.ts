import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";

const confirmMock = vi.fn(async () => true);
vi.mock("@octopus/ui-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/ui-kit")>();
  return { ...actual, useConfirm: () => ({ ...actual.useConfirm(), confirm: confirmMock }) };
});
vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin1", name: "鈴木", isAdmin: true }) }),
}));

import SessionHostView from "../session-host-view.vue";
import { makeDevice, makeRouter, registerHostAgent, setupSessionEnv, settle } from "./session-test-kit";
import type { SessionEnv } from "./session-test-kit";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  confirmMock.mockReset();
  confirmMock.mockResolvedValue(true);
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

async function mountHost(sessionId: string) {
  const router = makeRouter(`/session/host/${sessionId}`);
  await router.isReady();
  // route.params.id を読む画面なので、パスを持つルートで描画する
  const wrapper = mount(SessionHostView, { global: { plugins: [router], stubs: { teleport: true } } });
  await settle();
  return { wrapper, router };
}

describe("session-host-view", () => {
  it("ホストとして入室し、セッション名・参加コード・QR(ポータルURL)を表示する", async () => {
    const meta = await env.repo.create({ name: "夏祭り" });
    const { agent } = registerHostAgent(env);
    const { wrapper } = await mountHost(meta.id);

    expect(agent.active).toBe(true);
    expect(wrapper.find(".host-view__title").text()).toContain("夏祭り");
    expect(wrapper.find(".session-qr__code").text()).toBe(meta.code);
    const qr = wrapper.find("img.session-qr__image");
    expect(qr.exists()).toBe(true);
    expect(decodeURIComponent(qr.attributes("src")!)).toContain(`https://app.example/exec#/portal/${meta.code}`);
    expect(wrapper.text()).toContain("接続中");
  });

  it("端末名にログイン中のアカウント名が入る", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerHostAgent(env);
    await mountHost(meta.id);
    const stored = await env.hub.deps.repoFor(meta.id).getMeta();
    const host = await env.hub.deps.repoFor(meta.id).getDevice(stored!.hostDeviceId!);
    expect(host?.label).toBe("鈴木のホスト端末");
    expect(host?.memberId).toBe("admin1");
  });

  it("入室すると現在の画面(session.path)を状態として公開する", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerHostAgent(env);
    await mountHost(meta.id);
    const state = await env.hub.deps.repoFor(meta.id).getState();
    expect(state?.data).toEqual({ session: { path: `/session/host/${meta.id}` } });
  });

  it("デモのセッションにはデモの印が付く", async () => {
    const meta = await env.repo.create({ name: "リハ", mode: "demo" });
    registerHostAgent(env);
    const { wrapper } = await mountHost(meta.id);
    expect(wrapper.find(".host-view__tag").text()).toBe("デモ");
  });

  it("管理端末・参加者の人数を表示する", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerHostAgent(env);
    const { wrapper } = await mountHost(meta.id);
    const admin = makeDevice(env.hub, { memberId: "admin2" });
    await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
    const c1 = makeDevice(env.hub);
    await c1.conn.joinClient({ code: meta.code });
    await settle(5000);
    expect(wrapper.find(".host-view__presence").text()).toContain("管理端末 1 台");
    expect(wrapper.find(".host-view__presence").text()).toContain("参加者 1 人");
  });

  it("別のホストが在席中なら引き継ぎの確認を出し、承認で引き継ぐ", async () => {
    const meta = await env.repo.create({ name: "x" });
    const other = makeDevice(env.hub, { memberId: "admin1" });
    await other.conn.joinOperator({ sessionId: meta.id, role: "host", label: "先客PC" });
    const { agent } = registerHostAgent(env);
    const { wrapper } = await mountHost(meta.id);

    expect(agent.active).toBe(false);
    expect(wrapper.text()).toContain("先客PC");
    expect(wrapper.text()).toContain("引き継ぎますか");
    const confirmBtn = wrapper.findAll("button").find((b) => b.text() === "引き継ぐ")!;
    await confirmBtn.trigger("click");
    await settle();
    expect(agent.active).toBe(true);
    const stored = await env.hub.deps.repoFor(meta.id).getMeta();
    expect(stored?.hostDeviceId).toBe(agent.connection.state.deviceId);
  });

  it("存在しないセッションはエラーを表示し、再接続ボタンで再試行できる", async () => {
    registerHostAgent(env);
    const { wrapper } = await mountHost("no-such-session");
    expect(wrapper.find(".host-view__error").text()).toContain("セッションが見つかりません");
    const meta = await env.repo.create({ name: "後から作った" });
    // 同じIDで再試行しても見つからない(別セッションのIDは別物)
    await wrapper.findAll("button").find((b) => b.text() === "もう一度接続する")!.trigger("click");
    await settle();
    expect(wrapper.find(".host-view__error").exists()).toBe(true);
    void meta;
  });

  it("通信失敗は再接続ボタンで復旧できる", async () => {
    let down = true;
    env = setupSessionEnv({ faults: { decide: (e) => (down && e === "joinOperator" ? "dropRequest" : "ok") } });
    const meta = await env.repo.create({ name: "x" });
    const { agent } = registerHostAgent(env, "admin1", { decide: (e) => (down && e === "joinOperator" ? "dropRequest" : "ok") });
    const { wrapper } = await mountHost(meta.id);
    expect(agent.active).toBe(false);
    expect(wrapper.find(".host-view__error").exists()).toBe(true);
    down = false;
    await wrapper.findAll("button").find((b) => b.text() === "もう一度接続する")!.trigger("click");
    await settle();
    expect(agent.active).toBe(true);
    expect(wrapper.find(".host-view__error").exists()).toBe(false);
  });

  it("別のセッションのホストとして接続中なら切り替えの確認を出し、拒否したら元の画面へ戻る", async () => {
    const a = await env.repo.create({ name: "A会場" });
    const b = await env.repo.create({ name: "B会場" });
    const { agent } = registerHostAgent(env);
    await agent.connection.joinOperator({ sessionId: a.id, role: "host", label: "PC" });
    confirmMock.mockResolvedValueOnce(false);
    const { router } = await mountHost(b.id);
    expect(confirmMock).toHaveBeenCalled();
    expect(agent.connection.state.session?.id).toBe(a.id);
    expect(router.currentRoute.value.fullPath).toBe(`/session/host/${a.id}`);
  });

  it("切り替えを承認すると新しいセッションのホストになる", async () => {
    const a = await env.repo.create({ name: "A会場" });
    const b = await env.repo.create({ name: "B会場" });
    const { agent } = registerHostAgent(env);
    await agent.connection.joinOperator({ sessionId: a.id, role: "host", label: "PC" });
    await mountHost(b.id);
    expect(agent.connection.state.session?.id).toBe(b.id);
  });

  it("すでに同じセッションのホストとして接続済みなら再入室しない(リロード復帰後)", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { agent, device } = registerHostAgent(env);
    await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    const joins = device.api.calls.joinOperator;
    await mountHost(meta.id);
    expect(device.api.calls.joinOperator).toBe(joins);
  });

  it("「ホストをやめる」で切断し、セッション一覧へ戻る", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { agent } = registerHostAgent(env);
    const { wrapper, router } = await mountHost(meta.id);
    await wrapper.findAll("button").find((b) => b.text() === "ホストをやめる")!.trigger("click");
    await settle();
    expect(agent.active).toBe(false);
    expect(router.currentRoute.value.fullPath).toBe("/sessions");
  });

  it("セッションが終了したら終了を表示する", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerHostAgent(env);
    const { wrapper } = await mountHost(meta.id);
    await env.repo.close(meta.id);
    await settle(10_000);
    expect(wrapper.text()).toContain("セッションは終了しました");
  });
});
