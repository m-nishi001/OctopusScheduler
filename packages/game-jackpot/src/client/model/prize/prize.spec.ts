import { describe, expect, it } from "vitest";
import { applyPrizeEdit, createPrize } from "./prize";
import type { Prize } from "./prize";

const prize = (id: string, order: number): Prize => ({ id, name: id, order, weight: 10 });

describe("applyPrizeEdit", () => {
  it("編集した項目を反映し、id と order は変えない", () => {
    const next = applyPrizeEdit(prize("a", 3), { name: "新しい名前", weight: 50, animation: "slot" });
    expect(next).toEqual({ id: "a", order: 3, name: "新しい名前", weight: 50, animation: "slot" });
  });

  it("フォームに無い項目は残らない(編集した内容がそのまま保存される)", () => {
    const existing = { ...prize("a", 1), image: "img" };
    expect(applyPrizeEdit(existing, { name: "x" }).image).toBeUndefined();
  });

  it("元の景品は書き換えない", () => {
    const existing = prize("a", 1);
    applyPrizeEdit(existing, { name: "x" });
    expect(existing.name).toBe("a");
  });
});

describe("createPrize", () => {
  it("渡した id を持ち、order は既存の最大値 + 1", () => {
    const created = createPrize({ name: "n" }, [prize("a", 2), prize("b", 7), prize("c", 4)], "new");
    expect(created).toEqual({ id: "new", name: "n", order: 8 });
  });

  it("既存が無ければ order は 1", () => {
    expect(createPrize({ name: "n" }, [], "new").order).toBe(1);
  });
});
