import { describe, expect, it } from "vitest";
import { quizMediaNames, quizRecordHashes } from "../quiz-api-contract";
import type { QuizRecordEntry } from "../quiz-api-contract";

const h = (c: string) => c.repeat(32);
const info = (c: string) => ({ hash: h(c), mime: "image/png", size: 1 });

describe("quizRecordHashes", () => {
  it("索引(media)のハッシュを集める。同じ素材を複数のクイズが使っても索引は1つ", () => {
    const data = { quizzes: [{ id: "q1" }, { id: "q2" }], media: { "a.png": info("a"), "bgm.wav": info("b") } };
    expect(quizRecordHashes(data).sort()).toEqual([h("a"), h("b")]);
  });

  it("形が違う一覧でも例外にせず、何も参照していないものとして扱う", () => {
    expect(quizRecordHashes(null)).toEqual([]);
    expect(quizRecordHashes({})).toEqual([]);
    expect(quizRecordHashes([{ id: "old", bgm: h("a") }])).toEqual([]);
    expect(quizRecordHashes({ media: { "a.png": null, "b.png": {} } })).toEqual([]);
  });
});

describe("quizMediaNames", () => {
  it("選択肢の画像・BGM・景品の画像と音声の名前を、重複なしで集める", () => {
    const entry: QuizRecordEntry = {
      id: "q",
      title: "t",
      question: "q",
      options: [
        { no: 1, text: "a", color: "red", image: "a.png" },
        { no: 2, text: "b", color: "red", image: "a.png" },
        { no: 3, text: "c", color: "red", image: null },
      ],
      correctNo: 1,
      timeLimit: 30,
      bgm: "bgm.wav",
      settings: { correctBgm: "bgm.wav", prizeImage: "p.png", prizeName: "", prizeBgm: null },
    };
    expect(quizMediaNames(entry).sort()).toEqual(["a.png", "bgm.wav", "p.png"]);
  });
});
