import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fromDatetimeLocal, toDatetimeLocal } from "@octopus/client-common/date-utils/date-utils";

/**
 * 日本(UTC+9)で、予定の日時が保存のたびに 9 時間ずれていた不具合の回帰テスト。
 * タイムゾーンが UTC の環境(CI)だと不具合が見えないので、テストの間だけ日本時間に固定する。
 */
describe("datetime-local の変換(日本時間)", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Asia/Tokyo";
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("入力欄には、端末のローカル時刻(UTC ではない)を渡す", () => {
    const utcMidnight = new Date("2026-10-20T00:30:00.000Z"); // 日本では 09:30
    expect(toDatetimeLocal(utcMidnight)).toBe("2026-10-20T09:30");
  });

  it("入力欄の値は、ローカル時刻として読む", () => {
    expect(fromDatetimeLocal("2026-10-20T09:30").toISOString()).toBe("2026-10-20T00:30:00.000Z");
  });

  it("開いて保存し直しても、日時が動かない(何度繰り返しても同じ)", () => {
    const start = new Date("2026-10-20T00:30:00.000Z");
    let current = start;
    for (let i = 0; i < 3; i++) current = fromDatetimeLocal(toDatetimeLocal(current));
    expect(current.toISOString()).toBe(start.toISOString());
  });

  it("月・日・時・分が 1 桁でも 0 埋めされる", () => {
    expect(toDatetimeLocal(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02T03:04");
  });
});
