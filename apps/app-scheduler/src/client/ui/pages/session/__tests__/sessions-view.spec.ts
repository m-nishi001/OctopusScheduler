import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";

const confirmMock = vi.fn(async () => true);
vi.mock("@octopus/ui-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/ui-kit")>();
  return { ...actual, useConfirm: () => ({ ...actual.useConfirm(), confirm: confirmMock }) };
});

import SessionsView from "../sessions-view.vue";
import { makeRouter, setupSessionEnv, settle } from "./session-test-kit";
import type { SessionEnv } from "./session-test-kit";
import { toasts } from "../../../../../../../../packages/ui-kit/src/composables/use-feedback";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  confirmMock.mockClear();
  confirmMock.mockResolvedValue(true);
  toasts.value = [];
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

async function mountView() {
  const router = makeRouter("/sessions");
  await router.isReady();
  const wrapper = mount(SessionsView, { global: { plugins: [router] } });
  await settle();
  return { wrapper, router };
}

describe("sessions-view", () => {
  it("セッションが無いときは空表示で、作成ボタンは名前が空の間は押せない", async () => {
    const { wrapper } = await mountView();
    expect(wrapper.text()).toContain("進行中のセッションはありません");
    const submit = wrapper.find('form button[type="submit"]');
    expect(submit.attributes("disabled")).toBeDefined();
    await wrapper.find('input[type="text"]').setValue("   ");
    expect(wrapper.find('form button[type="submit"]').attributes("disabled")).toBeDefined();
  });

  it("名前を入れて作成すると一覧に出て、参加コードが表示され、入力欄が空に戻る", async () => {
    const { wrapper } = await mountView();
    const input = wrapper.find('input[type="text"]');
    await input.setValue("夏祭り");
    await wrapper.find("form").trigger("submit");
    await settle();
    expect(wrapper.text()).toContain("夏祭り");
    const code = (await env.repo.list())[0].code;
    expect(wrapper.find(".sessions__code").text()).toBe(code);
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).toContain("待機中");
  });

  it("デモとして作ると状態に(デモ)が付く", async () => {
    const { wrapper } = await mountView();
    await wrapper.find('input[type="text"]').setValue("リハ");
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.find("form").trigger("submit");
    await settle();
    expect(wrapper.text()).toContain("待機中(デモ)");
  });

  it("作成の連打でも二重に作られない", async () => {
    const { wrapper } = await mountView();
    await wrapper.find('input[type="text"]').setValue("連打");
    const form = wrapper.find("form");
    await form.trigger("submit");
    await form.trigger("submit");
    await form.trigger("submit");
    await settle();
    expect(await env.repo.list()).toHaveLength(1);
  });

  it("作成に失敗するとエラーを知らせ、一覧は変わらない", async () => {
    const failing = setupSessionEnv({ faults: { decide: (e) => (e === "createSession" ? "dropRequest" : "ok") } });
    void failing;
    const { wrapper } = await mountView();
    await wrapper.find('input[type="text"]').setValue("失敗");
    await wrapper.find("form").trigger("submit");
    await settle();
    expect(toasts.value.some((t) => t.kind === "error" && t.message.includes("作成に失敗しました"))).toBe(true);
    expect(wrapper.text()).toContain("進行中のセッションはありません");
  });

  it("一覧の取得に失敗するとエラーを表示し、回復すれば消える", async () => {
    let down = true;
    setupSessionEnv({ faults: { decide: (e) => (down && e === "listSessions" ? "dropRequest" : "ok") } });
    const { wrapper } = await mountView();
    expect(wrapper.find(".sessions__error").exists()).toBe(true);
    down = false;
    await wrapper.findAll("button").find((b) => b.text().includes("更新"))!.trigger("click");
    await settle();
    expect(wrapper.find(".sessions__error").exists()).toBe(false);
  });

  it("20秒ごとに自動更新し、非表示の間は更新しない", async () => {
    const { wrapper } = await mountView();
    const before = env.adminApi.calls.listSessions;
    await settle(20_000);
    expect(env.adminApi.calls.listSessions).toBe(before + 1);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await settle(60_000);
    expect(env.adminApi.calls.listSessions).toBe(before + 1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    wrapper.unmount();
    await settle(60_000);
    expect(env.adminApi.calls.listSessions).toBe(before + 1);
  });

  it("「ホストとして開く」「操作する」で対応する画面へ遷移する", async () => {
    const meta = await env.repo.create({ name: "遷移" });
    const { wrapper, router } = await mountView();
    const buttons = wrapper.findAll("button");
    await buttons.find((b) => b.text() === "ホストとして開く")!.trigger("click");
    await settle();
    expect(router.currentRoute.value.fullPath).toBe(`/session/host/${meta.id}`);
    await router.push("/sessions");
    await wrapper.findAll("button").find((b) => b.text() === "操作する")!.trigger("click");
    await settle();
    expect(router.currentRoute.value.fullPath).toBe(`/session/console/${meta.id}`);
  });

  it("終了は確認ダイアログを経て実行され、キャンセルなら何もしない", async () => {
    const meta = await env.repo.create({ name: "終了対象" });
    const { wrapper } = await mountView();
    confirmMock.mockResolvedValueOnce(false);
    await wrapper.findAll("button").find((b) => b.text() === "終了")!.trigger("click");
    await settle();
    expect((await env.repo.list())[0].status).not.toBe("closed");

    await wrapper.findAll("button").find((b) => b.text() === "終了")!.trigger("click");
    await settle();
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect((await env.repo.list()).find((s) => s.id === meta.id)?.status).toBe("closed");
    expect(wrapper.text()).toContain("終了");
  });

  it("終了済みは一覧の末尾に寄り、各操作ボタンが無効になる", async () => {
    const a = await env.repo.create({ name: "先に作った" });
    await env.repo.create({ name: "後に作った" });
    await env.repo.close(a.id);
    const { wrapper } = await mountView();
    const rows = wrapper.findAll("tbody tr");
    expect(rows[0].text()).toContain("後に作った");
    expect(rows[1].text()).toContain("先に作った");
    for (const b of rows[1].findAll("button")) expect(b.attributes("disabled")).toBeDefined();
  });
});
