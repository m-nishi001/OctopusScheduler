import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import type { SessionConnection } from "@octopus/session-hub";
import { tick } from "@octopus/session-hub/testing";
import { ALICE, BOB, participantDevice, portalEnv, sampleDraw, sampleRound } from "../../__tests__/portal-test-kit";
import type { Device } from "../../__tests__/portal-test-kit";
import { PARTICIPANT_AUTH_KEY } from "../../model/participant-auth";
import { participantPortalRoutes } from "../../routes";

// レイアウトは自分で接続を作る。テストでは用意した接続に差し替える。
let nextConnection: SessionConnection | null = null;
vi.mock("@octopus/session-hub", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@octopus/session-hub")>();
  return { ...actual, createSessionConnection: () => nextConnection! };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

const Stub = defineComponent({ render: () => h("div", "stub") });

interface Mounted {
  wrapper: VueWrapper;
  router: ReturnType<typeof createRouter>;
}

async function mountPortal(device: Device, path = "/p", member: { id: string; name: string } = ALICE): Promise<Mounted> {
  nextConnection = device.conn;
  const router = createRouter({ history: createMemoryHistory(), routes: [...participantPortalRoutes, { path: "/login", component: Stub }] });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router], provide: { [PARTICIPANT_AUTH_KEY as symbol]: { currentMember: ref(member), signOut: vi.fn(async () => undefined) } } },
    attachTo: document.body,
  });
  await flushPromises();
  await tick(0);
  return { wrapper, router };
}

const has = (m: Mounted, id: string) => m.wrapper.find(`[data-testid="${id}"]`).exists();
const text = (m: Mounted, id: string) => m.wrapper.find(`[data-testid="${id}"]`).text();
const all = (m: Mounted, id: string) => m.wrapper.findAll(`[data-testid="${id}"]`);

describe("参加者ポータル: 結果タブ", () => {
  it("下タブに「結果」があり、まだ何も無いときは案内を出す", async () => {
    const { hub } = await portalEnv();
    const m = await mountPortal(participantDevice(hub, ALICE), "/p/results");
    await tick(500);
    expect(m.wrapper.find(".pp-tabs").text()).toContain("結果");
    expect(has(m, "results-quiz-empty")).toBe(true);
    expect(text(m, "results-quiz-empty")).toContain("クイズの結果発表のあとに");
    expect(has(m, "results-me")).toBe(false);
    await m.wrapper.find('[data-testid="results-tab-jackpot"]').trigger("click");
    expect(text(m, "results-jackpot-empty")).toContain("まだ当選者はいません");
    m.wrapper.unmount();
  });

  it("クイズ: 総合ランキングと各問の結果が出て、自分の行・正誤が分かる", async () => {
    const env = await portalEnv();
    await env.saveQuizResult(sampleRound());
    await env.saveQuizResult(sampleRound({ roundKey: "qz2:live", quizId: "qz2", title: "宇宙クイズ", closedAtMs: 1_700_000_050_000, correct: [{ memberId: "bob", name: "ボブ", sec: 1 }], wrongMemberIds: ["alice"], answeredCount: 2 }));
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/results");
    await tick(500);
    // 自分の成績カード: アリスは 2問中1問正解、総合 1位(同点のボブより合計秒数が小さい)
    expect(text(m, "results-my-rank")).toContain("1");
    expect(text(m, "results-my-rank")).toContain("2 人中");
    expect(text(m, "results-cumulative")).toContain("総合ランキング");
    expect(text(m, "results-cumulative-mine")).toContain("あなた");
    // 各問: 新しい順。宇宙クイズは不正解、果物クイズは正解 1位
    const rounds = all(m, "results-round");
    expect(rounds).toHaveLength(2);
    expect(rounds[0].text()).toContain("宇宙クイズ");
    expect(rounds[0].find('[data-testid="results-round-verdict"]').text()).toBe("不正解");
    expect(rounds[1].text()).toContain("果物クイズ");
    expect(rounds[1].find('[data-testid="results-round-verdict"]').text()).toBe("正解 1位");
    expect(rounds[1].text()).toContain("回答 3 人 / 正解 2 人");
    m.wrapper.unmount();
  });

  it("未回答の人には「未回答」と出し、他の人のIDは画面にも出ない", async () => {
    const env = await portalEnv();
    await env.saveQuizResult(sampleRound());
    const m = await mountPortal(participantDevice(env.hub, { id: "dave", name: "デイブ" }), "/p/results", { id: "dave", name: "デイブ" });
    await tick(500);
    expect(all(m, "results-round")[0].find('[data-testid="results-round-verdict"]').text()).toBe("未回答");
    expect(has(m, "results-me")).toBe(false);
    expect(m.wrapper.html()).not.toContain("alice");
    m.wrapper.unmount();
  });

  it("上位に入っていない自分の順位は、表の下に出る", async () => {
    const env = await portalEnv();
    const correct = Array.from({ length: 14 }, (_, i) => ({ memberId: i === 12 ? "alice" : `p${i}`, name: i === 12 ? "アリス" : `参加者${i}`, sec: i + 1 }));
    await env.saveQuizResult(sampleRound({ correct, answeredCount: 14, wrongMemberIds: [] }));
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/results");
    await tick(500);
    expect(text(m, "results-cumulative-outside")).toContain("13位");
    expect(all(m, "results-cumulative-mine")).toHaveLength(0);
    m.wrapper.unmount();
  });

  it("ジャックポット: 当選履歴が新しい順に出て、自分の当選は強調される。成績カードに当選回数が出る", async () => {
    const env = await portalEnv();
    await env.saveJackpotDraw(sampleDraw());
    await env.saveJackpotDraw(sampleDraw({ drawId: "d2", memberId: "bob", memberName: "ボブ", prizeName: "5等 スイーツ", atMs: 1_700_000_200_000, isKakuhen: true }));
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/results");
    await tick(500);
    // クイズの結果が無く、当選だけあるので、最初からジャックポットが開く
    const draws = all(m, "results-draw");
    expect(draws).toHaveLength(2);
    expect(draws[0].text()).toContain("5等 スイーツ");
    expect(draws[0].text()).toContain("確変");
    expect(draws[0].text()).not.toContain("あなたが当選");
    expect(draws[1].text()).toContain("あなたが当選!");
    expect(text(m, "results-my-wins")).toContain("1");
    m.wrapper.unmount();
  });

  it("ホストが結果を保存すると、開いている画面が(少し待って)更新される。タブの印は取得後に消える", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, ALICE), "/p/results");
    await tick(500);
    expect(has(m, "results-quiz-empty")).toBe(true);
    await env.saveQuizResult(sampleRound());
    await tick(10_000);
    await flushPromises();
    expect(has(m, "results-quiz-empty")).toBe(false);
    expect(all(m, "results-round")).toHaveLength(1);
    expect(has(m, "results-new")).toBe(false);
    m.wrapper.unmount();
  });

  it("他のタブにいる間に結果が保存されると、「結果」タブに印が付き、開くと取得されて消える", async () => {
    const env = await portalEnv();
    const m = await mountPortal(participantDevice(env.hub, BOB, {}), "/p", BOB);
    await tick(500);
    expect(has(m, "results-new")).toBe(false);
    await env.saveQuizResult(sampleRound());
    await tick(5000);
    await flushPromises();
    expect(has(m, "results-new")).toBe(true);
    await m.router.push("/p/results");
    await flushPromises();
    await tick(500);
    expect(all(m, "results-round")).toHaveLength(1);
    expect(has(m, "results-new")).toBe(false);
    m.wrapper.unmount();
  });

  it("読み込めなかったときは案内と再読み込みを出す", async () => {
    const env = await portalEnv();
    let fail = true;
    const m = await mountPortal(participantDevice(env.hub, ALICE, { faults: { decide: (e) => (e === "getResults" && fail ? "fail" : "ok") } }), "/p/results");
    // 通信の一時的な失敗は接続が数回だけ再送する。それでも駄目なら案内を出す
    await tick(120_000);
    await flushPromises();
    expect(has(m, "results-error")).toBe(true);
    fail = false;
    await m.wrapper.find('[data-testid="results-error"] button').trigger("click");
    await flushPromises();
    await tick(500);
    expect(has(m, "results-error")).toBe(false);
    expect(has(m, "results-quiz-empty")).toBe(true);
    m.wrapper.unmount();
  });
});
