import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { FaultInjector } from "@octopus/session-hub/testing";
import { tick } from "@octopus/session-hub/testing";
import { useQuiz } from "../use-quiz";
import type { QuizState, QuizStorage } from "../use-quiz";
import { usePortalSession } from "../use-portal-session";
import type { PortalSession } from "../use-portal-session";
import { ALICE, BOB, MemoryDeviceStore, participantDevice, portalEnv, sampleQuizState } from "../../__tests__/portal-test-kit";
import type { Device } from "../../__tests__/portal-test-kit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

function memoryStorage(): QuizStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

async function connect(device: Device, storage: QuizStorage = memoryStorage(), memberId: string | null = "alice", now?: () => number) {
  let session!: PortalSession;
  let quiz!: QuizState;
  const app = createApp(
    defineComponent({
      setup() {
        session = usePortalSession(device.conn);
        quiz = useQuiz(session, { memberId: () => memberId, storage, now });
        return () => h("div");
      },
    })
  );
  app.mount(document.createElement("div"));
  await session.join();
  await tick(5000);
  return { session, quiz, unmount: () => app.unmount() };
}

describe("useQuiz: 出題と残り時間", () => {
  it("ホストが出題を公開すると取り出せ、取り下げると消える", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    expect(alice.quiz.quiz.value).toBeNull();
    expect(alice.quiz.remainingSec.value).toBeNull();

    await env.startQuiz();
    await tick(5000);
    expect(alice.quiz.quiz.value).toMatchObject({ page: "play", question: "みかんはどれ?", phase: "answering" });

    await env.publishQuiz(null);
    await tick(5000);
    expect(alice.quiz.quiz.value).toBeNull();
    alice.unmount();
  });

  it("残り時間は締切（サーバー時刻）から数え、時間が来たら回答できなくなる", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    await env.startQuiz({}, 30_000);
    await tick(1000);
    expect(alice.quiz.remainingSec.value).toBe(29);
    expect(alice.quiz.canAnswer.value).toBe(true);

    await tick(10_000);
    expect(alice.quiz.remainingSec.value).toBe(19);
    await tick(20_000);
    expect(alice.quiz.remainingSec.value).toBe(0);
    expect(alice.quiz.canAnswer.value).toBe(false);
    alice.unmount();
  });

  it("残り時間は端末の時計ではなくサーバー時刻で数える（端末の時計が30分進んでいても、締切前なら回答できる）", async () => {
    const env = await portalEnv();
    const SKEW = 30 * 60 * 1000;
    const skewedNow = () => Date.now() + SKEW;
    const device = participantDevice(env.hub, ALICE, { connection: { now: skewedNow } });
    const alice = await connect(device, memoryStorage(), "alice", skewedNow);
    await env.startQuiz({}, 20_000);
    await tick(5000);

    // サーバーとの差（約 -30分）を使って、端末の時計のずれを打ち消す
    expect(device.conn.state.serverOffsetMs).toBeLessThan(-SKEW + 10_000);
    expect(alice.quiz.remainingSec.value).toBeGreaterThan(10);
    expect(alice.quiz.remainingSec.value).toBeLessThanOrEqual(20);
    expect(alice.quiz.canAnswer.value).toBe(true);
    await alice.quiz.answer(1);
    expect(alice.quiz.myAnswer.value).toBe(1);
    alice.unmount();
  });

  it("受付中でない（待機・締切後）の間は、残り時間も回答もできない", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    await env.startQuiz({ phase: "closed", deadlineMs: null });
    await tick(5000);
    expect(alice.quiz.remainingSec.value).toBeNull();
    expect(alice.quiz.canAnswer.value).toBe(false);
    alice.unmount();
  });
});

describe("useQuiz: 回答する", () => {
  it("押した選択肢が採用され、回答済みになる。ホスト側にはメンバーとして1件届く", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    const quiz = await env.startQuiz();
    await tick(5000);

    await alice.quiz.answer(2);
    expect(alice.quiz.myAnswer.value).toBe(2);
    expect(alice.quiz.optionLabel(2)).toBe("2. みかん");
    // 受付中は、回答後も選び直せる
    expect(alice.quiz.canAnswer.value).toBe(true);
    expect(await env.entrants(quiz.roundKey!)).toEqual(["alice"]);
    alice.unmount();
  });

  it("連打しても送信中は1回だけ。同じ選択肢を押し直しても送らない", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    await env.startQuiz();
    await tick(5000);

    await Promise.all([alice.quiz.answer(1), alice.quiz.answer(1), alice.quiz.answer(3)]);
    expect(alice.quiz.myAnswer.value).toBe(1);
    expect(device.api.calls.submitAnswer).toBe(1);
    await alice.quiz.answer(1);
    expect(device.api.calls.submitAnswer).toBe(1);
    alice.unmount();
  });

  it("受付中なら選び直せて、最後に選んだものが回答になる(回答は1件のまま)", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    const quiz = await env.startQuiz();
    await tick(5000);

    await alice.quiz.answer(1);
    await alice.quiz.answer(3);
    expect(alice.quiz.myAnswer.value).toBe(3);
    expect(alice.quiz.message.value).toBe("");
    expect(device.api.calls.submitAnswer).toBe(2);
    const { answers } = await env.host.conn.getAnswers(quiz.roundKey!);
    expect(answers).toMatchObject([{ memberId: "alice", no: 3 }]);
    alice.unmount();
  });

  it("選び直した回答はリロードしても残る(最後の選択が保存される)", async () => {
    const env = await portalEnv();
    const storage = memoryStorage();
    const store = new MemoryDeviceStore();
    const first = await connect(participantDevice(env.hub, ALICE, { store }), storage);
    await env.startQuiz();
    await tick(5000);
    await first.quiz.answer(1);
    await first.quiz.answer(2);
    first.unmount();

    const reloaded = await connect(participantDevice(env.hub, ALICE, { store }), storage);
    expect(reloaded.quiz.myAnswer.value).toBe(2);
    reloaded.unmount();
  });

  it("選び直しの送信に失敗(通信断)したら、直前の回答のまま。つながってから押し直せる", async () => {
    const env = await portalEnv();
    let offline = false;
    const faults: FaultInjector = { decide: (endpoint) => (offline && endpoint === "submitAnswer" ? "dropRequest" : "ok") };
    const alice = await connect(participantDevice(env.hub, ALICE, { faults }));
    const quiz = await env.startQuiz();
    await tick(5000);
    await alice.quiz.answer(1);

    offline = true;
    const attempt = alice.quiz.answer(2);
    await tick(10_000);
    await attempt;
    expect(alice.quiz.myAnswer.value).toBe(1);
    expect(alice.quiz.message.value).toContain("通信できませんでした");
    expect((await env.host.conn.getAnswers(quiz.roundKey!)).answers).toMatchObject([{ no: 1 }]);

    offline = false;
    await alice.quiz.answer(2);
    expect(alice.quiz.myAnswer.value).toBe(2);
    expect(alice.quiz.message.value).toBe("");
    alice.unmount();
  });

  it("別の端末で回答済みでも、押した選択肢に置き換わる(メンバーごとに1件)", async () => {
    const env = await portalEnv();
    const phone = await connect(participantDevice(env.hub, ALICE));
    const tablet = await connect(participantDevice(env.hub, ALICE));
    const quiz = await env.startQuiz();
    await tick(5000);

    await phone.quiz.answer(2);
    await tablet.quiz.answer(3);
    expect(tablet.quiz.myAnswer.value).toBe(3);
    expect(await env.entrants(quiz.roundKey!)).toEqual(["alice"]);
    phone.unmount();
    tablet.unmount();
  });

  it("締め切られたあとは選び直せない。送信中に締まった場合は、採用済みの回答を案内する", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    const quiz = await env.startQuiz();
    await tick(5000);
    await alice.quiz.answer(1);
    await env.host.conn.closeRound(quiz.roundKey!);

    // 端末はまだ締切を知らない状態で押した場合
    await alice.quiz.answer(2);
    expect(alice.quiz.myAnswer.value).toBe(1);
    expect(alice.quiz.message.value).toBe("受付は終了しました(あなたの回答: 1. りんご)");
    const { answers } = await env.host.conn.getAnswers(quiz.roundKey!);
    expect(answers).toMatchObject([{ no: 1 }]);
    alice.unmount();
  });

  it("締め切られた直後に押すと、受付終了の案内を出し、回答済みにはならない", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    const quiz = await env.startQuiz();
    await tick(5000);
    await env.host.conn.closeRound(quiz.roundKey!);

    await alice.quiz.answer(1);
    expect(alice.quiz.myAnswer.value).toBeNull();
    expect(alice.quiz.message.value).toBe("受付は終了しました");
    alice.unmount();
  });

  it("通信に失敗したら案内を出し、つながってからもう一度押せる", async () => {
    const env = await portalEnv();
    let offline = true;
    const faults: FaultInjector = { decide: (endpoint) => (offline && endpoint === "submitAnswer" ? "dropRequest" : "ok") };
    const alice = await connect(participantDevice(env.hub, ALICE, { faults }));
    await env.startQuiz();
    await tick(5000);

    const attempt = alice.quiz.answer(1);
    await tick(10_000);
    await attempt;
    expect(alice.quiz.myAnswer.value).toBeNull();
    expect(alice.quiz.message.value).toContain("通信できませんでした");

    offline = false;
    await alice.quiz.answer(1);
    expect(alice.quiz.myAnswer.value).toBe(1);
    expect(alice.quiz.message.value).toBe("");
    alice.unmount();
  });
});

describe("useQuiz: 回答済みの保存", () => {
  it("リロードしても回答済みが残る。別の問題（ラウンド）になると消える", async () => {
    const env = await portalEnv();
    const storage = memoryStorage();
    const store = new MemoryDeviceStore();
    const first = await connect(participantDevice(env.hub, ALICE, { store }), storage);
    await env.startQuiz();
    await tick(5000);
    await first.quiz.answer(3);
    first.unmount();

    const reloaded = await connect(participantDevice(env.hub, ALICE, { store }), storage);
    expect(reloaded.quiz.myAnswer.value).toBe(3);

    await env.startQuiz({ quizId: "qz2", roundKey: "qz2:live", question: "次の問題" });
    await tick(5000);
    expect(reloaded.quiz.myAnswer.value).toBeNull();
    reloaded.unmount();
  });

  it("同じクイズでも、別のイベントで出し直したら（ラウンドのキーが変われば）未回答に戻る", async () => {
    const env = await portalEnv();
    const storage = memoryStorage();
    const device = await connect(participantDevice(env.hub, ALICE, { store: new MemoryDeviceStore() }), storage);
    await env.startQuiz({ roundKey: "qz1:live:ev-1" });
    await tick(5000);
    await device.quiz.answer(2);
    expect(device.quiz.myAnswer.value).toBe(2);

    await env.startQuiz({ roundKey: "qz1:live:ev-2" });
    await tick(5000);
    expect(device.quiz.myAnswer.value).toBeNull();
    expect(device.quiz.canAnswer.value).toBe(true);
    device.unmount();
  });

  it("1台のスマホを何人かで使っても、前の人の回答を引き継がない（保存は人ごと）", async () => {
    const env = await portalEnv();
    const storage = memoryStorage();
    const store = new MemoryDeviceStore();
    const alice = await connect(participantDevice(env.hub, ALICE, { store }), storage, "alice");
    await env.startQuiz();
    await tick(5000);
    await alice.quiz.answer(2);
    alice.unmount();

    const bob = await connect(participantDevice(env.hub, BOB, { store }), storage, "bob");
    expect(bob.quiz.myAnswer.value).toBeNull();
    await bob.quiz.answer(1);
    expect(bob.quiz.myAnswer.value).toBe(1);
    bob.unmount();
  });
});

describe("useQuiz: 正解発表", () => {
  it("正解を表示し、自分の回答が正しいかを伝える", async () => {
    const env = await portalEnv();
    const right = await connect(participantDevice(env.hub, ALICE), memoryStorage(), "alice");
    const wrong = await connect(participantDevice(env.hub, BOB), memoryStorage(), "bob");
    const quiz = await env.startQuiz();
    await tick(5000);
    await right.quiz.answer(2);
    await wrong.quiz.answer(1);

    await env.publishQuiz({ ...sampleQuizState(), ...quiz, page: "answer", phase: "closed", deadlineMs: null, correctNo: 2 });
    await tick(5000);
    expect(right.quiz.correctLabel.value).toBe("2. みかん");
    expect(right.quiz.verdictText.value).toBe("正解！");
    expect(wrong.quiz.verdictText.value).toBe("残念… あなたの回答: 1. りんご");
    right.unmount();
    wrong.unmount();
  });

  it("回答していない人には判定を出さない", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    const quiz = await env.startQuiz();
    await env.publishQuiz({ ...quiz, page: "answer", phase: "closed", deadlineMs: null, correctNo: 2 });
    await tick(5000);
    expect(alice.quiz.verdictText.value).toBe("");
    expect(alice.quiz.correctLabel.value).toBe("2. みかん");
    alice.unmount();
  });
});
