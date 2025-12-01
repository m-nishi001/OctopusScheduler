import { ref, onMounted, onUnmounted, watch } from "vue";
import type {
  RouletteItem,
  InternalRouletteItem,
} from "./roulette-image-loader";
import { convertToInternal } from "./roulette-image-loader";
import { drawWheel } from "./roulette-drawer";
import { useRouletteAnimator, UseRouletteOptions } from "./roulette-animator";
import { useRouletteAudio } from "./roulette-audio";
import { calculateSectorAngle } from "./roulette-angle-utils";

export type { RouletteItem } from "./roulette-image-loader";

export interface RouletteAnimationProps {
  prizes: RouletteItem[];
  selectedPrize?: RouletteItem | null;
  showResult?: boolean;
}

export function useRouletteAnimation(
  props: RouletteAnimationProps,
  opts?: UseRouletteOptions
) {
  const canvas = ref<HTMLCanvasElement | null>(null);
  let ctx: CanvasRenderingContext2D | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const {
    startBgm,
    stopBgmAudio,
    bgmAutoplayBlocked,
    tryResumeBgm,
    isBgmPlaying,
    currentBgmSrc,
  } = useRouletteAudio();

  let currentRouletteItems: InternalRouletteItem[] = [];

  const resizeCanvas = () => {
    if (!canvas.value || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.value.getBoundingClientRect();
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;
    canvas.value.width = Math.round(logicalWidth * dpr);
    canvas.value.height = Math.round(logicalHeight * dpr);
    try {
      if (typeof (ctx as any).setTransform === "function") {
        (ctx as any).setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    } catch (e) {
      // swallow for test environments where ctx implementations are partial
    }
  };

  const drawCallback = (rotation: number) => {
    if (ctx && canvas.value && currentRouletteItems.length > 0) {
      drawWheel(rotation, currentRouletteItems, ctx, canvas.value);
    }
  };

  const animator = useRouletteAnimator(opts, drawCallback);

  async function updateRouletteItems(
    prizes: RouletteItem[]
  ): Promise<InternalRouletteItem[]> {
    currentRouletteItems = await convertToInternal(prizes);
    drawCallback(0); // initial draw
    return currentRouletteItems;
  }

  const startSpin = async (
    bgmUrl?: Blob | null,
    accelDuration: number = 1,
    targetSpeed: number = 16
  ) => {
    try {
      // If autoplay was previously blocked, try to resume playback on user gesture
      try {
        if (
          (bgmAutoplayBlocked as any)?.value &&
          typeof tryResumeBgm === "function"
        ) {
          await tryResumeBgm();
        }
      } catch {}
      await startBgm(bgmUrl);
      console.log(
        "[RouletteAnimation] startSpin: bgm loaded",
        bgmUrl ? { size: bgmUrl.size, type: bgmUrl.type } : null
      );
      try {
        console.log(
          "[RouletteAnimation] startSpin: audio state after startBgm => isPlaying:",
          (isBgmPlaying as any).value,
          "currentSrc:",
          (currentBgmSrc as any).value,
          "autoplayBlocked:",
          (bgmAutoplayBlocked as any).value
        );
      } catch (e) {
        /* noop */
      }
    } catch (e) {
      console.warn("[RouletteAnimation] startSpin: failed to load bgm", e);
      // rethrow to preserve original behavior where startSpin rejects when startBgm fails
      throw e;
    }
    await animator.startSpin(accelDuration, targetSpeed);
  };

  const stopSpin = async (
    durationSec?: number,
    targetPrizeId?: string | null,
    occurrence: number = 1
  ): Promise<string | null> => {
    const targetId = targetPrizeId || null;
    if (!targetId) {
      throw new Error("Target prize not specified");
    }
    if (currentRouletteItems.length === 0) {
      throw new Error("Roulette items not initialized");
    }
    try {
      console.log("[RouletteAnimation] stopSpin requested", {
        targetId,
        occurrence,
        durationSec,
      });
      console.log(
        "[RouletteAnimation] currentRouletteItems:",
        currentRouletteItems.map((it) => ({
          id: it.id,
          prizeId: it.prizeId,
          index: it.index,
          idType: typeof it.id,
          prizeIdType: typeof it.prizeId,
        }))
      );
    } catch (e) {
      console.warn("[RouletteAnimation] failed to log currentRouletteItems", e);
    }
    const sectorAngle = calculateSectorAngle(currentRouletteItems.length);
    const result = await animator.stopSpin(
      targetId,
      currentRouletteItems,
      sectorAngle,
      durationSec || 3,
      occurrence
    );

    console.log("Stopping BGM audio");

    await stopBgmAudio();
    return result;
  };

  onMounted(async () => {
    if (!canvas.value) return;
    ctx = canvas.value.getContext("2d");
    if (!ctx) return;
    resizeCanvas();
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      drawCallback(0); // redraw on resize
    });
    resizeObserver.observe(canvas.value);
    const initialPrizes = (opts && opts.initialPrizes) ?? props.prizes;
    await updateRouletteItems(initialPrizes);
  });

  watch(
    () => props.prizes,
    async (newPrizes) => {
      if (newPrizes.length === 0) return;
      await updateRouletteItems(newPrizes);
    },
    { immediate: false }
  );

  onUnmounted(async () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    try {
      await stopBgmAudio();
    } catch {}
  });

  return {
    canvas,
    startSpin,
    stopSpin,
    spinning: animator.spinning,
    updatePrizes: updateRouletteItems,
    getInternalItems: () => currentRouletteItems.slice(),
    // expose autoplay control so the consumer can act on user gesture
    bgmAutoplayBlocked,
    tryResumeBgm,
  };
}
