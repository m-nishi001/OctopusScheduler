import { ref, computed } from "vue";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import type { RouletteItem } from "./roulette/roulette-image-loader";
import {
  prepareRenderPrizes,
  revokePreparedPrizes,
  type AssetService,
} from "./roulette/roulette-prize-preparer";

export interface PrizeDrawState {
  prizes: PrizeDto[];
  selectedPrize: PrizeDto | null;
  showResult: boolean;
  preparedPrizes: RouletteItem[];
  canStop: boolean;
}

export function usePrizeDrawState(
  initialPrizes: PrizeDto[] = [],
  initialSelectedPrize: PrizeDto | null = null,
  initialShowResult: boolean = false,
  assetService: AssetService
) {
  const prizes = ref<PrizeDto[]>(initialPrizes);
  const selectedPrize = ref<PrizeDto | null>(initialSelectedPrize);
  const showResult = ref<boolean>(initialShowResult);
  const preparedPrizes = ref<RouletteItem[]>([]);
  const canStop = ref(false);

  const preparePrizes = async (newPrizes: PrizeDto[]) => {
    const newPrepared = await prepareRenderPrizes(newPrizes, assetService);
    revokePreparedPrizes(preparedPrizes.value);
    preparedPrizes.value = newPrepared;
    return newPrepared;
  };

  const updatePrizes = async (newPrizes: PrizeDto[]) => {
    prizes.value = newPrizes;
    await preparePrizes(newPrizes);
  };

  const updateSelectedPrize = (newSelected: PrizeDto | null) => {
    selectedPrize.value = newSelected;
  };

  const updateShowResult = (newShow: boolean) => {
    showResult.value = newShow;
  };

  const setCanStop = (value: boolean) => {
    canStop.value = value;
  };

  return {
    prizes: computed(() => prizes.value),
    selectedPrize: computed(() => selectedPrize.value),
    showResult: computed(() => showResult.value),
    preparedPrizes: computed(() => preparedPrizes.value),
    canStop: computed(() => canStop.value),
    updatePrizes,
    preparePrizes,
    updateSelectedPrize,
    updateShowResult,
    setCanStop,
  };
}

export interface RouletteAnimationState {
  prizes: PrizeDto[];
  selectedPrize: PrizeDto;
  showResult: boolean;
  preparedPrizes: RouletteItem[];
  canStop: boolean;
}

export function useRouletteAnimationState(
  initialPrizes: PrizeDto[],
  initialSelectedPrize: PrizeDto,
  initialShowResult: boolean,
  assetService: AssetService
) {
  const prizes = ref<PrizeDto[]>(initialPrizes);
  const selectedPrize = ref<PrizeDto>(initialSelectedPrize);
  const showResult = ref<boolean>(initialShowResult);
  const preparedPrizes = ref<RouletteItem[]>([]);
  const canStop = ref(false);

  const updatePrizes = async (newPrizes: PrizeDto[]) => {
    prizes.value = newPrizes;
    const newPrepared = await prepareRenderPrizes(prizes.value, assetService);
    revokePreparedPrizes(preparedPrizes.value);
    preparedPrizes.value = newPrepared;
    return newPrepared;
  };

  const preparePrizes = async (newPrizes: PrizeDto[]) => {
    const newPrepared = await prepareRenderPrizes(newPrizes, assetService);
    revokePreparedPrizes(preparedPrizes.value);
    preparedPrizes.value = newPrepared;
    return newPrepared;
  };

  const updateSelectedPrize = (newSelected: PrizeDto) => {
    selectedPrize.value = newSelected;
  };

  const updateShowResult = (newShow: boolean) => {
    showResult.value = newShow;
  };

  const setCanStop = (value: boolean) => {
    canStop.value = value;
  };

  return {
    prizes: computed(() => prizes.value),
    selectedPrize: computed(() => selectedPrize.value),
    showResult: computed(() => showResult.value),
    preparedPrizes: computed(() => preparedPrizes.value),
    canStop: computed(() => canStop.value),
    updatePrizes,
    preparePrizes,
    updateSelectedPrize,
    updateShowResult,
    setCanStop,
  };
}
