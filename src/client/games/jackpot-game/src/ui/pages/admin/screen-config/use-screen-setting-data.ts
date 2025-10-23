import { ref, computed, onMounted } from "vue";
import { ScreenSettingsService } from "../../../../model/applications/screen-config/screen-settings-service";
import type { Asset } from "../../../../model/domains/drive-data/asset-data";
import { AssetDataService } from "../../../../model/applications/asset/asset-data-service";
import { container } from "tsyringe";

import type { IMemberRepository } from "../../../../model/domains/member/repository/i-member-repository";
import { IMemberRepositoryToken } from "../../../../model/domains/member/repository/i-member-repository";
import type { IPrizeRepository } from "../../../../model/domains/prize/repository/i-prize-repository";
import { IPrizeRepositoryToken } from "../../../../model/domains/prize/repository/i-prize-repository";

export function useScreenSettingData() {
  const assetService = container.resolve(AssetDataService);
  const screenConfigService = container.resolve(ScreenSettingsService);

  const assets = ref<any[]>([]);
  const members = ref<any[]>([]);
  const prizes = ref<any[]>([]);
  const loading = ref(false);
  const loadingStatus = ref("");
  const saving = ref(false);
  const saveStatus = ref("");
  const uploading = ref(false);
  const tempAssets = ref<Asset[]>([]);

  const memberRepo = container.resolve<IMemberRepository>(
    IMemberRepositoryToken
  );
  const prizeRepo = container.resolve<IPrizeRepository>(IPrizeRepositoryToken);

  const fetchAssets = async () => {
    try {
      assets.value = await assetService.getAllAssetData();
    } catch (e) {
      assets.value = [];
    }
  };

  const fetchMembers = async () => {
    try {
      members.value = await memberRepo.getMembers();
    } catch (e) {
      members.value = [];
    }
  };

  const fetchPrizes = async () => {
    try {
      prizes.value = await prizeRepo.getPrizes();
    } catch (e) {
      prizes.value = [];
    }
  };

  const audioAssets = computed(() =>
    assets.value.filter((a) => a.type === "audio")
  );
  const imageAssets = computed(() =>
    assets.value.filter((a) => a.type === "image")
  );

  const onUploading = (isUploading: boolean) => {
    uploading.value = isUploading;
  };

  const onTempAssets = (newTemp: Asset[]) => {
    const ids = tempAssets.value.map((a) => a.id);
    newTemp.forEach((t) => {
      if (!ids.includes(t.id)) tempAssets.value.push(t as Asset);
    });
  };

  const handleSave = async (saveFunction: () => Promise<void>) => {
    try {
      saving.value = true;
      saveStatus.value = "保存中...";

      if (tempAssets.value.length > 0) {
        saveStatus.value = "アセットをアップロード中...";
        const uploaded = await assetService.addAssetData(tempAssets.value);
        tempAssets.value = uploaded;
      }

      await saveFunction();
      saveStatus.value = "保存しました";
    } catch (e) {
      console.error("Failed to save:", e);
      saveStatus.value = "保存に失敗しました";
    } finally {
      saving.value = false;
    }
  };

  onMounted(async () => {
    loading.value = true;
    loadingStatus.value = "データを読み込み中...";
    try {
      const assetsPromise = fetchAssets();
      const membersPromise = fetchMembers();
      const prizesPromise = fetchPrizes();
      await Promise.all([assetsPromise, membersPromise, prizesPromise]);
    } finally {
      loading.value = false;
      loadingStatus.value = "";
    }
  });

  return {
    assetService,
    screenConfigService,
    assets,
    members,
    prizes,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    uploading,
    tempAssets,
    fetchAssets,
    audioAssets,
    imageAssets,
    onUploading,
    onTempAssets,
    handleSave,
    fetchMembers,
    fetchPrizes,
  };
}
