import { ref } from "vue";
import { InternalRouletteItem } from "./roulette-image-loader";

export type UseRouletteOptions = {
  raf?: (cb: FrameRequestCallback) => number;
  cancelRaf?: (id: number) => void;
  now?: () => number;
  emitDelayMs?: number;
  initialPrizes?: InternalRouletteItem[];
};

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
  targetSpeed: number
): { deltaRotation: number; acceleratedSpeed: number } {
  const remainingTime = accelerationDuration - elapsed;
  const acceleratedSpeed =
    remainingTime > 0
      ? (targetSpeed / accelerationDuration) * elapsed
      : targetSpeed;
  const fluctuation = Math.sin(elapsed * 0.01) * 0.02;
  const deltaRotation = acceleratedSpeed + fluctuation;
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

export function useRouletteAnimator(
  opts?: UseRouletteOptions,
  drawCallback?: (rotation: number) => void
) {
  let animationId: number | null = null;
  let currentRotation = 0;
  const spinning = ref(false);
  let currentSpeed = 0;

  const raf = opts?.raf ?? globalThis.requestAnimationFrame.bind(globalThis);
  const cancelRaf =
    opts?.cancelRaf ?? globalThis.cancelAnimationFrame.bind(globalThis);
  const nowFn = opts?.now ?? (() => performance.now());

  const startSpin = async (
    accelDuration: number = 2,
    targetSpeed: number = 2
  ) => {
    spinning.value = true;
    currentSpeed = 0;

    const accelerationDuration = accelDuration;
    const accelerationStartTime = nowFn();
    const animate = () => {
      const now = nowFn();
      const elapsed = (now - accelerationStartTime) / 1000;
      const { deltaRotation, acceleratedSpeed } = calculateAcceleratedRotation(
        elapsed,
        accelerationDuration,
        targetSpeed
      );
      currentRotation += deltaRotation;
      currentRotation %= Math.PI * 2;
      currentSpeed = acceleratedSpeed;
      if (drawCallback) drawCallback(currentRotation);
      animationId = raf(animate);
    };

    animationId = raf(animate);
  };

  const stopSpin = async (
    targetRouletteItemId: string,
    currentRouletteItems: InternalRouletteItem[],
    sectorAngle: number,
    duration: number = 3
  ) => {
    const finalPrize = currentRouletteItems.find(
      (p) => p.id === targetRouletteItemId
    );

    if (!finalPrize) {
      throw new Error("Target prize not found");
    }

    const targetAngle = calculateTargetRotation(finalPrize.index, sectorAngle);

    if (animationId) {
      cancelRaf(animationId);
      animationId = null;
    }

    const decelStartTime = nowFn();
    const startRotation = currentRotation;
    const initialSpeed = currentSpeed;
    const totalRotation = calculateTotalRotation(
      startRotation,
      targetAngle,
      initialSpeed,
      duration
    );

    await new Promise<void>((resolve) => {
      const animate = () => {
        const elapsed = nowFn() - decelStartTime;
        const { rotation, speed } = calculateDeceleratedRotationCalc(
          totalRotation,
          duration,
          initialSpeed,
          elapsed,
          startRotation
        );

        currentRotation = rotation;
        currentRotation %= Math.PI * 2;

        if (drawCallback) drawCallback(currentRotation);

        if (Math.round(speed) > 0) {
          animationId = raf(animate);
        } else {
          cancelRaf(animationId!);
          animationId = null;
          resolve();
        }
      };
      animationId = raf(animate);
    });

    spinning.value = false;
  };

  return {
    startSpin,
    stopSpin,
    spinning,
  };
}
