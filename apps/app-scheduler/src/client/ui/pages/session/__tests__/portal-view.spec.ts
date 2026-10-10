import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";

import PortalView from "../portal-view.vue";
import { makeDevice, makeRouter, registerHostAgent, setupSessionEnv, settle } from "./session-test-kit";
import type { SessionEnv } from "./session-test-kit";
import type { FaultInjector } from "@octopus/session-hub/testing";
import type { MemoryDeviceStore } from "@octopus/session-hub";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  localStorage.clear();
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

async function mountPortal(path: string, options: { store?: MemoryDeviceStore; faults?: FaultInjector } = {}) {
  const device = makeDevice(env.hub, { store: options.store, faults: options.faults });
  const router = makeRouter(path);
  await router.isReady();
  const wrapper = mount(PortalView, { props: { connection: device.conn }, global: { plugins: [router] } });
  await settle();
  return { wrapper, router, device };
}

const btn = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll("button").find((b) => b.text().includes(text))!;

async function hostWith(sessionId: string, clientInput: string[] = [], data: Record<string, unknown> = {}) {
  const { agent, device } = registerHostAgent(env);
  await device.conn.joinOperator({ sessionId, role: "host", label: "PC" });
  await agent.publishSlice("session", { path: "/session/host/x" , ...data }, clientInput);
  return { agent, device };
}

describe("portal-view: 入室", () => {
  it("コード欄が6文字未満の間は参加ボタンが押せない。小文字・記号は正規化される", async () => {
    const { wrapper } = await mountPortal("/portal");
    const input = wrapper.find("#portal-code");
    expect(btn(wrapper, "参加する").attributes("disabled")).toBeDefined();
    await input.setValue("abc");
    expect(btn(wrapper, "参加する").attributes("disabled")).toBeDefined();
    await input.setValue("abc-234");
    expect(btn(wrapper, "参加する").attributes("disabled")).toBeUndefined();
  });

  it("コードを入力して参加すると、セッション名と参加人数が表示される", async () => {
    const meta = await env.repo.create({ name: "夏祭り" });
    const { wrapper, router, device } = await mountPortal("/portal");
    await wrapper.find("#portal-code").setValue(meta.code.toLowerCase());
    await wrapper.find("#portal-name").setValue("太郎");
    await wrapper.find("form").trigger("submit");
    await settle(4000);
    expect(device.conn.state.phase).toBe("connected");
    expect(wrapper.find(".portal__session").text()).toBe("夏祭り");
    expect(wrapper.text()).toContain("参加者 1 人");
    expect(router.currentRoute.value.fullPath).toBe(`/portal/${meta.code}`);
    const joined = await env.hub.deps.repoFor(meta.id).getDevice(device.conn.state.deviceId!);
    expect(joined?.label).toBe("太郎");
    expect(localStorage.getItem("octopus.portal.name")).toBe("太郎");
  });

  it("URLにコードがあれば自動で参加する(QRから開いた場合)", async () => {
    const meta = await env.repo.create({ name: "QR参加" });
    const { wrapper, device } = await mountPortal(`/portal/${meta.code}`);
    expect(device.conn.state.phase).toBe("connected");
    expect(wrapper.find(".portal__session").text()).toBe("QR参加");
  });

  it("存在しないコードはエラーを表示し、入力欄に留まる", async () => {
    const { wrapper } = await mountPortal("/portal/ZZZZZZ");
    expect(wrapper.find(".portal__error").text()).toContain("参加コードが見つかりません");
    expect(wrapper.find("#portal-code").exists()).toBe(true);
  });

  it("通信失敗は電波に関する案内を出し、再度の参加で成功できる", async () => {
    const meta = await env.repo.create({ name: "x" });
    let down = true;
    const { wrapper, device } = await mountPortal(`/portal/${meta.code}`, {
      faults: { decide: (e) => (down && e === "joinClient" ? "dropRequest" : "ok") },
    });
    expect(wrapper.find(".portal__error").text()).toContain("通信できませんでした");
    down = false;
    await wrapper.find("form").trigger("submit");
    await settle(4000);
    expect(device.conn.state.phase).toBe("connected");
  });

  it("参加ボタンの連打でも端末は1つだけ", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper, device } = await mountPortal("/portal");
    await wrapper.find("#portal-code").setValue(meta.code);
    const form = wrapper.find("form");
    await form.trigger("submit");
    await form.trigger("submit");
    await settle(100);
    expect(device.api.calls.joinClient).toBe(1);
  });

  it("終了済みセッションのコードは参加できない", async () => {
    const meta = await env.repo.create({ name: "x" });
    await env.repo.close(meta.id);
    const { wrapper } = await mountPortal(`/portal/${meta.code}`);
    expect(wrapper.find(".portal__error").exists()).toBe(true);
  });
});

describe("portal-view: リロード復帰", () => {
  it("誤リロード(再マウント)しても同じ端末として自動で復帰する", async () => {
    const meta = await env.repo.create({ name: "復帰" });
    const first = await mountPortal(`/portal/${meta.code}`);
    const deviceId = first.device.conn.state.deviceId;
    first.wrapper.unmount();
    const second = await mountPortal(`/portal/${meta.code}`, { store: first.device.store });
    await settle(4000);
    expect(second.device.conn.state.deviceId).toBe(deviceId);
    expect(second.device.conn.state.phase).toBe("connected");
    expect(second.wrapper.find(".portal__session").text()).toBe("復帰");
    expect(second.device.api.calls.joinClient ?? 0).toBe(0);
  });

  it("コード無しのURL(/portal)でリロードしても保存情報から復帰する", async () => {
    const meta = await env.repo.create({ name: "復帰2" });
    const first = await mountPortal(`/portal/${meta.code}`);
    first.wrapper.unmount();
    const second = await mountPortal("/portal", { store: first.device.store });
    await settle(4000);
    expect(second.wrapper.find(".portal__session").text()).toBe("復帰2");
  });

  it("別のコードのURLを開いたら、復帰せずそのコードで入り直す", async () => {
    const a = await env.repo.create({ name: "A" });
    const b = await env.repo.create({ name: "B" });
    const first = await mountPortal(`/portal/${a.code}`);
    first.wrapper.unmount();
    const second = await mountPortal(`/portal/${b.code}`, { store: first.device.store });
    await settle(4000);
    expect(second.wrapper.find(".portal__session").text()).toBe("B");
  });

  it("保存したトークンが無効になっていたら「再参加する」で同じコードから入り直せる", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper, device } = await mountPortal(`/portal/${meta.code}`);
    const dev = await env.hub.deps.repoFor(meta.id).getDevice(device.conn.state.deviceId!);
    await env.hub.deps.repoFor(meta.id).putDevice({ ...dev!, token: "rotated" });
    await settle(20_000);
    expect(wrapper.text()).toContain("接続が切れました");
    const oldId = device.conn.state.deviceId;
    await btn(wrapper, "再参加する").trigger("click");
    await settle(4000);
    expect(device.conn.state.phase).toBe("connected");
    expect(device.conn.state.deviceId).not.toBe(oldId);
  });
});

describe("portal-view: セッション中", () => {
  it("ホストが受付を開始すると操作ボタンが現れ、押すとホストにコマンドが届く", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { agent } = await hostWith(meta.id);
    const received: string[] = [];
    agent.router.register("jackpot", (c) => void received.push(c.type));
    const { wrapper } = await mountPortal(`/portal/${meta.code}`);
    expect(wrapper.text()).toContain("受付が始まるまでお待ちください");

    await agent.publishSlice("jackpot", { phase: "draw" }, ["jackpot.stopRoulette"]);
    await settle(8000);
    const stop = btn(wrapper, "ルーレットを止める");
    expect(stop.exists()).toBe(true);
    await stop.trigger("click");
    await settle(5000);
    expect(received).toEqual(["stopRoulette"]);
    expect(wrapper.find(".portal__action").text()).toBe("送信しました");
  });

  it("受付が終わった直後に押した場合は「受付が終了しました」と案内する", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { agent } = await hostWith(meta.id, ["jackpot.stopRoulette"]);
    const { wrapper } = await mountPortal(`/portal/${meta.code}`);
    await settle(8000);
    const stop = btn(wrapper, "ルーレットを止める");
    expect(stop.exists()).toBe(true);
    // ホストが受付を閉じたが、参加者の画面にはまだボタンが残っている状態
    await agent.clearSlice("session");
    await agent.publishSlice("session", {}, []);
    await agent.publishSlice("jackpot", {}, []);
    await stop.trigger("click");
    await settle(100);
    expect(wrapper.find(".portal__action").text()).toBe("受付が終了しました");
  });

  it("ボタンの連打でも1回しか送られない", async () => {
    const meta = await env.repo.create({ name: "x" });
    await hostWith(meta.id, ["quiz.answer"]);
    const { wrapper, device } = await mountPortal(`/portal/${meta.code}`);
    await settle(8000);
    const answer = btn(wrapper, "回答する");
    await answer.trigger("click");
    await answer.trigger("click");
    await answer.trigger("click");
    await settle(100);
    expect(device.api.calls.issueCommand).toBe(1);
  });

  it("未知の操作キーはそのまま表示する", async () => {
    const meta = await env.repo.create({ name: "x" });
    await hostWith(meta.id, ["newgame.vote"]);
    const { wrapper } = await mountPortal(`/portal/${meta.code}`);
    await settle(8000);
    expect(btn(wrapper, "newgame.vote").exists()).toBe(true);
  });

  it("ホストの現在の画面を表示する", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { agent } = await hostWith(meta.id);
    const { wrapper } = await mountPortal(`/portal/${meta.code}`);
    await agent.publishSlice("session", { path: "/execute/jackpot-main-draw" });
    await settle(8000);
    expect(wrapper.find(".portal__screen").text()).toBe("ジャックポット");
  });

  it("ホストが不在の間はその旨を表示する", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper } = await mountPortal(`/portal/${meta.code}`);
    await settle(4000);
    expect(wrapper.find(".portal__presence").text()).toContain("ホストの接続を待っています");
  });

  it("セッションが終了したら終了を知らせ、別のコードで参加し直せる", async () => {
    const meta = await env.repo.create({ name: "x" });
    const { wrapper, router } = await mountPortal(`/portal/${meta.code}`);
    await env.repo.close(meta.id);
    await settle(20_000);
    expect(wrapper.text()).toContain("このセッションは終了しました");
    await btn(wrapper, "別のコードで参加する").trigger("click");
    await settle();
    expect(router.currentRoute.value.fullPath).toBe("/portal");
    expect(wrapper.find("#portal-code").exists()).toBe(true);
  });

  it("「退出する」で保存情報が消え、コード入力に戻る(次回は自動復帰しない)", async () => {
    const meta = await env.repo.create({ name: "x" });
    const first = await mountPortal(`/portal/${meta.code}`);
    await btn(first.wrapper, "退出する").trigger("click");
    await settle();
    expect(first.wrapper.find("#portal-code").exists()).toBe(true);
    first.wrapper.unmount();
    const second = await mountPortal("/portal", { store: first.device.store });
    expect(second.wrapper.find("#portal-code").exists()).toBe(true);
  });

  it("通信が途切れたら再接続中と表示し、戻れば消える", async () => {
    const meta = await env.repo.create({ name: "x" });
    let down = false;
    const { wrapper } = await mountPortal(`/portal/${meta.code}`, { faults: { decide: (e) => (down && e === "poll" ? "dropRequest" : "ok") } });
    await settle(4000);
    down = true;
    await settle(60_000);
    expect(wrapper.find(".connection-banner").text()).toContain("再接続中");
    down = false;
    await settle(40_000);
    expect(wrapper.find(".connection-banner").text()).toContain("接続中");
  });
});
