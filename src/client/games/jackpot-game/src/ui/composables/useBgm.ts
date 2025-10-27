import { useAudio } from "@shared-composables/use-audio";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";
import { ScreenSettingsService } from "@model/applications/screen-config/screen-settings-service";

export const useBgm = () => {
  const assetService = container.resolve(AssetDataService);
  const screenSettingsService = container.resolve(ScreenSettingsService);

  const { playRandomMemberBgm, stop } = useAudio({
    mode: "html-audio",
    bgmMode: "random-member",
    assetService,
    screenSettingsService,
  });

  return {
    playRandomMemberBgm,
    stopBgm: stop,
  };
};
