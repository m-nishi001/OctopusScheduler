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
import { PORTAL_EVENT_NS } from "@octopus/session-hub";
import { GetAllQuizzesUseCase, QuizSyncService } from "@octopus/game-quiz";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  localStorage.clear();
  env = setupSessionEnv();
});
afterEach(() => vi.useRealTimers());

const OPTIONS = [
  { no: 1, text: "りんご", color: "#ef4444" },
  { no: 2, text: "みかん", color: "#f59e0b" },
  { no: 3, text: "ぶどう", color: "#8b5cf6" },
];

function quizState(over: Record<string, unknown> = {}) {
  return {
    page: "play",
    quizId: "q1",
    title: "第1問",
    roundKey: "q1:live",
    deadlineMs: null,
    phase: "idle",
    question: "いちばん好きな果物は?",
    options: OPTIONS,
    correctNo: null,
    ...over,
  };
}

async function setupHosted() {
  const meta = await env.repo.create({ name: "クイズ会場" });
  const { agent, device } = registerHostAgent(env);
  await device.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const received: string[] = [];
  const payloads: unknown[] = [];
  agent.router.register("quiz", (c) => {
    received.push(c.type);
    payloads.push(c.payload);
  });
  const nav: unknown[] = [];
  agent.router.register("session", (c) => void nav.push(c.payload));
  return { meta, agent, device, received, nav, payloads };
}

function registerQuizList(list: Array<{ id: string; title: string; question: string }>, sync = vi.fn(async () => ({ results: [] }))) {
  let current = list;
  const execute = vi.fn(async () => current);
  container.register(GetAllQuizzesUseCase, { useValue: { execute } as unknown as GetAllQuizzesUseCase });
  container.register(QuizSyncService, { useValue: { syncAll: sync } as unknown as QuizSyncService });
  return { execute, sync, set: (l: typeof list) => (current = l) };
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

describe("管理コンソールのクイズ操作", () => {
  it("クイズの一覧を選べ、各画面への切り替えがホストに届く(デモは ?demo=1 付き)", async () => {
    const { meta, nav } = await setupHosted();
    registerQuizList([{ id: "q1", title: "果物クイズ", question: "?" }, { id: "q2", title: "動物クイズ", question: "?" }]);
    const { wrapper } = await mountConsole(meta.id);
    const select = wrapper.find('[data-testid="quiz-select"]');
    expect(select.findAll("option").map((o) => o.text())).toEqual(["果物クイズ", "動物クイズ"]);

    await btn(wrapper, "出題").trigger("click");
    await settle(5000);
    expect(nav).toEqual([{ path: "/quiz/q1/play" }]);

    await select.setValue("q2");
    await btn(wrapper, "正解").trigger("click");
    await settle(5000);
    expect(nav.at(-1)).toEqual({ path: "/quiz/q2/answer" });
  });

  it("デモのセッションでは遷移先に ?demo=1 が付く", async () => {
    const meta = await env.repo.create({ name: "リハ", mode: "demo" });
    const { agent, device } = registerHostAgent(env);
    await device.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    const nav: unknown[] = [];
    agent.router.register("session", (c) => void nav.push(c.payload));
    registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
    const { wrapper } = await mountConsole(meta.id);
    await btn(wrapper, "出題").trigger("click");
    await settle(5000);
    expect(nav).toEqual([{ path: "/quiz/q1/play?demo=1" }]);
  });

  it("この端末にクイズが無ければ Drive から取り込んで読み直す。取り込めなければ「クイズがありません」", async () => {
    const { meta } = await setupHosted();
    const list = registerQuizList([]);
    list.sync.mockImplementation(async () => {
      list.set([{ id: "q9", title: "取り込んだクイズ", question: "?" }]);
      return { results: [] };
    });
    const { wrapper } = await mountConsole(meta.id);
    expect(list.sync).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="quiz-select"]').text()).toContain("取り込んだクイズ");

    container.clearInstances();
    env = setupSessionEnv();
    const meta2 = await env.repo.create({ name: "空" });
    registerQuizList([]);
    const { wrapper: empty } = await mountConsole(meta2.id);
    expect(empty.find('[data-testid="quiz-select"]').text()).toContain("クイズがありません");
    expect(btn(empty, "出題").attributes("disabled")).toBeDefined();
  });

  it("クイズを始める1回で、クイズ名のイベント開催とイントロ画面への切り替えが済む(デモは ?demo=1 付き)", async () => {
    const { meta, agent, nav } = await setupHosted();
    registerQuizList([{ id: "q1", title: "果物クイズ", question: "?" }]);
    const hostEvents: Array<{ type: string; payload: unknown }> = [];
    agent.router.register(PORTAL_EVENT_NS, (c) => void hostEvents.push({ type: c.type, payload: c.payload }));
    const { wrapper } = await mountConsole(meta.id);
    await wrapper.find('[data-testid="start-quiz"]').trigger("click");
    await settle(8000);
    expect(hostEvents).toEqual([{ type: "start", payload: { title: "果物クイズ", pool: "entrants" } }]);
    expect(nav).toEqual([{ path: "/quiz/q1/intro" }]);
  });

  it("クイズの画面ごとに、主ボタンの文言と予告が変わる。回答受付中は「受付を締め切る」", async () => {
    const { meta, agent, received, nav, payloads } = await setupHosted();
    registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
    const { wrapper } = await mountConsole(meta.id);
    const next = () => wrapper.find('[data-testid="next-button"]');
    const hint = () => wrapper.find('[data-testid="next-hint"]').text();
    expect(next().exists()).toBe(false); // ロビーでは主ボタンは無い

    await agent.publishSlice("session", { path: "/execute/quiz/q1/entry" });
    await agent.publishSlice("quiz", quizState({ page: "entry" }));
    await settle(5000);
    expect(wrapper.find('[data-testid="now"]').text()).toContain("エントリー受付中");
    expect(hint()).toContain("回答受付を始めます");
    await next().trigger("click");
    await settle(5000);
    expect(received).toEqual(["advance"]);
    expect(payloads).toEqual([null]); // クイズの主ボタンは expectedPath を添えない(古い画面の確認はジャックポットだけ)

    await agent.publishSlice("session", { path: "/execute/quiz/q1/play" });
    await agent.publishSlice("quiz", quizState({ phase: "answering", deadlineMs: Date.now() + 20_000 }));
    await settle(5000);
    expect(wrapper.find('[data-testid="now"]').text()).toContain("回答受付中");
    expect(wrapper.find('[data-testid="quiz-state"]').text()).toContain("出題中");
    expect(next().text()).toContain("受付を締め切る");
    await next().trigger("click");
    await settle(5000);
    expect(received).toEqual(["advance", "closeAnswers"]);

    await agent.publishSlice("quiz", quizState({ phase: "closed" }));
    await settle(5000);
    expect(next().text()).toContain("次へ");
    expect(hint()).toContain("正解を発表");
    expect(nav).toEqual([]); // 主ボタンは画面を直接切り替えない(クイズの進行はホストの「次へ」)
  });

  describe("Enterキー", () => {
    const pressEnter = (init: KeyboardEventInit = {}, target: EventTarget = document.body) =>
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...init }));

    async function atQr() {
      const { meta, agent, received } = await setupHosted();
      registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
      const mounted = await mountConsole(meta.id);
      await agent.publishSlice("session", { path: "/execute/quiz/q1/entry" });
      await agent.publishSlice("quiz", quizState({ page: "entry" }));
      await settle(5000);
      return { ...mounted, agent, received };
    }

    it("Enter で主ボタン(次へ)と同じ操作が1回だけ送られ、ボタンに Enter の表示が出る", async () => {
      const { wrapper, received } = await atQr();
      expect(wrapper.find('[data-testid="next-key"]').text()).toBe("Enter");
      pressEnter();
      await settle(5000);
      expect(received).toEqual(["advance"]);
      wrapper.unmount();
    });

    it("送信中の連打は1回にまとまり、押しっぱなしや修飾キー付きは送らない", async () => {
      const { wrapper, received } = await atQr();
      pressEnter({ repeat: true });
      pressEnter({ ctrlKey: true });
      pressEnter({ shiftKey: true });
      await settle(5000);
      expect(received).toEqual([]);
      pressEnter();
      pressEnter();
      await settle(5000);
      expect(received).toEqual(["advance"]);
      wrapper.unmount();
    });

    it("回答受付中の「受付を締め切る」は Enter では動かず(表示も出さず)、クリックでは動く", async () => {
      const { wrapper, agent, received } = await atQr();
      await agent.publishSlice("session", { path: "/execute/quiz/q1/play" });
      await agent.publishSlice("quiz", quizState({ phase: "answering", deadlineMs: Date.now() + 20_000 }));
      await settle(5000);
      expect(wrapper.find('[data-testid="next-button"]').text()).toContain("受付を締め切る");
      expect(wrapper.find('[data-testid="next-key"]').exists()).toBe(false);
      pressEnter();
      await settle(5000);
      expect(received).toEqual([]);
      await wrapper.find('[data-testid="next-button"]').trigger("click");
      await settle(5000);
      expect(received).toEqual(["closeAnswers"]);
      wrapper.unmount();
    });

    it("入力欄やボタンにフォーカスがあるときの Enter は送らない", async () => {
      const { wrapper, received } = await atQr();
      const input = document.createElement("input");
      document.body.appendChild(input);
      pressEnter({}, input);
      await settle(5000);
      expect(received).toEqual([]);
      input.remove();
      wrapper.unmount();
    });

    it("主ボタンが無い画面(ロビー)では何も送らない", async () => {
      const { meta, received } = await setupHosted();
      registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
      const { wrapper } = await mountConsole(meta.id);
      expect(wrapper.find('[data-testid="next-button"]').exists()).toBe(false);
      pressEnter();
      await settle(5000);
      expect(received).toEqual([]);
      wrapper.unmount();
    });

    it("画面を閉じたあとの Enter は送られない", async () => {
      const { wrapper, received } = await atQr();
      wrapper.unmount();
      pressEnter();
      await settle(5000);
      expect(received).toEqual([]);
    });
  });

  it("受付中は回答数が表示される(参加者の回答が集まる様子)", async () => {
    const { meta, agent, device } = await setupHosted();
    registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
    const { wrapper } = await mountConsole(meta.id);
    await device.conn.openRound("q1:live", OPTIONS, 30_000);
    await agent.publishSlice("quiz", quizState({ phase: "answering", deadlineMs: Date.now() + 30_000 }));
    await env.repo.setPortalSession(meta.id, true);
    const players = [];
    for (let i = 0; i < 3; i++) {
      const p = makeDevice(env.hub, { memberId: `p${i}`, memberName: `p${i}` });
      await p.conn.joinPortal();
      players.push(p);
    }
    for (const p of players) await p.conn.answer("q1:live", 1);
    await settle(8000);
    expect(wrapper.find('[data-testid="quiz-state"]').text()).toContain("回答 3 人");
  });

  it("クイズの画面が開かれていない間は、「いま」は待機中で、進行状況は空", async () => {
    const { meta } = await setupHosted();
    registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
    const { wrapper } = await mountConsole(meta.id);
    expect(wrapper.find('[data-testid="now"]').text()).toContain("待機中");
    expect(wrapper.find('[data-testid="quiz-state"]').text()).toBe("");
  });
});
