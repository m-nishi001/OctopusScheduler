import { describe, expect, it } from "vitest";
import { clientInputLabel, readJackpotView, readQuizView } from "../activity";
import { sampleQuizState } from "../../__tests__/portal-test-kit";

describe("readQuizView", () => {
  it("公開されたクイズの状態を取り出す", () => {
    const view = readQuizView({ quiz: { ...sampleQuizState(), deadlineMs: 1234 } });
    expect(view).toMatchObject({ page: "play", title: "果物クイズ", roundKey: "qz1:live", deadlineMs: 1234, phase: "answering", question: "みかんはどれ?", correctNo: null });
    expect(view?.options.map((o) => o.no)).toEqual([1, 2, 3]);
    expect(view?.options[1]).toEqual({ no: 2, text: "みかん", color: "#f59e0b" });
  });

  it("クイズが無い・状態が無いときは null", () => {
    expect(readQuizView({})).toBeNull();
    expect(readQuizView(null)).toBeNull();
    expect(readQuizView(undefined)).toBeNull();
  });

  it.each([
    ["文字列", "quiz"],
    ["配列", []],
    ["pageが無い", { title: "x" }],
    ["未知のpage", { page: "finale" }],
    ["pageが文字列でない", { page: 1 }],
  ])("形が合わない状態（%s）は無いものとして扱う", (_name, value) => {
    expect(readQuizView({ quiz: value })).toBeNull();
  });

  it("欠けた項目は安全な既定値にし、形の合わない選択肢だけを捨てる", () => {
    const view = readQuizView({
      quiz: {
        page: "result",
        phase: "bogus",
        deadlineMs: "soon",
        correctNo: "2",
        roundKey: 5,
        options: [{ no: 1, text: "ok" }, { no: "2", text: "bad" }, { no: 3 }, null, "x", { no: 4, text: "もう一つ", color: 9 }],
      },
    });
    expect(view).toEqual({
      page: "result",
      title: "",
      roundKey: null,
      deadlineMs: null,
      phase: "idle",
      question: null,
      options: [
        { no: 1, text: "ok", color: "" },
        { no: 4, text: "もう一つ", color: "" },
      ],
      correctNo: null,
    });
  });
});

describe("readJackpotView", () => {
  it("当選者・賞品・段階を取り出す。まだ公開されていない当選者は null", () => {
    expect(readJackpotView({ jackpot: { page: "main-draw", phase: "member", canStop: true, member: null, prize: null } })).toEqual({ phase: "member", member: null, memberId: null, prize: null });
    expect(readJackpotView({ jackpot: { phase: "prize", member: "太郎", memberId: "m1", prize: "特賞" } })).toEqual({ phase: "prize", member: "太郎", memberId: "m1", prize: "特賞" });
  });

  it("無い・形が合わないときは null。項目の型が違えば null / 空にする", () => {
    expect(readJackpotView({})).toBeNull();
    expect(readJackpotView(null)).toBeNull();
    expect(readJackpotView({ jackpot: "x" })).toBeNull();
    expect(readJackpotView({ jackpot: [] })).toBeNull();
    expect(readJackpotView({ jackpot: { phase: 1, member: 2, prize: {} } })).toEqual({ phase: "", member: null, memberId: null, prize: null });
  });
});

describe("clientInputLabel", () => {
  it("既知の操作は表示名、未知のものはそのまま出す", () => {
    expect(clientInputLabel("jackpot.stopRoulette")).toBe("ルーレットを止める");
    expect(clientInputLabel("quiz.answer")).toBe("回答する");
    expect(clientInputLabel("custom.thing")).toBe("custom.thing");
  });
});
