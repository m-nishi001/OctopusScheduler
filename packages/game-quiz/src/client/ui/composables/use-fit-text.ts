import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import { largestFittingScale } from '../../model/option-size';

/**
 * `text` が自分の枠に収まるまで、CSS 変数 `--option-fit` を下げて文字を縮める。
 * 枠(`frame`)の大きさの変化、`source` の変化、フォントの読み込み完了のたびに測り直す。
 * `frame` は文字の大きさに左右されない要素にする(左右されると、測り直しが繰り返される)。
 */
export function useFitText(frame: Ref<HTMLElement | null>, text: Ref<HTMLElement | null>, source: () => unknown) {
  const fit = () => {
    const el = text.value;
    if (!el) return;
    const apply = (scale: number) => el.style.setProperty('--option-fit', String(scale));
    apply(
      largestFittingScale((scale) => {
        apply(scale);
        return el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth;
      })
    );
  };

  let observer: ResizeObserver | null = null;

  onMounted(() => {
    // 監視を始めた直後にも1回呼ばれるので、最初の調整もここで行われる
    if (typeof ResizeObserver !== 'undefined' && frame.value) {
      observer = new ResizeObserver(fit);
      observer.observe(frame.value);
    }
    void document.fonts?.ready.then(fit);
  });

  watch(source, fit, { flush: 'post' });

  onUnmounted(() => observer?.disconnect());
}
