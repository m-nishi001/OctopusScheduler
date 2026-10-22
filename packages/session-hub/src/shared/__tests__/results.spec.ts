import { describe, expect, it } from "vitest";
import {
  RESULTS_LIMITS,
  computeCumulative,
  emptyResultsDoc,
  parseJackpotDraw,
  parseJackpotPlan,
  parseQuizRoundResult,
  personalize,
  readResultsRev,
} from "../results";
import type { JackpotDraw, QuizRoundResult, ResultsDoc } from "../results";

const round = (over: Partial<QuizRoundResult> = {}): QuizRoundResult => ({
  roundKey: "q1:live",
  quizId: "q1",
  title: "第1問",
  correctNo: 2,
  closedAtMs: 1000,
  answeredCount: 4,
  correct: [
    { memberId: "a", name: "Alice", sec: 1.2 },
    { memberId: "b", name: "Bob", sec: 2.5 },
    { memberId: null, name: "ゲスト", sec: 3 },
  ],
  wrongMemberIds: ["c"],
  ...over,
});

const draw = (over: Partial<JackpotDraw> = {}): JackpotDraw => ({
  drawId: "d1",
  memberId: "a",
  memberName: "Alice",
  prizeId: "p1",
  prizeName: "1等",
  isKakuhen: false,
  atMs: 100,
  revealedAtMs: 200,
  ...over,
});

const docWith = (over: Partial<ResultsDoc>): ResultsDoc => ({ ...emptyResultsDoc(), ...over });

describe("parseQuizRoundResult", () => {
  it("正規化する(秒数は小数1桁、answeredCount は正解+不正解の人数以上)", () => {
    const r = parseQuizRoundResult({ ...round({ answeredCount: 0 }), correct: [{ memberId: "a", name: "Alice", sec: 1.2345 }], wrongMemberIds: ["x", "y"] });
    expect(r.correct[0].sec).toBe(1.2);
    expect(r.answeredCount).toBe(3);
  });

  it("名前などは長さの上限で切り詰め、正解者の件数にも上限がある", () => {
    const long = "あ".repeat(500);
    const many = Array.from({ length: RESULTS_LIMITS.maxCorrectPerRound + 20 }, (_, i) => ({ memberId: `m${i}`, name: long, sec: i }));
    const r = parseQuizRoundResult({ ...round(), title: long, correct: many });
    expect(r.title.length).toBe(RESULTS_LIMITS.maxTitleLength);
    expect(r.correct).toHaveLength(RESULTS_LIMITS.maxCorrectPerRound);
    expect(r.correct[0].name.length).toBe(RESULTS_LIMITS.maxNameLength);
  });

  it.each([null, "x", { ...round(), correct: "no" }, { ...round(), roundKey: "" }, { ...round(), closedAtMs: "1" }])("不正な入力は拒否する %#", (bad) => {
    expect(() => parseQuizRoundResult(bad)).toThrow();
  });
});

describe("parseJackpotDraw", () => {
  it("memberId は必須(無い・空の当選は拒否する)", () => {
    expect(() => parseJackpotDraw({ ...draw(), memberId: undefined })).toThrow();
    expect(() => parseJackpotDraw({ ...draw(), memberId: null })).toThrow();
    expect(() => parseJackpotDraw({ ...draw(), memberId: "" })).toThrow();
  });
  it("revealedAtMs は受け取らない(サーバーが決める)", () => {
    expect(parseJackpotDraw(draw())).not.toHaveProperty("revealedAtMs");
  });
  it("必須項目が無ければ拒否する", () => {
    expect(() => parseJackpotDraw({ ...draw(), prizeName: "" })).toThrow();
  });
});

describe("parseJackpotPlan", () => {
  it("正規化し、createdAtMs は受け取らない", () => {
    expect(parseJackpotPlan({ kakuhenTimings: [2.7, 5], reservedPrizeIds: ["p1"], createdAtMs: 1 })).toEqual({ kakuhenTimings: [2, 5], reservedPrizeIds: ["p1"] });
  });
  it("配列でない・要素が不正なら拒否する", () => {
    expect(() => parseJackpotPlan({ kakuhenTimings: 1, reservedPrizeIds: [] })).toThrow();
    expect(() => parseJackpotPlan({ kakuhenTimings: ["a"], reservedPrizeIds: [] })).toThrow();
    expect(() => parseJackpotPlan({ kakuhenTimings: [], reservedPrizeIds: [""] })).toThrow();
    expect(() => parseJackpotPlan(null)).toThrow();
  });
});

describe("computeCumulative", () => {
  it("正解1点。同点は合計秒数の小さい順、それも同じなら名前順。メンバーID無しは対象外", () => {
    const rounds = [
      round({ roundKey: "r1", correct: [{ memberId: "a", name: "Alice", sec: 1 }, { memberId: "b", name: "Bob", sec: 2 }, { memberId: null, name: "ゲスト", sec: 0.5 }] }),
      round({ roundKey: "r2", correct: [{ memberId: "b", name: "Bob", sec: 1 }, { memberId: "a", name: "Alice", sec: 2 }, { memberId: "c", name: "Carol", sec: 1.5 }] }),
      round({ roundKey: "r3", correct: [{ memberId: "c", name: "Carol", sec: 1 }] }),
    ];
    const rows = computeCumulative(rounds);
    expect(rows.map((r) => [r.memberId, r.points, r.totalSec])).toEqual([
      ["c", 2, 2.5],
      ["a", 2, 3],
      ["b", 2, 3],
    ]);
  });

  it("点数が多い人が上に来る", () => {
    const rows = computeCumulative([
      round({ roundKey: "r1", correct: [{ memberId: "a", name: "A", sec: 5 }, { memberId: "b", name: "B", sec: 1 }] }),
      round({ roundKey: "r2", correct: [{ memberId: "a", name: "A", sec: 5 }] }),
    ]);
    expect(rows.map((r) => r.memberId)).toEqual(["a", "b"]);
  });
});

describe("personalize", () => {
  const doc = docWith({ rev: 7, rounds: [round({ roundKey: "r1", closedAtMs: 1 }), round({ roundKey: "r2", closedAtMs: 2 })], draws: [draw({ drawId: "d1", atMs: 1 }), draw({ drawId: "d2", memberId: "b", memberName: "Bob", atMs: 2 })] });

  it("新しいラウンド・当選が先頭で、rev を引き継ぐ", () => {
    const view = personalize(doc, "a");
    expect(view.rev).toBe(7);
    expect(view.quiz.rounds.map((r) => r.roundKey)).toEqual(["r2", "r1"]);
    expect(view.jackpot.draws.map((d) => d.drawId)).toEqual(["d2", "d1"]);
  });

  it("自分の順位・正誤・当選を示す", () => {
    const a = personalize(doc, "a");
    expect(a.quiz.rounds[0].me).toEqual({ answered: true, correct: true, rank: 1, sec: 1.2 });
    expect(a.quiz.rounds[0].top[0].mine).toBe(true);
    expect(a.jackpot.myWins).toBe(1);
    expect(a.jackpot.draws.find((d) => d.drawId === "d1")?.mine).toBe(true);

    const c = personalize(doc, "c");
    expect(c.quiz.rounds[0].me).toEqual({ answered: true, correct: false, rank: null, sec: null });
    expect(c.quiz.cumulative.me).toBeNull();

    const z = personalize(doc, "zzz");
    expect(z.quiz.rounds[0].me).toEqual({ answered: false, correct: false, rank: null, sec: null });
    expect(z.jackpot.myWins).toBe(0);
  });

  it("他のメンバーのIDは返さない", () => {
    const text = JSON.stringify(personalize(doc, "a"));
    expect(text).not.toMatch(/"memberId"/);
    expect(text).not.toContain('"b"');
  });

  it("順位表は上位だけ、累計は人数と自分の行を返す", () => {
    const correct = Array.from({ length: 25 }, (_, i) => ({ memberId: `m${i}`, name: `N${i}`, sec: i + 1 }));
    const view = personalize(docWith({ rounds: [round({ correct })] }), "m20");
    expect(view.quiz.rounds[0].top).toHaveLength(RESULTS_LIMITS.topN);
    expect(view.quiz.rounds[0].me.rank).toBe(21);
    expect(view.quiz.cumulative.top).toHaveLength(RESULTS_LIMITS.topN);
    expect(view.quiz.cumulative.participants).toBe(25);
    expect(view.quiz.cumulative.me?.rank).toBe(21);
  });

  it("公開済み(revealedAtMs が数値)の抽選だけを見せる。未公開の行は存在も示さない", () => {
    const mixed = docWith({
      rev: 1,
      draws: [draw({ drawId: "d1", atMs: 1 }), draw({ drawId: "d2", memberId: "b", memberName: "Bob", prizeName: "秘密の景品", atMs: 2, revealedAtMs: null })],
    });
    const view = personalize(mixed, "b");
    expect(view.jackpot.draws.map((d) => d.drawId)).toEqual(["d1"]);
    expect(view.jackpot.myWins).toBe(0);
    expect(JSON.stringify(view)).not.toContain("秘密の景品");
  });

  it("結果が空でも壊れない", () => {
    const view = personalize(emptyResultsDoc(), "a");
    expect(view.quiz.rounds).toEqual([]);
    expect(view.jackpot.draws).toEqual([]);
  });
});

describe("readResultsRev", () => {
  it("results スライスの rev を読む。形が違えば null", () => {
    expect(readResultsRev({ results: { rev: 3 } })).toBe(3);
    expect(readResultsRev({ results: { rev: -1 } })).toBeNull();
    expect(readResultsRev({ results: { rev: "3" } })).toBeNull();
    expect(readResultsRev({})).toBeNull();
    expect(readResultsRev(undefined)).toBeNull();
  });
});
