import { ref, readonly, onUnmounted } from "vue";
import { useAudio } from "@octopus/composables";

/** 結果発表のあとの景品ダイアログの進行。景品の BGM を鳴らしてダイアログを出し、Enter で閉じて戻る。 */
export function usePrizeOrchestrator(options: {
  getSettings: () =>
    | {
        prizeBgm: Blob | null;
        prizeImage: Blob | null;
        prizeName: string | null;
      }
    | undefined;
  onNavigateHome: () => void;
}) {
  const isPrizeDialogVisible = ref(false);
  const audio = useAudio();
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  const showPrizeDialog = async () => {
    const settings = options.getSettings();
    if (settings?.prizeBgm) {
      try {
        await audio.load(settings.prizeBgm);
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
        confirm();
      }
    };
    document.addEventListener("keydown", keydownHandler);
  };

  /** 賞品のダイアログを閉じて、ホームへ戻る(Enter キーと、管理端末の「次へ」で共通)。 */
  const confirm = () => {
    void hidePrizeDialog();
    options.onNavigateHome();
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
    confirm,
    dispose,
  };
}
