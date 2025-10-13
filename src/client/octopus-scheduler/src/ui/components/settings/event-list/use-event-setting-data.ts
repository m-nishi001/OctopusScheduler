import { ref, computed, onMounted } from "vue";
import { AssetService } from "../../../../model/applications/assets/asset-service";
import { container } from "tsyringe";

export function useEventSettingData() {
  const assetService = container.resolve(AssetService);

  const assets = ref<any[]>([]);
  const loading = ref(false);
  const loadingStatus = ref("");
  const saving = ref(false);
  const saveStatus = ref("");

  const fetchAssets = async () => {
    try {
      assets.value = await assetService.getAssets();
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

  const audioAssets = computed(() =>
    assets.value.filter((a) => a.type === "audio")
  );
  const imageAssets = computed(() =>
    assets.value.filter((a) => a.type === "image")
  );
  const videoAssets = computed(() =>
    assets.value.filter((a) => a.type === "video")
  );

  const handleSave = async (saveFunction: () => Promise<void>) => {
    try {
      saving.value = true;
      saveStatus.value = "保存中...";
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
      await fetchAssets();
    } finally {
      loading.value = false;
      loadingStatus.value = "";
    }
  });

  return {
    assetService,
    assets,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    fetchAssets,
    syncWithDrive,
    audioAssets,
    imageAssets,
    videoAssets,
    handleSave,
  };
}
