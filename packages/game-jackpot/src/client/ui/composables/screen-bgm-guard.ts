import type { Router } from "vue-router";
import { container } from "tsyringe";
import type { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";
import { BGM_SETTING, bgmNameFor, bgmScreenOf } from "@model/screen-bgm";
import type { ScreenBgmSettings } from "@model/screen-bgm";

/** 行き先の画面の設定を読む(テストで差し替える)。読めなければ未指定。 */
export type LoadScreenSettings = (screen: keyof typeof BGM_SETTING) => Promise<unknown | null>;

const defaultLoad: LoadScreenSettings = async (screen) => {
  const { screenName, settingName } = BGM_SETTING[screen];
  return container.resolve(ScreenSettingsService).fetchScreenSetting(screenName, settingName);
};

/**
 * ジャックポットの画面が切り替わるとき(行き先か元がBGMを持つ画面のとき)、行き先の曲名以外の `screen` の曲を止める。
 * 同じ曲なら止めない(流し続ける)。新しい曲を鳴らすのは、行き先の画面の準備ができてから(画面側)。
 * 曲名が分からなくても(設定を読めない)、画面の遷移は止めない。
 */
export function installScreenBgmGuard(router: Router, sound: Pick<SoundSystem, "screen">, load: LoadScreenSettings = defaultLoad): () => void {
  return router.beforeResolve(async (to, from) => {
    const target = bgmScreenOf(to.path);
    if (!target && !bgmScreenOf(from.path)) return;
    let name: string | null = null;
    if (target) {
      try {
        const settings: ScreenBgmSettings = { [target]: await load(target) };
        name = bgmNameFor(to.path, settings);
      } catch (error) {
        console.warn("[ScreenBgm] failed to read settings", target, error);
      }
    }
    void sound.screen.stopUnless(name);
  });
}
