import { ref, computed, onMounted } from "vue";
import { ScreenConfigService } from "../../../../model/applications/screen-config/screen-config-service";
import { DriveDataDto } from "../../../../model/applications/asset/dto/drive-data-dto";
import type { IMemberRepository } from "../../../../model/domains/member/repository/i-member-repository";
import type { IPrizeRepository } from "../../../../model/domains/prize/repository/i-prize-repository";
import { DriveDataService } from "../../../../model/applications/asset/drive-data-service";
import { container } from "tsyringe";

export function useScreenSettingData() {
  const assetService = container.resolve(
    DriveDataService
  ) as unknown as DriveDataService;
  const screenConfigService = container.resolve(ScreenConfigService);
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
  const tempAssets = ref<DriveDataDto[]>([]);

  const fetchAssets = async () => {
    try {
      assets.value = await assetService.getAllDriveData();
    } catch (error) {
      console.error("Failed to fetch assets:", error);
      assets.value = [];
    }
  };

  const syncWithDrive = async (onMessage?: (msg: string) => void) => {
    try {
      await assetService.syncDriveData((message: string) => {
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

  const onTempAssets = (newTempAssets: DriveDataDto[]) => {
    const existingIds = tempAssets.value.map((a: DriveDataDto) => a.id);
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
        tempAssets.value = await assetService.addDriveData(tempAssets.value);
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
    screenConfigService,
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
