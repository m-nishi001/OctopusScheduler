import { ref, computed } from "vue";
import type { PrizeDto } from "@control/prize/dto/prize-dto";
import type { RouletteItem } from "./roulette/roulette-image-loader";
import {
  prepareRenderPrizes,
  revokePreparedPrizes,
  type AssetService,
} from "./roulette/roulette-prize-preparer";

/** 景品一覧・選ばれた景品・ルーレット用に用意した景品を持つ(本抽選画面用)。 */
export function usePrizeDrawState(assetService: AssetService) {
  const prizes = ref<PrizeDto[]>([]);
  const selectedPrize = ref<PrizeDto | null>(null);
  const preparedPrizes = ref<RouletteItem[]>([]);

  const preparePrizes = async (newPrizes: PrizeDto[]) => {
    const newPrepared = await prepareRenderPrizes(newPrizes, assetService);
    revokePreparedPrizes(preparedPrizes.value);
    preparedPrizes.value = newPrepared;
    return newPrepared;
  };

  /** ルーレットに描く形にするだけ(画面には反映しない)。次のサイクルの分を裏で先に用意するときに使う。 */
  const buildPrizeItems = (newPrizes: PrizeDto[]) => prepareRenderPrizes(newPrizes, assetService);

  /** 先に用意しておいた景品を画面に反映する。見えていた分の画像の URL は破棄する。 */
  const installPreparedPrizes = (items: RouletteItem[]) => {
    revokePreparedPrizes(preparedPrizes.value);
    preparedPrizes.value = items;
  };

  const updatePrizes = async (newPrizes: PrizeDto[]) => {
    prizes.value = newPrizes;
    await preparePrizes(newPrizes);
  };

  const updateSelectedPrize = (newSelected: PrizeDto | null) => {
    selectedPrize.value = newSelected;
  };

  return {
    prizes: computed(() => prizes.value),
    selectedPrize: computed(() => selectedPrize.value),
    preparedPrizes: computed(() => preparedPrizes.value),
    updatePrizes,
    preparePrizes,
    buildPrizeItems,
    installPreparedPrizes,
    updateSelectedPrize,
  };
}

export interface RouletteAnimationState {
  prizes: PrizeDto[];
  selectedPrize: PrizeDto;
  showResult: boolean;
  preparedPrizes: RouletteItem[];
  setPreparedPrizes?: (newPrepared: RouletteItem[]) => void;
}

/** 景品抽選の演出の表示状態。景品の一覧・選ばれた景品・結果を出すかと、画像の読み込み。 */
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

  const setPreparedPrizes = (newPrepared: RouletteItem[]) => {
    revokePreparedPrizes(preparedPrizes.value);
    preparedPrizes.value = newPrepared;
  };

  const updateSelectedPrize = (newSelected: PrizeDto) => {
    selectedPrize.value = newSelected;
  };

  const updateShowResult = (newShow: boolean) => {
    showResult.value = newShow;
  };

  return {
    prizes: computed(() => prizes.value),
    selectedPrize: computed(() => selectedPrize.value),
    showResult: computed(() => showResult.value),
    preparedPrizes: computed(() => preparedPrizes.value),
    updatePrizes,
    preparePrizes,
    setPreparedPrizes,
    updateSelectedPrize,
    updateShowResult,
  };
}
