import { ref } from "vue";

// No-op prize sync composable. Per-screen sync was removed and replaced
// by the global bulk sync. Keep API shape but make functions no-ops
// so older imports do not break until fully removed.
export function usePrizeSync() {
  const syncing = ref(false);
  const syncMessage = ref("");
  const showSyncModeModal = ref(false);
  const showReplaceWarningModal = ref(false);

  const confirmPrizesSyncMode = async (_mode: "drive" | "local") => {
    // no-op: bulk sync handles synchronization
    return;
  };

  const performReplaceFromDrive = async (
    _fetchAssets?: () => Promise<void>,
    _fetchPrizes?: () => Promise<void>
  ) => {
    // no-op
    return;
  };

  return {
    syncing,
    syncMessage,
    showSyncModeModal,
    showReplaceWarningModal,
    confirmPrizesSyncMode,
    performReplaceFromDrive,
  };
}
