<template>
    <div v-if="quiz" ref="containerRef" class="quiz-container" :style="containerStyle">
        <div class="timer-pill" :class="{ 'urgent': timeLeft <= 10 }" aria-hidden="false">
            <span class="time">{{ timeLeft }}</span>
            <span class="unit">秒</span>
        </div>
        <header ref="headerRef" class="quiz-header">
            <div class="header-row">
                <div class="qr-inline" aria-hidden="false">
                    <img :src="qrCodeUrl" alt="QR Code" class="qr-image qr-inline-image" />
                </div>
                <div class="header-content">
                    <div class="title-card" aria-hidden="false">
                        <h1 class="quiz-title">{{ quiz.title }}</h1>
                        <p class="quiz-content">{{ quiz.question }}</p>
                    </div>
                </div>
            </div>
        </header>
        <section ref="questionAreaRef" class="question-area" aria-live="polite">
            <div class="options-grid" :class="{ 'two-options': optionsCount === 2 }" role="list">
                <OptionCard v-for="(option, index) in optionsWithImageUrls" :key="index" :option="option" :index="index"
                    @select="selectOption" :style="{ '--option-color': option.color }" />
            </div>
        </section>
        <div v-if="showModal" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card">
                <h2 class="modal-title">終了！</h2>
                <p class="modal-body" v-if="isLoading">回答を取得中…</p>
                <p class="modal-body" v-else-if="errorMessage">{{ errorMessage }}</p>
                <p class="modal-body" v-else>集計完了。Enterで正解表示</p>
            </div>
        </div>
    </div>
    <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import type { QuizDto } from '../../../../model/applications/dtos/quiz-dto';
import { StartQuizUseCase } from '../../../../model/applications/use-cases/start-quiz-use-case';
import { StopQuizUseCase } from '../../../../model/applications/use-cases/stop-quiz-use-case';
import OptionCard from '../components/option-card.vue';
import { quizState } from '../../../../services/quizState';

const route = useRoute();
const router = useRouter();

const quizId = route.params.id as string;

// preview flag: determine from route params or route name (kept consistent with quiz-result.vue)
const isPreview = computed(() => {
    const paramPreview = (route.params as any)?.preview;
    if (paramPreview !== undefined) {
        if (typeof paramPreview === 'boolean') return paramPreview;
        return String(paramPreview) === 'true' || String(paramPreview) === '1';
    }
    if (String(route.name)?.endsWith('-preview')) return true;
    return false;
});

const quiz = ref<QuizDto | null>(null);

const timeLeft = ref(0);
const showModal = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;
const objectUrls = ref<string[]>([]);
const audioElement = ref<HTMLAudioElement | null>(null);
const bgmObjectUrl = ref<string | null>(null);

// Modal states
const isLoading = ref(false);
const canProceed = ref(false);
const errorMessage = ref<string | null>(null);

const qrCodeUrl = computed(() => {
    if (!quiz.value) return '';
    const q = quiz.value as QuizDto;
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(q.answerUrl)}`;
});

const optionsWithImageUrls = computed((): { no: number; text: string; color: string; imageUrl: string }[] => {
    if (!quiz.value) return [];
    return quiz.value.options.map((option: any, index: number) => {
        // Prefer already-created object URL from `objectUrls`; if absent, create from Blob
        // or use the string value. Use nullish coalescing to avoid `undefined` leaking
        // into `ref<string | null>` which is not allowed under `strictNullChecks`.
        const imageUrl = objectUrls.value[index] || (option.image ? URL.createObjectURL(option.image) : '');
        return {
            no: option.no,
            text: option.text,
            color: option.color,
            imageUrl,
        };
    });
});

const optionsCount = computed(() => optionsWithImageUrls.value.length);

// Layout: compute card height so the grid (2 columns) never overflows the viewport.
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
    let availableForRows = Math.max(0, winH - headerRect.bottom - paddingBottom - headerMarginBottom - safetyOffset);

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

onMounted(async () => {
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

    // Load quiz data
    const startQuizUseCase = container.resolve(StartQuizUseCase);
    quiz.value = await startQuizUseCase.execute(quizId);
    if (quiz.value) {
        timeLeft.value = quiz.value.timeLimit;
        // record quiz start time for result processing
        try {
            quizState.setStartTime();
        } catch (e) {
            console.warn('quizState.setStartTime failed', e);
        }


        startTimer();
        // Create object URLs for images
        objectUrls.value = quiz.value.options.map((option: any) => {
            return option.image ? URL.createObjectURL(option.image) : '';
        });
        // Play BGM if available
        if (quiz.value.bgm) {
            bgmObjectUrl.value = URL.createObjectURL(quiz.value.bgm);
            const audio = new Audio();
            audio.src = bgmObjectUrl.value;
            audio.loop = true;
            audio.play().catch(console.error); // 再生失敗を無視
            audioElement.value = audio;
        }
    }
    document.addEventListener('keydown', handleKeydown);
});

watch([optionsCount, () => quiz.value?.question], () => updateCardHeight());

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

    if (timer) clearInterval(timer);
    document.removeEventListener('keydown', handleKeydown);
    // Revoke object URLs to prevent memory leaks
    objectUrls.value.forEach(url => {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    });
    if (bgmObjectUrl.value && bgmObjectUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(bgmObjectUrl.value);
    }
    // Stop BGM
    if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value = null;
    }
});

// Prefer the parsed form id provided by the domain via DTO (answerFormId).

const startTimer = () => {
    // make the interval callback async so we can await the stop/process step
    timer = setInterval(async () => {
        timeLeft.value--;
        if (timeLeft.value <= 0) {
            if (timer) clearInterval(timer);
            // Stop BGM
            if (audioElement.value) {
                audioElement.value.pause();
                audioElement.value = null;
            }
            if (bgmObjectUrl.value && bgmObjectUrl.value.startsWith('blob:')) {
                URL.revokeObjectURL(bgmObjectUrl.value);
                bgmObjectUrl.value = null;
            }
            // Immediately show modal so UI reflects 0s instantly
            showModal.value = true;
            isLoading.value = true;
            canProceed.value = false;
            errorMessage.value = null;

            // Prefer parsed form id from DTO; do not parse in the component if possible.
            // Debug logs to trace why answerFormId may be missing.
            try {
                console.info('[stopAndGetProcessedResults] debug - quiz DTO:', quiz.value);
                console.info(
                    '[stopAndGetProcessedResults] debug - formUrl (answerUrl/formUrl):',
                    (quiz.value as any)?.answerUrl ?? (quiz.value as any)?.formUrl
                );
                console.info(
                    '[stopAndGetProcessedResults] debug - answerFormId:',
                    (quiz.value as any)?.answerFormId
                );
                console.info(
                    '[stopAndGetProcessedResults] debug - getFormId result:',
                    typeof (quiz.value as any)?.getFormId === 'function'
                        ? (quiz.value as any).getFormId()
                        : 'no-getFormId'
                );
            } catch (e) {
                console.warn('[stopAndGetProcessedResults] debug logging failed', e);
            }

            const formId = (quiz.value as any)?.answerFormId ?? null;

            if (!formId) {
                console.warn('[stopAndGetProcessedResults] no answerFormId available on DTO; skipping.');
                isLoading.value = false;
                canProceed.value = true;
            } else {
                console.info('[stopAndGetProcessedResults] about to call stopQuizUseCase for formId=', formId);
                const stopQuizUseCase = container.resolve(StopQuizUseCase);
                if (isPreview.value) {
                    console.info('[stopAndGetProcessedResults] preview mode: skipping for formId=', formId);
                    isLoading.value = false;
                    canProceed.value = true;
                } else {
                    // await the stop/process so we only enable Enter after work completes
                    const quizStartTimeMs = quizState.getStartTime() ?? Date.now();
                    const answerKey = '回答'; // Assuming the column is '回答'
                    const correctOption = quiz.value?.options.find((opt: any) => opt.no === quiz.value?.correctNo);
                    const correctValue = correctOption?.text || '';
                    try {
                        const results = await stopQuizUseCase.execute(formId, quizStartTimeMs, answerKey, correctValue);
                        console.log('[stopAndGetProcessedResults] succeeded for formId=', formId, 'results count=', Array.isArray(results) ? results.length : 'unknown');
                        try {
                            // Normalize cached results into ResultDto[] shape expected by results page
                            const normalized = (Array.isArray(results) ? results : []).map((r: any, idx: number) => {
                                const id = String(r.playerId ?? r.id ?? r.responseId ?? r.__responseId ?? (idx + 1));
                                const playerName = r.playerName ?? r.name ?? r.displayName ?? r.email ?? '匿名';
                                // time in ms: prefer timeToAnswerMs, then timestampMs-quizStartTimeMs, then time (may be seconds)
                                let timeMs: number | null = null;
                                if (typeof r.timeToAnswerMs === 'number') timeMs = Number(r.timeToAnswerMs);
                                else if (typeof r.timestampMs === 'number') timeMs = Number(r.timestampMs) - Number(quizStartTimeMs || Date.now());
                                else if (typeof r.time === 'number') {
                                    // if `time` looks like seconds (small), convert to ms heuristically
                                    timeMs = r.time > 1000 ? Number(r.time) : Number(r.time) * 1000;
                                }
                                const rank = typeof r.rank === 'number' ? r.rank : idx + 1;
                                return { id, playerName: String(playerName), time: Number.isFinite(timeMs) ? timeMs : null, rank };
                            });
                            quizState.setResults(normalized as any[]);
                        } catch (e) {
                            console.warn('Failed to normalize/cache results in quizState', e);
                            try { quizState.setResults(results as any[]); } catch (_) { /* ignore */ }
                        }
                        isLoading.value = false;
                        canProceed.value = true;
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        console.error('[stopAndGetProcessedResults] failed for formId=', formId, 'error=', msg);
                        errorMessage.value = '集計に失敗しました。';
                        isLoading.value = false;
                        canProceed.value = true; // Allow retry or proceed
                    }
                }
            }
        }
    }, 1000);
};

const selectOption = (index?: number) => {
    const idx = typeof index === 'number' ? index : -1;
    if (idx < 0) return;
    console.log('Selected option:', idx);
};

// prize image URL handling: handled in usePrizeOrchestrator

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && showModal.value && canProceed.value) {
        if (audioElement.value) {
            audioElement.value.pause();
            audioElement.value = null;
        }
        if (bgmObjectUrl.value && bgmObjectUrl.value.startsWith('blob:')) {
            URL.revokeObjectURL(bgmObjectUrl.value);
            bgmObjectUrl.value = null;
        }
        // Navigate to answer display page. Use the preview-specific route name when in preview mode
        // so downstream components that check the route name (`endsWith('-preview')`) keep
        // behaving in preview mode.
        router.push({ name: isPreview.value ? 'quiz-answer-preview' : 'quiz-answer', params: { id: quizId } });
    }
};
</script>
<style>
html,
body,
#app {
    height: 100%;
}

body {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

body::-webkit-scrollbar {
    width: 0;
    height: 0;
}
</style>

<style scoped>
:root {
    --card-bg: rgba(17, 24, 39, 0.65);
    --muted: rgba(255, 255, 255, 0.85);
}

.quiz-container {
    width: 100%;
    /* avoid 100vw + padding overflow */
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    position: relative;
}

.quiz-header {
    margin-bottom: 12px;
}

.header-row {
    display: flex;
    align-items: stretch;
    gap: 18px;
}

.header-content {
    flex: 1;
    display: flex;
    align-items: center;
}

.title-card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 20px 22px;
    width: 100%;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.5);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: center;
}

.quiz-title {
    font-size: 2.25rem;
    font-weight: 800;
    color: #ffd54a;
    margin: 0;
}

.timer-pill {
    position: absolute;
    top: 14px;
    right: 18px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--muted);
    padding: 14px 18px;
    min-width: 72px;
    min-height: 72px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-weight: 800;
    box-shadow: 0 10px 26px rgba(2, 6, 23, 0.6);
    transition: transform .18s ease, background-color .18s ease;
}

.timer-pill.urgent {
    background: linear-gradient(90deg, #ff6b6b, #ff3b3b);
    color: #fff;
    transform: scale(1.06);
}

.timer-pill .time {
    font-size: 2.2rem;
    line-height: 1;
}

.timer-pill .unit {
    font-size: .75rem;
    opacity: .85;
}

.question-area {
    text-align: center;
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}

.quiz-content {
    margin: 0;
    font-size: 1.375rem;
    color: var(--muted);
}

/* Grid: always 2 columns (2 x N rows). Narrow screens keep 2 columns as requested. */
.options-grid {
    display: grid;
    /* Always use 2 columns to keep the layout consistent (2 columns x N rows).
         Columns share available space equally. */
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(12px, 1.2vw, 24px);
    align-items: stretch;
    align-content: stretch;
    justify-items: stretch;
    /* Row height is driven by JS-calculated CSS variable so the grid never overflows. */
    /* `--card-height` is set on the container (px). */
    grid-auto-rows: var(--card-height);
    /* allow rows to be smaller when space is constrained */
    height: 100%;
    /* fill parent (.question-area) which is flex:1 */
    /* Use flex growth so this grid reliably fills the remaining vertical space
       even if header size changes. */
    flex: 1 1 auto;
}

.options-grid.two-options {
    grid-template-rows: 1fr;
    grid-auto-rows: unset;
}

/* When exactly two options are present, make each grid cell and its button fill the
   available height so the two options occupy the full area (no bottom gap). */
.options-grid.two-options>div {
    display: flex;
    align-items: stretch;
}

.options-grid.two-options .option-button {
    /* let the button stretch to full height of the grid cell */
    height: 100%;
    display: flex;
    flex-direction: column;
}

/* Remove the fixed aspect-ratio for image-wrapper in two-option layout so images
   can expand vertically to fill the card. */
.options-grid.two-options .image-wrapper {
    aspect-ratio: auto;
    height: 100%;
    min-height: 0;
    /* allow shrinking inside flex */
}

.options-grid.two-options .option-image {
    object-fit: cover;
    /* better visual fill when expanding */
    height: 100%;
}

.option-button {
    width: 100%;
    padding: 0;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    color: #fff;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.06));
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.55);
    transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
    font-weight: 900;
    text-align: left;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
}

.option-button:active {
    transform: translateY(2px) scale(.998);
}

.option-button:hover {
    transform: translateY(-6px);
    filter: brightness(1.03);
}

.image-wrapper {
    position: relative;
    width: 100%;
    display: block;
    overflow: hidden;
    border-radius: 16px;
    aspect-ratio: 11/5;
    background: var(--option-color, #334155);
}

.option-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    transform-origin: center;
    transition: transform 250ms ease;
    background-color: transparent;
}

.option-button:hover .option-image {
    transform: scale(1.02);
}

.option-index {
    position: absolute;
    top: 12px;
    left: 12px;
    min-width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--option-color, rgba(255, 255, 255, 0.12));
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.85rem;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 8px 18px rgba(2, 6, 23, 0.5);
    z-index: 3;
}

.text-ribbon {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 16px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
}

.option-text {
    font-size: 1rem;
    color: #fff;
    font-weight: 800;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 56px);
    padding: 6px 8px;
}

.qr-inline {
    display: flex;
    align-items: center;
    margin-right: 16px;
}

.qr-inline-image,
.qr-image {
    width: 168px;
    height: 168px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.55);
}

.modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(2, 6, 23, 0.72);
    z-index: 60;
}

.modal-card {
    background: linear-gradient(90deg, #ef4444, #fb7185);
    width: min(820px, 86%);
    max-width: 920px;
    min-height: 260px;
    padding: 56px;
    border-radius: 16px;
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    box-shadow: 0 28px 80px rgba(2, 6, 23, 0.7);
    transform: translateZ(0);
}

.modal-title {
    font-size: 3.2rem;
    line-height: 1;
    margin: 0 0 18px 0;
}

.modal-body {
    font-size: 1.25rem;
    margin: 0;
    opacity: .98;
}

.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-size: 1.5rem;
    color: #fff;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
}

/* Responsive tweaks at root level (previously nested incorrectly) */
@media (max-width:960px) {

    /* Keep two-column layout even on narrower screens; only adjust spacing and sizes. */
    .options-grid {
        /* keep grid-template-columns as 2 columns */
        gap: 8px;
        /* allow rows to size based on content on narrow viewports */
        grid-auto-rows: auto;
        height: auto;
    }

    .quiz-title {
        font-size: 1.6rem;
    }

    .question-text {
        font-size: 1.125rem;
        padding: 14px;
    }

    .timer-pill {
        right: 12px;
        top: 10px;
    }

    .qr-inline-image,
    .qr-image {
        width: 196px;
        height: 196px;
    }

    .option-button {
        padding: 22px 16px;
    }

    /* keep full-width images inside option cards on narrow screens */
}

@media (max-width:480px) {
    .quiz-container {
        height: calc(100vh - 80px);
    }

    .options-grid {
        gap: 8px;
    }

    .qr-inline-image,
    .qr-image {
        width: 134px;
        height: 134px;
    }

    /* keep full-width images inside option cards on very small screens */

    .option-index {
        min-width: 52px;
        height: 52px;
        font-size: 0.78rem;
        padding: 0 8px;
    }
}
</style>

<!-- Desktop-only overrides to increase option card height and adjust images -->
<style scoped>
@media (min-width: 1024px) {
    .options-grid {
        /* Desktop still uses the computed card height (may be larger). */
        grid-auto-rows: var(--card-height);
    }

    /* When two options are present, ensure each option has a reasonable minimum height */
    .options-grid.two-options>div {
        min-height: 360px;
    }

    .options-grid.two-options .option-button {
        min-height: 320px;
    }
}
</style>
