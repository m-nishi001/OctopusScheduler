import { container } from 'tsyringe';
import { JackpotRepository } from '@model/jackpot-repository';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { useAudio } from '@octopus/composables/use-audio';

/**
 * メンバー抽選中に流すBGM(main-screen-settingsのmemberLotteryBgmsからランダムに
 * 1曲選ぶ)の読み込み・再生・停止を担うcomposable。MemberDrawAnimationの
 * アニメーション本体(GSAPのtrack操作)とは独立した関心事のため分離した。
 */
export function useMemberDrawBgm() {
  const repo = container.resolve(JackpotRepository);
  const screenSettingsService = container.resolve(ScreenSettingsService);

  const { load, play, stop } = useAudio();

  const playRandomMemberBgm = async () => {
    try {
      const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
      if (!cfg || !cfg.memberLotteryBgms || cfg.memberLotteryBgms.length === 0) return;
      const names: string[] = cfg.memberLotteryBgms.filter((n: string) => n && n.trim());
      if (names.length === 0) return;
      const blob = await repo.blobOf(names[Math.floor(Math.random() * names.length)]);
      if (blob) {
        await stop();
        await load(blob);
        await play({ isRepeat: true });
      }
    } catch (e) {
      console.error('Failed to play member BGM:', e);
    }
  };

  return { playRandomMemberBgm, stopBgm: stop };
}
