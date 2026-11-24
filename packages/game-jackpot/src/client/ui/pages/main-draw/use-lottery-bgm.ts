import { container } from 'tsyringe';
import { JackpotRepository } from '@model/jackpot-repository';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { useSound } from '@octopus/composables/use-sound';
import type { SoundSource } from '@octopus/client-common/audio/sound-system';

/** 停止が始まってから、抽選BGMが消えるまでの長さ(ミリ秒)。 */
export const LOTTERY_BGM_FADE_MS = 1500;

/** `main-screen-settings` で曲を並べる項目(メンバー抽選BGM・メンバー結果BGM・景品抽選BGM)。 */
export type LotteryBgmKey = 'memberLotteryBgms' | 'memberResultBgms' | 'prizeLotteryBgms';

/**
 * 抽選BGMを扱う側(抽選の進行)から見た口。音の再生・フェードは進行を止めない: どちらも待たずに呼べて、
 * 失敗したり終わらなくても(自動再生が止められた・読み込みが終わらないなど)、抽選の進行は続く。
 */
export interface LotteryBgmPlayer {
  /** 設定した中から1曲をランダムに選び、1回だけ流し始める(待たない)。未設定なら何もしない(無音)。 */
  playRandom(): void;
  /** フェードアウトして止める。鳴っていなければ何もしない。例外にはならない。 */
  fadeOut(): Promise<void>;
  /** すぐ止める。例外にはならない。 */
  stop(): Promise<void>;
}

/** 再生の準備(設定・素材の読み込み)が終わるのを、フェードアウトが待つ長さ(ミリ秒)。これを過ぎたら、まだ始まっていない再生は取りやめる。 */
export const LOTTERY_BGM_START_WAIT_MS = 2000;

/** 設定の曲名(空・空白だけは除く)から1つ選ぶ。0件なら null。`random` はテストで固定できる。 */
export function pickLotteryBgm(names: readonly (string | null | undefined)[] | null | undefined, random: () => number = Math.random): string | null {
  const valid = (names ?? []).filter((n): n is string => typeof n === 'string' && n.trim() !== '');
  if (valid.length === 0) return null;
  return valid[Math.min(valid.length - 1, Math.floor(random() * valid.length))];
}

/**
 * 結果のBGM(メンバー結果BGM・景品の当選BGM)が空なら true。
 * true のときは、抽選BGMを停止の開始で止めず、リールやルーレットが止まるまで流し続けて、止まったらフェードアウトする(結果の表示中は無音)。
 */
export function shouldHoldLotteryBgm(resultBgms: string | readonly (string | null | undefined)[] | null | undefined): boolean {
  return pickLotteryBgm(typeof resultBgms === 'string' ? [resultBgms] : resultBgms) === null;
}

/**
 * 抽選中に流すBGM(`main-screen-settings` の `key` に並べた曲から、抽選のたびにランダムに1曲)の
 * 読み込み・再生・フェードアウトを担う。音の中心(`SoundSystem`)の `screen` チャンネルで1回だけ流す。
 * 再生に失敗しても演出は止めない。読み込み中に止められた・フェードアウトが来た再生は、チャンネルが取りやめる(古い結果は鳴らさない)。
 * 景品の当選BGM(bgm.ts)も同じチャンネルだが、2曲が同時に鳴ることはない(当選BGMがあれば抽選BGMは先に止め、無ければ当選BGMは鳴らない)。
 */
export function useLotteryBgm(key: LotteryBgmKey): LotteryBgmPlayer {
  const repo = container.resolve(JackpotRepository);
  const screenSettingsService = container.resolve(ScreenSettingsService);
  const { screen } = useSound();
  /** いま流している(または準備中の)曲名。 */
  let current: string | null = null;
  /** この抽選で曲を流し始めたか(未設定・読み込み失敗のときは false。フェードのログを出さない)。 */
  let playing = false;
  /** 準備の世代。stop / fadeOut の取りやめ / 次の再生で進め、古い準備が遅れて鳴らさないようにする(鳴らす前の取りやめは、チャンネルの stop が行う)。 */
  let generation = 0;
  /** 再生を始めた(または、始めないと決まった)ら解決する。フェードアウトが、再生の準備中に来ても待てるようにする。 */
  let ready: Promise<void> = Promise.resolve();

  const start = async (mine: number): Promise<void> => {
    try {
      const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
      const name = pickLotteryBgm(cfg?.[key]);
      if (!name) return;
      const blob = await repo.blobOf(name);
      if (!blob || mine !== generation) return;
      console.log(`[LotteryBgm] ${key} play`, name);
      current = name;
      const source: SoundSource = { key: name, load: async () => blob };
      await screen.stop({ key: name }); // 同じ曲が残っていれば、止めて頭から鳴らし直す
      if (mine !== generation) return;
      const result = await screen.play(source, { loop: false });
      if (mine === generation && result === 'started') playing = true;
    } catch (e) {
      console.error(`Failed to play ${key}:`, e);
    }
  };

  /** 再生の準備が終わるのを待つ。`LOTTERY_BGM_START_WAIT_MS` 待っても終わらなければ false。 */
  const readyWithin = async (): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), LOTTERY_BGM_START_WAIT_MS);
    });
    const result = await Promise.race([ready.then(() => true as const), timeout]);
    clearTimeout(timer);
    return result;
  };

  return {
    playRandom: () => {
      const mine = ++generation;
      playing = false;
      current = null;
      ready = start(mine);
    },
    fadeOut: async () => {
      try {
        if (!(await readyWithin())) {
          generation++; // 準備が終わらない再生は取りやめる(あとから鳴り出さない)
          if (current) await screen.stop({ key: current });
          return;
        }
        if (!playing || !current) return;
        playing = false;
        console.log(`[LotteryBgm] ${key} fadeOut`);
        await screen.stop({ key: current, fadeMs: LOTTERY_BGM_FADE_MS });
      } catch (e) {
        console.warn(`Failed to fade out ${key}:`, e);
      }
    },
    stop: async () => {
      generation++;
      playing = false;
      try {
        if (current) await screen.stop({ key: current });
      } catch (e) {
        console.warn(`Failed to stop ${key}:`, e);
      }
    },
  };
}
