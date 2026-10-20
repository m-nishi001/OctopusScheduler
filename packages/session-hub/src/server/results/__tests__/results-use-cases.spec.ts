import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { RESULTS_LIMITS } from "../../../shared/results";
import { createTestHub } from "../../../testing/test-hub";
import { deleteJackpotDraw, getResultsFor, putJackpotDraw, putQuizResult, resultsKey } from "../results-use-cases";
import type { ResultsDeps } from "../results-use-cases";
import { parseHubErrorCode } from "../../engine/hub-error";

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

    for (let i = 0; i < RESULTS_LIMITS.maxDraws; i++) await putJackpotDraw(deps, "s2", drawInput({ drawId: `d${i}`, atMs: i }));
    expect(await codeOf(putJackpotDraw(deps, "s2", drawInput({ drawId: "over" })))).toBe("PAYLOAD_TOO_LARGE");
  });

  it("不正な入力は INVALID_ARGUMENT", async () => {
    const { deps } = setup();
    expect(await codeOf(putQuizResult(deps, "s1", { nope: true }))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(putJackpotDraw(deps, "s1", drawInput({ prizeName: "" })))).toBe("INVALID_ARGUMENT");
    expect(await codeOf(deleteJackpotDraw(deps, "s1", 5))).toBe("INVALID_ARGUMENT");
  });

  it("抽選結果は drawId で上書きでき、削除すると rev が進んで見えなくなる", async () => {
    const { deps } = setup();
    expect(await putJackpotDraw(deps, "s1", drawInput())).toEqual({ rev: 1 });
    expect(await putJackpotDraw(deps, "s1", drawInput())).toEqual({ rev: 1 });
    expect(await putJackpotDraw(deps, "s1", drawInput({ drawId: "d2", memberId: "b", memberName: "Bob", atMs: 200 }))).toEqual({ rev: 2 });
    expect((await getResultsFor(deps, "s1", "a")).jackpot.draws.map((d) => d.drawId)).toEqual(["d2", "d1"]);

    expect(await deleteJackpotDraw(deps, "s1", "d1")).toEqual({ rev: 3 });
    expect(await deleteJackpotDraw(deps, "s1", "d1")).toEqual({ rev: 3 });
    const after = await getResultsFor(deps, "s1", "a");
    expect(after.jackpot.draws.map((d) => d.drawId)).toEqual(["d2"]);
    expect(after.jackpot.myWins).toBe(0);
  });

  it("同時に書き込んでも取りこぼさない(ロックで直列化)", async () => {
    const { deps } = setup();
    await Promise.all(Array.from({ length: 20 }, (_, i) => putJackpotDraw(deps, "s1", drawInput({ drawId: `d${i}`, atMs: i }))));
    const view = await getResultsFor(deps, "s1", "a");
    expect(view.jackpot.draws).toHaveLength(20);
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
      const broken = '{"v":1,"rev":3,"rounds":[';
      await storage.putText(resultsKey("s1"), broken, "application/json");

      await expect(putQuizResult(deps, "s1", roundInput())).rejects.toThrow();
      expect(await storage.getContentAsText(resultsKey("s1"))).toBe(broken);
    });

    it("形が違うファイル（別の版・配列でない）も同じ扱い", async () => {
      const { deps, storage } = setup();
      await storage.putText(resultsKey("s1"), JSON.stringify({ v: 2, rev: 1, rounds: [], draws: [] }), "application/json");
      await expect(putJackpotDraw(deps, "s1", drawInput())).rejects.toThrow("結果ファイルを読み込めませんでした");
      await storage.putText(resultsKey("s2"), JSON.stringify({ v: 1, rev: 1, rounds: {}, draws: [] }), "application/json");
      await expect(putJackpotDraw(deps, "s2", drawInput())).rejects.toThrow("結果ファイルを読み込めませんでした");
    });

    it("ファイルが無いだけなら、これまでどおり空から始まる", async () => {
      const { deps } = setup();
      expect((await getResultsFor(deps, "fresh", "a")).rev).toBe(0);
      expect(await putJackpotDraw(deps, "fresh", drawInput())).toEqual({ rev: 1 });
    });
  });
});
