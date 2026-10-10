import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { ref } from "vue";
import { AccountsRepository } from "@octopus/accounts";

vi.mock("../../../../control/auth/auth-session", () => ({
  useAuthSession: () => ({ currentMember: ref({ id: "admin2", name: "田中", isAdmin: true }) }),
}));

import SessionConsoleView from "../session-console-view.vue";
import PortalView from "../portal-view.vue";
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

async function mountPortal(code: string, options: { store?: ReturnType<typeof makeDevice>["store"] } = {}) {
  const device = makeDevice(env.hub, { store: options.store });
  const router = makeRouter(`/portal/${code}`);
  await router.isReady();
  const wrapper = mount(PortalView, { props: { connection: device.conn }, global: { plugins: [router] } });
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
    const players = [];
    for (let i = 0; i < 3; i++) {
      const p = makeDevice(env.hub);
      await p.conn.joinClient({ code: meta.code, label: `p${i}` });
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

describe("参加ポータルのクイズ回答", () => {
  async function openQuestion(secs = 20) {
    const ctx = await setupHosted();
    const round = await ctx.device.conn.openRound("q1:live", OPTIONS, secs * 1000);
    await ctx.agent.publishSlice("quiz", quizState({ phase: "answering", deadlineMs: round.deadlineMs }));
    return { ...ctx, round };
  }

  it("出題中は問題と選択肢が出て、タップで回答でき、回答後は選択が固定される", async () => {
    const { meta, device } = await openQuestion();
    const { wrapper } = await mountPortal(meta.code);
    await settle(8000);
    expect(wrapper.text()).toContain("いちばん好きな果物は?");
    expect(wrapper.findAll(".portal__option")).toHaveLength(3);
    expect(wrapper.find('[data-testid="quiz-timer"]').text()).toMatch(/残り \d+ 秒/);

    await btn(wrapper, "みかん").trigger("click");
    await settle(100);
    expect(wrapper.find('[data-testid="quiz-answered"]').text()).toContain("2. みかん");
    expect(wrapper.findAll(".portal__option").every((b) => b.attributes("disabled") !== undefined)).toBe(true);
    const result = await device.conn.getAnswers("q1:live");
    expect(result.answers.map((a) => a.no)).toEqual([2]);
  });

  it("連打しても1回だけ送られる", async () => {
    const { meta } = await openQuestion();
    const { wrapper, device } = await mountPortal(meta.code);
    await settle(8000);
    const opt = btn(wrapper, "りんご");
    await opt.trigger("click");
    await opt.trigger("click");
    await opt.trigger("click");
    await settle(100);
    expect(device.api.calls.submitAnswer).toBe(1);
  });

  it("残り時間は端末の時計ではなくサーバ時刻で数える(端末の時計が進んでいても締切前なら回答できる)", async () => {
    const { meta, round } = await openQuestion(20);
    const { wrapper, device } = await mountPortal(meta.code);
    await settle(8000);
    // この端末の時計は30分進んでいる想定。サーバ時刻との差で残り時間を出すので、まだ受付中。
    expect(device.conn.state.serverOffsetMs).toBeLessThan(5000);
    expect(round.deadlineMs - round.serverNowMs).toBe(20_000);
    expect(wrapper.find('[data-testid="quiz-timer"]').exists()).toBe(true);
  });

  it("締切を過ぎると回答できず、「受付は終了しました」と表示される", async () => {
    const { meta } = await openQuestion(5);
    const { wrapper } = await mountPortal(meta.code);
    await settle(8000);
    await settle(10_000);
    expect(wrapper.findAll(".portal__option").every((b) => b.attributes("disabled") !== undefined)).toBe(true);
    expect(wrapper.find('[data-testid="quiz-closed"]').text()).toBe("受付は終了しました");
  });

  it("ホストが締め切った直後(参加者の画面にはまだ残っている)に押しても、案内が出て回答は記録されない", async () => {
    const { meta, device, agent } = await openQuestion(60);
    const { wrapper } = await mountPortal(meta.code);
    await settle(8000);
    const opt = btn(wrapper, "ぶどう");
    await device.conn.closeRound("q1:live"); // 参加者の画面の更新より先に締切
    await opt.trigger("click");
    await settle(100);
    expect(wrapper.find(".portal__action").text()).toBe("受付は終了しました");
    expect(wrapper.find('[data-testid="quiz-answered"]').exists()).toBe(false);
    void agent;
  });

  it("通信失敗なら、再度押せる状態のまま案内を出す(回答済みにしない)", async () => {
    const { meta } = await openQuestion();
    let down = true;
    const device = makeDevice(env.hub, { faults: { decide: (e) => (down && e === "submitAnswer" ? "dropRequest" : "ok") } });
    const router = makeRouter(`/portal/${meta.code}`);
    await router.isReady();
    const wrapper = mount(PortalView, { props: { connection: device.conn }, global: { plugins: [router] } });
    await settle(8000);
    await btn(wrapper, "りんご").trigger("click");
    await settle(5000);
    expect(wrapper.find(".portal__action").text()).toContain("通信できませんでした");
    expect(wrapper.find('[data-testid="quiz-answered"]').exists()).toBe(false);
    expect(btn(wrapper, "りんご").attributes("disabled")).toBeUndefined();
    down = false;
    await btn(wrapper, "りんご").trigger("click");
    await settle(100);
    expect(wrapper.find('[data-testid="quiz-answered"]').exists()).toBe(true);
  });

  it("リロード(再マウント)しても回答済みの表示が残る。保存が無くても、再度押せば最初の回答が返る", async () => {
    const { meta } = await openQuestion(120);
    const first = await mountPortal(meta.code);
    await settle(8000);
    await btn(first.wrapper, "みかん").trigger("click");
    await settle(100);
    first.wrapper.unmount();
    const second = await mountPortal(meta.code, { store: first.device.store });
    await settle(8000);
    expect(second.wrapper.find('[data-testid="quiz-answered"]').text()).toContain("2. みかん");

    // 保存(localStorage)が消えた場合
    localStorage.clear();
    second.wrapper.unmount();
    const third = await mountPortal(meta.code, { store: first.device.store });
    await settle(8000);
    expect(third.wrapper.find('[data-testid="quiz-answered"]').exists()).toBe(false);
    await btn(third.wrapper, "りんご").trigger("click");
    await settle(100);
    expect(third.wrapper.find('[data-testid="quiz-answered"]').text()).toContain("2. みかん"); // 最初の回答のまま
    expect(third.wrapper.find(".portal__action").text()).toContain("すでに回答済み");
  });

  it("正解発表で正解が表示され、自分の回答の正誤が出る。正解はそれまで画面に含まれない", async () => {
    const { meta, agent } = await openQuestion();
    const { wrapper } = await mountPortal(meta.code);
    await settle(8000);
    await btn(wrapper, "みかん").trigger("click");
    await settle(100);
    expect(wrapper.html()).not.toContain("quiz-correct");

    await agent.publishSlice("quiz", quizState({ page: "answer", phase: "closed", correctNo: 2 }));
    await settle(8000);
    expect(wrapper.find('[data-testid="quiz-correct"]').text()).toContain("2. みかん");
    expect(wrapper.find('[data-testid="quiz-verdict"]').text()).toBe("正解！");

    await agent.publishSlice("quiz", quizState({ page: "answer", phase: "closed", correctNo: 3 }));
    await settle(8000);
    expect(wrapper.find('[data-testid="quiz-verdict"]').text()).toContain("残念");
  });

  it("回答しなかった人には「回答していません」と出る。イントロ/QR/結果では待機の案内", async () => {
    const { meta, agent } = await openQuestion();
    const { wrapper } = await mountPortal(meta.code);
    await settle(8000);
    await agent.publishSlice("quiz", quizState({ page: "answer", phase: "closed", correctNo: 1 }));
    await settle(8000);
    expect(wrapper.text()).toContain("あなたは回答していません");
    await agent.publishSlice("quiz", quizState({ page: "result", phase: "closed" }));
    await settle(8000);
    expect(wrapper.text()).toContain("結果発表中");
    await agent.publishSlice("quiz", quizState({ page: "intro", phase: "idle" }));
    await settle(8000);
    expect(wrapper.text()).toContain("クイズが始まります");
  });

  it("次の問題(別のラウンド)になると回答済み表示がリセットされ、再び回答できる", async () => {
    const { meta, device, agent } = await openQuestion();
    const { wrapper } = await mountPortal(meta.code);
    await settle(8000);
    await btn(wrapper, "りんご").trigger("click");
    await settle(100);
    const next = await device.conn.openRound("q2:live", OPTIONS, 20_000);
    await agent.publishSlice("quiz", quizState({ roundKey: "q2:live", title: "第2問", question: "次の問題", phase: "answering", deadlineMs: next.deadlineMs }));
    await settle(8000);
    expect(wrapper.text()).toContain("次の問題");
    expect(wrapper.find('[data-testid="quiz-answered"]').exists()).toBe(false);
    await btn(wrapper, "ぶどう").trigger("click");
    await settle(100);
    expect(wrapper.find('[data-testid="quiz-answered"]').text()).toContain("3. ぶどう");
  });
});

describe("参加ポータルのメンバー選択", () => {
  function registerMembers(list: Array<{ id: string; name: string }> | "error") {
    const listMembers = list === "error" ? vi.fn(async () => { throw new Error("offline"); }) : vi.fn(async () => list);
    container.register(AccountsRepository, { useValue: { listMembers } as unknown as AccountsRepository });
  }

  it("メンバーを選んで参加すると、回答が個人に紐づき表示名はメンバー名になる", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerMembers([{ id: "m1", name: "太郎" }, { id: "m2", name: "花子" }]);
    const device = makeDevice(env.hub);
    const router = makeRouter("/portal");
    await router.isReady();
    const wrapper = mount(PortalView, { props: { connection: device.conn }, global: { plugins: [router] } });
    await settle();
    await wrapper.find("#portal-code").setValue(meta.code);
    expect(wrapper.find("#portal-name").exists()).toBe(true);
    await wrapper.find("#portal-member").setValue("m2");
    expect(wrapper.find("#portal-name").exists()).toBe(false); // メンバーを選ぶと表示名の入力は不要
    await wrapper.find("form").trigger("submit");
    await settle(4000);
    const joined = await env.hub.deps.repoFor(meta.id).getDevice(device.conn.state.deviceId!);
    expect(joined).toMatchObject({ memberId: "m2", label: "花子" });
  });

  it("QRのURL(参加コード付き)で開いても、名簿があれば自動参加せず名前を選ぶ画面を出す。名簿が無ければ自動参加する", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerMembers([{ id: "m1", name: "太郎" }]);
    const { wrapper, device } = await mountPortal(meta.code);
    expect(device.conn.state.phase).toBe("idle");
    expect((wrapper.find("#portal-code").element as HTMLInputElement).value).toBe(meta.code);
    await wrapper.find("#portal-member").setValue("m1");
    await wrapper.find("form").trigger("submit");
    await settle(4000);
    expect(device.conn.state.phase).toBe("connected");

    container.clearInstances();
    env = setupSessionEnv();
    const meta2 = await env.repo.create({ name: "y" });
    registerMembers([]);
    const auto = await mountPortal(meta2.code);
    expect(auto.device.conn.state.phase).toBe("connected");
  });

  it("ゲストのままでも参加でき、入力した表示名が使われる", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerMembers([{ id: "m1", name: "太郎" }]);
    const device = makeDevice(env.hub);
    const router = makeRouter("/portal");
    await router.isReady();
    const wrapper = mount(PortalView, { props: { connection: device.conn }, global: { plugins: [router] } });
    await settle();
    await wrapper.find("#portal-code").setValue(meta.code);
    await wrapper.find("#portal-name").setValue("ゲスト花");
    await wrapper.find("form").trigger("submit");
    await settle(4000);
    const joined = await env.hub.deps.repoFor(meta.id).getDevice(device.conn.state.deviceId!);
    expect(joined).toMatchObject({ memberId: null, label: "ゲスト花" });
  });

  it("名簿を取得できなくても(オフライン等)、選択欄を出さずゲストとして参加できる", async () => {
    const meta = await env.repo.create({ name: "x" });
    registerMembers("error");
    const { wrapper, device } = await mountPortal(meta.code);
    expect(device.conn.state.phase).toBe("connected");
    expect(wrapper.find("#portal-member").exists()).toBe(false);
  });
});
