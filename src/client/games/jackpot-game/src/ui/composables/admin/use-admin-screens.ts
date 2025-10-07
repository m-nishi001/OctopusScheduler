import { ref, onMounted } from "vue";
import { useAssets } from "../data/use-assets";
import { useEntities } from "../data/use-entities";
import { useScreenConfigs } from "./use-screen-configs";

export function useAdminScreens() {
  const {
    assets,
    assetService,
    fetchAssets,
    syncWithDrive,
    audioAssets,
    imageAssets,
  } = useAssets();
  const { members, prizes, fetchMembers, fetchPrizes } = useEntities();
  const {
    loading,
    loadingStatus,
    homeConfig,
    openingConfig,
    descriptionConfig,
    demoConfig,
    mainConfig,
    resultConfig,
    endingConfig,
    loadScreenConfigs,
    updateHomeConfig,
    updateOpeningConfig,
    updateDescriptionConfig,
    updateDemoConfig,
    updateMainConfig,
    updateResultConfig,
    updateEndingConfig,
    saveConfigs,
  } = useScreenConfigs();

  const activeTab = ref("home");
  const tabs = [
    { key: "home", label: "ホーム" },
    { key: "opening", label: "オープニング" },
    { key: "description", label: "説明" },
    { key: "demo", label: "デモ抽選" },
    { key: "main", label: "本抽選" },
    { key: "result", label: "最終結果" },
    { key: "ending", label: "エンディング" },
  ];

  const saving = ref(false);
  const saveStatus = ref("");
  const uploading = ref(false);

  const onUploading = (isUploading: boolean) => {
    uploading.value = isUploading;
  };

  const handleSave = async () => {
    // provide UI feedback and call underlying saveConfigs
    try {
      saving.value = true;
      saveStatus.value = "保存中...";
      await saveConfigs();
      saveStatus.value = "保存しました";
    } catch (err) {
      console.error("Failed to save configs:", err);
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
      const configsPromise = loadScreenConfigs();

      await Promise.all([
        assetsPromise,
        membersPromise,
        prizesPromise,
        configsPromise,
      ]);
    } finally {
      loading.value = false;
      loadingStatus.value = "";
    }
  });

  return {
    activeTab,
    tabs,
    assets,
    members,
    prizes,
    assetService,
    audioAssets,
    imageAssets,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    uploading,
    homeConfig,
    openingConfig,
    descriptionConfig,
    demoConfig,
    mainConfig,
    resultConfig,
    endingConfig,
    updateHomeConfig,
    updateOpeningConfig,
    updateDescriptionConfig,
    updateDemoConfig,
    updateMainConfig,
    updateResultConfig,
    updateEndingConfig,
    onUploading,
    saveConfigs,
    handleSave,
  } as const;
}
