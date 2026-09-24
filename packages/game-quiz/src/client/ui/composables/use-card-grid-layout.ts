import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

/**
 * クイズ回答画面の選択肢グリッド(2列レイアウト)の1枚あたりの高さを、
 * ヘッダーとビューポートの残り高さから動的に計算し、常に画面内に収まる
 * ようにするcomposable。狭い画面(960px以下)ではCSS側の自動サイジングに
 * 任せ、この計算は行わない。
 */
export function useCardGridLayout(optionsCount: Ref<number>, extraWatchSource: () => unknown) {
  const containerRef = ref<HTMLElement | null>(null);
  const headerRef = ref<HTMLElement | null>(null);
  const questionAreaRef = ref<HTMLElement | null>(null);
  const cardHeight = ref<number>(180);

  const containerStyle = computed(() => {
    // when cardHeight is 0 (or falsy) we don't set the variable so CSS can take over (responsive "auto" case)
    if (!cardHeight.value) return {} as Record<string, string>;
    return { '--card-height': cardHeight.value + 'px' } as Record<string, string>;
  });

  // Small debounce helper to avoid thrashing on resize/image loads
  function debounce<T extends (...args: any[]) => void>(fn: T, wait = 50) {
    let t: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        fn(...args);
      }, wait);
    };
  }

  let ro: ResizeObserver | null = null;
  let optionsGridEl: HTMLElement | null = null;
  let imgLoadHandler: ((e: Event) => void) | null = null;

  const calcCardHeight = async () => {
    await nextTick();
    const containerEl = containerRef.value;
    const headerEl = headerRef.value;
    const questionEl = questionAreaRef.value;
    if (!containerEl || !headerEl || !questionEl) {
      cardHeight.value = 0;
      return;
    }

    // If narrow viewport (media query matches CSS override), let CSS size rows automatically
    const isNarrow = window.matchMedia('(max-width:960px)').matches;
    if (isNarrow) {
      cardHeight.value = 0;
      return;
    }

    const optionsEl = containerEl.querySelector('.options-grid') as HTMLElement | null;
    optionsGridEl = optionsEl;
    if (!optionsEl) {
      cardHeight.value = 0;
      return;
    }

    const winH = window.innerHeight;
    const headerRect = headerEl.getBoundingClientRect();

    const containerStyleComputed = getComputedStyle(containerEl);
    const paddingBottom = parseFloat(containerStyleComputed.paddingBottom || '0');

    const headerStyle = getComputedStyle(headerEl);
    const headerMarginBottom = parseFloat(headerStyle.marginBottom || '0');

    // base available space from bottom of header to bottom of viewport, minus container padding
    const safetyOffset = 8; // small safety margin for rounding
    const availableForRows = Math.max(
      0,
      winH - headerRect.bottom - paddingBottom - headerMarginBottom - safetyOffset
    );

    const rows = Math.max(1, Math.ceil(optionsCount.value / 2));

    const gridStyle = getComputedStyle(optionsEl);
    const rowGapPx = parseFloat(gridStyle.rowGap || gridStyle.gap || '0');
    const totalGaps = Math.max(0, rows - 1) * (isNaN(rowGapPx) ? 0 : rowGapPx);

    let h = Math.floor((availableForRows - totalGaps) / rows) - 4;

    const MIN_HEIGHT = 120; // recommended minimum for readability and tap targets
    if (h < MIN_HEIGHT) h = MIN_HEIGHT;

    cardHeight.value = h;
  };

  const updateCardHeight = debounce(() => {
    void calcCardHeight();
  }, 48);

  onMounted(() => {
    // initial calc and bind resize
    updateCardHeight();
    window.addEventListener('resize', updateCardHeight);

    // ResizeObserver to catch layout changes (images, fonts, grid changes)
    try {
      ro = new ResizeObserver(updateCardHeight);
      if (containerRef.value) ro.observe(containerRef.value);
      if (headerRef.value) ro.observe(headerRef.value);
      const opts = containerRef.value?.querySelector('.options-grid') as HTMLElement | null;
      if (opts) {
        ro.observe(opts);
        optionsGridEl = opts;
      }
    } catch (e) {
      // ResizeObserver may not be available in some test envs — fall back to window resize
      console.warn('ResizeObserver unavailable', e);
    }

    // Listen for image load events inside the options grid — when images finish loading heights can change
    imgLoadHandler = () => updateCardHeight();
    if (optionsGridEl) optionsGridEl.addEventListener('load', imgLoadHandler, true);
  });

  watch([optionsCount, extraWatchSource], () => updateCardHeight());

  onUnmounted(() => {
    window.removeEventListener('resize', updateCardHeight);
    if (ro) {
      try {
        ro.disconnect();
      } catch (e) {
        /* ignore */
      }
      ro = null;
    }
    if (optionsGridEl && imgLoadHandler) {
      optionsGridEl.removeEventListener('load', imgLoadHandler, true);
      optionsGridEl = null;
      imgLoadHandler = null;
    }
  });

  return { containerRef, headerRef, questionAreaRef, containerStyle };
}
