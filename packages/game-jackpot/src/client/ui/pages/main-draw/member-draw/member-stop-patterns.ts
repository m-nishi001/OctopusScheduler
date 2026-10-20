/**
 * メンバー抽選(横スクロールのスロット風)の止まり方。
 * どの止まり方も、最後は必ず当選者が中央に来る位置(finalX)に止まる。
 * トラックは左へ流れる(x が減る)ので、「手前」は finalX より右(x が大きい側)、「行き過ぎ」は左側。
 */

export type MemberStopPattern = "smooth" | "bounce" | "swing" | "nearMiss" | "creep" | "fakeout";

export interface TweenStep {
  x: number;
  duration: number;
  ease: string;
  /** 前のステップが終わってからの待ち(秒)。止まったと見せかける間。 */
  delay?: number;
}

export const MEMBER_STOP_PATTERNS: readonly MemberStopPattern[] = ["smooth", "bounce", "swing", "nearMiss", "creep", "fakeout"];

/** 出やすさ(合計100)。 */
const WEIGHTS: Record<MemberStopPattern, number> = {
  smooth: 22,
  bounce: 14,
  swing: 14,
  nearMiss: 18,
  creep: 16,
  fakeout: 16,
};

/** メンバー抽選の止まり方を、重みに応じて選ぶ。`random` はテストで固定できる。 */
export function pickMemberStopPattern(random: () => number = Math.random): MemberStopPattern {
  let r = random() * 100;
  for (const pattern of MEMBER_STOP_PATTERNS) {
    r -= WEIGHTS[pattern];
    if (r < 0) return pattern;
  }
  return "smooth";
}

/** 手前から進入するために、当選者の位置が中央より右に何マス必要か(マス = 隣との間隔)。0 は近い位置で足りる。 */
const LEAD_SLOTS: Record<MemberStopPattern, number> = {
  smooth: 0,
  bounce: 0,
  swing: 0,
  nearMiss: 1.5,
  creep: 3,
  fakeout: 2.5,
};

/** 当選者の位置が、中央よりこれだけ右にあれば、この止まり方ができる(px)。 */
export function requiredLeadPx(pattern: MemberStopPattern, pitch: number): number {
  return LEAD_SLOTS[pattern] * pitch;
}

/** 止まり方を、gsap のタイムラインに積むステップ列にする。pitch は隣のメンバーとの間隔(px)。 */
export function buildMemberStopSteps(pattern: MemberStopPattern, finalX: number, pitch: number): TweenStep[] {
  switch (pattern) {
    case "bounce":
      return [
        { x: finalX - 150, duration: 1.0, ease: "power2.out" },
        { x: finalX + 60, duration: 1.0, ease: "power1.inOut", delay: 0.2 },
        { x: finalX, duration: 1.0, ease: "bounce.out" },
      ];
    case "swing":
      return [
        { x: finalX - 90, duration: 1.0, ease: "power2.out" },
        { x: finalX + 90, duration: 1.0, ease: "power1.inOut" },
        { x: finalX, duration: 1.5, ease: "elastic.out(1, 0.3)" },
      ];
    case "nearMiss":
      // 当選の1つ手前で止まったように見せて、間を置いてから1マス進む
      return [
        { x: finalX + pitch, duration: 2.0, ease: "power3.out" },
        { x: finalX, duration: 0.7, ease: "power2.inOut", delay: 0.9 },
      ];
    case "creep":
      // 手前でほぼ止まり、じわじわと当選に近づく
      return [
        { x: finalX + pitch * 2.5, duration: 1.4, ease: "power3.out" },
        { x: finalX, duration: 2.6, ease: "sine.out" },
      ];
    case "fakeout":
      // 止まったと見せかけて動き出し、当選を行き過ぎてから戻る
      return [
        { x: finalX + pitch * 2, duration: 1.5, ease: "power3.out" },
        { x: finalX - pitch * 0.8, duration: 0.9, ease: "power2.inOut", delay: 0.5 },
        { x: finalX, duration: 0.8, ease: "back.out(2)" },
      ];
    default:
      return [{ x: finalX, duration: 3.0, ease: "power2.out" }];
  }
}
