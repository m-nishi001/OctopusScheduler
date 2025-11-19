import { ref } from "vue";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";
import { PrizeService } from "@model/applications/prize/prize-service";
import type { IPrizeRepository } from "@model/domains/prize/repository/i-prize-repository";
import { IPrizeRepositoryToken } from "@model/domains/prize/repository/i-prize-repository";

export function usePrizeSync(
  prizeRepoArg?: IPrizeRepository,
  assetDataServiceArg?: AssetDataService,
  prizeServiceArg?: PrizeService
) {
  const prizeRepo =
    prizeRepoArg || container.resolve<IPrizeRepository>(IPrizeRepositoryToken);
  const assetDataService =
    assetDataServiceArg || container.resolve(AssetDataService);
  const prizeService = prizeServiceArg || container.resolve(PrizeService);

  const syncing = ref(false);
  const syncMessage = ref("");
  const showSyncModeModal = ref(false);
  const showReplaceWarningModal = ref(false);
  const pendingSyncMode = ref<"drive" | "local" | null>(null);

  const confirmPrizesSyncMode = async (
    mode: "drive" | "local",
    onFetch?: () => Promise<void>
  ) => {
    showSyncModeModal.value = false;
    if (mode === "drive") {
      pendingSyncMode.value = "drive";
      showReplaceWarningModal.value = true;
      return;
    }
    syncing.value = true;
    syncMessage.value = "";
    try {
      await assetDataService.syncAssetData((msg: string) => {
        syncMessage.value = msg;
      });
      if (onFetch) await onFetch();
    } catch (e) {
      console.error("同期エラー:", e);
    } finally {
      syncing.value = false;
      syncMessage.value = "";
    }
  };

  const performReplaceFromDrive = async (
    fetchAssets: () => Promise<void>,
    fetchPrizes?: () => Promise<void>
  ) => {
    showReplaceWarningModal.value = false;
    if (pendingSyncMode.value !== "drive") return;
    pendingSyncMode.value = null;
    syncing.value = true;
    syncMessage.value = "";
    try {
      const oldAssets = await assetDataService.getAllAssetData();
      const oldSignatureToId = new Map<string, string>();
      for (const a of oldAssets) {
        const sig = `${a.name}:${a.size}`;
        oldSignatureToId.set(sig, a.id);
      }

      let idMap: { [oldId: string]: string } | undefined;
      if (
        typeof (assetDataService as any).replaceLocalWithDrive === "function"
      ) {
        const res = await (assetDataService as any).replaceLocalWithDrive(
          (message: string) => {
            syncMessage.value = message;
          }
        );
        idMap = res?.idMap;
      } else {
        await prizeRepo.importAllPrizesFromDrive();
      }

      if (fetchAssets) await fetchAssets();
      const newAssets = await assetDataService.getAllAssetData();
      const newSignatureToId = new Map<string, string>();
      for (const a of newAssets) {
        const sig = `${a.name}:${a.size}`;
        newSignatureToId.set(sig, a.id);
      }

      const existingPrizes = await prizeRepo.getPrizes();
      const updatedPrizes: any[] = [];
      for (const p of existingPrizes) {
        let updated = false;
        const updatedPrize = { ...p } as any;
        const checkAndReplace = (field: string) => {
          const currentId = (updatedPrize as any)[field];
          if (!currentId) return;
          if (idMap && idMap[currentId]) {
            (updatedPrize as any)[field] = idMap[currentId];
            updated = true;
            return;
          }
          const old = oldAssets.find((o: any) => o.id === currentId);
          if (!old) return;
          const sig = `${old.name}:${old.size}`;
          const newId = newSignatureToId.get(sig);
          if (newId && newId !== currentId) {
            (updatedPrize as any)[field] = newId;
            updated = true;
          }
        };
        checkAndReplace("imageAssetId");
        checkAndReplace("image2AssetId");
        checkAndReplace("bgm1AssetId");
        checkAndReplace("bgm2AssetId");
        if (updated) {
          try {
            await prizeService.updatePrize(updatedPrize.id, updatedPrize);
            updatedPrizes.push(updatedPrize);
          } catch (e) {
            console.warn(
              "performReplaceFromDrive: failed to update prize",
              updatedPrize.id,
              e
            );
          }
        }
      }
      if (updatedPrizes.length)
        console.log(
          "performReplaceFromDrive updated prizes",
          updatedPrizes.map((p) => p.id)
        );
      if (fetchPrizes) await fetchPrizes();
    } catch (e) {
      console.error("同期エラー:", e);
    } finally {
      syncing.value = false;
      syncMessage.value = "";
    }
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
