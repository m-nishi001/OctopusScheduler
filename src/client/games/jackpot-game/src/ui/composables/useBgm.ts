import { ref } from "vue";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";
import { ScreenSettingsService } from "@model/applications/screen-config/screen-settings-service";

const currentAudio = ref<HTMLAudioElement | null>(null);
const globalVolume = ref(50); // default

export const useBgm = () => {
  const assetService = container.resolve(AssetDataService);
  const screenSettingsService = container.resolve(ScreenSettingsService);

  const loadGlobalVolume = async () => {
    try {
      const cfg = await screenSettingsService.fetchScreenSetting(
        "main",
        "main-screen-settings"
      );
      if (cfg && typeof cfg.globalBgmVolume === "number") {
        globalVolume.value = cfg.globalBgmVolume;
      }
    } catch (e) {
      console.error("Failed to load global volume:", e);
    }
  };

  const playRandomMemberBgm = async () => {
    try {
      await loadGlobalVolume();
      const cfg = await screenSettingsService.fetchScreenSetting(
        "main",
        "main-screen-settings"
      );
      if (
        !cfg ||
        !cfg.memberLotteryBgms ||
        cfg.memberLotteryBgms.length === 0
      ) {
        return; // no BGM set
      }
      const bgmIds: string[] = cfg.memberLotteryBgms.filter(
        (id: string) => id && id.trim()
      );
      if (bgmIds.length === 0) return;

      const randomId = bgmIds[Math.floor(Math.random() * bgmIds.length)];
      const asset = await assetService.getAssetDataById(randomId);
      if (asset && asset.blob) {
        stopBgm(); // stop any current
        const url = URL.createObjectURL(asset.blob);
        currentAudio.value = new Audio(url);
        currentAudio.value.volume = globalVolume.value / 100;
        currentAudio.value.loop = true; // loop for draw duration
        await currentAudio.value.play();
      }
    } catch (e) {
      console.error("Failed to play member BGM:", e);
    }
  };

  const stopBgm = () => {
    if (currentAudio.value) {
      currentAudio.value.pause();
      currentAudio.value.currentTime = 0;
      URL.revokeObjectURL(currentAudio.value.src);
      currentAudio.value = null;
    }
  };

  return {
    playRandomMemberBgm,
    stopBgm,
  };
};
