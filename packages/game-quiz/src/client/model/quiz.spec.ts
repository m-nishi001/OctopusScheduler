import { describe, it, expect } from "vitest";
import { addOption, normalizeCorrectNo, nextOptionNo, removeOption, setCorrect } from "./quiz";

function opt(no: number, text = `選択肢${no}`) {
  return { no, text, color: "red", image: null as Blob | null };
}

function quiz(nos: number[], correctNo: number) {
  return { options: nos.map((n) => opt(n)), correctNo };
}

describe("addOption", () => {
  it("no は最大値 + 1 で、正解は変わらない", () => {
    const result = addOption(quiz([1, 2, 3], 3), { text: "新", color: "blue", image: null });
    expect(result.options.map((o) => o.no)).toEqual([1, 2, 3, 4]);
    expect(result.options[3].text).toBe("新");
    expect(result.correctNo).toBe(3);
  });

  it("元のクイズを変更しない", () => {
    const original = quiz([1, 2], 2);
    addOption(original, { text: "新", color: "red", image: null });
    expect(original.options).toHaveLength(2);
  });

  it("選択肢が空なら no は 1", () => {
    expect(nextOptionNo([])).toBe(1);
  });
});

describe("removeOption", () => {
  it("正解以外を消しても正解は変わらない", () => {
    const result = removeOption(quiz([1, 2, 3], 3), 1);
    expect(result.options.map((o) => o.no)).toEqual([2, 3]);
    expect(result.correctNo).toBe(3);
  });

  it("正解を消したときだけ先頭の選択肢の no に移す", () => {
    const result = removeOption(quiz([1, 2, 3], 2), 2);
    expect(result.options.map((o) => o.no)).toEqual([1, 3]);
    expect(result.correctNo).toBe(1);
    expect(removeOption(quiz([1, 2, 3], 1), 1).correctNo).toBe(2);
  });

  it("削除後に追加すると no は最大値 + 1(欠番を再利用しない)で、正解は保たれる", () => {
    const removed = removeOption(quiz([1, 2, 3], 3), 2);
    const added = addOption(removed, { text: "新", color: "red", image: null });
    expect(added.options.map((o) => o.no)).toEqual([1, 3, 4]);
    expect(added.correctNo).toBe(3);
  });

  it("全部消すと正解は 1 に戻る", () => {
    expect(removeOption(quiz([5], 5), 5).correctNo).toBe(1);
  });
});

describe("setCorrect", () => {
  it("存在する no を正解にする", () => {
    expect(setCorrect(quiz([1, 3], 1), 3).correctNo).toBe(3);
  });

  it("存在しない no は無視する", () => {
    expect(setCorrect(quiz([1, 3], 1), 2).correctNo).toBe(1);
  });
});

describe("normalizeCorrectNo", () => {
  it("存在する no ならそのまま", () => {
    expect(normalizeCorrectNo(quiz([1, 3], 3)).correctNo).toBe(3);
  });

  it("文字列で来た数値を数値にする", () => {
    expect(normalizeCorrectNo({ options: [opt(1), opt(2)], correctNo: "2" as unknown as number }).correctNo).toBe(2);
  });

  it("存在しない no や未設定は先頭の no にする", () => {
    expect(normalizeCorrectNo(quiz([2, 3], 1)).correctNo).toBe(2);
    expect(normalizeCorrectNo({ options: [opt(2)] }).correctNo).toBe(2);
  });

  it("選択肢が空なら 1", () => {
    expect(normalizeCorrectNo({ options: [], correctNo: 4 }).correctNo).toBe(1);
  });
});
