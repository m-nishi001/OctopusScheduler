import { ref, computed, onMounted } from "vue";
import { container } from "tsyringe";
import type { IScreenConfigRepository } from "../../../../model/domains/screen-config/repository/IScreenConfigRepository";
import { AssetService } from "../../../../model/applications/asset/asset-service";
import type { IMemberRepository } from "../../../../model/domains/member/repository/IMemberRepository";
import type { IPrizeRepository } from "../../../../model/domains/prize/repository/IPrizeRepository";
import { AssetDto } from "../../../../model/applications/asset/dto/asset-dto";

export function useScreenSettingData() {
  const assetService = container.resolve(
    AssetService
  ) as unknown as AssetService;
  const screenConfigRepo = container.resolve<IScreenConfigRepository>(
    "IScreenConfigRepository"
  );
  const memberRepo = container.resolve<IMemberRepository>("IMemberRepository");
  const prizeRepo = container.resolve<IPrizeRepository>("IPrizeRepository");

  const assets = ref<any[]>([]);
  const members = ref<any[]>([]);
  const prizes = ref<any[]>([]);
  const loading = ref(false);
  const loadingStatus = ref("");
  const saving = ref(false);
  const saveStatus = ref("");
  const uploading = ref(false);
  const tempAssets = ref<AssetDto[]>([]);

  const fetchAssets = async () => {
    try {
      assets.value = await assetService.getAllAssets();
    } catch (error) {
      console.error("Failed to fetch assets:", error);
      assets.value = [];
    }
  };

  const syncWithDrive = async (onMessage?: (msg: string) => void) => {
    try {
      await assetService.syncAssets((message: string) => {
        if (onMessage) onMessage(message);
      });
    } catch (e) {
      console.error("syncAssets failed", e);
    }
  };

  const fetchMembers = async () => {
    try {
      members.value = await memberRepo.getMembers();
    } catch (error) {
      console.error("Failed to fetch members:", error);
      members.value = [];
    }
  };

  const fetchPrizes = async () => {
    try {
      prizes.value = await prizeRepo.getPrizes();
    } catch (error) {
      console.error("Failed to fetch prizes:", error);
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

  const onTempAssets = (newTempAssets: AssetDto[]) => {
    const existingIds = tempAssets.value.map((a: AssetDto) => a.id);
    newTempAssets.forEach((asset) => {
      if (!existingIds.includes(asset.id)) {
        tempAssets.value.push(asset);
      }
    });
  };

  const handleSave = async (saveFunction: () => Promise<void>) => {
    try {
      saving.value = true;
      saveStatus.value = "保存中...";

      if (tempAssets.value.length > 0) {
        saveStatus.value = "アセットをアップロード中...";
        await assetService.addAssets(tempAssets.value);
        tempAssets.value = [];
      }

      await saveFunction();
      saveStatus.value = "保存しました";
    } catch (err) {
      console.error("Failed to save:", err);
      saveStatus.value = "保存に失敗しました";
    } finally {
      saving.value = false;
    }
  };

  onMounted(async () => {
    loading.value = true;
    loadingStatus.value = "データを読み込み中...";
    try {
      await syncWithDrive((message: string) => {
        loadingStatus.value = message;
      });

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
    screenConfigRepo,
    memberRepo,
    prizeRepo,
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
    syncWithDrive,
    fetchMembers,
    fetchPrizes,
    audioAssets,
    imageAssets,
    onUploading,
    onTempAssets,
    handleSave,
  };
}
