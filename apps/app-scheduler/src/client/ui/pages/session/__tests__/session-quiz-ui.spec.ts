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
  agent.router.register("quiz", (c) => void received.push(c.type));
  const nav: unknown[] = [];
  agent.router.register("session", (c) => void nav.push(c.payload));
  return { meta, agent, device, received, nav };
}

function registerQuizList(list: Array<{ id: string; title: string; question: string }>, sync = vi.fn(async () => ({ failed: [] }))) {
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
      return { failed: [] };
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

  it("「次へ」と「受付を締め切る」がホストに届く。締め切りは受付中だけ押せる", async () => {
    const { meta, agent, received } = await setupHosted();
    registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
    const { wrapper } = await mountConsole(meta.id);
    expect(btn(wrapper, "受付を今すぐ締め切る").attributes("disabled")).toBeDefined();

    const quizNext = wrapper.find('[data-testid="quiz-panel"]').findAll("button").find((b) => b.text().includes("次へ"))!;
    await quizNext.trigger("click");
    await settle(5000);
    expect(received).toEqual(["advance"]);

    await agent.publishSlice("quiz", quizState({ phase: "answering", deadlineMs: Date.now() + 20_000 }));
    await settle(5000);
    expect(wrapper.find('[data-testid="quiz-state"]').text()).toContain("出題中");
    expect(wrapper.find('[data-testid="quiz-state"]').text()).toContain("回答受付中");
    const close = btn(wrapper, "受付を今すぐ締め切る");
    expect(close.attributes("disabled")).toBeUndefined();
    await close.trigger("click");
    await settle(5000);
    expect(received).toEqual(["advance", "closeAnswers"]);
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

  it("クイズの画面が開かれていない間は案内を表示する", async () => {
    const { meta } = await setupHosted();
    registerQuizList([{ id: "q1", title: "果物", question: "?" }]);
    const { wrapper } = await mountConsole(meta.id);
    expect(wrapper.find('[data-testid="quiz-state"]').text()).toContain("クイズの画面を開くと");
  });
});
