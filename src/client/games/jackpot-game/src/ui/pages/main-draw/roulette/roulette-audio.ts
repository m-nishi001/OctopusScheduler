import { useAudio } from "@shared-composables/use-audio";

// Ensure a single shared audio instance across multiple consumers so that
// playback state and events are consistent even if multiple components call
// `useRouletteAudio()`.
let sharedAudio: any = null;
export function useRouletteAudio() {
  if (!sharedAudio) {
    sharedAudio = useAudio({ mode: "html-audio" });
  }
  const {
    load: loadBgm,
    play: playBgm,
    stop: stopBgm,
    isPlaying: isBgmPlaying,
    currentSrc: currentBgmSrc,
    volume: bgmVolume,
    error: bgmError,
    autoplayBlocked: bgmAutoplayBlocked,
    tryResume: tryResumeBgm,
    instanceId: bgmInstanceId,
    getHtmlAudioState: getHtmlAudioState,
  } = sharedAudio as any;

  const startBgm = async (bgmUrl?: Blob | null) => {
    if (!bgmUrl) return;
    try {
      console.log("[RouletteAudio] startBgm: requested, bgmUrl:", bgmUrl, "useAudio.instanceId:", (bgmInstanceId as any)?.value ?? null);
      try {
        // If useAudio exposes an instance id, show it for debugging
        const ii = (getHtmlAudioState as any) ? null : null;
        // The useAudio instance includes logs with instance id in them.
      } catch (e) {}
      await stopBgm();
      await loadBgm(bgmUrl);
      // Ensure we are not muted and set default volume if unset.
      try {
        if (typeof (bgmVolume as any)?.value === "number") {
          if ((bgmVolume as any).value <= 0) {
            (bgmVolume as any).value = 1;
          }
        }
      } catch (e) {
        /* noop */
      }
      await playBgm({ isRepeat: true });
      // Log element state snapshot for diagnostics
      try {
        const state = (getHtmlAudioState as any) ? (getHtmlAudioState as any)() : null;
        console.log("[RouletteAudio] startBgm: audio element state =>", state);
      } catch (e) {}
      // Debug logs to inspect state after attempting to play
      console.log(
        "[RouletteAudio] startBgm: played, isPlaying:",
        (isBgmPlaying as any).value,
        "currentSrc:",
        (currentBgmSrc as any).value,
        "error:",
        (bgmError as any).value,
        "autoplayBlocked:",
        (bgmAutoplayBlocked as any).value,
        "volume:",
        (bgmVolume as any).value
      );
    } catch (err) {
      console.warn("[RouletteAudio] startBgm: failed", err);
    }
  };

  const stopBgmAudio = async () => {
    await stopBgm();
  };

  return {
    startBgm,
    stopBgmAudio,
    bgmAutoplayBlocked,
    tryResumeBgm,
    isBgmPlaying,
    currentBgmSrc,
  };
}
