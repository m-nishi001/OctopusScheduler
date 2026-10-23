import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { RESULTS_LIMITS } from "../../../shared/results";
import { createTestHub } from "../../../testing/test-hub";
import { commitJackpotDraw, ensureJackpotPlan, getJackpotState, getResultsFor, putQuizResult, resetJackpot, resultsKey, revealJackpotDraw } from "../results-use-cases";
import type { ResultsDeps } from "../results-use-cases";
import { parseHubErrorCode } from "../../../shared/hub-error";

function setup() {
  const hub = createTestHub();
  const storage = new InMemoryKeyValueStorage();
  const deps: ResultsDeps = { storage, withLock: hub.deps.withLock, now: hub.deps.now };
  return { hub, storage, deps };
}

const roundInput = (over: Record<string, unknown> = {}) => ({
  roundKey: "q1:live",
  quizId: "q1",
  title: "第1問",
  correctNo: 2,
  closedAtMs: 1000,
  answeredCount: 3,
  correct: [
    { memberId: "a", name: "Alice", sec: 1.1 },
    { memberId: "b", name: "Bob", sec: 2.2 },
  ],
  wrongMemberIds: ["c"],
  ...over,
});

const drawInput = (over: Record<string, unknown> = {}) => ({
  drawId: "d1",
  memberId: "a",
  memberName: "Alice",
  prizeId: "p1",
  prizeName: "1等",
  isKakuhen: false,
  atMs: 100,
  ...over,
});

/** 確定して、すぐ公開する。 */
const putJackpotDraw = async (deps: ResultsDeps, sessionId: string, draw: ReturnType<typeof drawInput>) => {
  await commitJackpotDraw(deps, sessionId, draw);
  return revealJackpotDraw(deps, sessionId, draw.drawId as string);
};

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return parseHubErrorCode((e as Error).message);
  }
  return null;
};

describe("results-use-cases", () => {
  it("保存先は results/json/<sessionId>.json。不正な sessionId は拒否する", async () => {
    expect(resultsKey("abc-123_X")).toBe("results/json/abc-123_X.json");
    const { deps } = setup();
    expect(await codeOf(putQuizResult(deps, "../evil", roundInput()))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(getResultsFor(deps, "a/b", "a"))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(getResultsFor(deps, "", "a"))).toBe("INVALID_ARGUMENT");
  });

  it("まだ結果が無いセッションは空で返る", async () => {
    const { deps } = setup();
    const view = await getResultsFor(deps, "s1", "a");
    expect(view.rev).toBe(0);
    expect(view.quiz.rounds).toEqual([]);
    expect(view.jackpot.draws).toEqual([]);
  });

  it("クイズの結果を保存して読める。rev は内容が変わったときだけ進む", async () => {
    const { deps, storage } = setup();
    expect(await putQuizResult(deps, "s1", roundInput())).toEqual({ rev: 1 });
    expect(await putQuizResult(deps, "s1", roundInput())).toEqual({ rev: 1 });
    expect(await putQuizResult(deps, "s1", roundInput({ answeredCount: 4, wrongMemberIds: ["c", "d"] }))).toEqual({ rev: 2 });
    const view = await getResultsFor(deps, "s1", "a");
    expect(view.rev).toBe(2);
    expect(view.quiz.rounds).toHaveLength(1);
    expect(view.quiz.rounds[0].answeredCount).toBe(4);
    expect(JSON.parse((await storage.getContentAsText("results/json/s1.json")) as string).rev).toBe(2);
  });

  it("ホストの再読み込みで回答が空になった書き直しは、回答の多い既存の結果を壊さない", async () => {
    const { deps } = setup();
    await putQuizResult(deps, "s1", roundInput());
    const rev = await putQuizResult(deps, "s1", roundInput({ answeredCount: 0, correct: [], wrongMemberIds: [] }));
    expect(rev).toEqual({ rev: 1 });
    expect((await getResultsFor(deps, "s1", "a")).quiz.rounds[0].correctCount).toBe(2);
  });

  it("ラウンドは roundKey ごとに別々に残り、累計に反映される", async () => {
    const { deps } = setup();
    await putQuizResult(deps, "s1", roundInput({ roundKey: "q1:live", closedAtMs: 1 }));
    await putQuizResult(deps, "s1", roundInput({ roundKey: "q2:live", quizId: "q2", closedAtMs: 2, correct: [{ memberId: "a", name: "Alice", sec: 1 }], wrongMemberIds: [] }));
    const view = await getResultsFor(deps, "s1", "a");
    expect(view.quiz.rounds.map((r) => r.roundKey)).toEqual(["q2:live", "q1:live"]);
    expect(view.quiz.cumulative.me).toMatchObject({ rank: 1, points: 2 });
  });

  it("ラウンド数・抽選数の上限を超えたら拒否する", async () => {
    const { deps } = setup();
    for (let i = 0; i < RESULTS_LIMITS.maxRounds; i++) await putQuizResult(deps, "s1", roundInput({ roundKey: `r${i}`, closedAtMs: i }));
    expect(await codeOf(putQuizResult(deps, "s1", roundInput({ roundKey: "over" })))).toBe("PAYLOAD_TOO_LARGE");
    // 既存のラウンドの上書きは上限に達していても受け付ける
    await putQuizResult(deps, "s1", roundInput({ roundKey: "r0", answeredCount: 9 }));

    for (let i = 0; i < RESULTS_LIMITS.maxDraws; i++) await putJackpotDraw(deps, "s2", drawInput({ drawId: `d${i}`, memberId: `m${i}`, prizeId: `p${i}`, atMs: i }));
    expect(await codeOf(commitJackpotDraw(deps, "s2", drawInput({ drawId: "over", memberId: "mo", prizeId: "po" })))).toBe("PAYLOAD_TOO_LARGE");
  });

  it("不正な入力は INVALID_ARGUMENT", async () => {
    const { deps } = setup();
    expect(await codeOf(putQuizResult(deps, "s1", { nope: true }))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ prizeName: "" })))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ memberId: undefined })))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(revealJackpotDraw(deps, "s1", 5))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(ensureJackpotPlan(deps, "s1", { kakuhenTimings: "x", reservedPrizeIds: [] }))).toBe("INVALID_ARGUMENT");
  });

  describe("ジャックポット", () => {
    it("確定しただけでは rev が進まず、ポータルにも見えない。公開すると rev が進んで見える", async () => {
      const { deps } = setup();
      expect(await commitJackpotDraw(deps, "s1", drawInput())).toEqual({ rev: 0 });
      expect((await getResultsFor(deps, "s1", "a")).jackpot.draws).toEqual([]);
      expect((await getResultsFor(deps, "s1", "a")).rev).toBe(0);
      expect(await getJackpotState(deps, "s1")).toMatchObject({ rev: 0, plan: null, draws: [{ drawId: "d1", revealedAtMs: null }] });

      expect(await revealJackpotDraw(deps, "s1", "d1")).toEqual({ rev: 1 });
      const view = await getResultsFor(deps, "s1", "a");
      expect(view.rev).toBe(1);
      expect(view.jackpot.draws.map((d) => d.drawId)).toEqual(["d1"]);
      expect(view.jackpot.myWins).toBe(1);
      const state = await getJackpotState(deps, "s1");
      expect(state.draws[0].revealedAtMs).toEqual(expect.any(Number));
    });

    it("同じ drawId・同じ内容の commit は何度でも成功(何も書かない)。公開後の再送も成功", async () => {
      const { deps, storage } = setup();
      await commitJackpotDraw(deps, "s1", drawInput());
      const before = await storage.getContentAsText(resultsKey("s1"));
      expect(await commitJackpotDraw(deps, "s1", drawInput())).toEqual({ rev: 0 });
      expect(await storage.getContentAsText(resultsKey("s1"))).toBe(before);
      await revealJackpotDraw(deps, "s1", "d1");
      expect(await commitJackpotDraw(deps, "s1", drawInput())).toEqual({ rev: 1 });
      expect((await getJackpotState(deps, "s1")).draws).toHaveLength(1);
    });

    it("reveal は何度呼んでも同じ(2回目以降は rev も公開時刻も変わらない)", async () => {
      const { deps } = setup();
      await commitJackpotDraw(deps, "s1", drawInput());
      expect(await revealJackpotDraw(deps, "s1", "d1")).toEqual({ rev: 1 });
      const first = (await getJackpotState(deps, "s1")).draws[0].revealedAtMs;
      expect(await revealJackpotDraw(deps, "s1", "d1")).toEqual({ rev: 1 });
      expect((await getJackpotState(deps, "s1")).draws[0].revealedAtMs).toBe(first);
    });

    it("存在しない drawId の reveal は JACKPOT_CONFLICT", async () => {
      const { deps } = setup();
      expect(await codeOf(revealJackpotDraw(deps, "s1", "nope"))).toBe("JACKPOT_CONFLICT");
    });

    describe("commit の拒否(JACKPOT_CONFLICT)", () => {
      it("同じメンバーが別の抽選にすでにいる", async () => {
        const { deps } = setup();
        await putJackpotDraw(deps, "s1", drawInput());
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ drawId: "d2", prizeId: "p2" })))).toBe("JACKPOT_CONFLICT");
      });

      it("同じ景品が別の抽選にすでにある", async () => {
        const { deps } = setup();
        await putJackpotDraw(deps, "s1", drawInput());
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ drawId: "d2", memberId: "b" })))).toBe("JACKPOT_CONFLICT");
      });

      it("未公開の抽選が残っている(別の drawId)", async () => {
        const { deps } = setup();
        await commitJackpotDraw(deps, "s1", drawInput());
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ drawId: "d2", memberId: "b", prizeId: "p2" })))).toBe("JACKPOT_CONFLICT");
        await revealJackpotDraw(deps, "s1", "d1");
        await commitJackpotDraw(deps, "s1", drawInput({ drawId: "d2", memberId: "b", prizeId: "p2" }));
      });

      it("同じ drawId で中身が違う", async () => {
        const { deps } = setup();
        await commitJackpotDraw(deps, "s1", drawInput());
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ memberId: "b" })))).toBe("JACKPOT_CONFLICT");
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ prizeId: "p9" })))).toBe("JACKPOT_CONFLICT");
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ isKakuhen: true })))).toBe("JACKPOT_CONFLICT");
        await revealJackpotDraw(deps, "s1", "d1");
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ prizeName: "別名" })))).toBe("JACKPOT_CONFLICT");
      });

      it("確変の取り置きと食い違う(確変なのに取り置き外、通常なのに取り置きの景品)", async () => {
        const { deps } = setup();
        await ensureJackpotPlan(deps, "s1", { kakuhenTimings: [2], reservedPrizeIds: ["pk"] });
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ isKakuhen: true })))).toBe("JACKPOT_CONFLICT");
        expect(await codeOf(commitJackpotDraw(deps, "s1", drawInput({ prizeId: "pk" })))).toBe("JACKPOT_CONFLICT");
        // 食い違わなければ通る
        await commitJackpotDraw(deps, "s1", drawInput({ drawId: "k1", prizeId: "pk", isKakuhen: true }));
        await revealJackpotDraw(deps, "s1", "k1");
        await commitJackpotDraw(deps, "s1", drawInput({ memberId: "b" }));
      });

      it("拒否されたときは何も書かれない", async () => {
        const { deps, storage } = setup();
        await putJackpotDraw(deps, "s1", drawInput());
        const before = await storage.getContentAsText(resultsKey("s1"));
        await codeOf(commitJackpotDraw(deps, "s1", drawInput({ drawId: "d2", prizeId: "p2" })));
        expect(await storage.getContentAsText(resultsKey("s1"))).toBe(before);
      });
    });

    it("同時に同じメンバーを commit しても、勝つのは1つだけ(ロックの中で検証)", async () => {
      const { deps } = setup();
      const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => commitJackpotDraw(deps, "s1", drawInput({ drawId: `d${i}`, prizeId: `p${i}` }))));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await getJackpotState(deps, "s1")).draws).toHaveLength(1);
    });

    it("ensureJackpotPlan は最初の1回だけ保存し、以後は保存済みを返す(並行しても1つ)。rev は進まない", async () => {
      const { deps } = setup();
      const settled = await Promise.all(Array.from({ length: 5 }, (_, i) => ensureJackpotPlan(deps, "s1", { kakuhenTimings: [i + 1], reservedPrizeIds: [`pk${i}`] })));
      const plan = settled[0].plan;
      expect(settled.every((r) => JSON.stringify(r.plan) === JSON.stringify(plan) && r.rev === 0)).toBe(true);
      expect(plan.createdAtMs).toEqual(expect.any(Number));
      expect(await ensureJackpotPlan(deps, "s1", { kakuhenTimings: [9], reservedPrizeIds: ["zz"] })).toEqual({ rev: 0, plan });
      expect((await getJackpotState(deps, "s1")).plan).toEqual(plan);
    });

    it("resetJackpot は抽選と予定だけを消し、クイズは残す。公開済みの抽選があれば rev が進む", async () => {
      const { deps } = setup();
      await putQuizResult(deps, "s1", roundInput());
      await ensureJackpotPlan(deps, "s1", { kakuhenTimings: [], reservedPrizeIds: [] });
      await putJackpotDraw(deps, "s1", drawInput());
      expect(await resetJackpot(deps, "s1")).toEqual({ rev: 3 });
      expect(await getJackpotState(deps, "s1")).toMatchObject({ plan: null, draws: [], rev: 3 });
      const view = await getResultsFor(deps, "s1", "a");
      expect(view.quiz.rounds).toHaveLength(1);
      expect(view.jackpot.draws).toEqual([]);
      expect(await resetJackpot(deps, "s1")).toEqual({ rev: 3 });
      // 消した後は、同じメンバー・景品でもう一度抽選できる
      await putJackpotDraw(deps, "s1", drawInput());
    });

    it("未公開の抽選だけのリセットでは rev が進まない", async () => {
      const { deps } = setup();
      await commitJackpotDraw(deps, "s1", drawInput());
      expect(await resetJackpot(deps, "s1")).toEqual({ rev: 0 });
      expect((await getJackpotState(deps, "s1")).draws).toEqual([]);
    });
  });

  it("同時に書き込んでも取りこぼさない(ロックで直列化)", async () => {
    const { deps } = setup();
    await Promise.all(Array.from({ length: 20 }, (_, i) => putQuizResult(deps, "s1", roundInput({ roundKey: `r${i}`, closedAtMs: i }))));
    const view = await getResultsFor(deps, "s1", "a");
    expect(view.quiz.rounds).toHaveLength(20);
    expect(view.rev).toBe(20);
  });

  it("セッションごとに別ファイル。他のメンバーのIDは返さない", async () => {
    const { deps } = setup();
    await putJackpotDraw(deps, "s1", drawInput());
    expect((await getResultsFor(deps, "s2", "a")).jackpot.draws).toEqual([]);
    expect(JSON.stringify(await getResultsFor(deps, "s1", "b"))).not.toContain('"memberId"');
  });

  describe("結果ファイルが壊れているとき", () => {
    it("読み込めないときは空として扱わず、エラーにする（保存も、取得も）", async () => {
      const { deps, storage } = setup();
      await storage.putText(resultsKey("s1"), "{ これはJSONではない", "application/json");

      await expect(getResultsFor(deps, "s1", "a")).rejects.toThrow("結果ファイルを読み込めませんでした");
      await expect(putQuizResult(deps, "s1", roundInput())).rejects.toThrow("結果ファイルを読み込めませんでした");
    });

    it("壊れたファイルを、新しい結果で上書きしない（残っている中身を失わない）", async () => {
      const { deps, storage } = setup();
      const broken = '{"v":2,"rev":3,"rounds":[';
      await storage.putText(resultsKey("s1"), broken, "application/json");

      await expect(putQuizResult(deps, "s1", roundInput())).rejects.toThrow();
      expect(await storage.getContentAsText(resultsKey("s1"))).toBe(broken);
    });

    it("形が違うファイル（別の版・配列でない）も同じ扱い", async () => {
      const { deps, storage } = setup();
      // v1 は読まない(後方互換なし)
      await storage.putText(resultsKey("s1"), JSON.stringify({ v: 1, rev: 1, rounds: [], draws: [] }), "application/json");
      await expect(commitJackpotDraw(deps, "s1", drawInput())).rejects.toThrow("結果ファイルを読み込めませんでした");
      await storage.putText(resultsKey("s2"), JSON.stringify({ v: 2, rev: 1, rounds: {}, draws: [], jackpot: { plan: null } }), "application/json");
      await expect(commitJackpotDraw(deps, "s2", drawInput())).rejects.toThrow("結果ファイルを読み込めませんでした");
      await storage.putText(resultsKey("s3"), JSON.stringify({ v: 2, rev: 1, rounds: [], draws: [] }), "application/json");
      await expect(commitJackpotDraw(deps, "s3", drawInput())).rejects.toThrow("結果ファイルを読み込めませんでした");
    });

    it("ファイルが無いだけなら、これまでどおり空から始まる", async () => {
      const { deps } = setup();
      expect((await getResultsFor(deps, "fresh", "a")).rev).toBe(0);
      expect(await putJackpotDraw(deps, "fresh", drawInput())).toEqual({ rev: 1 });
    });
  });
});
