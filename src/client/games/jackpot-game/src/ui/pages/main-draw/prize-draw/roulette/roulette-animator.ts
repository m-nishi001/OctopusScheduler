import { ref } from "vue";
import { InternalRouletteItem } from "./roulette-image-loader";
import {
  calculateTargetRotation,
  calculateTotalRotation,
  calculateAcceleratedRotation,
  calculateDeceleratedRotationCalc,
} from "./roulette-angle-utils";

export type UseRouletteOptions = {
  raf?: (cb: FrameRequestCallback) => number;
  cancelRaf?: (id: number) => void;
  now?: () => number;
  emitDelayMs?: number;
  initialPrizes?: InternalRouletteItem[];
};

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
  ): Promise<string | null> => {
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
    return targetRouletteItemId;
  };

  return {
    startSpin,
    stopSpin,
    spinning,
  };
}
