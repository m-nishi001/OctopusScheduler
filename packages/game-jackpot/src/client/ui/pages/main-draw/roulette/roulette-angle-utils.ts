export function calculateSectorAngle(sectorsCount: number): number {
  const sectors = Math.max(8, sectorsCount);
  return (Math.PI * 2) / sectors;
}

export function calculateTargetRotation(
  finalPrizeIndex: number,
  sectorAngle: number
): number {
  const sectorCenter = sectorAngle / 2;
  const randomOffset = (Math.random() - 0.5) * sectorCenter;
  const offset = sectorCenter + randomOffset;
  const prizeAngle = finalPrizeIndex * sectorAngle;
  const adjustedAngle = prizeAngle + offset;
  return adjustedAngle + Math.PI / 2;
}

export function calculateTotalRotation(
  startRotation: number,
  targetAngle: number,
  initialSpeed: number,
  duration: number
): number {
  const delta =
    (((targetAngle - startRotation) % (Math.PI * 2)) + Math.PI * 2) %
    (Math.PI * 2);
  const calculatedMinRotations = Math.max(
    3,
    Math.floor((initialSpeed * duration) / (Math.PI * 2))
  );
  return startRotation + delta + Math.PI * 2 * calculatedMinRotations;
}

export function calculateAcceleratedRotation(
  elapsed: number,
  accelerationDuration: number,
  targetSpeed: number,
  deltaTime: number
): { deltaRotation: number; acceleratedSpeed: number } {
  const remainingTime = accelerationDuration - elapsed;
  const acceleratedSpeed =
    remainingTime > 0
      ? (targetSpeed / accelerationDuration) * elapsed
      : targetSpeed;
  const fluctuation = Math.sin(elapsed * 0.01) * 0.02;
  const deltaRotation = acceleratedSpeed * deltaTime + fluctuation * deltaTime;
  return { deltaRotation, acceleratedSpeed };
}

export function calculateDeceleratedRotationCalc(
  totalRotation: number,
  duration: number,
  initialSpeed: number,
  elapsed: number,
  startRotation: number
): { rotation: number; speed: number } {
  const progress = Math.min(elapsed / (duration * 1000), 1);
  const easeProgress = 1 - Math.pow(1 - progress, 3);
  const rotation =
    startRotation + (totalRotation - startRotation) * easeProgress;
  const speed = initialSpeed * (1 - easeProgress);
  return { rotation, speed };
}

/**
 * ルーレットの止まり方。どれも最終的には同じ当選(targetAngle)に止まり、減速の軌道だけが違う。
 *   normal   : ふつうに減速して止まる
 *   overshoot: 当選を通り過ぎて、少し戻って止まる
 *   creep    : 手前でほぼ止まり、じわじわ進んで当選に入る
 *   fakeout  : 止まったと見せかけて、もう一度回り出して止まる
 *   nearMiss : 当選の隣で止まったと見せかけて、1マス進んで止まる
 */
export type StopPattern = "normal" | "overshoot" | "creep" | "fakeout" | "nearMiss";

export const STOP_PATTERNS: readonly StopPattern[] = ["normal", "overshoot", "creep", "fakeout", "nearMiss"];

/** 演出が長くなる分、減速にかける時間を伸ばす倍率。 */
export const STOP_PATTERN_DURATION_FACTOR: Record<StopPattern, number> = {
  normal: 1,
  overshoot: 1.25,
  creep: 1.6,
  fakeout: 1.7,
  nearMiss: 1.5,
};

/** 出やすさ(合計100)。ふつうの止まり方も残して、意地悪な止まり方を「たまに」出す。 */
const STOP_PATTERN_WEIGHTS: Record<StopPattern, number> = {
  normal: 34,
  overshoot: 18,
  creep: 16,
  fakeout: 16,
  nearMiss: 16,
};

/** 乱数(0以上1未満)から止まり方を選ぶ。 */
export function pickStopPattern(random: () => number = Math.random): StopPattern {
  let r = random() * 100;
  for (const pattern of STOP_PATTERNS) {
    r -= STOP_PATTERN_WEIGHTS[pattern];
    if (r < 0) return pattern;
  }
  return "normal";
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * 減速中の回転角。progress(0〜1)が 1 のとき、必ず totalRotation(当選の角度)になる。
 * overshoot の戻り以外では、回転の向きは逆行しない。
 */
export function calculatePatternRotation(
  pattern: StopPattern,
  totalRotation: number,
  startRotation: number,
  progress: number,
  sectorAngle: number
): number {
  const p = clamp01(progress);
  const span = totalRotation - startRotation;
  switch (pattern) {
    case "overshoot": {
      const over = sectorAngle * 0.9;
      if (p <= 0.7) return startRotation + (span + over) * easeOutCubic(p / 0.7);
      return totalRotation + over * (1 - easeInOut((p - 0.7) / 0.3));
    }
    case "creep": {
      const crawl = sectorAngle * 2.5;
      if (p <= 0.5) return startRotation + (span - crawl) * easeOutCubic(p / 0.5);
      return totalRotation - crawl + crawl * easeOutSine((p - 0.5) / 0.5);
    }
    case "fakeout": {
      const again = Math.PI * 2 * 0.75;
      if (p <= 0.45) return startRotation + (span - again) * easeOutCubic(p / 0.45);
      if (p <= 0.6) return totalRotation - again;
      return totalRotation - again + again * easeInOut((p - 0.6) / 0.4);
    }
    case "nearMiss": {
      if (p <= 0.6) return startRotation + (span - sectorAngle) * easeOutCubic(p / 0.6);
      if (p <= 0.8) return totalRotation - sectorAngle;
      return totalRotation - sectorAngle + sectorAngle * easeInOut((p - 0.8) / 0.2);
    }
    default:
      return startRotation + span * easeOutCubic(p);
  }
}
