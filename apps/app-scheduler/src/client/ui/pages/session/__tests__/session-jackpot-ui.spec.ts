import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";
import { PORTAL_EVENT_NS } from "@octopus/session-hub";
import type { ClientInput } from "@octopus/session-hub";

const confirmMock = vi.fn(async (_options: unknown) => true);
vi.mock("@octopus/ui-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/ui-kit")>();
  return { ...actual, useConfirm: () => ({ ...actual.useConfirm(), confirm: confirmMock }) };
});
vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin2", name: "田中", isAdmin: true }) }),
}));

import SessionConsoleView from "../session-console-view.vue";
import { makeDevice, makeRouter, registerHostAgent, setupSessionEnv, settle } from "./session-test-kit";
import type { SessionEnv } from "./session-test-kit";

let env: SessionEnv;

beforeEach(() => {
  confirmMock.mockReset();
  confirmMock.mockResolvedValue(true);
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

const jackpotState = (over: Record<string, unknown> = {}) => ({
  page: "main-draw",
  stage: "member",
  canStop: false,
  busy: false,
  member: null,
  memberId: null,
  prize: null,
  ...over,
});

async function setupHosted() {
  const meta = await env.repo.create({ name: "抽選会場" });
  const { agent, device } = registerHostAgent(env);
  await device.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const calls: string[] = [];
  const nav: unknown[] = [];
  const payloads: unknown[] = [];
  const events: string[] = [];
  agent.router.register("jackpot", (c) => {
    calls.push(c.type);
    payloads.push(c.payload);
  });
  agent.router.register("session", (c) => void nav.push(c.payload));
  agent.router.register(PORTAL_EVENT_NS, (c) => void events.push(c.type));
  return { meta, agent, calls, nav, events, payloads };
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
async function openDraw(agent: Awaited<ReturnType<typeof setupHosted>>["agent"], over: Record<string, unknown> = {}, clientInput: ClientInput[] = []) {
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

  it("「ジャックポットを始める」1回で、イベントの開催・オープニング画面への切り替えが済む(エントリー受付は始めない)。もう一度押してもイベントを重ねない", async () => {
    const { meta, agent, nav, events } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    await wrapper.find('[data-testid="start-jackpot"]').trigger("click");
    await settle(8000);
    expect(events).toEqual(["start"]);
    expect(nav).toEqual([{ path: "/jackpot-opening" }]);

    // ホストがイベントと受付を公開した後に再度押すと、イベントも受付も触らず画面だけ切り替える
    await agent.publishSlice(PORTAL_EVENT_NS, { id: "e1", title: "ジャックポット抽選", startedAtMs: Date.now(), entry: { key: "entry-e1", open: false } });
    await settle(5000);
    await wrapper.find('[data-testid="start-jackpot"]').trigger("click");
    await settle(8000);
    expect(events).toEqual(["start"]);
    expect(nav).toEqual([{ path: "/jackpot-opening" }, { path: "/jackpot-opening" }]);
  });

  it("参加者全員(自動)では、オープニングの次は説明(エントリー画面を挟まない)。説明 → 次へ(ホストが行き先を決める)", async () => {
    const { meta, agent, nav } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);

    await agent.publishSlice("session", { path: "/jackpot-opening" });
    await settle(5000);
    expect(next(wrapper).text()).toContain("説明へ");
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(nav).toEqual([{ path: "/jackpot-description", expectedPath: "/jackpot-opening" }]);

    await agent.publishSlice("session", { path: "/jackpot-description" });
    await settle(5000);
    expect(next(wrapper).text()).toContain("次へ");
    expect(wrapper.find('[data-testid="next-hint"]').text()).toContain("デモ抽選");
  });

  it("エントリーした人のみでは、オープニング → エントリー → 説明 → 抽選 の順に、主ボタンで画面が進む", async () => {
    const { meta, agent, nav } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    await agent.publishSlice(PORTAL_EVENT_NS, { id: "e1", title: "抽選", startedAtMs: Date.now(), pool: "entrants" });

    await agent.publishSlice("session", { path: "/jackpot-opening" });
    await settle(5000);
    expect(next(wrapper).text()).toContain("エントリーへ");
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(nav).toEqual([{ path: "/jackpot-entry", expectedPath: "/jackpot-opening" }]);

    await agent.publishSlice("session", { path: "/execute/jackpot-entry" });
    await settle(5000);
    expect(next(wrapper).text()).toContain("説明へ");
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(nav[1]).toEqual({ path: "/jackpot-description", expectedPath: "/execute/jackpot-entry" });

    await agent.publishSlice("session", { path: "/jackpot-description" });
    await settle(5000);
    expect(next(wrapper).text()).toContain("次へ");
  });

  describe("説明のページ", () => {
    const descState = (index: number, total: number) => ({ page: "description", index, total });
    const openDescription = async (agent: Awaited<ReturnType<typeof setupHosted>>["agent"], index: number, total = 3) => {
      await agent.publishSlice("session", { path: "/execute/jackpot-description" });
      await agent.publishSlice("jackpot", descState(index, total));
      await settle(5000);
    };
    const back = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="back-button"]');
    const pressKey = (key: string, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

    it("最初のページでは「次のページへ」だけ。押すとホストに advance が届き、前へは出ない", async () => {
      const { meta, agent, calls, nav } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDescription(agent, 0);
      expect(next(wrapper).text()).toContain("次のページへ (2/3)");
      expect(back(wrapper).exists()).toBe(false);
      await next(wrapper).trigger("click");
      await settle(5000);
      expect(calls).toEqual(["advance"]);
      expect(nav).toEqual([]); // ページを飛ばして次の画面へは行かない
    });

    it("途中では「← 前へ」が出て、押すとホストに back が届く。Enter / Backspace でも同じ", async () => {
      const { meta, agent, calls } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDescription(agent, 1);
      expect(wrapper.find('[data-testid="now"]').text()).toContain("(2/3)");
      expect(back(wrapper).exists()).toBe(true);
      expect(wrapper.find('[data-testid="back-key"]').text()).toBe("Backspace");
      await back(wrapper).trigger("click");
      await settle(5000);
      expect(calls).toEqual(["back"]);

      pressKey("Enter");
      await settle(5000);
      pressKey("Backspace");
      await settle(5000);
      expect(calls).toEqual(["back", "advance", "back"]);
    });

    it("最後のページで主ボタンが「説明を終える」になり、押すとホストに advance が届く(行き先はホストが決める。コンソールは画面を切り替えない)", async () => {
      const { meta, agent, calls, nav } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDescription(agent, 2);
      expect(next(wrapper).text()).toContain("説明を終える");
      expect(back(wrapper).exists()).toBe(true);
      await next(wrapper).trigger("click");
      await settle(5000);
      expect(calls).toEqual(["advance"]);
      expect(nav).toEqual([]);
    });

    it("前へが無い画面(最初のページ・抽選)では Backspace を押しても何も送られない", async () => {
      const { meta, agent, calls } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDescription(agent, 0);
      pressKey("Backspace");
      await settle(5000);
      await openDraw(agent);
      pressKey("Backspace");
      await settle(5000);
      expect(calls).toEqual([]);
      wrapper.unmount();
    });

    it("入力欄にフォーカスがあるときの Backspace は前へにならない", async () => {
      const { meta, agent, calls } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDescription(agent, 1);
      const input = document.createElement("input");
      document.body.appendChild(input);
      pressKey("Backspace", input);
      await settle(5000);
      expect(calls).toEqual([]);
      input.remove();
      wrapper.unmount();
    });
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

  it("抽選画面の主ボタンは、見ていたホストの画面(expectedPath)を添えて advance を送る", async () => {
    const { meta, agent, payloads } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);
    await openDraw(agent);
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(payloads).toEqual([{ expectedPath: "/execute/jackpot-draw" }]);
  });

  it("止められる間は主ボタンが「止める」になり、押すと進行(advance)が届く。止められない間は「次へ」に戻る", async () => {
    const { meta, agent, calls } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);

    await openDraw(agent, { stage: "member", canStop: true }, [{ key: "jackpot.stopRoulette" }]);
    expect(wrapper.find('[data-testid="now"]').text()).toContain("メンバー抽選");
    expect(next(wrapper).text()).toContain("止める");
    expect(wrapper.find('[data-testid="next-hint"]').text()).toContain("メンバー");
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(calls).toEqual(["advance"]);

    await openDraw(agent, { stage: "prize-revealed", member: "太郎", prize: "特賞" });
    expect(wrapper.find('[data-testid="now"]').text()).toContain("景品抽選");
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("当選者: 太郎");
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("賞品: 特賞");
    expect(next(wrapper).text()).toContain("次へ");
  });

  it("抽選が終わった(ended)ら主ボタンが「結果へ」になり、押すと進行(advance)が届く(景品 > メンバー でも進める)", async () => {
    const { meta, agent, calls } = await setupHosted();
    const { wrapper } = await mountConsole(meta.id);

    await openDraw(agent, { stage: "ended", member: "太郎", prize: "特賞" });
    expect(wrapper.find('[data-testid="now"]').text()).toContain("抽選は終了");
    expect(wrapper.find('[data-testid="jackpot-state"]').text()).toContain("抽選終了");
    expect(next(wrapper).text()).toContain("結果へ");
    await next(wrapper).trigger("click");
    await settle(5000);
    expect(calls).toEqual(["advance"]);
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

  describe("当選者を飛ばす(不在)", () => {
    const skipButton = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="skip-winner-button"]');
    const revealed = { stage: "prize-revealed", member: "太郎", memberId: "m1", prize: "特賞" };

    it("当選者が見えるまでは出ない。メンバー発表後・結果表示中に出る", async () => {
      const { meta, agent } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDraw(agent, { stage: "member" });
      expect(skipButton(wrapper).exists()).toBe(false);
      await openDraw(agent, { stage: "member-revealed", member: "太郎", memberId: "m1" });
      expect(skipButton(wrapper).exists()).toBe(true);
      await openDraw(agent, revealed);
      expect(skipButton(wrapper).text()).toContain("この人を飛ばす(不在)");
    });

    it("押すと確認ダイアログ(「◯◯さんを以降の抽選から外し、同じ景品で引き直します。続けますか?」)が出て、了承すると、当選者のIDと画面つきで skipWinner がホストに届く", async () => {
      const { meta, agent, calls, payloads } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDraw(agent, revealed);
      await skipButton(wrapper).trigger("click");
      await settle(5000);
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(confirmMock.mock.calls[0][0]).toMatchObject({ message: "太郎さんを以降の抽選から外し、同じ景品で引き直します。続けますか?", danger: true });
      expect(calls).toEqual(["skipWinner"]);
      expect(payloads).toEqual([{ memberId: "m1", expectedPath: "/execute/jackpot-draw" }]);
    });

    it("確認でやめたら何も送らない", async () => {
      const { meta, agent, calls } = await setupHosted();
      const { wrapper, device } = await mountConsole(meta.id);
      await openDraw(agent, revealed);
      confirmMock.mockResolvedValueOnce(false);
      await skipButton(wrapper).trigger("click");
      await settle(5000);
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(calls).toEqual([]);
      expect(device.api.calls.issueCommand ?? 0).toBe(0);
    });

    it("ほかに候補がいない(spare が 0)ときは押せず、理由が出る。ホストが演出中(busy)でも押せない", async () => {
      const { meta, agent, calls } = await setupHosted();
      const { wrapper } = await mountConsole(meta.id);
      await openDraw(agent, { ...revealed, spare: 0 });
      expect(skipButton(wrapper).attributes("disabled")).toBeDefined();
      expect(wrapper.find('[data-testid="skip-winner-reason"]').text()).toContain("ほかに抽選できる人がいない");
      await skipButton(wrapper).trigger("click");
      await settle(5000);
      expect(confirmMock).not.toHaveBeenCalled();

      await openDraw(agent, { ...revealed, spare: 2, busy: true });
      expect(skipButton(wrapper).attributes("disabled")).toBeDefined();
      await openDraw(agent, { ...revealed, spare: 2 });
      expect(skipButton(wrapper).attributes("disabled")).toBeUndefined();
      expect(wrapper.find('[data-testid="skip-winner-reason"]').exists()).toBe(false);
      expect(calls).toEqual([]);
    });
  });

});
