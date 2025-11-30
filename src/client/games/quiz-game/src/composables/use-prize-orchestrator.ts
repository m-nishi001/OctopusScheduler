import { ref, readonly, onUnmounted } from "vue";
import { useAudio } from "shared-composables";
import { dataUrlToBlob } from "../utils/blob-utils";

export function usePrizeOrchestrator(options: {
  getSettings: () =>
    | {
        prizeBgm: Blob | string | null;
        prizeImage: Blob | string | null;
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
    if (settings?.prizeBgm) {
      try {
        let blob: Blob | null = null;
        if (settings.prizeBgm instanceof Blob) blob = settings.prizeBgm;
        else if (typeof settings.prizeBgm === "string")
          blob = dataUrlToBlob(settings.prizeBgm);
        if (blob) {
          await audio.load(blob);
          await audio.play();
        }
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
