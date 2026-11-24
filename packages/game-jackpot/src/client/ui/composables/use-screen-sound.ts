import { container } from "tsyringe";
import { JackpotRepository } from "@model/jackpot-repository";
import { useSound } from "@octopus/composables/use-sound";
import type { SoundSource } from "@octopus/client-common/audio/sound-system";

/** 素材(名前)から曲を作る。素材が無い・中身が無いときは、読み込みで例外(再生側が警告して、画面は止めない)。 */
export function screenBgmSource(name: string, blobOf: (name: string) => Promise<Blob | null> = defaultBlobOf): SoundSource {
  return {
    key: name,
    load: async () => {
      const blob = await blobOf(name);
      if (!blob) throw new Error(`BGM の素材がありません: ${name}`);
      return blob;
    },
  };
}

function defaultBlobOf(name: string): Promise<Blob | null> {
  return container.resolve(JackpotRepository).blobOf(name);
}

/**
 * ジャックポットの画面のBGM。音の中心(`SoundSystem`)の `screen` チャンネルで、ループして流す。
 * 同じ曲がすでに鳴っていれば何もしない(前の画面から流し続ける)。止めるのは、画面が切り替わるときの router の `beforeResolve`(screen-bgm-guard)。
 */
export function useScreenSound(blobOf?: (name: string) => Promise<Blob | null>) {
  const { screen } = useSound();
  return {
    /** 曲を先に読み込んでおく(名前が空なら何もしない)。 */
    preload(name: string | null | undefined): Promise<void> {
      return name ? screen.preload(screenBgmSource(name, blobOf)) : Promise.resolve();
    },
    /** 曲をループで流す(`delayMs` 待ってから)。名前が空なら何もしない。失敗しても画面は止めない。 */
    async play(name: string | null | undefined, delayMs = 0): Promise<void> {
      if (!name) return;
      await screen.play(screenBgmSource(name, blobOf), { loop: true, delayMs });
    },
    /** 流している曲を止める。 */
    stop(): Promise<void> {
      return screen.stop();
    },
  };
}
