import { ref } from 'vue';

export function useImage() {
  const imageUrl = ref('');
  const isVisible = ref(false);
  const fadeOutTimer = ref<number | null>(null);

  function show(src: string) {
    imageUrl.value = src;
    isVisible.value = true;
  }

  function hide(fadeOutDuration?: number) {
    if (fadeOutDuration && fadeOutDuration > 0) {
      // フェードアウト用のCSSを適用する場合は、呼び出し元で制御
      fadeOutTimer.value = window.setTimeout(() => {
        isVisible.value = false;
        imageUrl.value = '';
      }, fadeOutDuration);
    } else {
      isVisible.value = false;
      imageUrl.value = '';
    }
  }

  return { imageUrl, isVisible, show, hide };
}
