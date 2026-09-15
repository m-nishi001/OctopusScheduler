import { ref, computed } from "vue";

interface UsePrizeOrchestratorOptions {
  getSettings: () => any;
  onNavigateHome: () => void;
}

export function usePrizeOrchestrator(options: UsePrizeOrchestratorOptions) {
  const { getSettings, onNavigateHome } = options;

  const isPrizeDialogVisible = ref(false);

  const showPrizeDialog = () => {
    isPrizeDialogVisible.value = true;
  };

  const hidePrizeDialog = () => {
    isPrizeDialogVisible.value = false;
    onNavigateHome();
  };

  const prizeName = computed(() => getSettings()?.prizeName ?? null);
  const prizeImageUrl = computed(() => {
    const image = getSettings()?.prizeImage;
    if (image instanceof Blob) {
      return URL.createObjectURL(image);
    }
    return image || null;
  });

  return {
    isPrizeDialogVisible,
    showPrizeDialog,
    hidePrizeDialog,
    prizeName,
    prizeImageUrl,
  };
}
