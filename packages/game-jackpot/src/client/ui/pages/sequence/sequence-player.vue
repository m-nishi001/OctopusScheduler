<template>
    <div class="seq-container" data-testid="sequence" :style="containerStyle">
        <div v-if="current" :key="currentIndex" class="seq-item" :class="{ 'is-image': current.kind === '画像' }" data-testid="seq-item" :data-index="currentIndex"
            :data-effect="current.effect" :data-page="page" :data-pages="pages">
            <!-- 行送りは「lines 行ぶんの窓」の中で本文を上へずらす。ほかは本文そのものを中央に置いて動かす -->
            <div class="seq-window" :class="{ 'is-lines': current.effect === '行送り' && current.kind === 'テキスト' }"
                :style="windowStyle">
                <div ref="bodyEl" class="seq-body" :style="bodyStyle">
                    <!-- テキストは文字として出す(HTML として解釈しない) -->
                    <div v-if="current.kind === 'テキスト'" class="seq-text" data-testid="seq-text">{{ current.text }}</div>
                    <img v-else-if="current.imageUrl" :src="current.imageUrl" class="seq-image" data-testid="seq-image" alt="" />
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, type PropType } from 'vue';
import { useRouter } from 'vue-router';
import { useSound } from '@octopus/composables/use-sound';
import type { SoundSource } from '@octopus/client-common/audio/sound-system';
import { useJackpotSession } from '../../composables/use-jackpot-session';
import type { SequenceItem, SequenceSettings } from '@model/screen-config/sequence-setting';
import { loadEdgeColor } from '../../composables/load-edge-color';
import { buildTimeline, pageAt, sampleTimeline, type Timeline } from '@model/sequence-timeline';

/** 行送りの1行の高さ(em)。窓の高さ(lines × この値)と、本文の line-height を同じ値にして、行の境目で送る。 */
const LINE_HEIGHT_EM = 1.6;

/** timeline を実時間で進める。毎フレーム時刻 t(秒)を渡す。cancel() で止まり、止まったら resolve する。 */
function runTimeline(timeline: Timeline, onFrame: (t: number) => void, isCancelled: () => boolean): Promise<void> {
    return new Promise((resolve) => {
        const start = performance.now();
        const tick = () => {
            if (isCancelled()) return resolve();
            const t = (performance.now() - start) / 1000;
            onFrame(Math.min(t, timeline.duration));
            if (t >= timeline.duration) return resolve();
            requestAnimationFrame(tick);
        };
        tick();
    });
}

export default {
    name: 'SequencePlayer',
    props: {
        config: { type: Object as PropType<SequenceSettings>, required: true },
        autoNavigate: { type: Boolean, default: true },
        nextRoute: { type: String, default: '/jackpot-description' },
    },
    emits: ['finished'],
    setup(props, { emit }) {
        const router = useRouter();
        const session = useJackpotSession();
        const bodyEl = ref<HTMLElement | null>(null);
        const currentIndex = ref(-1);
        /** 画像のページの外側の色(画像の縁の色)。求められない・画像でないときは null(既存の暗い背景のまま)。 */
        const edge = ref<string | null>(null);
        const y = ref(0);
        const opacity = ref(0);
        const page = ref(0);
        const pages = ref(1);
        let cancelled = false;

        const current = computed<SequenceItem | null>(() => props.config.items[currentIndex.value] ?? null);

        const isLines = computed(() => current.value?.effect === '行送り' && current.value.kind === 'テキスト');
        const windowStyle = computed(() => (isLines.value ? { height: `${(current.value?.lines ?? 3) * LINE_HEIGHT_EM}em` } : {}));
        const containerStyle = computed(() => (edge.value ? { background: edge.value } : {}));
        const bodyStyle = computed(() => ({ transform: `translateY(${y.value}px)`, opacity: opacity.value }));

        // 効果音は、音の中心(SoundSystem)の effect チャンネルで鳴らす(重ねて鳴らせる。止めない。鳴らなくても進める)。先に読み込んでおき、項目の始めで遅れないようにする
        const { effect } = useSound();
        const seSource = (url: string): SoundSource => ({ key: url, load: async () => (await fetch(url)).blob() });
        for (const item of props.config.items) if (item.seUrl) void effect.preload(seSource(item.seUrl));
        const playSe = (item: SequenceItem) => {
            if (item.seUrl) void effect.play(seSource(item.seUrl));
        };

        const waitForImage = (el: HTMLElement | null) =>
            new Promise<void>((resolve) => {
                const img = el?.querySelector('img');
                if (!img || img.complete) return resolve();
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
            });

        const playItem = async (item: SequenceItem, index: number) => {
            opacity.value = 0;
            y.value = 0;
            page.value = 0;
            pages.value = 1;
            edge.value = item.kind === '画像' && item.imageUrl ? await loadEdgeColor(item.imageUrl) : null;
            if (cancelled) return;
            currentIndex.value = index;
            await nextTick();
            await waitForImage(bodyEl.value);
            if (cancelled) return;
            const body = bodyEl.value;
            const stage = body?.closest('.seq-container') as HTMLElement | null;
            const fontSize = body ? parseFloat(getComputedStyle(body).fontSize) || 32 : 32;
            const timeline = buildTimeline(
                { kind: item.kind, effect: item.effect, seconds: item.seconds, lines: item.lines ?? 3 },
                {
                    viewportHeight: stage?.clientHeight || window.innerHeight,
                    contentHeight: body?.offsetHeight || 0,
                    lineHeight: fontSize * LINE_HEIGHT_EM,
                }
            );
            pages.value = timeline.pages;
            playSe(item);
            await runTimeline(
                timeline,
                (t) => {
                    const s = sampleTimeline(timeline, t);
                    y.value = s.y;
                    opacity.value = s.opacity;
                    page.value = pageAt(timeline, t);
                },
                () => cancelled
            );
        };

        const start = async () => {
            const items = props.config.items;
            for (let i = 0; i < items.length; i++) {
                if (cancelled) return;
                await playItem(items[i], i);
            }
            if (cancelled) return;
            // 最後の項目が消えたあとに残像が出ないよう、遷移や通知の前にすべて隠す
            currentIndex.value = -1;
            emit('finished');
            if (props.autoNavigate) void router.push(session.to(props.nextRoute));
        };

        onMounted(() => void start());
        onUnmounted(() => {
            cancelled = true;
        });

        return { bodyEl, containerStyle, current, currentIndex, page, pages, windowStyle, bodyStyle };
    },
};
</script>

<style scoped>
.seq-container {
    position: relative;
    height: 100vh;
    overflow: hidden;
    background: black;
    color: #fff;
    text-align: center;
    /* 会場のスクリーンで遠くから読める大きさ(画面の幅に比例。小さい画面でも 1.75rem 以上) */
    font-size: clamp(1.75rem, 3.6vw, 4.5rem);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.seq-item {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 86%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
}

/* 画像のページは画面いっぱい(外側の色は画像の縁の色) */
.seq-item.is-image {
    width: 100%;
    height: 100%;
}

.seq-window {
    width: 100%;
}

/* 行送り: lines 行ぶんの窓の外は見せない。本文は窓の上端から並べる */
.seq-window.is-lines {
    overflow: hidden;
}

.seq-body {
    width: 100%;
    will-change: transform, opacity;
}

.seq-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.6em;
}

/* 画像は、比率を保ったまま画面いっぱいに出す(小さい画像も大きく映す) */
.seq-image {
    width: 100%;
    height: 100vh;
    object-fit: contain;
    display: block;
    margin: 0 auto;
}
</style>
