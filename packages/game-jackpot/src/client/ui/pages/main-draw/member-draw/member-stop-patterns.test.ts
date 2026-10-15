import { describe, expect, it } from "vitest";
import { MEMBER_STOP_PATTERNS, buildMemberStopSteps, pickMemberStopPattern, requiredLeadPx } from "./member-stop-patterns";

const PITCH = 180;

describe("メンバー抽選の止まり方", () => {
  it("どの止まり方も、最後のステップは必ず当選者が中央に来る位置(finalX)", () => {
    for (const pattern of MEMBER_STOP_PATTERNS) {
      for (const finalX of [-5400, -123.5, 0, 800]) {
        const steps = buildMemberStopSteps(pattern, finalX, PITCH);
        expect(steps.length, pattern).toBeGreaterThan(0);
        expect(steps[steps.length - 1].x, pattern).toBe(finalX);
      }
    }
  });

  it("ステップの時間は正で、全体が長すぎない(10秒以内)。待ちは0以上", () => {
    for (const pattern of MEMBER_STOP_PATTERNS) {
      const steps = buildMemberStopSteps(pattern, -1000, PITCH);
      let total = 0;
      for (const s of steps) {
        expect(s.duration, pattern).toBeGreaterThan(0);
        expect(s.delay ?? 0, pattern).toBeGreaterThanOrEqual(0);
        total += s.duration + (s.delay ?? 0);
      }
      expect(total, pattern).toBeLessThanOrEqual(10);
    }
  });

  it("手前から進入する止まり方(nearMiss / creep)は、左へ流れる向きのまま(逆走しない)で当選に着く", () => {
    for (const pattern of ["nearMiss", "creep"] as const) {
      const finalX = -2000;
      // 当選者が中央より、必要なぶんだけ右にある = 開始位置は finalX + lead
      let x = finalX + requiredLeadPx(pattern, PITCH);
      for (const s of buildMemberStopSteps(pattern, finalX, PITCH)) {
        expect(s.x, `${pattern}: 逆走`).toBeLessThanOrEqual(x);
        x = s.x;
      }
      expect(x).toBe(finalX);
    }
  });

  it("fakeout は、手前で止まったあとに当選を行き過ぎてから戻って、当選に着く", () => {
    const finalX = -2000;
    const steps = buildMemberStopSteps("fakeout", finalX, PITCH);
    expect(steps[0].x).toBeGreaterThan(finalX); // まず手前
    expect(steps[1].x).toBeLessThan(finalX); // 行き過ぎ
    expect(steps[1].delay).toBeGreaterThan(0); // 止まったと見せかける間
    expect(steps[steps.length - 1].x).toBe(finalX);
    // 進入の開始位置(finalX + lead)から、最初の手前の位置までは左へ進む
    expect(steps[0].x).toBeLessThanOrEqual(finalX + requiredLeadPx("fakeout", PITCH));
  });

  it("必要な余白(右にあるべき距離)は、使う手前の位置より大きい", () => {
    for (const pattern of ["nearMiss", "creep", "fakeout"] as const) {
      const finalX = 0;
      const firstPre = buildMemberStopSteps(pattern, finalX, PITCH)[0].x;
      expect(requiredLeadPx(pattern, PITCH), pattern).toBeGreaterThan(firstPre);
    }
    expect(requiredLeadPx("smooth", PITCH)).toBe(0);
  });

  it("乱数で選ぶと、全種類が出る。端の値でも壊れない", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(pickMemberStopPattern(() => i / 1000));
    expect([...seen].sort()).toEqual([...MEMBER_STOP_PATTERNS].sort());
    expect(MEMBER_STOP_PATTERNS).toContain(pickMemberStopPattern(() => 0));
    expect(MEMBER_STOP_PATTERNS).toContain(pickMemberStopPattern(() => 0.999999));
  });

  it("ふつうの止まり方も、一定の割合で出る(意地悪ばかりにならない)", () => {
    let smooth = 0;
    for (let i = 0; i < 1000; i++) if (pickMemberStopPattern(() => i / 1000) === "smooth") smooth++;
    expect(smooth).toBeGreaterThanOrEqual(150);
    expect(smooth).toBeLessThanOrEqual(400);
  });
});
