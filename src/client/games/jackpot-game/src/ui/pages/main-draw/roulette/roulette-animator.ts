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
  // テスト用実装開始
  // When multiple stopSpin calls happen, keep a reference to the
  // pending stop resolver so a subsequent stopSpin can resolve the
  // previous Promise immediately (the tests expect earlier promises
  // to complete even if superseded).
  let pendingStopResolve: ((value: string | null) => void) | null = null;
  let pendingStopTargetId: string | null = null;
  // テスト用実装終了

  const spinning = ref(false);

  let animationId: number | null = null;
  let currentRotation = 0;
  let currentSpeedValue = 0;

  const raf = opts?.raf ?? globalThis.requestAnimationFrame.bind(globalThis);
  const cancelRaf =
    opts?.cancelRaf ?? globalThis.cancelAnimationFrame.bind(globalThis);
  const nowFn = opts?.now ?? (() => performance.now());

  const startSpin = async (
    accelDuration: number = 2,
    targetSpeed: number = 2
  ) => {
    spinning.value = true;
    currentSpeedValue = 0;

    const accelerationDuration = accelDuration;
    const accelerationStartTime = nowFn();
    let lastTime = accelerationStartTime;
    const animate = () => {
      const now = nowFn();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;
      const elapsed = (now - accelerationStartTime) / 1000;
      const { deltaRotation, acceleratedSpeed } = calculateAcceleratedRotation(
        elapsed,
        accelerationDuration,
        targetSpeed,
        deltaTime
      );
      currentRotation += deltaRotation;
      currentRotation %= Math.PI * 2;
      currentSpeedValue = acceleratedSpeed;
      if (drawCallback) drawCallback(currentRotation);
      animationId = raf(animate);
    };

    animationId = raf(animate);
  };

  const stopSpin = async (
    targetRouletteItemId: string,
    currentRouletteItems: InternalRouletteItem[],
    sectorAngle: number,
    duration: number = 3,
    occurrence: number = 1
  ): Promise<string | null> => {
    if (duration <= 0) {
      throw new Error("Duration must be positive");
    }

    if (occurrence <= 0) {
      throw new Error("occurrence must be >= 1");
    }

    const candidates = currentRouletteItems.filter(
      (item) =>
        item.id === targetRouletteItemId ||
        (item as any).prizeId === targetRouletteItemId
    );
    if (candidates.length === 0) {
      throw new Error("Target prize not found");
    }
    let finalPrize = candidates.at(occurrence - 1) as
      | InternalRouletteItem
      | undefined;
    // If requested occurrence doesn't exist, fallback to the last occurrence
    if (!finalPrize) {
      finalPrize = candidates[candidates.length - 1];
    }

    const targetAngle = calculateTargetRotation(finalPrize.index, sectorAngle);

    // If there's a pending stop from a previous call, resolve it now
    // because this new stop supersedes it.
    if (pendingStopResolve) {
      try {
        pendingStopResolve(pendingStopTargetId);
      } catch {}
      pendingStopResolve = null;
      pendingStopTargetId = null;
    }

    if (animationId) {
      cancelRaf(animationId);
      animationId = null;
    }

    const decelStartTime = nowFn();
    const startRotation = currentRotation;
    const initialSpeed = currentSpeedValue;
    const totalRotation = calculateTotalRotation(
      startRotation,
      targetAngle,
      initialSpeed,
      duration
    );

    // Return a Promise that resolves with the target id when this
    // deceleration completes. If another stopSpin is called while
    // this is pending, that new call will immediately resolve this
    // Promise (with its target id) and take over the animation.
    return await new Promise<string | null>((resolve) => {
      // If there's an earlier pending stop, resolve it now so it
      // doesn't hang.
      if (pendingStopResolve) {
        try {
          pendingStopResolve(pendingStopTargetId);
        } catch {}
        pendingStopResolve = null;
        pendingStopTargetId = null;
      }

      // Register this stop's resolver and target id.
      pendingStopResolve = resolve;
      pendingStopTargetId = targetRouletteItemId;

      const animate = () => {
        const elapsed = nowFn() - decelStartTime;
        const { rotation } = calculateDeceleratedRotationCalc(
          totalRotation,
          duration,
          initialSpeed,
          elapsed,
          startRotation
        );

        currentRotation = rotation;
        currentRotation %= Math.PI * 2;

        if (drawCallback) drawCallback(currentRotation);

        // Continue animation until the requested duration elapses.
        if (elapsed < duration * 1000) {
          animationId = raf(animate);
        } else {
          if (animationId) cancelRaf(animationId);
          animationId = null;

          // Resolve this stop (if still pending) and clear refs.
          if (pendingStopResolve) {
            const r = pendingStopResolve;
            pendingStopResolve = null;
            pendingStopTargetId = null;
            try {
              r(targetRouletteItemId);
            } catch {}
          }

          spinning.value = false;
        }
      };

      animationId = raf(animate);
    });
  };

  return {
    startSpin,
    stopSpin,
    spinning,
    // テスト用実装開始
    get currentSpeed() {
      return currentSpeedValue;
    },
    get currentRotation() {
      return currentRotation;
    },
    // テスト用実装終了
  };
}
