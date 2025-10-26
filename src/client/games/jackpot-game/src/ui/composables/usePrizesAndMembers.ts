import { ref, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { PrizeRepository } from '../../model/infrastructures/prize-repository';
import { MemberRepository } from '../../model/infrastructures/member-repository';
import { AssetDataService } from '../../model/applications/asset/asset-data-service';

export function usePrizesAndMembers() {
  const prizes = ref<any[]>([]);
  const members = ref<any[]>([]);
  const objectUrlMap = new Map<string, string>();

  const prizeRepo = container.resolve(PrizeRepository);
  const memberRepo = container.resolve(MemberRepository);
  const assetService = (() => {
    try {
      return container.resolve(AssetDataService);
    } catch (e) {
      return null as any;
    }
  })();

  const fetchPrizes = async () => {
    prizes.value = await prizeRepo.getPrizes();
  };

  const fetchMembers = async () => {
    members.value = await memberRepo.getMembers();
    if (!assetService) return;
    for (const m of members.value) {
      if (m.photoAssetId && !objectUrlMap.has(m.photoAssetId)) {
        try {
          const asset = await assetService.getAssetDataById(m.photoAssetId);
          if (asset && asset.blob) {
            objectUrlMap.set(m.photoAssetId, URL.createObjectURL(asset.blob));
          }
        } catch (e) {
          // ignore asset fetch errors
        }
      }
    }
  };

  const cleanup = () => {
    for (const url of objectUrlMap.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    }
    objectUrlMap.clear();
  };

  onUnmounted(() => cleanup());

  return { prizes, members, objectUrlMap, fetchPrizes, fetchMembers, cleanup };
}
