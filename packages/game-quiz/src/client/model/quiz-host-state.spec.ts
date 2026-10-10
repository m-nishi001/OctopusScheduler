import { describe, expect, it } from "vitest";
import { buildQuizHostState, roundKeyFor } from "./quiz-host-state";

const OPTIONS = [
  { no: 1, text: "りんご", color: "#f00" },
  { no: 2, text: "みかん", color: "#fa0" },
];

describe("roundKeyFor", () => {
  it("同じクイズ・同じ区分なら同じキー(ホストのリロードで受付が続きになる)。本番とデモは別", () => {
    expect(roundKeyFor("q1", "live")).toBe("q1:live");
    expect(roundKeyFor("q1", "live")).toBe(roundKeyFor("q1", "live"));
    expect(roundKeyFor("q1", "demo")).not.toBe(roundKeyFor("q1", "live"));
  });

  it("セッション基盤のキー形式(英数と : _ - のみ、80文字以内)に収める", () => {
    const key = roundKeyFor("日本語 id/with*chars" + "x".repeat(200), "live");
    expect(key).toMatch(/^[A-Za-z0-9:_-]{1,80}$/);
  });
});

describe("buildQuizHostState", () => {
  it("出題画面でだけ問題文と選択肢を含み、正解は含めない(参加者に先に答えを渡さない)", () => {
    const s = buildQuizHostState({ page: "play", quizId: "q1", title: "T", question: "Q?", options: OPTIONS, correctNo: 2, phase: "answering", deadlineMs: 9, roundKey: "q1:live" });
    expect(s.question).toBe("Q?");
    expect(s.options).toHaveLength(2);
    expect(s.correctNo).toBeNull();
    expect(s.deadlineMs).toBe(9);
    expect(JSON.stringify(s)).not.toContain('"correctNo":2');
  });

  it("正解発表(answer)で正解番号が入り、結果(result)でも保たれる。イントロ/QRでは入らない", () => {
    const base = { quizId: "q1", question: "Q?", options: OPTIONS, correctNo: 2 };
    expect(buildQuizHostState({ ...base, page: "answer" }).correctNo).toBe(2);
    expect(buildQuizHostState({ ...base, page: "result" }).correctNo).toBe(2);
    expect(buildQuizHostState({ ...base, page: "intro" }).correctNo).toBeNull();
    expect(buildQuizHostState({ ...base, page: "qr" }).correctNo).toBeNull();
  });

  it("問題文・選択肢は intro/qr/result では含めない", () => {
    for (const page of ["intro", "qr", "result"] as const) {
      const s = buildQuizHostState({ page, quizId: "q1", question: "Q?", options: OPTIONS });
      expect(s.question).toBeNull();
      expect(s.options).toEqual([]);
    }
  });

  it("締切は受付中(answering)のときだけ入る", () => {
    expect(buildQuizHostState({ page: "play", quizId: "q", phase: "closed", deadlineMs: 5 }).deadlineMs).toBeNull();
    expect(buildQuizHostState({ page: "play", quizId: "q", phase: "idle", deadlineMs: 5 }).deadlineMs).toBeNull();
    expect(buildQuizHostState({ page: "play", quizId: "q", phase: "answering", deadlineMs: 5 }).deadlineMs).toBe(5);
  });

  it("長い文字列は切り詰め、RoomState の上限(6KB)に十分収まる", () => {
    const longOptions = Array.from({ length: 8 }, (_, i) => ({ no: i + 1, text: "あ".repeat(500), color: "#fff" }));
    const s = buildQuizHostState({ page: "play", quizId: "q1", title: "題".repeat(500), question: "問".repeat(2000), options: longOptions });
    expect(s.title.length).toBeLessThanOrEqual(100);
    expect(s.question!.length).toBeLessThanOrEqual(300);
    expect(s.options.every((o) => o.text.length <= 100)).toBe(true);
    // 日本語は1文字3バイト。UTF-8 のサイズで6000バイトを大きく下回る
    expect(new TextEncoder().encode(JSON.stringify(s)).length).toBeLessThan(5000);
  });

  it("未指定の値は安全な既定値になる", () => {
    const s = buildQuizHostState({ page: "play", quizId: "q1" });
    expect(s).toMatchObject({ title: "", roundKey: null, deadlineMs: null, phase: "idle", question: null, options: [], correctNo: null });
  });
});
