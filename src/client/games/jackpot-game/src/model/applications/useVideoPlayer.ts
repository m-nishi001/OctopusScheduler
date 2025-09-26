import { ref } from 'vue';

export function useVideoPlayer() {
  const video = ref<HTMLVideoElement | null>(null);
  const isPlaying = ref(false);

  function play(src: string) {
    if (!video.value) {
      video.value = document.createElement('video');
      video.value.src = src;
      video.value.onended = () => { isPlaying.value = false; };
    } else {
      video.value.src = src;
    }
    video.value.play();
    isPlaying.value = true;
  }

  function pause() {
    if (video.value) {
      video.value.pause();
      isPlaying.value = false;
    }
  }

  function stop() {
    if (video.value) {
      video.value.pause();
      video.value.currentTime = 0;
      isPlaying.value = false;
    }
  }

  return { video, isPlaying, play, pause, stop };
}
