import { ref } from 'vue';

export function useVideo() {
  const videoRef = ref<HTMLVideoElement | null>(null);
  const isPlaying = ref(false);
  const fadeOutTimer = ref<number | null>(null);

  function play(src: string) {
    if (videoRef.value) {
      videoRef.value.src = src;
      videoRef.value.play();
      isPlaying.value = true;
    }
  }

  function stop(fadeOutDuration?: number) {
    if (videoRef.value) {
      if (fadeOutDuration && fadeOutDuration > 0) {
        videoRef.value.style.transition = `opacity ${fadeOutDuration}ms`;
        videoRef.value.style.opacity = '0';
        fadeOutTimer.value = window.setTimeout(() => {
          videoRef.value?.pause();
          videoRef.value!.currentTime = 0;
          isPlaying.value = false;
          videoRef.value!.style.opacity = '1';
        }, fadeOutDuration);
      } else {
        videoRef.value.pause();
        videoRef.value.currentTime = 0;
        isPlaying.value = false;
      }
    }
  }

  return { videoRef, isPlaying, play, stop };
}
