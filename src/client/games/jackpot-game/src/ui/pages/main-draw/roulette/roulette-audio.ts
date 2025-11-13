import { useAudio } from "@shared-composables/use-audio";

export function useRouletteAudio() {
  const {
    load: loadBgm,
    play: playBgm,
    stop: stopBgm,
  } = useAudio({ mode: "html-audio" });

  const startBgm = async (bgmUrl?: Blob | null) => {
    if (bgmUrl) {
      try {
        await stopBgm();
        await loadBgm(bgmUrl);
        await playBgm({ isRepeat: true });
      } catch {}
    }
  };

  const stopBgmAudio = async () => {
    await stopBgm();
  };

  return {
    startBgm,
    stopBgmAudio,
  };
}
