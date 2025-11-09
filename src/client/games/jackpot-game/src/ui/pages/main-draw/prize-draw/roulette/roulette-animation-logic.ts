import { ref, onMounted, onUnmounted, watch } from "vue";
import type {
  RouletteItem,
  InternalRouletteItem,
} from "./roulette-image-loader";
import { convertToInternal } from "./roulette-image-loader";
import { setRouletteConfig, drawWheel } from "./roulette-drawer";
import { useRouletteAnimator, UseRouletteOptions } from "./roulette-animator";
import { useRouletteAudio } from "./roulette-audio";

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

  const { startBgm, stopBgmAudio } = useRouletteAudio();

  let currentRouletteItems: InternalRouletteItem[] = [];

  const drawCallback = (rotation: number) => {
    if (ctx && canvas.value && currentRouletteItems.length > 0) {
      drawWheel(rotation, currentRouletteItems, ctx, canvas.value);
    }
  };

  const animator = useRouletteAnimator(opts, drawCallback);

  async function updateRouletteItems(prizes: RouletteItem[]) {
    currentRouletteItems = await convertToInternal(prizes);
    setRouletteConfig(currentRouletteItems.length);
    drawCallback(0); // initial draw
  }

  const startSpin = async (
    bgmUrl?: Blob | null,
    accelDuration: number = 2,
    targetSpeed: number = 2
  ) => {
    await startBgm(bgmUrl);
    await animator.startSpin(accelDuration, targetSpeed);
  };

  const stopSpin = async (
    targetRouletteItemId: string,
    duration: number = 3
  ) => {
    if (currentRouletteItems.length === 0) {
      throw new Error("Roulette items not initialized");
    }
    const sectorAngle =
      (Math.PI * 2) / Math.max(8, currentRouletteItems.length);
    await animator.stopSpin(
      targetRouletteItemId,
      currentRouletteItems,
      sectorAngle,
      duration
    );
    await stopBgmAudio();
  };

  onMounted(async () => {
    if (!canvas.value) return;
    ctx = canvas.value.getContext("2d");
    if (!ctx) return;
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
  };
}
