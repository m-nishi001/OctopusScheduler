import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { makeDevice, makeHub } from "@octopus/session-hub/testing";
import { sessionService as svc } from "@octopus/session-hub/engine";
import { useQuizHost } from "./use-quiz-host";
import type { QuizHostHandlers } from "./use-quiz-host";
import { buildQuizHostState } from "../../model/quiz-host-state";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

async function scene() {
  const hub = makeHub();
  const meta = await svc.createSession(hub.deps, { name: "x" }, "a");
  const hostDevice = makeDevice(hub, { memberId: "a" });
  container.register(HostAgent, { useValue: new HostAgent(hostDevice.conn) });
  await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(hub, { memberId: "b" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  const client = makeDevice(hub);
  await client.conn.joinClient({ code: meta.code });
  return { admin, client };
}

function mount(handlers?: QuizHostHandlers) {
  const scope = effectScope();
  const host = scope.run(() => useQuizHost(handlers))!;
  return { host, stop: () => scope.stop() };
}

describe("useQuizHost", () => {
  it("HostAgent 未登録(ホストでない端末)では何もしない", () => {
    const { host } = mount({ advance: vi.fn() });
    expect(() => host.publish(buildQuizHostState({ page: "intro", quizId: "q1" }))).not.toThrow();
  });

  it("advance を省略すると、管理端末の「次へ」が表示画面の Enter キー押下として届く", async () => {
    const { admin } = await scene();
    mount();
    const keys: string[] = [];
    const onKey = (e: KeyboardEvent) => keys.push(e.key);
    document.addEventListener("keydown", onKey);
    await admin.conn.issue("quiz", "advance");
    await tick(4000);
    document.removeEventListener("keydown", onKey);
    expect(keys).toEqual(["Enter"]);
  });

  it("advance を指定した画面ではそのハンドラが呼ばれ、Enter は再現されない", async () => {
    const { admin } = await scene();
    const advance = vi.fn();
    mount({ advance });
    const keys: string[] = [];
    const onKey = (e: KeyboardEvent) => keys.push(e.key);
    document.addEventListener("keydown", onKey);
    await admin.conn.issue("quiz", "advance");
    await tick(4000);
    document.removeEventListener("keydown", onKey);
    expect(advance).toHaveBeenCalledTimes(1);
    expect(keys).toEqual([]);
  });

  it("closeAnswers は指定した画面でだけ処理され、未指定の画面では無視される", async () => {
    const { admin } = await scene();
    const closeAnswers = vi.fn();
    const first = mount({ closeAnswers });
    await admin.conn.issue("quiz", "closeAnswers");
    await tick(4000);
    expect(closeAnswers).toHaveBeenCalledTimes(1);
    first.stop();

    mount({}); // closeAnswers を持たない画面
    await admin.conn.issue("quiz", "closeAnswers");
    await tick(4000);
    expect(closeAnswers).toHaveBeenCalledTimes(1);
  });

  it("未知のコマンドは無視する", async () => {
    const { admin } = await scene();
    const advance = vi.fn();
    mount({ advance });
    await admin.conn.issue("quiz", "somethingNew");
    await tick(4000);
    expect(advance).not.toHaveBeenCalled();
  });

  it("公開した状態が参加者に届き、画面を離れると取り下げられてコマンドも受けなくなる", async () => {
    const { admin, client } = await scene();
    const advance = vi.fn();
    const { host, stop } = mount({ advance });
    host.publish(buildQuizHostState({ page: "intro", quizId: "q1", title: "第1問" }));
    await tick(5000);
    expect((client.conn.state.roomState?.data as { quiz?: { title: string } }).quiz?.title).toBe("第1問");
    stop();
    await tick(5000);
    expect((client.conn.state.roomState?.data as { quiz?: unknown }).quiz).toBeUndefined();
    await admin.conn.issue("quiz", "advance");
    await tick(4000);
    expect(advance).not.toHaveBeenCalled();
  });
});
