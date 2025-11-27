import { ref, readonly, onUnmounted } from "vue";
import { useAudio } from "shared-composables";
import { dataUrlToBlob } from "../utils/blob-utils";

export function usePrizeOrchestrator(options: {
  getSettings: () =>
    | {
        prizeBgmDataUrl: string | null;
        prizeImageDataUrl: string | null;
        prizeName: string | null;
      }
    | undefined;
  onNavigateHome: () => void;
}) {
  const isPrizeDialogVisible = ref(false);
  const audio = useAudio({ mode: "html-audio" });
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  const showPrizeDialog = async () => {
    const settings = options.getSettings();
    if (settings?.prizeBgmDataUrl) {
      try {
        const blob = dataUrlToBlob(settings.prizeBgmDataUrl);
        await audio.load(blob);
        await audio.play();
      } catch (error) {
        console.error("Failed to load prize BGM:", error);
      }
    }
    isPrizeDialogVisible.value = true;

    // Attach keydown handler
    keydownHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        hidePrizeDialog();
        options.onNavigateHome();
      }
    };
    document.addEventListener("keydown", keydownHandler);
  };

  const hidePrizeDialog = async () => {
    await audio.stop();
    isPrizeDialogVisible.value = false;

    // Remove keydown handler
    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }
  };

  const dispose = () => {
    hidePrizeDialog();
  };

  onUnmounted(() => {
    dispose();
  });

  return {
    isPrizeDialogVisible: readonly(isPrizeDialogVisible),
    showPrizeDialog,
    hidePrizeDialog,
    dispose,
  };
}
