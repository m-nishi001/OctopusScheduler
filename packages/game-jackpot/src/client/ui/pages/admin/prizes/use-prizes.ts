import { ref } from "vue";
import { container } from "tsyringe";
import { JackpotRepository } from "@model/jackpot-repository";
import type { Prize } from "@model/prize/prize";
import { PrizeService } from "@control/prize/prize-service";

/** 景品の管理画面の状態と操作(一覧・選択・削除)。 */
export function usePrizes(prizeRepoArg?: JackpotRepository, prizeServiceArg?: PrizeService) {
  const prizeRepo = prizeRepoArg || container.resolve(JackpotRepository);
  const prizeService = prizeServiceArg || container.resolve(PrizeService);

  const prizes = ref<Prize[]>([]);
  const selectedPrizes = ref<string[]>([]);

  /** 景品を並び順で読み直す。 */
  const fetchPrizes = async () => {
    try {
      prizes.value = [...(await prizeRepo.getPrizes())].sort((a, b) => a.order - b.order);
    } catch (e) {
      console.error("Failed to fetch prizes", e);
      prizes.value = [];
    }
  };

  /** 景品を消す(書き込みは1回)。選択からも外す。 */
  const deletePrizes = async (ids: string[]) => {
    if (!ids.length) return;
    await prizeService.deletePrizes(ids);
    const gone = new Set(ids);
    selectedPrizes.value = selectedPrizes.value.filter((id) => !gone.has(id));
  };

  return { prizes, selectedPrizes, fetchPrizes, deletePrizes };
}
