import { ref, computed } from 'vue';
import { container } from 'tsyringe';
import type { IPrizeRepository } from '@model/domains/prize/repository/i-prize-repository';
import { IPrizeRepositoryToken } from '@model/domains/prize/repository/i-prize-repository';
import { PrizeService } from '@model/applications/prize/prize-service';

export function usePrizes(prizeRepoArg?: IPrizeRepository, prizeServiceArg?: PrizeService) {
  const prizeRepo = prizeRepoArg || container.resolve<IPrizeRepository>(IPrizeRepositoryToken);
  const prizeService = prizeServiceArg || container.resolve(PrizeService);

  const prizes = ref<any[]>([]);
  const selectedPrizes = ref<string[]>([]);

  const isAllSelected = computed({
    get: () => prizes.value.length > 0 && selectedPrizes.value.length === prizes.value.length,
    set: (val: boolean) => {
      if (val) selectedPrizes.value = prizes.value.map(p => p.id);
      else selectedPrizes.value = [];
    }
  });

  const fetchPrizes = async () => {
    try {
      const fetchedPrizes = await prizeRepo.getPrizes();
      prizes.value = fetchedPrizes;
    } catch (e) {
      console.error('Failed to fetch prizes', e);
      prizes.value = [];
    }
  };

  const deletePrize = async (id: string) => {
    await prizeService.deletePrize(id);
    await fetchPrizes();
  };

  const deletePrizes = async (ids: string[]) => {
    if (!ids || !ids.length) return;
    await prizeService.deletePrizes(ids);
    await fetchPrizes();
    selectedPrizes.value = [];
  };

  return { prizes, selectedPrizes, isAllSelected, fetchPrizes, deletePrize, deletePrizes };
}
