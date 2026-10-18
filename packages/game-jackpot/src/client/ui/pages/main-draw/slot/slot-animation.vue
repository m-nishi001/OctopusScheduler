<template>
    <div class="slot-container jp-frame" ref="container" :class="{ spinning }" :style="sizeVars">
        <div class="slot-reels">
            <div class="reel" v-for="(reel, index) in reels" :key="index">
                <div class="reel-content" :style="{ transform: `translateY(${-reel.position}px)` }">
                    <div v-for="slot in strip" :key="slot.key" class="prize-item">
                        {{ slot.name }}
                    </div>
                </div>
            </div>
        </div>
        <div v-if="showResult" class="result">{{ selectedPrize?.name }}</div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAudio } from '@octopus/composables/use-audio';
import '../../../theme/jackpot-theme.css';
import type { PrizeDto } from '@control/prize/dto/prize-dto';
import type { AnimationRef } from './animation-types';
import { advancePosition, buildLoop, cycleHeight, indexInLoop, positionForIndex, renderedCount } from './reel-model';

export default {
    name: 'SlotAnimation',
    props: {
        prizes: { type: Array as () => PrizeDto[], default: () => [] },
        selectedPrize: { type: Object as () => PrizeDto | null, default: null },
        showResult: { type: Boolean, default: false },
    },
    emits: ['stopped'],
    setup(props, { emit, expose }) {
        const spinning = ref(false);
        const container = ref<HTMLElement | null>(null);
        let resizeObserver: ResizeObserver | null = null;
        let animationId: number | null = null;
        // useAudio を使って BGM を再生
        const { load: loadBgm, play: playBgm, stop: stopBgm } = useAudio({ mode: 'html-audio' });
        // position は「上へ流れた距離(px)」。ループ1周で元に戻る(位置計算は reel-model.ts)。
        const reels = ref([
            { position: 0, speed: 0 },
            { position: 0, speed: 0 },
            { position: 0, speed: 0 },
        ]);

        const loop = computed(() => buildLoop(props.prizes));
        // 描画は「ループ + 窓の高さ分」。窓が帯の外(黒)を映さないので、1周の継ぎ目が見えない。
        const strip = computed(() =>
            Array.from({ length: renderedCount(loop.value.length) }, (_, k) => ({
                key: k,
                name: loop.value[k % loop.value.length].name,
            }))
        );

        const itemHeight = ref(60);

        // 筐体の大きさは画面の高さに合わせる(投影の1080pでも見映えがするよう、既定60pxから拡大)。
        // リール内の位置計算(itemHeight)と見た目のCSS変数は同じ値を使う。
        const updateItemHeight = () => {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
            itemHeight.value = Math.max(64, Math.min(170, Math.round(vh * 0.13)));
        };

        const sizeVars = computed(() => ({
            '--slot-item-h': `${itemHeight.value}px`,
            '--slot-reel-h': `${itemHeight.value * 3}px`,
            '--slot-reel-w': `${Math.round(itemHeight.value * 2.6)}px`,
            '--slot-font': `${Math.round(itemHeight.value * 0.34)}px`,
        }));

        const startSpin = async (bgmUrl?: Blob | null) => {
            console.log('[SlotAnimation] startSpin: bgmUrl=', bgmUrl ? { size: bgmUrl.size, type: bgmUrl.type } : null);
            if (bgmUrl) {
                try {
                    await stopBgm();
                    await loadBgm(bgmUrl);
                    await playBgm({ isRepeat: true });
                } catch { /* ignore */ }
            }
            spinning.value = true;
            reels.value.forEach((reel, index) => {
                reel.speed = 10 + index * 2; // 少しずつ遅く
            });
        };

        const stopSpin = async (durationSec?: number, targetPrizeId?: string | null) => {
            return new Promise<string | null>((resolve) => {
                let stoppedCount = 0;
                const totalReels = reels.value.length;

                const stopReel = (index: number) => {
                    if (index >= totalReels) return;
                    setTimeout(() => {
                        reels.value[index].speed = 0;
                        const targetId = targetPrizeId ?? props.selectedPrize?.id ?? null;
                        const found = indexInLoop(loop.value, targetId);
                        const targetIndex = found >= 0 ? found : Math.floor(Math.random() * loop.value.length);
                        reels.value[index].position = positionForIndex(
                            targetIndex,
                            itemHeight.value,
                            cycleHeight(loop.value.length, itemHeight.value)
                        );
                        stoppedCount++;
                        if (stoppedCount === totalReels) {
                            spinning.value = false;
                            stopBgm().catch(() => { });
                            setTimeout(() => {
                                const prizeId = targetId || null;
                                emit('stopped', prizeId);
                                resolve(prizeId);
                            }, 1000);
                        } else {
                            stopReel(index + 1);
                        }
                    }, 500 * (index + 1));
                };
                stopReel(0);
            });
        };

        // runAutoReroll removed — use startSpin/stopSpin flow via parent orchestrator if needed

        // アニメーションループ
        const animate = () => {
            const cycle = cycleHeight(loop.value.length, itemHeight.value);
            reels.value.forEach(reel => {
                if (reel.speed > 0) reel.position = advancePosition(reel.position, reel.speed, cycle);
            });
            animationId = requestAnimationFrame(animate);
        };

        onMounted(() => {
            updateItemHeight();
            resizeObserver = new ResizeObserver(() => {
                updateItemHeight();
            });
            if (container.value) {
                resizeObserver.observe(container.value);
            }
            animate();
        });

        onUnmounted(() => {
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            stopBgm().catch(() => { });
        });

        // Options API の setup() では defineExpose は使えない(何もしない)ので、context の expose を使う。
        // これが無いと親から startSpin/stopSpin が見えず、景品抽選を開始しても何も動かない。
        expose({ startSpin, stopSpin } satisfies AnimationRef);

        return { spinning, reels, strip, sizeVars };
    }
};
</script>

<style scoped>
.slot-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(24px, 4vh, 48px);
}

.slot-reels {
    display: flex;
    gap: clamp(14px, 2vh, 28px);
    margin-bottom: 20px;
}

.reel {
    width: var(--slot-reel-w, 120px);
    height: var(--slot-reel-h, 180px);
    background: #000;
    border: 3px solid #FFD700;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
}

.reel-content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    transition: transform 0.1s ease-out;
}

.prize-item {
    height: var(--slot-item-h, 60px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFD700;
    font-weight: bold;
    font-size: var(--slot-font, 18px);
    padding: 0 8px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.8);
    border-bottom: 1px solid #FFD700;
}

.spinning .reel-content {
    transition: none;
}

.result {
    font-size: calc(var(--slot-font, 18px) * 1.5);
    color: #FFD700;
    font-weight: bold;
    text-shadow: 0 0 15px #FFD700;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px 20px;
    border-radius: 10px;
    border: 2px solid #FFD700;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    animation: resultPop 0.5s ease-out;
}

@keyframes resultPop {
    0% {
        transform: scale(0);
        opacity: 0;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>