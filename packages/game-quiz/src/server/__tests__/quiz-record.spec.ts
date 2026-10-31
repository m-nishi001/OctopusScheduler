import { describe, expect, it } from "vitest";
import { quizRecordHashes } from "../quiz-api-contract";

const h = (c: string) => c.repeat(32);

describe("quizRecordHashes", () => {
  it("選択肢の画像・BGM・賞品の画像と音声のハッシュを集める", () => {
    const data = [
      {
        id: "q1",
        options: [{ image: h("a") }, { image: null }],
        bgm: h("b"),
        settings: { correctBgm: h("c"), prizeImage: h("d"), prizeBgm: null },
      },
      { id: "q2", options: [], bgm: null },
    ];
    expect(quizRecordHashes(data).sort()).toEqual([h("a"), h("b"), h("c"), h("d")]);
  });

  it("配列でない・形が違う一覧でも例外にせず、何も参照していないものとして扱う", () => {
    expect(quizRecordHashes(null)).toEqual([]);
    expect(quizRecordHashes({})).toEqual([]);
    expect(quizRecordHashes([null, {}, { options: null }])).toEqual([]);
  });
});
