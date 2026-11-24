import type { Router } from "vue-router";
import { container } from "tsyringe";
import type { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";
import { BGM_SETTING, bgmNameFor, bgmScreenOf, isJackpotGamePath } from "@model/screen-bgm";
import type { ScreenBgmSettings } from "@model/screen-bgm";

/** 行き先の画面の設定を読む(テストで差し替える)。読めなければ未指定。 */
export type LoadScreenSettings = (screen: keyof typeof BGM_SETTING) => Promise<unknown | null>;

const SLOW = Symbol("slow");

const defaultLoad: LoadScreenSettings = async (screen) => {
  const { screenName, settingName } = BGM_SETTING[screen];
  return container.resolve(ScreenSettingsService).fetchScreenSetting(screenName, settingName);
};

/** 行き先の設定を読むのを待つ上限(ミリ秒)。遅くても画面の遷移を止めない。 */
export const SETTINGS_WAIT_MS = 1500;

/**
 * ジャックポットのゲームの画面が切り替わるとき(行き先か元が、オープニング・説明・デモ抽選・抽選・結果・エンディングなどのとき)、行き先の曲名以外の `screen` の曲を止める。
 * 同じ曲なら止めない(流し続ける)。新しい曲を鳴らすのは、行き先の画面の準備ができてから(画面側)。
 * 曲名が分からなくても、画面の遷移は止めない: 読めなければ止める。読むのが遅ければ(`SETTINGS_WAIT_MS`)、止めずに進む
 * (行き先の画面が `screen.play` で、別の曲なら切り替え、同じ曲なら続ける)。
 */
export function installScreenBgmGuard(router: Router, sound: Pick<SoundSystem, "screen">, load: LoadScreenSettings = defaultLoad): () => void {
  return router.beforeResolve(async (to, from) => {
    const target = bgmScreenOf(to.path);
    if (!isJackpotGamePath(to.path) && !isJackpotGamePath(from.path)) return;
    let name: string | null = null;
    if (target) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const slow = new Promise<typeof SLOW>((resolve) => (timer = setTimeout(() => resolve(SLOW), SETTINGS_WAIT_MS)));
        const loaded = await Promise.race([load(target), slow]);
        if (loaded === SLOW) return;
        const settings: ScreenBgmSettings = { [target]: loaded };
        name = bgmNameFor(to.path, settings);
      } catch (error) {
        console.warn("[ScreenBgm] failed to read settings", target, error);
      } finally {
        clearTimeout(timer);
      }
    }
    void sound.screen.stopUnless(name);
  });
}
