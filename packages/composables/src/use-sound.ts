import { inject } from "vue";
import type { InjectionKey } from "vue";
import type { SoundSystem } from "@octopus/client-common/audio/sound-system";

/**
 * 音の中心(`SoundSystem`)。アプリの起動時に `app.provide(SOUND_KEY, …)` する。
 * ゲームのパッケージは、これを `useSound()` で受け取るので、DI の仕組み(tsyringe)を知らなくてよい。テストでは偽物を provide する。
 */
export const SOUND_KEY: InjectionKey<SoundSystem> = Symbol("sound");

/** アプリが提供した `SoundSystem` を取り出す。提供されていなければ例外。 */
export function useSound(): SoundSystem {
  const sound = inject(SOUND_KEY, null);
  if (!sound) throw new Error("SOUND_KEY が提供されていません(アプリの起動時に app.provide してください)");
  return sound;
}
