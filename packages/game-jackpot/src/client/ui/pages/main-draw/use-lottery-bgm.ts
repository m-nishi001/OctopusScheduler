import { container } from 'tsyringe';
import { JackpotRepository } from '@model/jackpot-repository';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { useAudio } from '@octopus/composables/use-audio';

/** 停止が始まってから、抽選BGMが消えるまでの長さ(ミリ秒)。 */
export const LOTTERY_BGM_FADE_MS = 1500;

/** `main-screen-settings` で曲を並べる項目(メンバー抽選BGM・景品抽選BGM)。 */
export type LotteryBgmKey = 'memberLotteryBgms' | 'prizeLotteryBgms';

/** 抽選BGMを扱う側(抽選の進行)から見た口。 */
export interface LotteryBgmPlayer {
  /** 設定した中から1曲をランダムに選び、ループで流す。未設定なら何もしない(無音)。 */
  playRandom(): Promise<void>;
  /** フェードアウトして止める。鳴っていなければ何もしない。 */
  fadeOut(): Promise<void>;
  /** すぐ止める。 */
  stop(): Promise<void>;
}

/** 設定の曲名(空・空白だけは除く)から1つ選ぶ。0件なら null。`random` はテストで固定できる。 */
export function pickLotteryBgm(names: readonly (string | null | undefined)[] | null | undefined, random: () => number = Math.random): string | null {
  const valid = (names ?? []).filter((n): n is string => typeof n === 'string' && n.trim() !== '');
  if (valid.length === 0) return null;
  return valid[Math.min(valid.length - 1, Math.floor(random() * valid.length))];
}

/**
 * 抽選中に流すBGM(`main-screen-settings` の `key` に並べた曲から、抽選のたびにランダムに1曲)の
 * 読み込み・再生・フェードアウトを担う。景品の当選BGM(roulette-audio の singleton)とは別の
 * `useAudio()` を持つので、2曲が同時に鳴る。再生に失敗しても演出は止めない。
 */
export function useLotteryBgm(key: LotteryBgmKey): LotteryBgmPlayer {
  const repo = container.resolve(JackpotRepository);
  const screenSettingsService = container.resolve(ScreenSettingsService);
  const { load, play, stop, fadeOut } = useAudio();

  const playRandom = async (): Promise<void> => {
    try {
      const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
      const name = pickLotteryBgm(cfg?.[key]);
      if (!name) return;
      const blob = await repo.blobOf(name);
      if (!blob) return;
      await stop();
      await load(blob);
      console.log(`[LotteryBgm] ${key} play`, name);
      await play({ isRepeat: true });
    } catch (e) {
      console.error(`Failed to play ${key}:`, e);
    }
  };

  return {
    playRandom,
    fadeOut: async () => {
      try {
        console.log(`[LotteryBgm] ${key} fadeOut`);
        await fadeOut(LOTTERY_BGM_FADE_MS);
      } catch (e) {
        console.warn(`Failed to fade out ${key}:`, e);
      }
    },
    stop,
  };
}
