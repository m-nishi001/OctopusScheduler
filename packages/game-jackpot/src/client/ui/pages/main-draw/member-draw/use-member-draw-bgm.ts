import { container } from 'tsyringe';
import { AssetDataService } from '@control/asset/asset-data-service';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { useAudio } from '@octopus/composables/use-audio';

/**
 * メンバー抽選中に流すBGM(main-screen-settingsのmemberLotteryBgmsからランダムに
 * 1曲選ぶ)の読み込み・再生・停止を担うcomposable。MemberDrawAnimationの
 * アニメーション本体(GSAPのtrack操作)とは独立した関心事のため分離した。
 */
export function useMemberDrawBgm() {
  const assetService = container.resolve(AssetDataService);
  const screenSettingsService = container.resolve(ScreenSettingsService);

  const { load, play, stop, setVolume } = useAudio({
    assetService,
    screenSettingsService,
  });

  const loadGlobalVolume = async () => {
    try {
      const cfg = await screenSettingsService.fetchScreenSetting('main', 'global-volume');
      if (cfg && typeof cfg.volume === 'number') setVolume(cfg.volume);
    } catch (e) {
      console.error('Failed to load global volume:', e);
    }
  };

  const playRandomMemberBgm = async () => {
    try {
      await loadGlobalVolume();
      const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
      if (!cfg || !cfg.memberLotteryBgms || cfg.memberLotteryBgms.length === 0) return;
      const bgmIds: string[] = cfg.memberLotteryBgms.filter((id: string) => id && id.trim());
      if (bgmIds.length === 0) return;
      const randomId = bgmIds[Math.floor(Math.random() * bgmIds.length)];
      const asset = await assetService.getAssetDataById(randomId);
      if (asset && asset.blob) {
        await stop();
        await load(asset.blob);
        await play({ isRepeat: true });
      }
    } catch (e) {
      console.error('Failed to play member BGM:', e);
    }
  };

  return { playRandomMemberBgm, stopBgm: stop };
}
