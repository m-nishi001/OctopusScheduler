import type { Ref } from "vue";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import { AssetDataService } from "@model/applications/asset/asset-data-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { container } from "tsyringe";

export function usePrizeDrawOrchestrator(
  prizes: Ref<PrizeDto[]>,
  latestResult: Ref<DrawResultDto | null>,
  rouletteRef: Ref<any>,
  selectedPrize: Ref<PrizeDto | null>,
  showPrizeWinnerModal: Ref<boolean>,
  onStartSpin?: () => void
) {
  const drawService = container.resolve(DrawApplicationService);
  const assetService = container.resolve(AssetDataService);

  const loadBgmUrl = async (assetId: string | null): Promise<string | null> => {
    if (!assetId) return null;
    try {
      const asset = await assetService.getAssetDataById(assetId);
      return asset?.blob ? URL.createObjectURL(asset.blob) : null;
    } catch {
      return null;
    }
  };

  const handleKakuhenDraw = async (res: any) => {
    const dummyPrize = prizes.value.find((p) => p.id === res.dummyPrizeIds[0]);
    const reservedPrize = prizes.value.find(
      (p) => p.id === res.reservedPrizeIds?.[0]
    );

    const [bgm1Url, bgm2Url] = await Promise.all([
      loadBgmUrl(dummyPrize?.bgm1AssetId || null),
      loadBgmUrl(reservedPrize?.bgm2AssetId || null),
    ]);

    if (rouletteRef.value?.runAutoReroll) {
      await rouletteRef.value.runAutoReroll({
        dummyPrizeId: res.dummyPrizeIds[0] || null,
        finalPrizeId: res.reservedPrizeIds?.[0] || null,
        dummyDuration: 2000,
        finalDuration: 2000,
        bgm1Url,
        bgm2Url,
      });
    }

    const assignRes = await drawService.executeKakuhenAssign();
    if (assignRes.winnerPrizeId) {
      latestResult.value!.prize =
        prizes.value.find((p) => p.id === assignRes.winnerPrizeId) || null;
      showPrizeWinnerModal.value = true;
    }
  };

  const handleNormalDraw = async (res: any) => {
    selectedPrize.value =
      prizes.value.find((p) => p.id === res.winnerPrizeId) || null;
    const bgmUrl = await loadBgmUrl(selectedPrize.value?.bgm1AssetId || null);

    if (rouletteRef.value?.startSpin) {
      rouletteRef.value.startSpin(bgmUrl);
      onStartSpin?.();
    }
    // Do not set showPrizeResult here; wait for user to stop
  };

  const prizeStart = async () => {
    if (!latestResult.value || !latestResult.value.member) return;
    const res = await drawService.executePrizeDraw({
      memberId: latestResult.value.member.id,
      requestCount: 8,
    });
    if (!res) return;

    if (res.isKakuhen) {
      await handleKakuhenDraw(res);
    } else {
      await handleNormalDraw(res);
    }
  };

  return {
    prizeStart,
  };
}
