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
